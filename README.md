# Warehouse Inventory Management System (DBMS Project)

A production-ready **Warehouse Inventory Management System** built with **React (Vite, plain CSS)**, **Node.js + Express**, and **MySQL Community Server (using `mysql2`)**.

---

## 1. Tech Stack

- **Frontend:** React 18, Vite, Plain CSS (No Tailwind, No Bootstrap, No TypeScript)
- **Backend:** Node.js, Express, `mysql2/promise`, `bcryptjs`, `jsonwebtoken`
- **Database:** MySQL Community Server (Version 26.10 / 8.x)

---

## 2. Exact Database Schema — Five Normalized Tables (3NF)

The schema contains **exactly five tables** designed in **Third Normal Form (3NF)**:

```
+-------------+         +-------------+         +------------------+
| warehouses  | 1 --- 1 |    users    | 1 --- * | stock_movements  |
+-------------+         +-------------+         +------------------+
       | 1                     | 1                       | *
       |                       |                         |
       | *                     | *                       | 1
+-------------+         +-------------+                  |
|  inventory  | * --- 1 |  products   | -----------------+
+-------------+         +-------------+
```

1. **`users`**:
   - `user_id` (PK, AUTO_INCREMENT)
   - `full_name`, `email` (UNIQUE), `password_hash` (bcrypt), `phone`
   - `role` ENUM('admin', 'manager', 'staff')
   - `warehouse_id` (FK to `warehouses.warehouse_id`, NULL for Admin)

2. **`warehouses`**:
   - `warehouse_id` (PK, AUTO_INCREMENT)
   - `warehouse_name` (VARCHAR(100), UNIQUE)
   - `location` (VARCHAR(255))
   - `manager_id` (INT, UNIQUE, FK to `users.user_id`)

3. **`products`**:
   - `product_id` (PK, AUTO_INCREMENT)
   - `product_name` (VARCHAR(150))
   - `sku` (VARCHAR(50), UNIQUE)
   - `category` (VARCHAR(100))
   - `description` (TEXT)
   - `unit_price` (DECIMAL(10,2), CHECK >= 0)
   - `reorder_level` (INT, CHECK >= 0)
   - `created_by` (FK to `users.user_id`)

4. **`inventory`**:
   - `warehouse_id` (FK to `warehouses.warehouse_id`)
   - `product_id` (FK to `products.product_id`)
   - `quantity` (INT, CHECK >= 0)
   - `last_updated` (DATETIME)
   - **Composite Primary Key:** `(warehouse_id, product_id)`

5. **`stock_movements`**:
   - `movement_id` (PK, AUTO_INCREMENT)
   - `warehouse_id` (FK to `warehouses.warehouse_id`)
   - `product_id` (FK to `products.product_id`)
   - `user_id` (FK to `users.user_id`)
   - `movement_type` ENUM('IN', 'OUT', 'ADJUSTMENT')
   - `quantity` (INT, CHECK `quantity > 0`)
   - `reference_number` (VARCHAR(100))
   - `notes` (TEXT)
   - `movement_date` (DATETIME)

### 3NF Normalization Justification
- **1NF:** All attributes are atomic; no repeating groups; composite PK for `inventory`.
- **2NF:** All non-key attributes are fully functionally dependent on the entire primary key. In `inventory`, `quantity` depends on the pair `(warehouse_id, product_id)`.
- **3NF:** No transitive dependencies. Product details (such as price and category) reside in `products`; user details reside in `users`. Inventory values are calculated dynamically (`quantity * unit_price`).

---

## 3. Required Database Objects

1. **VIEW `vw_inventory_details`**:
   - Joins `inventory`, `products`, and `warehouses` to provide real-time details: product name, SKU, category, warehouse name, quantity, reorder level, unit price, and calculated `inventory_value`.
2. **STORED PROCEDURE `sp_get_warehouse_inventory_summary(p_warehouse_id INT)`**:
   - Returns aggregated distinct products, total physical units, total inventory value, and low stock count for a specified warehouse or across all warehouses.
3. **TRIGGER `trg_prevent_negative_inventory`**:
   - Fires `BEFORE UPDATE ON inventory` to prevent any transaction from setting `quantity < 0` via `SIGNAL SQLSTATE '45000'`.

---

## 4. Test Accounts & Login Credentials

All passwords are encrypted with bcrypt. The system contains **19 seeded users**:

### Admin
- **Email:** `admin@warehouse.com`
- **Password:** `admin@123`
- **Role:** `admin` (Unrestricted global access)

### Central Warehouse (Manager + 5 Staff)
- **Manager:** Alex Manager (`alexmanager@company.com` / `PASSWORD`)
- **Staff 1:** Arjun Kumar (`arjunkumar@company.com` / `PASSWORD`)
- **Staff 2:** Ananya Sharma (`ananyasharma@company.com` / `PASSWORD`)
- **Staff 3:** Karthik Raj (`karthikraj@company.com` / `PASSWORD`)
- **Staff 4:** Meera Patel (`meerapatel@company.com` / `PASSWORD`)
- **Staff 5:** Vikram Singh (`vikramsingh@company.com` / `PASSWORD`)

### North Warehouse (Manager + 5 Staff)
- **Manager:** Priya Manager (`priyamanager@company.com` / `PASSWORD`)
- **Staff 1:** Sneha Reddy (`snehareddy@company.com` / `PASSWORD`)
- **Staff 2:** Rahul Verma (`rahulverma@company.com` / `PASSWORD`)
- **Staff 3:** Divya Nair (`divyanair@company.com` / `PASSWORD`)
- **Staff 4:** Aditya Rao (`adityarao@company.com` / `PASSWORD`)
- **Staff 5:** Pooja Iyer (`poojaiyer@company.com` / `PASSWORD`)

### South Warehouse (Manager + 5 Staff)
- **Manager:** Rahul Manager (`rahulmanager@company.com` / `PASSWORD`)
- **Staff 1:** Neha Kapoor (`nehakapoor@company.com` / `PASSWORD`)
- **Staff 2:** Sanjay Gupta (`sanjaygupta@company.com` / `PASSWORD`)
- **Staff 3:** Ishita Das (`ishitadas@company.com` / `PASSWORD`)
- **Staff 4:** Rohan Mehta (`rohanmehta@company.com` / `PASSWORD`)
- **Staff 5:** Kavya Menon (`kavyamenon@company.com` / `PASSWORD`)

---

## 5. How to Run the Application

### 1. Database Setup
Ensure MySQL is running on `localhost:3306`. Configure credentials in `server/.env` if needed:
```bash
# Seed the database (creates tables, view, stored proc, trigger, and 19 users)
$env:NODE_PATH="server/node_modules"; node database/init-db.js
```

### 2. Start Backend Server
```bash
node server/src/index.js
```
Runs at: `http://localhost:5000`

### 3. Start Frontend Client
```bash
npm.cmd run dev --prefix client
```
Runs at: `http://localhost:5173`

---

## 6. Verification and Automated Test Scripts

Run the built-in test suites to verify constraints, triggers, and APIs:

```bash
# 1. Verify schema, 5 tables, VIEW, PROCEDURE, TRIGGER, and mathematical stock consistency:
$env:NODE_PATH="server/node_modules"; node database/verify-system.js

# 2. Test full end-to-end HTTP API authentication, role scoping, transactions & rollbacks:
node database/test-api.js
```
