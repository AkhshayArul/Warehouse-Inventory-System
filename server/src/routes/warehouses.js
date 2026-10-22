const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/warehouses
// Admin sees all warehouses; Manager & Staff can view warehouses list (for reference or their own)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        w.warehouse_id,
        w.warehouse_name,
        w.location,
        w.manager_id,
        u.full_name AS manager_name,
        u.email AS manager_email,
        u.phone AS manager_phone,
        COUNT(DISTINCT i.product_id) AS distinct_products_count,
        COALESCE(SUM(i.quantity), 0) AS total_units_in_stock
      FROM warehouses w
      LEFT JOIN users u ON w.manager_id = u.user_id
      LEFT JOIN inventory i ON w.warehouse_id = i.warehouse_id
    `;
    const params = [];

    // If staff or manager, they can still view their assigned warehouse, or all basic names for reference
    // For admin, view everything with full stats
    if (req.user.role !== 'admin' && req.query.assigned_only === 'true') {
      query += ` WHERE w.warehouse_id = ?`;
      params.push(req.user.warehouse_id);
    }

    query += ` GROUP BY w.warehouse_id, w.warehouse_name, w.location, w.manager_id, u.full_name, u.email, u.phone ORDER BY w.warehouse_id ASC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Fetch warehouses error:', err);
    res.status(500).json({ message: 'Error retrieving warehouses.' });
  }
});

