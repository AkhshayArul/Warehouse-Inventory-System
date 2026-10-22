const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root@12345',
  multipleStatements: true
};

const DB_NAME = process.env.DB_NAME || 'warehouse_db';

async function initDB() {
  console.log('Connecting to MySQL Server at ' + DB_CONFIG.host + ':' + DB_CONFIG.port + '...');
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
  } catch (err) {
    console.error('Failed to connect to MySQL:', err.message);
    process.exit(1);
  }

  try {
    console.log(`Ensuring database '${DB_NAME}' exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${DB_NAME}\`;`);

    console.log('Executing schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    
    // Split schema by delimiter if necessary or clean up
    // Since mysql2 multipleStatements handles raw DDL if not using DELIMITER directives:
    // Let's execute the table creations, then view, trigger, procedure cleanly.
    await setupSchema(connection, schemaSql);

    console.log('Seeding initial data...');
    await seedDatabase(connection);

    console.log('✅ Database initialization and seeding completed successfully!');
  } catch (err) {
    console.error('❌ Database initialization error:', err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

async function setupSchema(conn, fullSql) {
  // Execute base tables
  await conn.query('SET FOREIGN_KEY_CHECKS = 0;');
  await conn.query('DROP VIEW IF EXISTS `vw_inventory_details`;');
  await conn.query('DROP PROCEDURE IF EXISTS `sp_get_warehouse_inventory_summary`;');
  await conn.query('DROP TRIGGER IF EXISTS `trg_prevent_negative_inventory`;');
  await conn.query('DROP TABLE IF EXISTS `stock_movements`;');
  await conn.query('DROP TABLE IF EXISTS `inventory`;');
  await conn.query('DROP TABLE IF EXISTS `products`;');
  await conn.query('DROP TABLE IF EXISTS `warehouses`;');
  await conn.query('DROP TABLE IF EXISTS `users`;');
  await conn.query('SET FOREIGN_KEY_CHECKS = 1;');

  // Create users
  await conn.query(`
    CREATE TABLE \`users\` (
      \`user_id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`full_name\` VARCHAR(100) NOT NULL,
      \`email\` VARCHAR(150) NOT NULL UNIQUE,
      \`password_hash\` VARCHAR(255) NOT NULL,
      \`phone\` VARCHAR(15) NULL,
      \`role\` ENUM('admin', 'manager', 'staff') NOT NULL DEFAULT 'staff',
      \`warehouse_id\` INT NULL,
      CONSTRAINT \`chk_user_role\` CHECK (\`role\` IN ('admin', 'manager', 'staff'))
    ) ENGINE=InnoDB;
  `);

  // Create warehouses
  await conn.query(`
    CREATE TABLE \`warehouses\` (
      \`warehouse_id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`warehouse_name\` VARCHAR(100) NOT NULL UNIQUE,
      \`location\` VARCHAR(255) NOT NULL,
      \`manager_id\` INT NOT NULL UNIQUE,
      CONSTRAINT \`fk_warehouses_manager\` FOREIGN KEY (\`manager_id\`)
        REFERENCES \`users\` (\`user_id\`)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Add foreign key from users to warehouses
  await conn.query(`
    ALTER TABLE \`users\`
      ADD CONSTRAINT \`fk_users_warehouse\` FOREIGN KEY (\`warehouse_id\`)
        REFERENCES \`warehouses\` (\`warehouse_id\`)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
  `);

  // Create products
  await conn.query(`
    CREATE TABLE \`products\` (
      \`product_id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`product_name\` VARCHAR(150) NOT NULL,
      \`sku\` VARCHAR(50) NOT NULL UNIQUE,
      \`category\` VARCHAR(100) NOT NULL,
      \`description\` TEXT NULL,
      \`unit_price\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      \`reorder_level\` INT NOT NULL DEFAULT 10,
      \`created_by\` INT NOT NULL,
      CONSTRAINT \`chk_product_unit_price\` CHECK (\`unit_price\` >= 0),
      CONSTRAINT \`chk_product_reorder_level\` CHECK (\`reorder_level\` >= 0),
      CONSTRAINT \`fk_products_creator\` FOREIGN KEY (\`created_by\`)
        REFERENCES \`users\` (\`user_id\`)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Create inventory
  await conn.query(`
    CREATE TABLE \`inventory\` (
      \`warehouse_id\` INT NOT NULL,
      \`product_id\` INT NOT NULL,
      \`quantity\` INT NOT NULL DEFAULT 0,
      \`last_updated\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`warehouse_id\`, \`product_id\`),
      CONSTRAINT \`chk_inventory_quantity\` CHECK (\`quantity\` >= 0),
      CONSTRAINT \`fk_inventory_warehouse\` FOREIGN KEY (\`warehouse_id\`)
        REFERENCES \`warehouses\` (\`warehouse_id\`)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
      CONSTRAINT \`fk_inventory_product\` FOREIGN KEY (\`product_id\`)
        REFERENCES \`products\` (\`product_id\`)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Create stock_movements
  await conn.query(`
    CREATE TABLE \`stock_movements\` (
      \`movement_id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`warehouse_id\` INT NOT NULL,
      \`product_id\` INT NOT NULL,
      \`user_id\` INT NOT NULL,
      \`movement_type\` ENUM('IN', 'OUT', 'ADJUSTMENT') NOT NULL,
      \`quantity\` INT NOT NULL,
      \`reference_number\` VARCHAR(100) NULL,
      \`notes\` TEXT NULL,
      \`movement_date\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT \`chk_movement_type\` CHECK (\`movement_type\` IN ('IN', 'OUT', 'ADJUSTMENT')),
      CONSTRAINT \`chk_movement_quantity\` CHECK (\`quantity\` > 0),
      CONSTRAINT \`fk_movements_warehouse\` FOREIGN KEY (\`warehouse_id\`)
        REFERENCES \`warehouses\` (\`warehouse_id\`)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
      CONSTRAINT \`fk_movements_product\` FOREIGN KEY (\`product_id\`)
        REFERENCES \`products\` (\`product_id\`)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
      CONSTRAINT \`fk_movements_user\` FOREIGN KEY (\`user_id\`)
        REFERENCES \`users\` (\`user_id\`)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
    ) ENGINE=InnoDB;
  `);

  // VIEW: vw_inventory_details
  await conn.query(`
    CREATE OR REPLACE VIEW \`vw_inventory_details\` AS
    SELECT
      i.warehouse_id,
      w.warehouse_name,
      w.location AS warehouse_location,
      i.product_id,
      p.product_name,
      p.sku,
      p.category,
      i.quantity,
      p.reorder_level,
      p.unit_price,
      ROUND(i.quantity * p.unit_price, 2) AS inventory_value,
      CASE WHEN i.quantity <= p.reorder_level THEN 1 ELSE 0 END AS is_low_stock,
      i.last_updated
    FROM \`inventory\` i
    JOIN \`products\` p ON i.product_id = p.product_id
    JOIN \`warehouses\` w ON i.warehouse_id = w.warehouse_id;
  `);

  // STORED PROCEDURE: sp_get_warehouse_inventory_summary
  await conn.query(`
    CREATE PROCEDURE \`sp_get_warehouse_inventory_summary\`(IN p_warehouse_id INT)
    BEGIN
      IF p_warehouse_id IS NULL OR p_warehouse_id = 0 THEN
        SELECT 
          COUNT(DISTINCT i.product_id) AS total_distinct_products,
          COALESCE(SUM(i.quantity), 0) AS total_units,
          COALESCE(SUM(ROUND(i.quantity * p.unit_price, 2)), 0.00) AS total_inventory_value,
          COUNT(CASE WHEN i.quantity <= p.reorder_level THEN 1 END) AS low_stock_items_count
        FROM \`inventory\` i
        JOIN \`products\` p ON i.product_id = p.product_id;
      ELSE
        SELECT 
          COUNT(DISTINCT i.product_id) AS total_distinct_products,
          COALESCE(SUM(i.quantity), 0) AS total_units,
          COALESCE(SUM(ROUND(i.quantity * p.unit_price, 2)), 0.00) AS total_inventory_value,
          COUNT(CASE WHEN i.quantity <= p.reorder_level THEN 1 END) AS low_stock_items_count
        FROM \`inventory\` i
        JOIN \`products\` p ON i.product_id = p.product_id
        WHERE i.warehouse_id = p_warehouse_id;
      END IF;
    END;
  `);

  // TRIGGER: trg_prevent_negative_inventory
  await conn.query(`
    CREATE TRIGGER \`trg_prevent_negative_inventory\`
    BEFORE UPDATE ON \`inventory\`
    FOR EACH ROW
    BEGIN
      IF NEW.quantity < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Transaction rejected: Inventory quantity cannot fall below zero.';
      END IF;
    END;
  `);
}

async function seedDatabase(conn) {
  const adminHash = await bcrypt.hash('admin@123', 10);
  const employeeHash = await bcrypt.hash('PASSWORD', 10);

  // 1. Insert Admin (user_id = 1)
  await conn.query(
    `INSERT INTO \`users\` (user_id, full_name, email, password_hash, phone, role, warehouse_id)
     VALUES (1, 'Warehouse Admin', 'admin@warehouse.com', ?, '+1-800-555-0100', 'admin', NULL)`,
    [adminHash]
  );

  // 2. Insert Managers first without warehouse_id (due to circular FK)
  // Alex Manager (id: 2) -> Central Warehouse
  // Priya Manager (id: 3) -> North Warehouse
  // Rahul Manager (id: 4) -> South Warehouse
  await conn.query(`
    INSERT INTO \`users\` (user_id, full_name, email, password_hash, phone, role, warehouse_id) VALUES
    (2, 'Alex Manager', 'alexmanager@company.com', ?, '+1-555-0101', 'manager', NULL),
    (3, 'Priya Manager', 'priyamanager@company.com', ?, '+1-555-0102', 'manager', NULL),
    (4, 'Rahul Manager', 'rahulmanager@company.com', ?, '+1-555-0103', 'manager', NULL)
  `, [employeeHash, employeeHash, employeeHash]);

  // 3. Insert Warehouses
  await conn.query(`
    INSERT INTO \`warehouses\` (warehouse_id, warehouse_name, location, manager_id) VALUES
    (1, 'Central Warehouse', 'Building A, Industrial Area, Sector 5', 2),
    (2, 'North Warehouse', 'Plot 42, North Logistics Park, Expressway', 3),
    (3, 'South Warehouse', 'Bay 12, South Freight Terminal, Port Road', 4)
  `);

  // 4. Update managers' warehouse_id to match their warehouse
  await conn.query(`UPDATE \`users\` SET warehouse_id = 1 WHERE user_id = 2`);
  await conn.query(`UPDATE \`users\` SET warehouse_id = 2 WHERE user_id = 3`);
  await conn.query(`UPDATE \`users\` SET warehouse_id = 3 WHERE user_id = 4`);

  // 5. Insert 5 Staff for Central Warehouse (IDs: 5 to 9)
  await conn.query(`
    INSERT INTO \`users\` (user_id, full_name, email, password_hash, phone, role, warehouse_id) VALUES
    (5, 'Arjun Kumar', 'arjunkumar@company.com', ?, '+1-555-0111', 'staff', 1),
    (6, 'Ananya Sharma', 'ananyasharma@company.com', ?, '+1-555-0112', 'staff', 1),
    (7, 'Karthik Raj', 'karthikraj@company.com', ?, '+1-555-0113', 'staff', 1),
    (8, 'Meera Patel', 'meerapatel@company.com', ?, '+1-555-0114', 'staff', 1),
    (9, 'Vikram Singh', 'vikramsingh@company.com', ?, '+1-555-0115', 'staff', 1)
  `, [employeeHash, employeeHash, employeeHash, employeeHash, employeeHash]);

  // 6. Insert 5 Staff for North Warehouse (IDs: 10 to 14)
  await conn.query(`
    INSERT INTO \`users\` (user_id, full_name, email, password_hash, phone, role, warehouse_id) VALUES
    (10, 'Sneha Reddy', 'snehareddy@company.com', ?, '+1-555-0121', 'staff', 2),
    (11, 'Rahul Verma', 'rahulverma@company.com', ?, '+1-555-0122', 'staff', 2),
    (12, 'Divya Nair', 'divyanair@company.com', ?, '+1-555-0123', 'staff', 2),
    (13, 'Aditya Rao', 'adityarao@company.com', ?, '+1-555-0124', 'staff', 2),
    (14, 'Pooja Iyer', 'poojaiyer@company.com', ?, '+1-555-0125', 'staff', 2)
  `, [employeeHash, employeeHash, employeeHash, employeeHash, employeeHash]);

  // 7. Insert 5 Staff for South Warehouse (IDs: 15 to 19)
  await conn.query(`
    INSERT INTO \`users\` (user_id, full_name, email, password_hash, phone, role, warehouse_id) VALUES
    (15, 'Neha Kapoor', 'nehakapoor@company.com', ?, '+1-555-0131', 'staff', 3),
    (16, 'Sanjay Gupta', 'sanjaygupta@company.com', ?, '+1-555-0132', 'staff', 3),
    (17, 'Ishita Das', 'ishitadas@company.com', ?, '+1-555-0133', 'staff', 3),
    (18, 'Rohan Mehta', 'rohanmehta@company.com', ?, '+1-555-0134', 'staff', 3),
    (19, 'Kavya Menon', 'kavyamenon@company.com', ?, '+1-555-0135', 'staff', 3)
  `, [employeeHash, employeeHash, employeeHash, employeeHash, employeeHash]);

  console.log('Seeded 19 users (1 admin, 3 managers, 15 staff).');

  // 8. Insert 16 Realistic Products across categories
  const products = [
    [1, 'Industrial Barcode Scanner 2D', 'ELEC-BCS-001', 'Electronics', 'Rugged handheld Bluetooth & USB 2D QR barcode reader', 129.99, 15, 1],
    [2, 'Thermal Label Printer Pro', 'ELEC-TLP-002', 'Electronics', 'High-speed 4x6 inch direct thermal shipping label printer', 219.50, 8, 1],
    [3, 'Rugged Warehouse Tablet X1', 'ELEC-RWT-003', 'Electronics', 'Drop-resistant 10-inch Android tablet with scanner cradle', 499.00, 5, 1],
    [4, 'Heavy Duty Power Bank 30000mAh', 'ELEC-PWB-004', 'Electronics', 'Multi-voltage portable battery pack for terminal devices', 59.99, 20, 1],
    [5, 'Heavy-Duty Corrugated Boxes (Large)', 'PKG-BOX-001', 'Packaging', 'Double-wall heavy duty shipping boxes (24x18x18 in, bundle of 25)', 45.00, 30, 1],
    [6, 'Pallet Stretch Wrap Film (500mm)', 'PKG-STW-002', 'Packaging', 'Industrial puncture-resistant stretch film rolls (23 micron)', 28.50, 40, 1],
    [7, 'Reinforced Fiberglass Packaging Tape', 'PKG-TAP-003', 'Packaging', 'Filament reinforced security packing tape (pack of 6 rolls)', 34.00, 25, 1],
    [8, 'Heavy Duty Bubble Wrap Roll 100m', 'PKG-BBL-004', 'Packaging', 'Shock-absorbing protective air bubble roll (500mm x 100m)', 38.00, 15, 1],
    [9, 'High-Visibility Reflective Safety Vest', 'SFT-VST-001', 'Safety & PPE', 'ANSI Class 2 compliant zipper front vest with pockets (Pack of 10)', 42.00, 20, 1],
    [10, 'Steel Toe Work Boots (Sizes 9-11)', 'SFT-BOT-002', 'Safety & PPE', 'Slip-resistant puncture-proof oil-resistant work boots', 78.50, 10, 1],
    [11, 'Nitrile Coated Work Gloves (L)', 'SFT-GLV-003', 'Safety & PPE', 'Heavy duty abrasion resistant grip gloves (Box of 12 pairs)', 24.00, 35, 1],
    [12, 'Manual Hydraulic Pallet Jack 2.5T', 'MHE-PLJ-001', 'Material Handling', '2500 kg capacity heavy-duty polyurethane wheels hand pallet truck', 380.00, 4, 1],
    [13, 'Industrial Steel Shelving Unit 4-Tier', 'STR-SHV-001', 'Storage & Hardware', 'Heavy duty boltless steel storage rack 1200kg load capacity', 185.00, 6, 1],
    [14, 'Stackable Storage Tote Bin 60L', 'STR-TOT-002', 'Storage & Hardware', 'Heavy-duty recycled polypropylene nesting container with lid', 18.00, 50, 1],
    [15, 'Industrial Cable Ties 300mm (1000pk)', 'STR-CBL-003', 'Storage & Hardware', 'Heavy duty nylon self-locking cable ties bundle', 22.00, 25, 1],
    [16, 'Digital Floor Platform Scale 300kg', 'MHE-SCL-002', 'Material Handling', 'Stainless steel weighing platform with digital indicator LCD', 240.00, 5, 1]
  ];

  for (const p of products) {
    await conn.query(
      `INSERT INTO \`products\` (product_id, product_name, sku, category, description, unit_price, reorder_level, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      p
    );
  }
  console.log(`Seeded ${products.length} products.`);

  // 9. Stock Movements and Inventory
  // Rules:
  // Every movement references warehouse_id, product_id, user_id, movement_type ('IN', 'OUT', 'ADJUSTMENT'), quantity (>0), reference_number, notes.
  // We specify initial movements, and compute the inventory quantity from the movements!
  // Documented ADJUSTMENT rule:
  // - If notes starts with '[INCREASE]' -> adds quantity
  // - If notes starts with '[DECREASE]' -> subtracts quantity
  // - If IN -> adds quantity
  // - If OUT -> subtracts quantity
  // Total must be nonnegative.

  const initialMovements = [
    // Central Warehouse (warehouse_id: 1)
    // p1: IN 50, OUT 10 -> net 40 (reorder 15)
    { wid: 1, pid: 1, uid: 2, type: 'IN', qty: 50, ref: 'PO-2026-001', note: 'Initial bulk shipment from OEM supplier' },
    { wid: 1, pid: 1, uid: 5, type: 'OUT', qty: 10, ref: 'DISP-101', note: 'Dispatched to retail distribution hub' },
    
    // p2: IN 12, OUT 8 -> net 4 (reorder 8) -> LOW STOCK!
    { wid: 1, pid: 2, uid: 2, type: 'IN', qty: 12, ref: 'PO-2026-002', note: 'Received batch from Zebra Logistics' },
    { wid: 1, pid: 2, uid: 6, type: 'OUT', qty: 8, ref: 'DISP-102', note: 'Order fulfillment for customer branch' },

    // p3: IN 15, OUT 5, ADJUSTMENT -2 -> net 8 (reorder 5)
    { wid: 1, pid: 3, uid: 2, type: 'IN', qty: 15, ref: 'PO-2026-003', note: 'Received secure tablet consignment' },
    { wid: 1, pid: 3, uid: 7, type: 'OUT', qty: 5, ref: 'DISP-103', note: 'Deployment to warehouse operations team' },
    { wid: 1, pid: 3, uid: 2, type: 'ADJUSTMENT', qty: 2, ref: 'AUDIT-ADJ-01', note: '[DECREASE] 2 units dropped and sent to repair' },

    // p5: IN 100, OUT 40 -> net 60 (reorder 30)
    { wid: 1, pid: 5, uid: 5, type: 'IN', qty: 100, ref: 'PO-2026-004', note: 'Stock replenishment for packing boxes' },
    { wid: 1, pid: 5, uid: 8, type: 'OUT', qty: 40, ref: 'DISP-104', note: 'Consumed during packing peak' },

    // p6: IN 20, OUT 10 -> net 10 (reorder 40) -> LOW STOCK!
    { wid: 1, pid: 6, uid: 5, type: 'IN', qty: 20, ref: 'PO-2026-005', note: 'Rolls delivered from supplier' },
    { wid: 1, pid: 6, uid: 9, type: 'OUT', qty: 10, ref: 'DISP-105', note: 'Allocated to shipping staging dock' },

    // p9: IN 30, OUT 12 -> net 18 (reorder 20) -> LOW STOCK!
    { wid: 1, pid: 9, uid: 6, type: 'IN', qty: 30, ref: 'PO-2026-006', note: 'Quarterly PPE restock' },
    { wid: 1, pid: 9, uid: 7, type: 'OUT', qty: 12, ref: 'DISP-106', note: 'Issued to new intake staff' },

    // p12: IN 6, OUT 1 -> net 5 (reorder 4)
    { wid: 1, pid: 12, uid: 2, type: 'IN', qty: 6, ref: 'PO-2026-007', note: 'Fleet of pallet trucks delivered' },
    { wid: 1, pid: 12, uid: 8, type: 'OUT', qty: 1, ref: 'DISP-107', note: 'Transferred to sorting line' },

    // North Warehouse (warehouse_id: 2)
    // p1: IN 30, OUT 5 -> net 25 (reorder 15)
    { wid: 2, pid: 1, uid: 3, type: 'IN', qty: 30, ref: 'PO-2026-101', note: 'Stock transfer from central hub' },
    { wid: 2, pid: 1, uid: 10, type: 'OUT', qty: 5, ref: 'DISP-201', note: 'Dispatched to local express depot' },

    // p4: IN 40, OUT 25, ADJUSTMENT +5 -> net 20 (reorder 20) -> LOW STOCK! (equals reorder level)
    { wid: 2, pid: 4, uid: 3, type: 'IN', qty: 40, ref: 'PO-2026-102', note: 'Battery packs received' },
    { wid: 2, pid: 4, uid: 11, type: 'OUT', qty: 25, ref: 'DISP-202', note: 'Bulk supply to field operations' },
    { wid: 2, pid: 4, uid: 3, type: 'ADJUSTMENT', qty: 5, ref: 'AUDIT-ADJ-02', note: '[INCREASE] Stock audit recount found 5 unrecorded packs' },

    // p7: IN 50, OUT 15 -> net 35 (reorder 25)
    { wid: 2, pid: 7, uid: 12, type: 'IN', qty: 50, ref: 'PO-2026-103', note: 'Fiberglass tape cartons checked in' },
    { wid: 2, pid: 7, uid: 13, type: 'OUT', qty: 15, ref: 'DISP-203', note: 'Issued to packing station B' },

    // p10: IN 15, OUT 12 -> net 3 (reorder 10) -> LOW STOCK!
    { wid: 2, pid: 10, uid: 3, type: 'IN', qty: 15, ref: 'PO-2026-104', note: 'Safety boots shipment arrived' },
    { wid: 2, pid: 10, uid: 14, type: 'OUT', qty: 12, ref: 'DISP-204', note: 'Safety gear distribution to floor workers' },

    // p13: IN 10, OUT 2 -> net 8 (reorder 6)
    { wid: 2, pid: 13, uid: 3, type: 'IN', qty: 10, ref: 'PO-2026-105', note: 'Heavy racks modular parts delivered' },
    { wid: 2, pid: 13, uid: 10, type: 'OUT', qty: 2, ref: 'DISP-205', note: 'Installed in cold room aisle 4' },

    // South Warehouse (warehouse_id: 3)
    // p2: IN 20, OUT 15 -> net 5 (reorder 8) -> LOW STOCK!
    { wid: 3, pid: 2, uid: 4, type: 'IN', qty: 20, ref: 'PO-2026-201', note: 'Thermal printers received for port facility' },
    { wid: 3, pid: 2, uid: 15, type: 'OUT', qty: 15, ref: 'DISP-301', note: 'Port terminal shipping gate installation' },

    // p8: IN 40, OUT 10 -> net 30 (reorder 15)
    { wid: 3, pid: 8, uid: 16, type: 'IN', qty: 40, ref: 'PO-2026-202', note: 'Bubble wrap shipment unpacked' },
    { wid: 3, pid: 8, uid: 17, type: 'OUT', qty: 10, ref: 'DISP-302', note: 'Marine export freight packing' },

    // p11: IN 80, OUT 55 -> net 25 (reorder 35) -> LOW STOCK!
    { wid: 3, pid: 11, uid: 4, type: 'IN', qty: 80, ref: 'PO-2026-203', note: 'Boxes of safety grip gloves delivered' },
    { wid: 3, pid: 11, uid: 18, type: 'OUT', qty: 55, ref: 'DISP-303', note: 'Monthly issuance across dock hands' },

    // p14: IN 120, OUT 40 -> net 80 (reorder 50)
    { wid: 3, pid: 14, uid: 19, type: 'IN', qty: 120, ref: 'PO-2026-204', note: 'Tote bins delivered from moulder' },
    { wid: 3, pid: 14, uid: 15, type: 'OUT', qty: 40, ref: 'DISP-304', note: 'Assigned to small parts picking area' },

    // p16: IN 8, OUT 6 -> net 2 (reorder 5) -> LOW STOCK!
    { wid: 3, pid: 16, uid: 4, type: 'IN', qty: 8, ref: 'PO-2026-205', note: 'Heavy platform scales arrived' },
    { wid: 3, pid: 16, uid: 16, type: 'OUT', qty: 6, ref: 'DISP-305', note: 'Set up at receiving docks 1 through 6' }
  ];

  // Calculate net quantities for each (wid, pid)
  const inventoryMap = {};

  for (const m of initialMovements) {
    // Insert movement
    await conn.query(`
      INSERT INTO \`stock_movements\` (warehouse_id, product_id, user_id, movement_type, quantity, reference_number, notes, movement_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW() - INTERVAL FLOOR(RAND() * 5) DAY)
    `, [m.wid, m.pid, m.uid, m.type, m.qty, m.ref, m.note]);

    const key = `${m.wid}_${m.pid}`;
    if (!inventoryMap[key]) {
      inventoryMap[key] = { wid: m.wid, pid: m.pid, qty: 0 };
    }

    if (m.type === 'IN') {
      inventoryMap[key].qty += m.qty;
    } else if (m.type === 'OUT') {
      inventoryMap[key].qty -= m.qty;
    } else if (m.type === 'ADJUSTMENT') {
      if (m.note.includes('[INCREASE]')) {
        inventoryMap[key].qty += m.qty;
      } else if (m.note.includes('[DECREASE]')) {
        inventoryMap[key].qty -= m.qty;
      }
    }
  }

  // Insert inventory records with exact matching quantities
  for (const item of Object.values(inventoryMap)) {
    if (item.qty < 0) {
      throw new Error(`Negative stock calculated for warehouse ${item.wid}, product ${item.pid}: ${item.qty}`);
    }
    await conn.query(`
      INSERT INTO \`inventory\` (warehouse_id, product_id, quantity, last_updated)
      VALUES (?, ?, ?, NOW())
    `, [item.wid, item.pid, item.qty]);
  }

  console.log(`Seeded ${initialMovements.length} stock movements and ${Object.keys(inventoryMap).length} inventory records with exact matching quantities.`);
}

initDB();
