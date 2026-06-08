// Migration: 把 "order".status CHECK constraint 從舊版三個值
//   ('待製作','製作中','已完成')
// 改成 schema v3 的五個值
//   ('待製作','製作中','待付款','已完成','已取消')
//
// 跑法：先停 dev server，然後 `node scripts/migrate-order-status-constraint.js`

const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

const DB_PATH = path.join(__dirname, '..', 'data', 'jinhaoke.db')

if (!fs.existsSync(DB_PATH)) {
  console.error('找不到 DB：', DB_PATH)
  process.exit(1)
}

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

const currentSql = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='order'"
).get()

if (!currentSql) {
  console.error('找不到 order table')
  process.exit(1)
}

console.log('目前 schema：')
console.log(currentSql.sql)
console.log()

const NEW_VALUES = ['待製作', '製作中', '待付款', '已完成', '已取消']
const allPresent = NEW_VALUES.every(v => currentSql.sql.includes(`'${v}'`))
if (allPresent && currentSql.sql.includes('待付款') && currentSql.sql.includes('已取消')) {
  console.log('CHECK constraint 已是新版五個值，不需 migrate。')
  process.exit(0)
}

console.log('開始 migrate……')

const migrate = db.transaction(() => {
  db.exec(`
    CREATE TABLE "order_new" (
      order_id       TEXT    PRIMARY KEY,
      order_date     TEXT    NOT NULL,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now', '+8 hours')),
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now', '+8 hours')),
      status         TEXT    NOT NULL DEFAULT '待製作'
                     CHECK (status IN ('待製作','製作中','待付款','已完成','已取消')),
      customer_phone TEXT,
      FOREIGN KEY (customer_phone) REFERENCES delivery_customer(phone)
          ON UPDATE CASCADE ON DELETE SET NULL
    );

    INSERT INTO "order_new" (order_id, order_date, created_at, updated_at, status, customer_phone)
      SELECT order_id, order_date, created_at, updated_at, status, customer_phone FROM "order";
  `)

  // order_item FK 是參考 "order"(order_id)，drop 舊表前先停 FK
  db.pragma('foreign_keys = OFF')
  db.exec(`DROP TABLE "order";`)
  db.exec(`ALTER TABLE "order_new" RENAME TO "order";`)

  // 重建 index
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_order_date ON "order"(order_date);
    CREATE INDEX IF NOT EXISTS idx_order_status ON "order"(status);
    CREATE INDEX IF NOT EXISTS idx_order_phone ON "order"(customer_phone);
  `)
  db.pragma('foreign_keys = ON')
})

migrate()

const after = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='order'"
).get()
console.log('新 schema：')
console.log(after.sql)
console.log('Migration 完成。')

db.close()