// GET /api/warehouses/:id
router.get('/:id', authenticateToken, async (req, res) => {
  const warehouseId = parseInt(req.params.id, 10);
  if (req.user.role !== 'admin' && req.user.warehouse_id !== warehouseId) {
    return res.status(403).json({ message: 'Access denied to this warehouse.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT w.warehouse_id, w.warehouse_name, w.location, w.manager_id,
              u.full_name AS manager_name, u.email AS manager_email, u.phone AS manager_phone
       FROM warehouses w
       LEFT JOIN users u ON w.manager_id = u.user_id
       WHERE w.warehouse_id = ?`,
      [warehouseId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Warehouse not found.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Get warehouse error:', err);
    res.status(500).json({ message: 'Error retrieving warehouse details.' });
  }
});

// POST /api/warehouses (Admin only)
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  const { warehouse_name, location, manager_id } = req.body;

  if (!warehouse_name || !location || !manager_id) {
    return res.status(400).json({ message: 'Warehouse name, location, and manager are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Verify manager exists and has role 'manager'
    const [mgrRows] = await conn.query(
      `SELECT user_id, role, warehouse_id FROM users WHERE user_id = ?`,
      [manager_id]
    );

    if (mgrRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Selected manager does not exist.' });
    }

    if (mgrRows[0].role !== 'manager') {
      await conn.rollback();
      return res.status(400).json({ message: 'The selected user must have the Warehouse Manager role.' });
    }

    // 2. Check if manager is already assigned to manage another warehouse
    const [existingManaged] = await conn.query(
      `SELECT warehouse_id, warehouse_name FROM warehouses WHERE manager_id = ?`,
      [manager_id]
    );

    if (existingManaged.length > 0) {
      await conn.rollback();
      return res.status(400).json({ 
        message: `This user is already managing warehouse '${existingManaged[0].warehouse_name}'. A manager can only manage one warehouse.` 
      });
    }

    // 3. Insert warehouse
    const [insertResult] = await conn.query(
      `INSERT INTO warehouses (warehouse_name, location, manager_id) VALUES (?, ?, ?)`,
      [warehouse_name.trim(), location.trim(), manager_id]
    );

    const newWarehouseId = insertResult.insertId;

    // 4. Update the manager's warehouse_id
    await conn.query(
      `UPDATE users SET warehouse_id = ? WHERE user_id = ?`,
      [newWarehouseId, manager_id]
    );

    await conn.commit();
    res.status(201).json({
      message: 'Warehouse created successfully.',
      warehouse_id: newWarehouseId
    });
  } catch (err) {
    await conn.rollback();
    console.error('Create warehouse error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'A warehouse with this name already exists.' });
    }
    res.status(500).json({ message: 'Failed to create warehouse.' });
  } finally {
    conn.release();
  }
});

// PUT /api/warehouses/:id (Admin only)
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const warehouseId = parseInt(req.params.id, 10);
  const { warehouse_name, location, manager_id } = req.body;

  if (!warehouse_name || !location || !manager_id) {
    return res.status(400).json({ message: 'Warehouse name, location, and manager are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check warehouse exists
    const [wRows] = await conn.query(
      `SELECT warehouse_id, manager_id FROM warehouses WHERE warehouse_id = ?`,
      [warehouseId]
    );

    if (wRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Warehouse not found.' });
    }

    const currentManagerId = wRows[0].manager_id;

    // Verify new manager
    const [mgrRows] = await conn.query(
      `SELECT user_id, role FROM users WHERE user_id = ?`,
      [manager_id]
    );

    if (mgrRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Selected manager does not exist.' });
    }

    if (mgrRows[0].role !== 'manager') {
      await conn.rollback();
      return res.status(400).json({ message: 'The assigned user must have the Warehouse Manager role.' });
    }

    // Check if new manager is already managing another warehouse
    const [otherManaged] = await conn.query(
      `SELECT warehouse_id, warehouse_name FROM warehouses WHERE manager_id = ? AND warehouse_id != ?`,
      [manager_id, warehouseId]
    );

    if (otherManaged.length > 0) {
      await conn.rollback();
      return res.status(400).json({ 
        message: `Manager is already assigned to '${otherManaged[0].warehouse_name}'.` 
      });
    }

    // Update warehouse
    await conn.query(
      `UPDATE warehouses SET warehouse_name = ?, location = ?, manager_id = ? WHERE warehouse_id = ?`,
      [warehouse_name.trim(), location.trim(), manager_id, warehouseId]
    );

    // If manager changed, update warehouse_id of both old and new manager
    if (currentManagerId !== manager_id) {
      await conn.query(`UPDATE users SET warehouse_id = NULL WHERE user_id = ?`, [currentManagerId]);
      await conn.query(`UPDATE users SET warehouse_id = ? WHERE user_id = ?`, [warehouseId, manager_id]);
    } else {
      await conn.query(`UPDATE users SET warehouse_id = ? WHERE user_id = ?`, [warehouseId, manager_id]);
    }

    await conn.commit();
    res.json({ message: 'Warehouse updated successfully.' });
  } catch (err) {
    await conn.rollback();
    console.error('Update warehouse error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'A warehouse with this name already exists.' });
    }
    res.status(500).json({ message: 'Failed to update warehouse.' });
  } finally {
    conn.release();
  }
});

// DELETE /api/warehouses/:id (Admin only - Prevent Unsafe Deletion)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const warehouseId = parseInt(req.params.id, 10);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Check for dependent inventory records with non-zero quantity or existing rows
    const [invRows] = await conn.query(
      `SELECT COUNT(*) AS total_items, COALESCE(SUM(quantity), 0) AS total_units 
       FROM inventory WHERE warehouse_id = ?`,
      [warehouseId]
    );

    if (invRows[0].total_items > 0) {
      await conn.rollback();
      return res.status(400).json({
        message: `Cannot delete warehouse: It still contains ${invRows[0].total_items} inventory record(s) with ${invRows[0].total_units} total units. Clear inventory first.`
      });
    }

    // 2. Check for dependent stock movements
    const [smRows] = await conn.query(
      `SELECT COUNT(*) AS count FROM stock_movements WHERE warehouse_id = ?`,
      [warehouseId]
    );

    if (smRows[0].count > 0) {
      await conn.rollback();
      return res.status(400).json({
        message: `Cannot delete warehouse: Audit trail contains ${smRows[0].count} historical stock movement record(s). Unsafe deletion prevented.`
      });
    }

    // Unlink any users assigned to this warehouse before deleting
    await conn.query(`UPDATE users SET warehouse_id = NULL WHERE warehouse_id = ?`, [warehouseId]);

    // Delete warehouse
    await conn.query(`DELETE FROM warehouses WHERE warehouse_id = ?`, [warehouseId]);

    await conn.commit();
    res.json({ message: 'Warehouse safely removed.' });
  } catch (err) {
    await conn.rollback();
    console.error('Delete warehouse error:', err);
    res.status(500).json({ message: 'Failed to delete warehouse: ' + err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
