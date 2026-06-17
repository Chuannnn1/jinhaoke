// scripts/migrate-add-recipe-26.js
//
// 補 26 沙茶燴雞肉（單點）的 recipe。
// 原本 menu_item 26 是 migrate-add-addon-menu.js 補進來的，但只補了 menu_item row，
// 沒補 recipe；導致客製化「加雞」對應 ref_item=26 時跑不出扣料，
// 也讓單點 26 點下單後狀態完成沒扣庫存。
//
// 對齊 10 沙茶雞柳燴飯 的「肉」部分（單點不含飯）：
//   item_id=26 沙茶雞 0.15
//
// Idempotent：已有 recipe row 就跳過。
const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'jinhaoke.db')
if (!fs.existsSync(DB_PATH)) {
  console.error('找不到 DB：', DB_PATH)
  process.exit(1)
}
const db = new Database(DB_PATH)
db.pragma('foreign_keys = ON')

const menu = db.prepare('SELECT item_id FROM menu_item WHERE item_id = 26').get()
if (!menu) {
  console.log('  menu_item 26 不存在（已被刪？），跳過')
  db.close()
  process.exit(0)
}

const existing = db.prepare('SELECT ingredient_name FROM recipe WHERE item_id = 26').all()
if (existing.length > 0) {
  console.log(`  recipe 26 已有 ${existing.length} 筆，跳過`)
  db.close()
  process.exit(0)
}

const ingExists = db.prepare("SELECT name FROM ingredient WHERE name = '沙茶雞'").get()
if (!ingExists) {
  console.error('  ingredient 沙茶雞 不存在，無法補 recipe 26')
  db.close()
  process.exit(1)
}

db.prepare('INSERT INTO recipe (item_id, ingredient_name, consume_qty) VALUES (?, ?, ?)')
  .run(26, '沙茶雞', 0.15)
console.log('  [+] recipe 26 (沙茶燴雞肉) → 沙茶雞 0.15')

db.close()
