const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/products (Available to all authenticated users)
router.get('/', authenticateToken, async (req, res) => {
  const { search, category } = req.query;

  try {
    let query = `
      SELECT 
        p.product_id,
        p.product_name,
        p.sku,
        p.category,
        p.description,
        p.unit_price,
        p.reorder_level,
        p.created_by,
        u.full_name AS creator_name,
        COALESCE(SUM(i.quantity), 0) AS total_global_stock
      FROM products p
      LEFT JOIN users u ON p.created_by = u.user_id
      LEFT JOIN inventory i ON p.product_id = i.product_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (p.product_name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category) {
      query += ` AND p.category = ?`;
      params.push(category);
    }

    query += ` GROUP BY p.product_id, p.product_name, p.sku, p.category, p.description, p.unit_price, p.reorder_level, p.created_by, u.full_name ORDER BY p.product_name ASC`;

    const [rows] = await pool.query(query, params);

    // Also get distinct categories list for filters
    const [categories] = await pool.query(`SELECT DISTINCT category FROM products ORDER BY category ASC`);

    res.json({
      products: rows,
      categories: categories.map(c => c.category)
    });
  } catch (err) {
    console.error('Fetch products error:', err);
    res.status(500).json({ message: 'Error retrieving products list.' });
  }
});

// GET /api/products/:id
router.get('/:id', authenticateToken, async (req, res) => {
  const productId = parseInt(req.params.id, 10);
  try {
    const [rows] = await pool.query(
      `SELECT p.*, u.full_name AS creator_name FROM products p LEFT JOIN users u ON p.created_by = u.user_id WHERE p.product_id = ?`,
      [productId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    // Also get stock per warehouse for this product
    const [stockRows] = await pool.query(
      `SELECT i.warehouse_id, w.warehouse_name, i.quantity, i.last_updated
       FROM inventory i
       JOIN warehouses w ON i.warehouse_id = w.warehouse_id
       WHERE i.product_id = ?`,
      [productId]
    );

    res.json({
      ...rows[0],
      warehouse_stock: stockRows
    });
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ message: 'Error retrieving product details.' });
  }
});

// POST /api/products (Admin & Manager only)
router.post('/', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
  const { product_name, sku, category, description, unit_price, reorder_level } = req.body;

  if (!product_name || !sku || !category) {
    return res.status(400).json({ message: 'Product name, SKU, and category are required.' });
  }

  const price = parseFloat(unit_price) || 0.00;
  const reorder = parseInt(reorder_level, 10) || 0;

  if (price < 0 || reorder < 0) {
    return res.status(400).json({ message: 'Unit price and reorder level must be non-negative numbers.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO products (product_name, sku, category, description, unit_price, reorder_level, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        product_name.trim(),
        sku.trim().toUpperCase(),
        category.trim(),
        description ? description.trim() : null,
        price,
        reorder,
        req.user.user_id
      ]
    );

    res.status(201).json({
      message: 'Product created successfully.',
      product_id: result.insertId
    });
  } catch (err) {
    console.error('Create product error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'A product with this SKU already exists.' });
    }
    res.status(500).json({ message: 'Failed to create product.' });
  }
});

// PUT /api/products/:id (Admin & Manager only)
router.put('/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const { product_name, sku, category, description, unit_price, reorder_level } = req.body;

  if (!product_name || !sku || !category) {
    return res.status(400).json({ message: 'Product name, SKU, and category are required.' });
  }

  const price = parseFloat(unit_price);
  const reorder = parseInt(reorder_level, 10);

  if (price < 0 || reorder < 0) {
    return res.status(400).json({ message: 'Unit price and reorder level must be non-negative.' });
  }

  try {
    await pool.query(
      `UPDATE products 
       SET product_name = ?, sku = ?, category = ?, description = ?, unit_price = ?, reorder_level = ?
       WHERE product_id = ?`,
      [
        product_name.trim(),
        sku.trim().toUpperCase(),
        category.trim(),
        description ? description.trim() : null,
        price,
        reorder,
        productId
      ]
    );

    res.json({ message: 'Product updated successfully.' });
  } catch (err) {
    console.error('Update product error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Another product with this SKU already exists.' });
    }
    res.status(500).json({ message: 'Failed to update product.' });
  }
});

// DELETE /api/products/:id (Admin only - Prevent Unsafe Deletion)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const productId = parseInt(req.params.id, 10);

  try {
    // 1. Check if referenced in stock movements
    const [sm] = await pool.query(
      `SELECT COUNT(*) AS count FROM stock_movements WHERE product_id = ?`,
      [productId]
    );

    if (sm[0].count > 0) {
      return res.status(400).json({
        message: `Cannot delete product: Referenced in ${sm[0].count} historical stock movement transaction(s). Preserving audit integrity.`
      });
    }

    // 2. Check if inventory records exist with quantity > 0
    const [inv] = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total_qty FROM inventory WHERE product_id = ?`,
      [productId]
    );

    if (inv[0].total_qty > 0) {
      return res.status(400).json({
        message: `Cannot delete product: Warehouse inventory currently holds ${inv[0].total_qty} units in stock.`
      });
    }

    // Clean up empty 0-quantity inventory rows before deleting product
    await pool.query(`DELETE FROM inventory WHERE product_id = ?`, [productId]);
    await pool.query(`DELETE FROM products WHERE product_id = ?`, [productId]);

    res.json({ message: 'Product successfully removed.' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ message: 'Failed to delete product: ' + err.message });
  }
});

module.exports = router;
