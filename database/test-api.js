const http = require('http');

async function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runApiTests() {
  console.log('--- 🌐 STARTING END-TO-END HTTP API TESTS ---\n');

  try {
    // 1. Test Admin Login
    console.log('1. Testing POST /api/auth/login (Admin)...');
    const adminLogin = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@warehouse.com', password: 'admin@123' });

    if (adminLogin.status !== 200 || !adminLogin.data.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLogin)}`);
    }
    const adminToken = adminLogin.data.token;
    console.log('✅ Admin login succeeded. Received JWT token.');

    // 2. Test Staff Login
    console.log('2. Testing POST /api/auth/login (Staff: Arjun Kumar)...');
    const staffLogin = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'arjunkumar@company.com', password: 'PASSWORD' });

    if (staffLogin.status !== 200 || !staffLogin.data.token) {
      throw new Error(`Staff login failed: ${JSON.stringify(staffLogin)}`);
    }
    const staffToken = staffLogin.data.token;
    console.log(`✅ Staff login succeeded. Assigned to: ${staffLogin.data.user.warehouse_name}`);

    // 3. Test Staff Warehouse Authorization Scope
    console.log('3. Testing Warehouse Authorization boundary enforcement...');
    // Arjun Kumar belongs to warehouse 1 (Central). Attempting to move stock in warehouse 2 (North) must be rejected with 403.
    const forbiddenMove = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/movements',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffToken}`
      }
    }, {
      warehouse_id: 2,
      product_id: 1,
      movement_type: 'IN',
      quantity: 5
    });

    if (forbiddenMove.status !== 403) {
      throw new Error(`Expected 403 Forbidden when staff accesses unassigned warehouse, got: ${forbiddenMove.status}`);
    }
    console.log(`✅ Cross-warehouse operation forbidden as expected: "${forbiddenMove.data.message}"`);

    // 4. Test Valid Movement Execution (IN) by Staff in assigned warehouse
    console.log('4. Recording valid IN stock movement by Staff in assigned warehouse...');
    const inMove = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/movements',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffToken}`
      }
    }, {
      warehouse_id: 1,
      product_id: 1,
      movement_type: 'IN',
      quantity: 10,
      reference_number: 'TEST-PO-2026',
      notes: 'Automated API validation check'
    });

    if (inMove.status !== 201) {
      throw new Error(`Inbound movement failed: ${JSON.stringify(inMove)}`);
    }
    console.log(`✅ Inbound movement recorded. Prev qty: ${inMove.data.previous_quantity}, New qty: ${inMove.data.new_quantity}`);

    // 5. Test Insufficient Stock OUT prevention
    console.log('5. Testing prevention of negative stock on excessive OUT movement...');
    const excessiveOut = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/movements',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffToken}`
      }
    }, {
      warehouse_id: 1,
      product_id: 1,
      movement_type: 'OUT',
      quantity: 99999,
      reference_number: 'FAIL-TEST',
      notes: 'Should be rejected'
    });

    if (excessiveOut.status !== 400) {
      throw new Error(`Expected 400 Bad Request for excessive stock deduction, got ${excessiveOut.status}`);
    }
    console.log(`✅ Excessive stock deduction safely rejected: "${excessiveOut.data.message}"`);

    // 6. Restore original stock quantity (OUT 10)
    console.log('6. Reversing test quantity with OUT 10...');
    const restoreMove = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/movements',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffToken}`
      }
    }, {
      warehouse_id: 1,
      product_id: 1,
      movement_type: 'OUT',
      quantity: 10,
      reference_number: 'TEST-REV-2026',
      notes: 'Automated API revert'
    });
    console.log(`✅ Restored to initial quantity: ${restoreMove.data.new_quantity}`);

    // 7. Test Safe Deletion Prevention on Warehouse
    console.log('7. Testing Safe Deletion Prevention (cannot delete warehouse with inventory/movements)...');
    const deleteWh = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/warehouses/1',
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (deleteWh.status !== 400) {
      throw new Error(`Expected 400 for unsafe warehouse deletion, got ${deleteWh.status}`);
    }
    console.log(`✅ Unsafe deletion prevented: "${deleteWh.data.message}"`);

    // 8. Test Dashboard Report API
    console.log('8. Testing GET /api/reports/dashboard...');
    const dashboard = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (dashboard.status !== 200 || !dashboard.data.summary) {
      throw new Error(`Dashboard report failed: ${JSON.stringify(dashboard)}`);
    }
    console.log('✅ Dashboard report returned real metrics:', {
      total_products: dashboard.data.summary.total_products,
      total_units: dashboard.data.summary.total_units,
      total_valuation: dashboard.data.summary.total_value,
      low_stock_count: dashboard.data.summary.low_stock_count
    });

    console.log('\n🎉 ALL HTTP API TESTS COMPLETED AND VERIFIED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ API test failed:', err);
    process.exit(1);
  }
}

runApiTests();
