# jinhaoke SQLite → MySQL Migration Plan

> Target: `C:\Users\Chuannnn\Documents\GitHub\jinhaoke-mysql`
> Original (do not touch): `C:\Users\Chuannnn\Documents\GitHub\jinhaoke`
> Date: 2026-06-20

---

## Overview

Convert the jinhaoke POS system from `better-sqlite3` (synchronous, file-based) to `mysql2` (async, XAMPP MySQL server). The goal is to present the database via phpMyAdmin to a professor.

**Key architectural change**: `better-sqlite3` is synchronous (`db.prepare().get()` returns data immediately). `mysql2` is asynchronous (`await pool.execute()` returns `[rows, fields]`). Every DB call in every file must become `async/await`.

---

## Task Dependency Graph

```
TASK 0 (prerequisite, manual)
   |
TASK 1 (foundation: package.json + lib/db.ts + lib/schema.sql)
   |
   +---> TASK 2 (lib: auth.ts, availability.ts, order-consumption.ts)
   |        |
   +---> TASK 3 (API routes group A: auth, menu, ingredients, inventory, suppliers)
   |        |
   +---> TASK 4 (API routes group B: orders, purchase, purchase-orders, reports)
   |        |
   +---> TASK 5 (scripts: init-db.js, seed-data.js, seed-only.js, set-admin-password.js)
   |
   v
TASK 6 (data migration: SQLite dump → MySQL import)
   |
TASK 7 (verification: build + manual test)
```

**Parallelizable**: Tasks 2, 3, 4, 5 can all run in parallel AFTER Task 1 is complete. They edit different files with no overlap.

---

## TASK 0: Prerequisites (Manual)

1. Install XAMPP, start Apache + MySQL
2. Open phpMyAdmin (`http://localhost/phpmyadmin`)
3. Create database:
   ```sql
   CREATE DATABASE jinhaoke CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
4. Note credentials (default XAMPP: host=`localhost`, user=`root`, password=`` (empty), port=`3306`)

---

## TASK 1: Foundation (BLOCKING — all other tasks depend on this)

### Files to modify:
- `package.json`
- `lib/db.ts` (full rewrite)
- `lib/schema.sql` (full rewrite)
- `.env.local` (create)

### 1A. package.json

Remove `better-sqlite3` and `@types/better-sqlite3`. Add `mysql2`.

```diff
  "dependencies": {
-   "better-sqlite3": "^12.10.0",
+   "mysql2": "^3.14.0",
    "next": "^14.2.0",
  },
  "devDependencies": {
-   "@types/better-sqlite3": "^7.6.13",
  }
```

Then run `npm install`.

### 1B. .env.local (create new file)

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=jinhaoke
```

### 1C. lib/db.ts (full rewrite)

Replace the entire file. The new module must:

1. Export a `getPool()` function that returns a `mysql2/promise` connection pool (singleton)
2. NO schema auto-execution (MySQL schema is run separately via init script)
3. NO seedIfEmpty (handled by init script)
4. Pool config reads from env vars (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)

**New API contract** (all other tasks depend on this interface):

```typescript
import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'jinhaoke',
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
    })
  }
  return pool
}
```

### 1D. lib/schema.sql (full rewrite to MySQL syntax)

Every SQLite-specific construct must be converted:

| SQLite | MySQL |
|--------|-------|
| `PRAGMA foreign_keys = ON` | Remove (InnoDB default) |
| `TEXT PRIMARY KEY` | `VARCHAR(100) PRIMARY KEY` (for supplier.name, ingredient.name, delivery_customer.phone, admin_session.token, admin_setting.key) |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `INT PRIMARY KEY AUTO_INCREMENT` |
| `REAL` | `DOUBLE` |
| `TEXT` (non-PK) | `TEXT` (keep as-is, or `VARCHAR(255)` for indexed columns) |
| `"order"` (double-quoted) | `` `order` `` (backtick) |
| `datetime('now', '+8 hours')` | `DATE_ADD(NOW(), INTERVAL 8 HOUR)` |
| `CREATE TABLE IF NOT EXISTS` | Same (MySQL supports it) |
| `CREATE INDEX IF NOT EXISTS` | Same (MySQL 8.0 supports it; for older versions use `ALTER TABLE ... ADD INDEX ... IF NOT EXISTS` or wrap in procedure) |
| `CHECK (status IN (...))` | Same (MySQL 8.0.16+ enforces CHECK) |
| `FOREIGN KEY ... ON UPDATE CASCADE ON DELETE SET NULL` | Same syntax |

