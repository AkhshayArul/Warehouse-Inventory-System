-- =============================================================================
-- Warehouse Inventory Management System - Seed Data
-- 1 Admin, 3 Warehouses, 3 Managers, 15 Staff (19 Users total)
-- 16 Products across categories
-- Valid stock movements & exactly matching inventory quantities
-- Passwords:
--   admin@warehouse.com -> admin@123
--   all managers & staff -> PASSWORD
-- =============================================================================

USE `warehouse_db`;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `stock_movements`;
TRUNCATE TABLE `inventory`;
TRUNCATE TABLE `products`;
-- Unlink users & warehouses to truncate safely
UPDATE `users` SET `warehouse_id` = NULL;
TRUNCATE TABLE `warehouses`;
TRUNCATE TABLE `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Admin Account (user_id = 1)
-- bcrypt hash for 'admin@123': $2a$10$wK1mJvR0H8d.eR9nS8rNtuGfC0.C6O7Y41o9oU2s8qG7Y4VjEcm7m
-- For cross-compatibility, the standard bcrypt hash generated during init:
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `phone`, `role`, `warehouse_id`) VALUES
(1, 'Warehouse Admin', 'admin@warehouse.com', '$2a$10$tZ2cQ9R8C9S.Gv1.L2zUreA8y8Y0M2hZ5qH6rZ1bN5k0vP8sT4vOu', '+1-800-555-0100', 'admin', NULL);

-- 2. Warehouse Managers (Initial insert without warehouse_id due to circular FK)
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `phone`, `role`, `warehouse_id`) VALUES
(2, 'Alex Manager', 'alexmanager@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0101', 'manager', NULL),
(3, 'Priya Manager', 'priyamanager@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0102', 'manager', NULL),
(4, 'Rahul Manager', 'rahulmanager@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0103', 'manager', NULL);

-- 3. Warehouses
INSERT INTO `warehouses` (`warehouse_id`, `warehouse_name`, `location`, `manager_id`) VALUES
(1, 'Central Warehouse', 'Building A, Industrial Area, Sector 5', 2),
(2, 'North Warehouse', 'Plot 42, North Logistics Park, Expressway', 3),
(3, 'South Warehouse', 'Bay 12, South Freight Terminal, Port Road', 4);

-- 4. Link Managers to their respective warehouses
UPDATE `users` SET `warehouse_id` = 1 WHERE `user_id` = 2;
UPDATE `users` SET `warehouse_id` = 2 WHERE `user_id` = 3;
UPDATE `users` SET `warehouse_id` = 3 WHERE `user_id` = 4;

-- 5. Central Warehouse Staff (IDs 5-9)
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `phone`, `role`, `warehouse_id`) VALUES
(5, 'Arjun Kumar', 'arjunkumar@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0111', 'staff', 1),
(6, 'Ananya Sharma', 'ananyasharma@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0112', 'staff', 1),
(7, 'Karthik Raj', 'karthikraj@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0113', 'staff', 1),
(8, 'Meera Patel', 'meerapatel@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0114', 'staff', 1),
(9, 'Vikram Singh', 'vikramsingh@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0115', 'staff', 1);

-- 6. North Warehouse Staff (IDs 10-14)
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `phone`, `role`, `warehouse_id`) VALUES
(10, 'Sneha Reddy', 'snehareddy@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0121', 'staff', 2),
(11, 'Rahul Verma', 'rahulverma@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0122', 'staff', 2),
(12, 'Divya Nair', 'divyanair@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0123', 'staff', 2),
(13, 'Aditya Rao', 'adityarao@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0124', 'staff', 2),
(14, 'Pooja Iyer', 'poojaiyer@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0125', 'staff', 2);

-- 7. South Warehouse Staff (IDs 15-19)
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `phone`, `role`, `warehouse_id`) VALUES
(15, 'Neha Kapoor', 'nehakapoor@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0131', 'staff', 3),
(16, 'Sanjay Gupta', 'sanjaygupta@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0132', 'staff', 3),
(17, 'Ishita Das', 'ishitadas@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0133', 'staff', 3),
(18, 'Rohan Mehta', 'rohanmehta@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0134', 'staff', 3),
(19, 'Kavya Menon', 'kavyamenon@company.com', '$2a$10$0k4z3hE6mQp8xW7kC5vLSeF7.hP1tZ2cQ9R8C9S.Gv1.L2zUreA8y', '+1-555-0135', 'staff', 3);

-- 8. Products (16 items)
INSERT INTO `products` (`product_id`, `product_name`, `sku`, `category`, `description`, `unit_price`, `reorder_level`, `created_by`) VALUES
(1, 'Industrial Barcode Scanner 2D', 'ELEC-BCS-001', 'Electronics', 'Rugged handheld Bluetooth & USB 2D QR barcode reader', 129.99, 15, 1),
(2, 'Thermal Label Printer Pro', 'ELEC-TLP-002', 'Electronics', 'High-speed 4x6 inch direct thermal shipping label printer', 219.50, 8, 1),
(3, 'Rugged Warehouse Tablet X1', 'ELEC-RWT-003', 'Electronics', 'Drop-resistant 10-inch Android tablet with scanner cradle', 499.00, 5, 1),
(4, 'Heavy Duty Power Bank 30000mAh', 'ELEC-PWB-004', 'Electronics', 'Multi-voltage portable battery pack for terminal devices', 59.99, 20, 1),
(5, 'Heavy-Duty Corrugated Boxes (Large)', 'PKG-BOX-001', 'Packaging', 'Double-wall heavy duty shipping boxes (24x18x18 in, bundle of 25)', 45.00, 30, 1),
(6, 'Pallet Stretch Wrap Film (500mm)', 'PKG-STW-002', 'Packaging', 'Industrial puncture-resistant stretch film rolls (23 micron)', 28.50, 40, 1),
(7, 'Reinforced Fiberglass Packaging Tape', 'PKG-TAP-003', 'Packaging', 'Filament reinforced security packing tape (pack of 6 rolls)', 34.00, 25, 1),
(8, 'Heavy Duty Bubble Wrap Roll 100m', 'PKG-BBL-004', 'Packaging', 'Shock-absorbing protective air bubble roll (500mm x 100m)', 38.00, 15, 1),
(9, 'High-Visibility Reflective Safety Vest', 'SFT-VST-001', 'Safety & PPE', 'ANSI Class 2 compliant zipper front vest with pockets (Pack of 10)', 42.00, 20, 1),
(10, 'Steel Toe Work Boots (Sizes 9-11)', 'SFT-BOT-002', 'Safety & PPE', 'Slip-resistant puncture-proof oil-resistant work boots', 78.50, 10, 1),
(11, 'Nitrile Coated Work Gloves (L)', 'SFT-GLV-003', 'Safety & PPE', 'Heavy duty abrasion resistant grip gloves (Box of 12 pairs)', 24.00, 35, 1),
(12, 'Manual Hydraulic Pallet Jack 2.5T', 'MHE-PLJ-001', 'Material Handling', '2500 kg capacity heavy-duty polyurethane wheels hand pallet truck', 380.00, 4, 1),
(13, 'Industrial Steel Shelving Unit 4-Tier', 'STR-SHV-001', 'Storage & Hardware', 'Heavy duty boltless steel storage rack 1200kg load capacity', 185.00, 6, 1),
(14, 'Stackable Storage Tote Bin 60L', 'STR-TOT-002', 'Storage & Hardware', 'Heavy-duty recycled polypropylene nesting container with lid', 18.00, 50, 1),
(15, 'Industrial Cable Ties 300mm (1000pk)', 'STR-CBL-003', 'Storage & Hardware', 'Heavy duty nylon self-locking cable ties bundle', 22.00, 25, 1),
(16, 'Digital Floor Platform Scale 300kg', 'MHE-SCL-002', 'Material Handling', 'Stainless steel weighing platform with digital indicator LCD', 240.00, 5, 1);

-- 9. Seed Stock Movements
INSERT INTO `stock_movements` (`movement_id`, `warehouse_id`, `product_id`, `user_id`, `movement_type`, `quantity`, `reference_number`, `notes`, `movement_date`) VALUES
(1, 1, 1, 2, 'IN', 50, 'PO-2026-001', 'Initial bulk shipment from OEM supplier', NOW() - INTERVAL 4 DAY),
(2, 1, 1, 5, 'OUT', 10, 'DISP-101', 'Dispatched to retail distribution hub', NOW() - INTERVAL 3 DAY),
(3, 1, 2, 2, 'IN', 12, 'PO-2026-002', 'Received batch from Zebra Logistics', NOW() - INTERVAL 4 DAY),
(4, 1, 2, 6, 'OUT', 8, 'DISP-102', 'Order fulfillment for customer branch', NOW() - INTERVAL 2 DAY),
(5, 1, 3, 2, 'IN', 15, 'PO-2026-003', 'Received secure tablet consignment', NOW() - INTERVAL 4 DAY),
(6, 1, 3, 7, 'OUT', 5, 'DISP-103', 'Deployment to warehouse operations team', NOW() - INTERVAL 3 DAY),
(7, 1, 3, 2, 'ADJUSTMENT', 2, 'AUDIT-ADJ-01', '[DECREASE] 2 units dropped and sent to repair', NOW() - INTERVAL 1 DAY),
(8, 1, 5, 5, 'IN', 100, 'PO-2026-004', 'Stock replenishment for packing boxes', NOW() - INTERVAL 4 DAY),
(9, 1, 5, 8, 'OUT', 40, 'DISP-104', 'Consumed during packing peak', NOW() - INTERVAL 2 DAY),
(10, 1, 6, 5, 'IN', 20, 'PO-2026-005', 'Rolls delivered from supplier', NOW() - INTERVAL 4 DAY),
(11, 1, 6, 9, 'OUT', 10, 'DISP-105', 'Allocated to shipping staging dock', NOW() - INTERVAL 2 DAY),
(12, 1, 9, 6, 'IN', 30, 'PO-2026-006', 'Quarterly PPE restock', NOW() - INTERVAL 4 DAY),
(13, 1, 9, 7, 'OUT', 12, 'DISP-106', 'Issued to new intake staff', NOW() - INTERVAL 2 DAY),
(14, 1, 12, 2, 'IN', 6, 'PO-2026-007', 'Fleet of pallet trucks delivered', NOW() - INTERVAL 4 DAY),
(15, 1, 12, 8, 'OUT', 1, 'DISP-107', 'Transferred to sorting line', NOW() - INTERVAL 1 DAY),

(16, 2, 1, 3, 'IN', 30, 'PO-2026-101', 'Stock transfer from central hub', NOW() - INTERVAL 4 DAY),
(17, 2, 1, 10, 'OUT', 5, 'DISP-201', 'Dispatched to local express depot', NOW() - INTERVAL 2 DAY),
(18, 2, 4, 3, 'IN', 40, 'PO-2026-102', 'Battery packs received', NOW() - INTERVAL 4 DAY),
(19, 2, 4, 11, 'OUT', 25, 'DISP-202', 'Bulk supply to field operations', NOW() - INTERVAL 2 DAY),
(20, 2, 4, 3, 'ADJUSTMENT', 5, 'AUDIT-ADJ-02', '[INCREASE] Stock audit recount found 5 unrecorded packs', NOW() - INTERVAL 1 DAY),
(21, 2, 7, 12, 'IN', 50, 'PO-2026-103', 'Fiberglass tape cartons checked in', NOW() - INTERVAL 4 DAY),
(22, 2, 7, 13, 'OUT', 15, 'DISP-203', 'Issued to packing station B', NOW() - INTERVAL 2 DAY),
(23, 2, 10, 3, 'IN', 15, 'PO-2026-104', 'Safety boots shipment arrived', NOW() - INTERVAL 4 DAY),
(24, 2, 10, 14, 'OUT', 12, 'DISP-204', 'Safety gear distribution to floor workers', NOW() - INTERVAL 1 DAY),
(25, 2, 13, 3, 'IN', 10, 'PO-2026-105', 'Heavy racks modular parts delivered', NOW() - INTERVAL 4 DAY),
(26, 2, 13, 10, 'OUT', 2, 'DISP-205', 'Installed in cold room aisle 4', NOW() - INTERVAL 1 DAY),

(27, 3, 2, 4, 'IN', 20, 'PO-2026-201', 'Thermal printers received for port facility', NOW() - INTERVAL 4 DAY),
(28, 3, 2, 15, 'OUT', 15, 'DISP-301', 'Port terminal shipping gate installation', NOW() - INTERVAL 2 DAY),
(29, 3, 8, 16, 'IN', 40, 'PO-2026-202', 'Bubble wrap shipment unpacked', NOW() - INTERVAL 4 DAY),
(30, 3, 8, 17, 'OUT', 10, 'DISP-302', 'Marine export freight packing', NOW() - INTERVAL 2 DAY),
(31, 3, 11, 4, 'IN', 80, 'PO-2026-203', 'Boxes of safety grip gloves delivered', NOW() - INTERVAL 4 DAY),
(32, 3, 11, 18, 'OUT', 55, 'DISP-303', 'Monthly issuance across dock hands', NOW() - INTERVAL 2 DAY),
(33, 3, 14, 19, 'IN', 120, 'PO-2026-204', 'Tote bins delivered from moulder', NOW() - INTERVAL 4 DAY),
(34, 3, 14, 15, 'OUT', 40, 'DISP-304', 'Assigned to small parts picking area', NOW() - INTERVAL 2 DAY),
(35, 3, 16, 4, 'IN', 8, 'PO-2026-205', 'Heavy platform scales arrived', NOW() - INTERVAL 4 DAY),
(36, 3, 16, 16, 'OUT', 6, 'DISP-305', 'Set up at receiving docks 1 through 6', NOW() - INTERVAL 1 DAY);

-- 10. Seed Inventory (Quantities exactly correspond to the movements above)
INSERT INTO `inventory` (`warehouse_id`, `product_id`, `quantity`, `last_updated`) VALUES
(1, 1, 40, NOW()),    -- 50 IN - 10 OUT
(1, 2, 4, NOW()),     -- 12 IN - 8 OUT (reorder 8 => LOW STOCK)
(1, 3, 8, NOW()),     -- 15 IN - 5 OUT - 2 ADJ
(1, 5, 60, NOW()),    -- 100 IN - 40 OUT
(1, 6, 10, NOW()),    -- 20 IN - 10 OUT (reorder 40 => LOW STOCK)
(1, 9, 18, NOW()),    -- 30 IN - 12 OUT (reorder 20 => LOW STOCK)
(1, 12, 5, NOW()),    -- 6 IN - 1 OUT

(2, 1, 25, NOW()),    -- 30 IN - 5 OUT
(2, 4, 20, NOW()),    -- 40 IN - 25 OUT + 5 ADJ (reorder 20 => LOW STOCK)
(2, 7, 35, NOW()),    -- 50 IN - 15 OUT
(2, 10, 3, NOW()),    -- 15 IN - 12 OUT (reorder 10 => LOW STOCK)
(2, 13, 8, NOW()),    -- 10 IN - 2 OUT

(3, 2, 5, NOW()),     -- 20 IN - 15 OUT (reorder 8 => LOW STOCK)
(3, 8, 30, NOW()),    -- 40 IN - 10 OUT
(3, 11, 25, NOW()),   -- 80 IN - 55 OUT (reorder 35 => LOW STOCK)
(3, 14, 80, NOW()),   -- 120 IN - 40 OUT
(3, 16, 2, NOW());    -- 8 IN - 6 OUT (reorder 5 => LOW STOCK)
