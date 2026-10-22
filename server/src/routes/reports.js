const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/reports/dashboard
// Comprehensive dashboard summary using aggregated SQL queries
router.get('/dashboard', async (req, res) => {
  try {
    const isRestricted = req.user.role !== 'admin';
    const warehouseId = req.user.warehouse_id;

    // 1. Overall stats
    let totalStatsQuery = `
      SELECT 
        COUNT(DISTINCT i.product_id) AS total_products,
        COALESCE(SUM(i.quantity), 0) AS total_units,
        COALESCE(SUM(ROUND(i.quantity * p.unit_price, 2)), 0.00) AS total_value,
        COUNT(CASE WHEN i.quantity <= p.reorder_level THEN 1 END) AS low_stock_count,
        ROUND(AVG(p.unit_price), 2) AS average_product_price
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
    `;
    const totalStatsParams = [];
    if (isRestricted) {
      totalStatsQuery += ` WHERE i.warehouse_id = ?`;
      totalStatsParams.push(warehouseId);
    }
    const [statsRows] = await pool.query(totalStatsQuery, totalStatsParams);

    // 2. Breakdown by warehouse (Admin only or single warehouse for manager/staff)
    let warehouseStatsQuery = `
      SELECT 
        w.warehouse_id,
        w.warehouse_name,
        w.location,
        u.full_name AS manager_name,
        COUNT(DISTINCT i.product_id) AS product_count,
        COALESCE(SUM(i.quantity), 0) AS total_quantity,
        COALESCE(SUM(ROUND(i.quantity * p.unit_price, 2)), 0.00) AS warehouse_value,
        COUNT(CASE WHEN i.quantity <= p.reorder_level THEN 1 END) AS low_stock_items
      FROM warehouses w
      LEFT JOIN users u ON w.manager_id = u.user_id
      LEFT JOIN inventory i ON w.warehouse_id = i.warehouse_id
      LEFT JOIN products p ON i.product_id = p.product_id
    `;
    const warehouseParams = [];
    if (isRestricted) {
      warehouseStatsQuery += ` WHERE w.warehouse_id = ?`;
      warehouseParams.push(warehouseId);
    }
    warehouseStatsQuery += ` GROUP BY w.warehouse_id, w.warehouse_name, w.location, u.full_name ORDER BY warehouse_value DESC`;
    const [warehouseStats] = await pool.query(warehouseStatsQuery, warehouseParams);

    // 3. Breakdown by product category
    let categoryStatsQuery = `
      SELECT 
        p.category,
        COUNT(DISTINCT p.product_id) AS category_products,
        COALESCE(SUM(i.quantity), 0) AS total_units,
        COALESCE(SUM(ROUND(i.quantity * p.unit_price, 2)), 0.00) AS category_value,
        ROUND(AVG(p.unit_price), 2) AS avg_unit_price
      FROM products p
      LEFT JOIN inventory i ON p.product_id = i.product_id
    `;
    const categoryParams = [];
    if (isRestricted) {
      categoryStatsQuery += ` AND i.warehouse_id = ?`;
      categoryParams.push(warehouseId);
    }
    categoryStatsQuery += ` GROUP BY p.category ORDER BY category_value DESC`;
    const [categoryStats] = await pool.query(categoryStatsQuery, categoryParams);

    // 4. Movement summary by type
    let movementStatsQuery = `
      SELECT 
        sm.movement_type,
        COUNT(*) AS transaction_count,
        COALESCE(SUM(sm.quantity), 0) AS total_quantity_moved
      FROM stock_movements sm
    `;
    const movementParams = [];
    if (isRestricted) {
      movementStatsQuery += ` WHERE sm.warehouse_id = ?`;
      movementParams.push(warehouseId);
    }
    movementStatsQuery += ` GROUP BY sm.movement_type`;
    const [movementStats] = await pool.query(movementStatsQuery, movementParams);

    // 5. Recent 8 movements
    let recentMovementsQuery = `
      SELECT 
        sm.movement_id,
        sm.movement_type,
        sm.quantity,
        sm.reference_number,
        sm.notes,
        sm.movement_date,
        p.product_name,
        p.sku,
        w.warehouse_name,
        u.full_name AS user_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.product_id
      JOIN warehouses w ON sm.warehouse_id = w.warehouse_id
      JOIN users u ON sm.user_id = u.user_id
    `;
    const recentParams = [];
    if (isRestricted) {
      recentMovementsQuery += ` WHERE sm.warehouse_id = ?`;
      recentParams.push(warehouseId);
    }
    recentMovementsQuery += ` ORDER BY sm.movement_date DESC, sm.movement_id DESC LIMIT 8`;
    const [recentMovements] = await pool.query(recentMovementsQuery, recentParams);

    // 6. Low stock alert items list
    let lowStockQuery = `
      SELECT 
        i.warehouse_id,
        w.warehouse_name,
        p.product_id,
        p.product_name,
        p.sku,
        p.category,
        i.quantity,
        p.reorder_level,
        p.unit_price,
        ROUND(i.quantity * p.unit_price, 2) AS inventory_value
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      WHERE i.quantity <= p.reorder_level
    `;
    const lowStockParams = [];
    if (isRestricted) {
      lowStockQuery += ` AND i.warehouse_id = ?`;
      lowStockParams.push(warehouseId);
    }
    lowStockQuery += ` ORDER BY (i.quantity - p.reorder_level) ASC, p.product_name ASC`;
    const [lowStockItems] = await pool.query(lowStockQuery, lowStockParams);

    res.json({
      summary: statsRows[0] || {},
      by_warehouse: warehouseStats,
      by_category: categoryStats,
      by_movement_type: movementStats,
      recent_movements: recentMovements,
      low_stock_items: lowStockItems
    });
  } catch (err) {
    console.error('Fetch dashboard report error:', err);
    res.status(500).json({ message: 'Error compiling dashboard statistics.' });
  }
});

module.exports = router;