**Important column length constraints for MySQL PKs:**
- `supplier.name` → `VARCHAR(100)`
- `ingredient.name` → `VARCHAR(100)`
- `ingredient.supplier_name` → `VARCHAR(100)`
- `delivery_customer.phone` → `VARCHAR(50)`
- `order.order_id` → `VARCHAR(20)`
- `order.customer_phone` → `VARCHAR(50)`
- `order_item.order_id` → `VARCHAR(20)`
- `admin_session.token` → `VARCHAR(64)` (fixed length hex)
- `admin_setting.key` → `VARCHAR(100)`
- `menu_item.name` → add `VARCHAR(100)` for the UNIQUE constraint
- `recipe.ingredient_name` → `VARCHAR(100)` (FK to ingredient.name)
- `ingredient_supplier.ingredient_name` → `VARCHAR(100)`
- `ingredient_supplier.supplier_name` → `VARCHAR(100)`
- `purchase_order.supplier_name` → `VARCHAR(100)`
- `purchase_order_item.ingredient_name` → `VARCHAR(100)`
- `return_order.ingredient_name` → `VARCHAR(100)`

All other TEXT columns (descriptions, notes, JSON fields) can stay as `TEXT`.

---

## TASK 2: Lib Files (after Task 1)

### Files to modify:
- `lib/auth.ts`
- `lib/availability.ts`
- `lib/order-consumption.ts`

### Universal conversion pattern

Every file follows the same transformation:

**Before (SQLite sync)**:
```typescript
import { getDb } from './db'
// ...
const db = getDb()
const row = db.prepare('SELECT * FROM foo WHERE id = ?').get(id) as Foo
const rows = db.prepare('SELECT * FROM foo').all() as Foo[]
const result = db.prepare('UPDATE foo SET x = ? WHERE id = ?').run(val, id)
// result.changes = number of affected rows
```

**After (MySQL async)**:
```typescript
import { getPool } from './db'
// ...
const pool = getPool()
const [rows] = await pool.execute<mysql.RowDataPacket[]>('SELECT * FROM foo WHERE id = ?', [id])
const row = rows[0] as Foo | undefined  // .get() equivalent
// For all rows: rows as Foo[]
const [result] = await pool.execute<mysql.ResultSetHeader>('UPDATE foo SET x = ? WHERE id = ?', [val, id])
// result.affectedRows = number of affected rows
```

**Transaction pattern**:

Before:
```typescript
db.transaction(() => {
  db.prepare('...').run(...)
  db.prepare('...').run(...)
})()
```

After:
```typescript
const conn = await pool.getConnection()
try {
  await conn.beginTransaction()
  await conn.execute('...', [...])
  await conn.execute('...', [...])
  await conn.commit()
} catch (err) {
  await conn.rollback()
  throw err
} finally {
  conn.release()
}
```

**ON CONFLICT → ON DUPLICATE KEY UPDATE**:

Before:
```sql
INSERT INTO admin_setting (key, value, updated_at) VALUES (?, ?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
```

After:
```sql
INSERT INTO admin_setting (`key`, `value`, updated_at) VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), updated_at = VALUES(updated_at)
```

Note: `key` and `value` are MySQL reserved words — must be backtick-quoted.

### 2A. lib/auth.ts

- Change `import { getDb } from './db'` → `import { getPool } from './db'`
- Import `mysql` types: `import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'`
- Every function that calls DB becomes `async`:
  - `createSession()` → `async createSession()`
  - `isValidSession()` → `async isValidSession()`
  - `deleteSession()` → `async deleteSession()`
  - `cleanExpiredSessions()` → `async cleanExpiredSessions()`
  - `getAdminSetting()` → `async getAdminSetting()`
  - `setAdminSetting()` → `async setAdminSetting()`
  - `getStoredHash()` → `async getStoredHash()`
  - `hasAdminPassword()` → `async hasAdminPassword()`
  - `requireAdmin()` → `async requireAdmin()`
- `hashPassword()`, `verifyPassword()`, `getSessionTokenFromRequest()`, `buildSessionCookie()`, `buildClearCookie()` — pure functions, no change needed
- The `ON CONFLICT` in `setAdminSetting` → `ON DUPLICATE KEY UPDATE`
- Backtick-quote `key` and `value` (MySQL reserved words)

