const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/inventory
// Scoped by role: Admin sees all (or filtered), Manager & Staff restricted to assigned warehouse
// Uses MySQL VIEW: `vw_inventory_details`
router.get('/', async (req, res) => {
  const { warehouse_id, search, category, low_stock_only } = req.query;

  try {
    let query = `
      SELECT 
        warehouse_id,
        warehouse_name,
        warehouse_location,
        product_id,
        product_name,
        sku,
        category,
        quantity,
        reorder_level,
        unit_price,
        inventory_value,
        is_low_stock,
        last_updated
      FROM vw_inventory_details
      WHERE 1=1
    `;
    const params = [];

    // Authorization scope enforcement
    if (req.user.role !== 'admin') {
      query += ` AND warehouse_id = ?`;
      params.push(req.user.warehouse_id);
    } else if (warehouse_id) {
      query += ` AND warehouse_id = ?`;
      params.push(parseInt(warehouse_id, 10));
    }

    if (search) {
      query += ` AND (product_name LIKE ? OR sku LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (low_stock_only === 'true' || low_stock_only === '1') {
      query += ` AND is_low_stock = 1`;
    }

    query += ` ORDER BY warehouse_name ASC, product_name ASC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Fetch inventory error:', err);
    res.status(500).json({ message: 'Error retrieving inventory records from database view.' });
  }
});

// GET /api/inventory/summary
// Uses MySQL Stored Procedure: `sp_get_warehouse_inventory_summary`
router.get('/summary', async (req, res) => {
  const { warehouse_id } = req.query;

  try {
    let targetWarehouseId = null;

    if (req.user.role !== 'admin') {
      targetWarehouseId = req.user.warehouse_id;
    } else if (warehouse_id) {
      targetWarehouseId = parseInt(warehouse_id, 10);
    }

    // Call stored procedure
    const [result] = await pool.query(
      `CALL sp_get_warehouse_inventory_summary(?)`,
      [targetWarehouseId]
    );

    // Stored procedure returns array of result sets
    const summary = result[0] && result[0][0] ? result[0][0] : {
      total_distinct_products: 0,
      total_units: 0,
      total_inventory_value: 0.00,
      low_stock_items_count: 0
    };

    res.json(summary);
  } catch (err) {
    console.error('Fetch inventory summary procedure error:', err);
    res.status(500).json({ message: 'Error executing warehouse inventory summary procedure.' });
  }
});

module.exports = router;
