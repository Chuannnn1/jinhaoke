// Migration: 為 ingredient 加上 order_block_threshold 欄位
// 用途：接單暫停點。NULL 表示用 safety_stock * 0.2 的 fallback。
//
// 跑法：先停 dev server，然後 `node scripts/migrate-add-block-threshold.js`
// Idempotent：重複執行不會出錯。

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

// 檢查欄位是否已存在
const cols = db.prepare("PRAGMA table_info(ingredient)").all()
const has = cols.some(c => c.name === 'order_block_threshold')

if (has) {
  console.log('ingredient.order_block_threshold 已存在，不需 migrate。')
  process.exit(0)
}

console.log('開始 migrate……')

db.exec(`ALTER TABLE ingredient ADD COLUMN order_block_threshold REAL DEFAULT NULL`)

const after = db.prepare("PRAGMA table_info(ingredient)").all()
console.log('新 ingredient 欄位：')
console.log(after.map(c => `  ${c.name} ${c.type}${c.dflt_value !== null ? ' DEFAULT ' + c.dflt_value : ''}`).join('\n'))
console.log('Migration 完成。')

db.close()
