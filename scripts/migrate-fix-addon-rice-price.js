// scripts/migrate-fix-addon-rice-price.js
// 加飯 (item_id=31) 從 20 改成 10。
// idempotent：價格已是 10 則跳過。
const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'jinhaoke.db')
if (!fs.existsSync(DB_PATH)) {
  console.error('找不到 DB：', DB_PATH)
  process.exit(1)
}
const db = new Database(DB_PATH)

const row = db.prepare('SELECT item_id, name, price FROM menu_item WHERE item_id = 31').get()
if (!row) {
  console.log('item_id=31 還沒建立，跳過（migrate-add-addon-menu.js 會用新價建）')
} else if (row.price === 10) {
  console.log('加飯 已是 10，跳過')
} else {
  db.prepare('UPDATE menu_item SET price = 10 WHERE item_id = 31').run()
  console.log(`加飯 價格 ${row.price} → 10`)
}
db.close()
