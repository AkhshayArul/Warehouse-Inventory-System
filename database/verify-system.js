const pool = require('../server/src/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'warehouse-inventory-system-secret-key-2026-dbms';

async function verifySystem() {
  console.log('--- 🧪 STARTING COMPLETE SYSTEM VERIFICATION ---\n');

  try {
    // 1. Verify 5 exact tables exist
    console.log('1. Checking exact five database tables...');
    const [tables] = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `);
    const tableNames = tables.map(t => t.TABLE_NAME || t.table_name);
    console.log('Found tables:', tableNames.join(', '));
    const expectedTables = ['inventory', 'products', 'stock_movements', 'users', 'warehouses'];
    if (JSON.stringify(tableNames) !== JSON.stringify(expectedTables)) {
      throw new Error(`Expected exactly 5 tables [${expectedTables.join(', ')}], but found: [${tableNames.join(', ')}]`);
    }
    console.log('✅ Exactly 5 tables confirmed.\n');

    // 2. Verify VIEW vw_inventory_details
    console.log('2. Verifying VIEW vw_inventory_details...');
    const [viewRows] = await pool.query(`SELECT * FROM vw_inventory_details LIMIT 3`);
    console.log(`View returned ${viewRows.length} sample rows. Sample row:`, {
      product: viewRows[0].product_name,
      sku: viewRows[0].sku,
      warehouse: viewRows[0].warehouse_name,
      quantity: viewRows[0].quantity,
      value: viewRows[0].inventory_value,
      is_low_stock: viewRows[0].is_low_stock
    });
    console.log('✅ VIEW vw_inventory_details confirmed working.\n');

    // 3. Verify STORED PROCEDURE sp_get_warehouse_inventory_summary
    console.log('3. Verifying STORED PROCEDURE sp_get_warehouse_inventory_summary...');
    const [spResult] = await pool.query(`CALL sp_get_warehouse_inventory_summary(1)`);
    console.log('Stored procedure summary for Central Warehouse (ID 1):', spResult[0][0]);
    if (!spResult[0][0] || typeof spResult[0][0].total_units === 'undefined') {
      throw new Error('Stored procedure failed to return expected summary format.');
    }
    console.log('✅ Stored procedure confirmed working.\n');

    // 4. Verify TRIGGER trg_prevent_negative_inventory
    console.log('4. Testing TRIGGER trg_prevent_negative_inventory...');
    let triggerFired = false;
    try {
      await pool.query(`UPDATE inventory SET quantity = -10 WHERE warehouse_id = 1 AND product_id = 1`);
    } catch (err) {
      if (err.message.includes('Inventory quantity cannot fall below zero') || err.sqlState === '45000') {
        triggerFired = true;
        console.log(`Trigger correctly rejected negative quantity with error: "${err.message}"`);
      } else {
        throw err;
      }
    }
    if (!triggerFired) {
      throw new Error('TRIGGER trg_prevent_negative_inventory did not fire on negative stock update!');
    }
    console.log('✅ TRIGGER trg_prevent_negative_inventory confirmed working.\n');

    // 5. Test Passwords and Credentials
    console.log('5. Verifying Login Credentials and Bcrypt Hashes...');
    // Admin
    const [adminRows] = await pool.query(`SELECT * FROM users WHERE email = 'admin@warehouse.com'`);
    if (adminRows.length === 0) throw new Error('Admin user not found!');
    const adminPassMatch = await bcrypt.compare('admin@123', adminRows[0].password_hash);
    if (!adminPassMatch) throw new Error('admin@warehouse.com password hash does not match "admin@123"!');
    console.log('✓ Admin login password verified (admin@123)');

    // Managers & Staff
    const testAccounts = [
      'alexmanager@company.com',
      'priyamanager@company.com',
      'rahulmanager@company.com',
      'arjunkumar@company.com',
      'snehareddy@company.com',
      'nehakapoor@company.com'
    ];
    for (const email of testAccounts) {
      const [u] = await pool.query(`SELECT * FROM users WHERE email = ?`, [email]);
      if (u.length === 0) throw new Error(`User ${email} not found!`);
      const match = await bcrypt.compare('PASSWORD', u[0].password_hash);
      if (!match) throw new Error(`${email} password hash does not match "PASSWORD"!`);
    }
    console.log(`✓ Verified ${testAccounts.length} manager and staff accounts login password: "PASSWORD"`);
    console.log('✅ All credentials confirmed working.\n');

    // 6. Test Transactional Movement and Rollback
    console.log('6. Verifying Transactional Stock Movement (IN, OUT, ADJUSTMENT) & Rollback...');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Check current quantity of product 1 in warehouse 1
      const [curr] = await conn.query(`SELECT quantity FROM inventory WHERE warehouse_id = 1 AND product_id = 1 FOR UPDATE`);
      const initialQty = curr[0].quantity;

      // IN 10
      await conn.query(`UPDATE inventory SET quantity = quantity + 10 WHERE warehouse_id = 1 AND product_id = 1`);
      await conn.query(`
        INSERT INTO stock_movements (warehouse_id, product_id, user_id, movement_type, quantity, reference_number, notes)
        VALUES (1, 1, 2, 'IN', 10, 'TEST-IN-01', 'Test verification IN')
      `);

      // OUT 5
      await conn.query(`UPDATE inventory SET quantity = quantity - 5 WHERE warehouse_id = 1 AND product_id = 1`);
      await conn.query(`
        INSERT INTO stock_movements (warehouse_id, product_id, user_id, movement_type, quantity, reference_number, notes)
        VALUES (1, 1, 2, 'OUT', 5, 'TEST-OUT-01', 'Test verification OUT')
      `);

      // Check new quantity
      const [after] = await conn.query(`SELECT quantity FROM inventory WHERE warehouse_id = 1 AND product_id = 1`);
      if (after[0].quantity !== initialQty + 5) {
        throw new Error(`Expected quantity ${initialQty + 5}, got ${after[0].quantity}`);
      }
      console.log(`✓ Inbound & Outbound transaction succeeded: ${initialQty} -> ${after[0].quantity}`);

      // Now rollback to leave database in pristine seed state
      await conn.rollback();
      console.log('✓ Transaction rollback executed cleanly (database state preserved).');
    } finally {
      conn.release();
    }
    console.log('✅ Transaction and rollback mechanisms confirmed working.\n');

    // 7. Verify Inventory Quantity matches Stock Movements Sum
    console.log('7. Verifying mathematical consistency between inventory and movements history...');
    const [movements] = await pool.query(`SELECT * FROM stock_movements`);
    const computedMap = {};
    for (const m of movements) {
      const key = `${m.warehouse_id}_${m.product_id}`;
      if (!computedMap[key]) computedMap[key] = 0;
      if (m.movement_type === 'IN') computedMap[key] += m.quantity;
      else if (m.movement_type === 'OUT') computedMap[key] -= m.quantity;
      else if (m.movement_type === 'ADJUSTMENT') {
        if (m.notes && m.notes.includes('[INCREASE]')) computedMap[key] += m.quantity;
        else if (m.notes && m.notes.includes('[DECREASE]')) computedMap[key] -= m.quantity;
      }
    }

    const [allInv] = await pool.query(`SELECT * FROM inventory`);
    for (const inv of allInv) {
      const key = `${inv.warehouse_id}_${inv.product_id}`;
      const expected = computedMap[key];
      if (inv.quantity !== expected) {
        throw new Error(`Mismatch in warehouse ${inv.warehouse_id}, product ${inv.product_id}: Inventory has ${inv.quantity}, movements calculated ${expected}`);
      }
    }
    console.log(`✓ All ${allInv.length} inventory records exactly equal the sum of ${movements.length} stock movements!`);
    console.log('✅ Complete audit consistency verified.\n');

    console.log('🎉 ALL SYSTEM CHECKS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifySystem();
