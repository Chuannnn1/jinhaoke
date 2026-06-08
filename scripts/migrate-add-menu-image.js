// Migration: 給 menu_item 新增 image_url 欄位
//   image_url TEXT NOT NULL DEFAULT ''
//
// 跑法：先停 dev server，然後 `node scripts/migrate-add-menu-image.js`

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

const tableExists = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='menu_item'"
).get()

if (!tableExists) {
  console.error('找不到 menu_item table')
  process.exit(1)
}

const columns = db.prepare("PRAGMA table_info(menu_item)").all()
const hasImageUrl = columns.some(c => c.name === 'image_url')

if (hasImageUrl) {
  console.log('image_url 欄位已存在，不需 migrate。')
  process.exit(0)
}

console.log('開始 migrate……')
db.exec("ALTER TABLE menu_item ADD COLUMN image_url TEXT NOT NULL DEFAULT ''")

const after = db.prepare("PRAGMA table_info(menu_item)").all()
console.log('新欄位列表：')
console.log(after.map(c => `  ${c.name} ${c.type}`).join('\n'))
console.log('Migration 完成。')

db.close()
