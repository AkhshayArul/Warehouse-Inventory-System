-- =============================================================================
-- Warehouse Inventory Management System
-- Database Schema: EXACTLY FIVE TABLES
-- Normalized to 3NF with constraints, view, stored procedure, and trigger
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `warehouse_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `warehouse_db`;

-- Temporarily disable foreign key checks for clean drops if recreating
SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW IF EXISTS `vw_inventory_details`;
DROP PROCEDURE IF EXISTS `sp_get_warehouse_inventory_summary`;
DROP TRIGGER IF EXISTS `trg_prevent_negative_inventory`;
DROP TABLE IF EXISTS `stock_movements`;
DROP TABLE IF EXISTS `inventory`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `warehouses`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 1. USERS Table (Created first without warehouse FK to avoid circular dependency)
-- -----------------------------------------------------------------------------
CREATE TABLE `users` (
  `user_id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(15) NULL,
  `role` ENUM('admin', 'manager', 'staff') NOT NULL DEFAULT 'staff',
  `warehouse_id` INT NULL,
  CONSTRAINT `chk_user_role` CHECK (`role` IN ('admin', 'manager', 'staff'))
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 2. WAREHOUSES Table
-- -----------------------------------------------------------------------------
CREATE TABLE `warehouses` (
  `warehouse_id` INT AUTO_INCREMENT PRIMARY KEY,
  `warehouse_name` VARCHAR(100) NOT NULL UNIQUE,
  `location` VARCHAR(255) NOT NULL,
  `manager_id` INT NOT NULL UNIQUE,
  CONSTRAINT `fk_warehouses_manager` FOREIGN KEY (`manager_id`)
    REFERENCES `users` (`user_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Add foreign key from users.warehouse_id to warehouses.warehouse_id
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_warehouse` FOREIGN KEY (`warehouse_id`)
    REFERENCES `warehouses` (`warehouse_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 3. PRODUCTS Table
-- -----------------------------------------------------------------------------
CREATE TABLE `products` (
  `product_id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_name` VARCHAR(150) NOT NULL,
  `sku` VARCHAR(50) NOT NULL UNIQUE,
  `category` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `unit_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `reorder_level` INT NOT NULL DEFAULT 10,
  `created_by` INT NOT NULL,
  CONSTRAINT `chk_product_unit_price` CHECK (`unit_price` >= 0),
  CONSTRAINT `chk_product_reorder_level` CHECK (`reorder_level` >= 0),
  CONSTRAINT `fk_products_creator` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`user_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 4. INVENTORY Table (Composite Primary Key)
-- -----------------------------------------------------------------------------
CREATE TABLE `inventory` (
  `warehouse_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` INT NOT NULL DEFAULT 0,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`warehouse_id`, `product_id`),
  CONSTRAINT `chk_inventory_quantity` CHECK (`quantity` >= 0),
  CONSTRAINT `fk_inventory_warehouse` FOREIGN KEY (`warehouse_id`)
    REFERENCES `warehouses` (`warehouse_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_inventory_product` FOREIGN KEY (`product_id`)
    REFERENCES `products` (`product_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 5. STOCK_MOVEMENTS Table
-- -----------------------------------------------------------------------------
CREATE TABLE `stock_movements` (
  `movement_id` INT AUTO_INCREMENT PRIMARY KEY,
  `warehouse_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `movement_type` ENUM('IN', 'OUT', 'ADJUSTMENT') NOT NULL,
  `quantity` INT NOT NULL,
  `reference_number` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `movement_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `chk_movement_type` CHECK (`movement_type` IN ('IN', 'OUT', 'ADJUSTMENT')),
  CONSTRAINT `chk_movement_quantity` CHECK (`quantity` > 0),
  CONSTRAINT `fk_movements_warehouse` FOREIGN KEY (`warehouse_id`)
    REFERENCES `warehouses` (`warehouse_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_movements_product` FOREIGN KEY (`product_id`)
    REFERENCES `products` (`product_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_movements_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`user_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- REQUIRED DATABASE OBJECTS
-- =============================================================================

-- VIEW: vw_inventory_details
-- Joins inventory, products, and warehouses to show product names, SKU, category,
-- warehouse name, quantity, reorder level, unit price, and inventory value.
CREATE OR REPLACE VIEW `vw_inventory_details` AS
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
FROM `inventory` i
JOIN `products` p ON i.product_id = p.product_id
JOIN `warehouses` w ON i.warehouse_id = w.warehouse_id;

-- STORED PROCEDURE: sp_get_warehouse_inventory_summary
-- Return total distinct products, total units, and total inventory value for a warehouse.
-- If p_warehouse_id is NULL or 0, returns summary across all warehouses.
DELIMITER $$
CREATE PROCEDURE `sp_get_warehouse_inventory_summary`(IN p_warehouse_id INT)
BEGIN
  IF p_warehouse_id IS NULL OR p_warehouse_id = 0 THEN
    SELECT 
      COUNT(DISTINCT i.product_id) AS total_distinct_products,
      COALESCE(SUM(i.quantity), 0) AS total_units,
      COALESCE(SUM(ROUND(i.quantity * p.unit_price, 2)), 0.00) AS total_inventory_value,
      COUNT(CASE WHEN i.quantity <= p.reorder_level THEN 1 END) AS low_stock_items_count
    FROM `inventory` i
    JOIN `products` p ON i.product_id = p.product_id;
  ELSE
    SELECT 
      COUNT(DISTINCT i.product_id) AS total_distinct_products,
      COALESCE(SUM(i.quantity), 0) AS total_units,
      COALESCE(SUM(ROUND(i.quantity * p.unit_price, 2)), 0.00) AS total_inventory_value,
      COUNT(CASE WHEN i.quantity <= p.reorder_level THEN 1 END) AS low_stock_items_count
    FROM `inventory` i
    JOIN `products` p ON i.product_id = p.product_id
    WHERE i.warehouse_id = p_warehouse_id;
  END IF;
END$$
DELIMITER ;

-- TRIGGER: trg_prevent_negative_inventory
-- Ensures inventory quantity never becomes negative on UPDATE
DELIMITER $$
CREATE TRIGGER `trg_prevent_negative_inventory`
BEFORE UPDATE ON `inventory`
FOR EACH ROW
BEGIN
  IF NEW.quantity < 0 THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Transaction rejected: Inventory quantity cannot fall below zero.';
  END IF;
END$$
DELIMITER ;