### 2B. lib/availability.ts

- `computeAvailability()` → `async computeAvailability()`
- Two DB queries inside → both need `await pool.execute()`
- No transactions, no upserts — straightforward conversion
- Return type stays the same

### 2C. lib/order-consumption.ts

- `computeOrderConsumption()` → `async computeOrderConsumption()`
- `findInsufficientIngredients()` → `async findInsufficientIngredients()`
- Dynamic `IN (?,?,?)` placeholder: same syntax in MySQL, no change needed
- The `ADDON_TO_REF_ITEM` constant and `OrderItemInput` interface — no change

---

## TASK 3: API Routes Group A (after Task 1)

### Files (14 routes):

**Auth (6 files)**:
1. `app/api/auth/login/route.ts`
2. `app/api/auth/logout/route.ts`
3. `app/api/auth/me/route.ts`
4. `app/api/auth/setup/route.ts`
5. `app/api/auth/setup-status/route.ts`
6. `app/api/auth/change-password/route.ts`

**Menu (4 files)**:
7. `app/api/menu/route.ts`
8. `app/api/menu/[id]/route.ts`
9. `app/api/menu/availability/route.ts`
10. `app/api/menu/upload/route.ts`

**Ingredients (3 files)**:
11. `app/api/ingredients/route.ts`
12. `app/api/ingredients/[name]/route.ts`
13. `app/api/ingredients/[name]/suppliers/route.ts`

**Inventory (3 files)**:
14. `app/api/inventory/route.ts`
15. `app/api/inventory/[name]/route.ts`
16. `app/api/inventory/low-stock/route.ts`

**Suppliers (2 files)**:
17. `app/api/suppliers/route.ts`
18. `app/api/suppliers/[name]/route.ts`

### Conversion rules (apply to every file):

1. `import { getDb } from '@/lib/db'` → `import { getPool } from '@/lib/db'`
2. `const db = getDb()` → `const pool = getPool()`
3. Every `db.prepare(SQL).all(...args)` → `const [rows] = await pool.execute(SQL, [args])`
4. Every `db.prepare(SQL).get(...args)` → `const [rows] = await pool.execute(SQL, [args]); const row = rows[0]`
5. Every `db.prepare(SQL).run(...args)` → `const [result] = await pool.execute(SQL, [args])` (result is `ResultSetHeader`)
6. `result.changes` → `result.affectedRows`
7. `result.lastInsertRowid` → `result.insertId`
8. `"order"` (double-quoted table name) → `` `order` `` (backtick)
9. `ON CONFLICT(...) DO UPDATE SET col = excluded.col` → `ON DUPLICATE KEY UPDATE col = VALUES(col)`
10. Auth routes that call `requireAdmin(req)` — this function becomes async, so add `await`
11. Auth routes that call `isValidSession()`, `createSession()`, etc. — add `await`
12. Menu/availability routes that call `computeAvailability()` — add `await`

### SQL dialect changes to watch for:

- `"order"` → `` `order` `` (every query that touches the order table)
- `key` column name (admin_setting) → `` `key` ``
- `value` column name (admin_setting) → `` `value` ``
- Any `substr()` → `SUBSTRING()` (MySQL equivalent; `substr` also works in MySQL 8 but `SUBSTRING` is canonical)
- Any `LIKE ?` — same syntax, no change

---

## TASK 4: API Routes Group B (after Task 1)

### Files (14 routes):

**Orders (5 files)**:
1. `app/api/orders/route.ts` — **complex**: has transaction + ON CONFLICT + date logic
2. `app/api/orders/[id]/route.ts`
3. `app/api/orders/status/route.ts` — **complex**: transaction + inventory deduction
4. `app/api/orders/import/route.ts` — **complex**: transaction + `datetime('now', '+8 hours')` + bulk insert
5. `app/api/orders/auto-restock/route.ts` — transaction

**Purchase (3 files)**:
6. `app/api/purchase/route.ts` — transaction
7. `app/api/purchase/[po_id]/route.ts` — transaction + ON CONFLICT
8. `app/api/purchase/auto-generate/route.ts` — two transactions

