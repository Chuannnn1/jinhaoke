// scripts/seed-only.js
// 只跑 seed（不建表、不 migrate）。當你已經有 DB 但想補預設品項時用。
//
// 使用：node scripts/seed-only.js
// 注意：dev server 要先停。

const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

const DB_PATH = path.join(__dirname, '..', 'data', 'jinhaoke.db')

if (!fs.existsSync(DB_PATH)) {
  console.error('❌ 找不到 DB：', DB_PATH)
  console.error('   請先跑 `npm run db:init` 建表')
  process.exit(1)
}

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const { seedAll } = require('./seed-data')
seedAll(db)

console.log('✅ seed 完成')
db.close()
