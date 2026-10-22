const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/movements
// Scoped by role:
// - Admin: can view all movements, filter by warehouse, user, product, type, date
// - Manager: can view all movements for their assigned warehouse
// - Staff: can view their own movements or movements in their assigned warehouse
router.get('/', async (req, res) => {
  const { warehouse_id, product_id, user_id, movement_type, search, own_only } = req.query;

  try {
    let query = `
      SELECT 
        sm.movement_id,
        sm.warehouse_id,
        w.warehouse_name,
        sm.product_id,
        p.product_name,
        p.sku,
        p.category,
        sm.user_id,
        u.full_name AS user_name,
        u.email AS user_email,
        u.role AS user_role,
        sm.movement_type,
        sm.quantity,
        sm.reference_number,
        sm.notes,
        sm.movement_date
      FROM stock_movements sm
      JOIN warehouses w ON sm.warehouse_id = w.warehouse_id
      JOIN products p ON sm.product_id = p.product_id
      JOIN users u ON sm.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    // Authorization scopes
    if (req.user.role === 'staff') {
      if (own_only === 'true') {
        query += ` AND sm.user_id = ?`;
        params.push(req.user.user_id);
      } else {
        query += ` AND sm.warehouse_id = ?`;
        params.push(req.user.warehouse_id);
      }
    } else if (req.user.role === 'manager') {
      query += ` AND sm.warehouse_id = ?`;
      params.push(req.user.warehouse_id);
    } else if (req.user.role === 'admin') {
      if (warehouse_id) {
        query += ` AND sm.warehouse_id = ?`;
        params.push(parseInt(warehouse_id, 10));
      }
      if (user_id) {
        query += ` AND sm.user_id = ?`;
        params.push(parseInt(user_id, 10));
      }
    }

    if (product_id) {
      query += ` AND sm.product_id = ?`;
      params.push(parseInt(product_id, 10));
    }

    if (movement_type) {
      query += ` AND sm.movement_type = ?`;
      params.push(movement_type);
    }

    if (search) {
      query += ` AND (p.product_name LIKE ? OR p.sku LIKE ? OR sm.reference_number LIKE ? OR sm.notes LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY sm.movement_date DESC, sm.movement_id DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Fetch movements error:', err);
    res.status(500).json({ message: 'Error retrieving stock movements.' });
  }
});

// POST /api/movements
// Transactional stock movement: IN, OUT, ADJUSTMENT
router.post('/', async (req, res) => {
  const {
    warehouse_id,
    product_id,
    movement_type,
    quantity,
    adjustment_action, // 'INCREASE' or 'DECREASE' (for ADJUSTMENT type)
    reference_number,
    notes
  } = req.body;

  // 1. Basic validation
  if (!warehouse_id || !product_id || !movement_type || !quantity) {
    return res.status(400).json({ message: 'Warehouse, product, movement type, and quantity are required.' });
  }

  const numQty = parseInt(quantity, 10);
  if (isNaN(numQty) || numQty <= 0) {
    return res.status(400).json({ message: 'Movement quantity must be a positive integer greater than zero.' });
  }

  if (!['IN', 'OUT', 'ADJUSTMENT'].includes(movement_type)) {
    return res.status(400).json({ message: "Movement type must be 'IN', 'OUT', or 'ADJUSTMENT'." });
  }

  const targetWarehouseId = parseInt(warehouse_id, 10);
  const targetProductId = parseInt(product_id, 10);

  // 2. Strict Warehouse Authorization Rules
  if (req.user.role !== 'admin') {
    if (req.user.warehouse_id !== targetWarehouseId) {
      return res.status(403).json({
        message: `Forbidden: You are assigned to warehouse ID ${req.user.warehouse_id} and cannot record stock in warehouse ID ${targetWarehouseId}.`
      });
    }
  }

  // Determine adjustment prefix and effect
  let formattedNotes = notes ? notes.trim() : '';
  let effectiveDelta = 0; // +qty or -qty

  if (movement_type === 'IN') {
    effectiveDelta = numQty;
  } else if (movement_type === 'OUT') {
    effectiveDelta = -numQty;
  } else if (movement_type === 'ADJUSTMENT') {
    if (!adjustment_action || !['INCREASE', 'DECREASE'].includes(adjustment_action)) {
      return res.status(400).json({
        message: "For stock adjustment, adjustment_action must be specified as 'INCREASE' or 'DECREASE'."
      });
    }
    const prefix = `[${adjustment_action}]`;
    if (!formattedNotes.startsWith(prefix)) {
      formattedNotes = `${prefix} ${formattedNotes}`.trim();
    }
    effectiveDelta = adjustment_action === 'INCREASE' ? numQty : -numQty;
  }

  // 3. Execute Transaction
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Verify warehouse exists
    const [wCheck] = await conn.query(
      `SELECT warehouse_id, warehouse_name FROM warehouses WHERE warehouse_id = ?`,
      [targetWarehouseId]
    );
    if (wCheck.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Warehouse not found.' });
    }

    // Verify product exists
    const [pCheck] = await conn.query(
      `SELECT product_id, product_name, reorder_level FROM products WHERE product_id = ?`,
      [targetProductId]
    );
    if (pCheck.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Product not found.' });
    }

    // Lock relevant inventory row
    const [invRows] = await conn.query(
      `SELECT quantity FROM inventory WHERE warehouse_id = ? AND product_id = ? FOR UPDATE`,
      [targetWarehouseId, targetProductId]
    );

    let currentQty = 0;
    const inventoryExists = invRows.length > 0;

    if (inventoryExists) {
      currentQty = invRows[0].quantity;
    }

    // Validate sufficient stock for deductions
    if (effectiveDelta < 0 && currentQty < Math.abs(effectiveDelta)) {
      await conn.rollback();
      return res.status(400).json({
        message: `Insufficient stock: Current available quantity is ${currentQty}, but attempted to deduct ${Math.abs(effectiveDelta)}.`
      });
    }

    const newQty = currentQty + effectiveDelta;
    if (newQty < 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Transaction rejected: Stock quantity cannot become negative.' });
    }

    // Upsert inventory record
    if (inventoryExists) {
      await conn.query(
        `UPDATE inventory SET quantity = ?, last_updated = NOW() WHERE warehouse_id = ? AND product_id = ?`,
        [newQty, targetWarehouseId, targetProductId]
      );
    } else {
      await conn.query(
        `INSERT INTO inventory (warehouse_id, product_id, quantity, last_updated) VALUES (?, ?, ?, NOW())`,
        [targetWarehouseId, targetProductId, newQty]
      );
    }

    // Insert stock_movements record in same transaction
    const [movementResult] = await conn.query(
      `INSERT INTO stock_movements (warehouse_id, product_id, user_id, movement_type, quantity, reference_number, notes, movement_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        targetWarehouseId,
        targetProductId,
        req.user.user_id,
        movement_type,
        numQty,
        reference_number ? reference_number.trim() : null,
        formattedNotes || null
      ]
    );

    await conn.commit();

    res.status(201).json({
      message: `Stock movement (${movement_type}) recorded successfully.`,
      movement_id: movementResult.insertId,
      previous_quantity: currentQty,
      new_quantity: newQty,
      is_low_stock: newQty <= pCheck[0].reorder_level
    });
  } catch (err) {
    await conn.rollback();
    console.error('Movement transaction error:', err);
    res.status(500).json({ message: 'Transaction failed and rolled back: ' + err.message });
  } finally {
    conn.release();
  }
});

// Stock movement deletion is strictly forbidden to protect audit trail
router.delete('/:id', (req, res) => {
  res.status(403).json({
    message: 'Stock movement records are immutable and cannot be deleted through the system. Preserving audit compliance.'
  });
});

module.exports = router;