**Purchase Orders (4 files)**:
9. `app/api/purchase-orders/route.ts` — transaction
10. `app/api/purchase-orders/[id]/route.ts`
11. `app/api/purchase-orders/[id]/receive/route.ts` — transaction
12. `app/api/purchase-orders/[id]/return/route.ts` — transaction

**Reports (3 files)**:
13. `app/api/reports/overview/route.ts` — **complex**: `substr()` for hourly bucketing
14. `app/api/reports/daily/route.ts`
15. `app/api/reports/monthly/route.ts`

### Special conversion notes for this group:

**orders/route.ts (POST)**:
- Transaction wraps: order_id generation, delivery_customer upsert, order insert, order_item inserts
- `ON CONFLICT(phone) DO UPDATE SET name = excluded.name` → `ON DUPLICATE KEY UPDATE name = VALUES(name)`
- `computeOrderConsumption()` and `findInsufficientIngredients()` become `await` (from Task 2)
- `computeAvailability()` becomes `await`

**orders/import/route.ts**:
- Contains `datetime('now', '+8 hours')` → replace with JS-side date computation (already mostly done in the code; just remove the SQLite fallback)
- Bulk transaction with many inserts

**orders/status/route.ts (PATCH)**:
- `computeOrderConsumption()` becomes `await`
- Transaction: update order status + deduct inventory

**purchase/[po_id]/route.ts (PATCH)**:
- `ON CONFLICT(po_id, ingredient_name) DO UPDATE SET ...` → `ON DUPLICATE KEY UPDATE ...`

