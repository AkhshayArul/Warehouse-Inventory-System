const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All user management routes require admin role
router.use(authenticateToken, requireRole('admin'));

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const { role, warehouse_id, search } = req.query;
    let query = `
      SELECT 
        u.user_id,
        u.full_name,
        u.email,
        u.phone,
        u.role,
        u.warehouse_id,
        w.warehouse_name,
        w.manager_id,
        CASE WHEN w.manager_id = u.user_id THEN 1 ELSE 0 END AS is_warehouse_manager
      FROM users u
      LEFT JOIN warehouses w ON u.warehouse_id = w.warehouse_id
      WHERE 1=1
    `;
    const params = [];

    if (role) {
      query += ` AND u.role = ?`;
      params.push(role);
    }

    if (warehouse_id) {
      query += ` AND u.warehouse_id = ?`;
      params.push(warehouse_id);
    }

    if (search) {
      query += ` AND (u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY u.user_id ASC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ message: 'Error retrieving user list.' });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  const { full_name, email, password, phone, role, warehouse_id } = req.body;

  if (!full_name || !email || !password || !role) {
    return res.status(400).json({ message: 'Full name, email, password, and role are required.' });
  }

  if (!['admin', 'manager', 'staff'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role specified.' });
  }

  if ((role === 'staff' || role === 'manager') && !warehouse_id) {
    return res.status(400).json({ message: 'Warehouse assignment is required for staff and manager roles.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const assignedWarehouse = role === 'admin' ? (warehouse_id || null) : warehouse_id;

    // If role is manager, check if warehouse already has a different manager assigned
    if (role === 'manager' && assignedWarehouse) {
      const [wCheck] = await pool.query(
        `SELECT manager_id, warehouse_name FROM warehouses WHERE warehouse_id = ?`,
        [assignedWarehouse]
      );
      if (wCheck.length > 0 && wCheck[0].manager_id) {
        // Warehouse already has a manager
        return res.status(400).json({
          message: `Warehouse '${wCheck[0].warehouse_name}' already has a designated manager. Each warehouse can only have one manager.`
        });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, phone, role, warehouse_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [full_name.trim(), email.trim().toLowerCase(), passwordHash, phone || null, role, assignedWarehouse]
    );

    const newUserId = result.insertId;

    // If manager, link to warehouse table as manager_id if it was unmanaged
    if (role === 'manager' && assignedWarehouse) {
      await pool.query(
        `UPDATE warehouses SET manager_id = ? WHERE warehouse_id = ? AND (manager_id IS NULL OR manager_id = 0)`,
        [newUserId, assignedWarehouse]
      );
    }

    res.status(201).json({
      message: 'User created successfully.',
      user_id: newUserId
    });
  } catch (err) {
    console.error('Create user error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'A user with this email address already exists.' });
    }
    res.status(500).json({ message: 'Failed to create user.' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { full_name, email, phone, role, warehouse_id, new_password } = req.body;

  if (!full_name || !email || !role) {
    return res.status(400).json({ message: 'Full name, email, and role are required.' });
  }

  if (!['admin', 'manager', 'staff'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role specified.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query(`SELECT * FROM users WHERE user_id = ?`, [userId]);
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'User not found.' });
    }

    // Check if user is currently assigned as manager in warehouses table
    const [managedWh] = await conn.query(
      `SELECT warehouse_id, warehouse_name FROM warehouses WHERE manager_id = ?`,
      [userId]
    );

    const isCurrentManager = managedWh.length > 0;
    const targetWarehouse = role === 'admin' ? null : (warehouse_id || null);

    if (isCurrentManager && role !== 'manager') {
      await conn.rollback();
      return res.status(400).json({
        message: `Cannot change role: This user is currently the active manager of '${managedWh[0].warehouse_name}'. Reassign warehouse manager first.`
      });
    }

    if (isCurrentManager && role === 'manager' && targetWarehouse && targetWarehouse !== managedWh[0].warehouse_id) {
      await conn.rollback();
      return res.status(400).json({
        message: `This user manages '${managedWh[0].warehouse_name}'. You must reassign warehouse leadership in the Warehouse Management section before moving warehouses.`
      });
    }

    let passwordHash = existing[0].password_hash;
    if (new_password && new_password.trim().length > 0) {
      passwordHash = await bcrypt.hash(new_password.trim(), 10);
    }

    await conn.query(
      `UPDATE users 
       SET full_name = ?, email = ?, password_hash = ?, phone = ?, role = ?, warehouse_id = ?
       WHERE user_id = ?`,
      [full_name.trim(), email.trim().toLowerCase(), passwordHash, phone || null, role, targetWarehouse, userId]
    );

    await conn.commit();
    res.json({ message: 'User details updated successfully.' });
  } catch (err) {
    await conn.rollback();
    console.error('Update user error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Email address is already in use by another account.' });
    }
    res.status(500).json({ message: 'Failed to update user.' });
  } finally {
    conn.release();
  }
});

// DELETE /api/users/:id (Prevent unsafe deletion)
router.delete('/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);

  if (userId === req.user.user_id) {
    return res.status(400).json({ message: 'You cannot delete your own account.' });
  }

  try {
    // 1. Check if user is active warehouse manager
    const [wh] = await pool.query(
      `SELECT warehouse_name FROM warehouses WHERE manager_id = ?`,
      [userId]
    );
    if (wh.length > 0) {
      return res.status(400).json({
        message: `Cannot delete user: Active manager of '${wh[0].warehouse_name}'. Reassign the warehouse manager first.`
      });
    }

    // 2. Check if user recorded stock movements
    const [sm] = await pool.query(
      `SELECT COUNT(*) AS count FROM stock_movements WHERE user_id = ?`,
      [userId]
    );
    if (sm[0].count > 0) {
      return res.status(400).json({
        message: `Cannot delete user: Associated with ${sm[0].count} historical stock movement transaction(s). Required for audit integrity.`
      });
    }

    // 3. Check if user created products
    const [pr] = await pool.query(
      `SELECT COUNT(*) AS count FROM products WHERE created_by = ?`,
      [userId]
    );
    if (pr[0].count > 0) {
      return res.status(400).json({
        message: `Cannot delete user: Author of ${pr[0].count} product catalog item(s).`
      });
    }

    await pool.query(`DELETE FROM users WHERE user_id = ?`, [userId]);
    res.json({ message: 'User account safely removed.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Failed to delete user: ' + err.message });
  }
});

module.exports = router;