**reports/overview/route.ts**:
- `substr(o.created_at, 12, 2)` → `SUBSTRING(o.created_at, 12, 2)` (or `HOUR(o.created_at)` if created_at is DATETIME type; but since it's stored as TEXT/VARCHAR in ISO format, `SUBSTRING` is safer)

**All transactions in this group**: Convert from `db.transaction(() => { ... })()` to:
```typescript
const conn = await pool.getConnection()
try {
  await conn.beginTransaction()
  // ... all db calls use conn.execute() instead of pool.execute()
  await conn.commit()
} catch (err) {
  await conn.rollback()
  throw err
} finally {
  conn.release()
}
```

**Important**: Inside a transaction, use `conn.execute()` (the connection), not `pool.execute()` (the pool). The pool would grab a different connection and bypass the transaction.

---

## TASK 5: Scripts (after Task 1)

### Files to modify:
- `scripts/init-db.js` (full rewrite)
- `scripts/seed-data.js` (full rewrite)
- `scripts/seed-only.js` (full rewrite)
- `scripts/set-admin-password.js` (full rewrite)

### Files to delete:
- `scripts/sqlite-viewer.js` (replaced by phpMyAdmin)
- All `scripts/migrate-*.js` (17 files) — migrations are baked into the new schema; no incremental migration needed for a fresh MySQL DB

### 5A. scripts/init-db.js

Rewrite to:
1. Connect to MySQL using `mysql2/promise`
2. Read `lib/schema.sql` and execute it (split by `;` and run each statement)
3. Call `seedAll()` from `seed-data.js`

Note: MySQL doesn't support multi-statement execution by default. Either:
- Enable `multipleStatements: true` in the connection config, OR
- Split the schema SQL by `;` and execute each statement individually

### 5B. scripts/seed-data.js

- Replace all `db.prepare(SQL).run(...)` → `await conn.execute(SQL, [...])`
- Replace all `db.prepare(SQL).get(...)` → `const [rows] = await conn.execute(SQL, [...]); const row = rows[0]`
- The `seedAll(db)` function signature changes to `async seedAll(conn)` where `conn` is a mysql2 connection
- All `INSERT ... VALUES` syntax is the same between SQLite and MySQL
- `"order"` table references → `` `order` ``

### 5C. scripts/seed-only.js

Rewrite to connect to MySQL and call `seedAll()`.

### 5D. scripts/set-admin-password.js

Replace `better-sqlite3` with `mysql2/promise`. The script just does one INSERT/UPDATE to `admin_setting`.

---

## TASK 6: Data Migration

After all code changes are complete, migrate existing data from SQLite to MySQL.

### Approach: Export from SQLite → Transform → Import to MySQL

```bash
# 1. Export each table from SQLite as INSERT statements
sqlite3 data/jinhaoke.db ".mode insert" ".output /tmp/dump_supplier.sql" "SELECT * FROM supplier;"
sqlite3 data/jinhaoke.db ".mode insert" ".output /tmp/dump_ingredient.sql" "SELECT * FROM ingredient;"
# ... repeat for each table

# 2. Transform: fix table quoting ("table" → `table`)
# 3. Import into MySQL:
mysql -u root jinhaoke < /tmp/dump_supplier.sql
```

Or write a Node.js migration script that:
1. Opens the SQLite DB (read-only)
2. Connects to MySQL
3. For each table: SELECT all from SQLite → batch INSERT into MySQL

**Table import order** (respect FK constraints):
1. `supplier`
2. `ingredient`
3. `ingredient_supplier`
4. `menu_item`
5. `recipe`
6. `delivery_customer`
7. `order`
8. `order_item`
9. `purchase_order`
10. `purchase_order_item`
11. `return_order`
12. `admin_setting`
13. `admin_session`

---

## TASK 7: Verification

### Build check:
```bash
cd jinhaoke-mysql
npm run build
```

### Runtime check:
1. Start XAMPP MySQL
2. Run `node scripts/init-db.js` (creates tables + seeds)
3. `npm run dev`
4. Open `http://localhost:3100` — test ordering flow
5. Open `http://localhost:3100/admin` — test dashboard, inventory, order management
6. Open phpMyAdmin (`http://localhost/phpmyadmin`) — verify tables, data, structure

### Critical paths to test:
- [ ] Front-page menu loads (`GET /api/menu`)
- [ ] Place an order (`POST /api/orders`)
- [ ] Mark order as done → inventory deducts (`PATCH /api/orders/status`)
- [ ] Admin login (`POST /api/auth/login`)
- [ ] Dashboard KPIs load (`GET /api/reports/overview`)
- [ ] Inventory page loads (`GET /api/inventory`)
- [ ] Purchase order creation (`POST /api/purchase`)
- [ ] phpMyAdmin shows all 13 tables with correct schema

---

## File Change Summary

| Task | Files Modified | Files Created | Files Deleted |
|------|---------------|--------------|--------------|
| 1 | `package.json`, `lib/db.ts`, `lib/schema.sql` | `.env.local` | — |
| 2 | `lib/auth.ts`, `lib/availability.ts`, `lib/order-consumption.ts` | — | — |
| 3 | 18 API route files (auth/menu/ingredients/inventory/suppliers) | — | — |
| 4 | 15 API route files (orders/purchase/purchase-orders/reports) | — | — |
| 5 | `scripts/init-db.js`, `scripts/seed-data.js`, `scripts/seed-only.js`, `scripts/set-admin-password.js` | — | `scripts/sqlite-viewer.js` + 17 `migrate-*.js` |
| 6 | — | `scripts/migrate-sqlite-to-mysql.js` | — |
| **Total** | **40 files** | **2 files** | **18 files** |

---

## MySQL Reserved Words in This Codebase

The following column/table names are MySQL reserved words and MUST be backtick-quoted in all SQL:

- `` `order` `` (table name)
- `` `key` `` (admin_setting column)
- `` `value` `` (admin_setting column)
- `` `name` `` (technically reserved in some MySQL versions; safe to quote preventively)

---

## Quick Reference: Conversion Cheatsheet

```
getDb()                           → getPool()
db.prepare(sql).all(...args)      → const [rows] = await pool.execute(sql, [...args])
db.prepare(sql).get(...args)      → const [rows] = await pool.execute(sql, [...args]); rows[0]
db.prepare(sql).run(...args)      → const [result] = await pool.execute(sql, [...args])
result.changes                    → result.affectedRows
result.lastInsertRowid            → result.insertId
db.transaction(() => {})()        → conn = await pool.getConnection(); try { beginTransaction; ...; commit } catch { rollback } finally { release }
ON CONFLICT(col) DO UPDATE SET    → ON DUPLICATE KEY UPDATE
excluded.col                      → VALUES(col)
"order"                           → `order`
datetime('now','+8 hours')        → DATE_ADD(NOW(), INTERVAL 8 HOUR)  [or compute in JS]
substr(x, start, len)             → SUBSTRING(x, start, len)
AUTOINCREMENT                     → AUTO_INCREMENT
TEXT PRIMARY KEY                  → VARCHAR(100) PRIMARY KEY
PRAGMA ...                        → (delete)
```
