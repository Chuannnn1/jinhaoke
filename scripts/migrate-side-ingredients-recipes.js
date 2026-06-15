// scripts/migrate-side-ingredients-recipes.js
// 補既有 DB 的：
//   1. 4 個新食材：豬腳 / 滷蛋 / 湯品 / 菜脯
//   2. 滷豬腳便當 recipe：帶骨排骨 → 豬腳（語意正確）
//   3. 滷排骨便當 補上 滷蛋 recipe（描述本來就寫附滷蛋）
//   4. 單點 item_id 12-20 主餐 recipe（過去 seed 漏寫）
//   5. 單點 item_id 21-25 配菜 / 加購 recipe
//
// 跑法：先停 dev server → `node scripts/migrate-side-ingredients-recipes.js`
// Idempotent：已存在的不重複插入。
const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'jinhaoke.db')
if (!fs.existsSync(DB_PATH)) {
  console.error('找不到 DB：', DB_PATH); process.exit(1)
}
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// 新 ingredient（供應商用 seed 預設的舊名；若已被改名，自動對應到第一個現有 supplier）
const ingHasSupplier = (name) =>
  !!db.prepare('SELECT 1 FROM supplier WHERE name = ?').get(name)
const firstSupplier = () =>
  db.prepare('SELECT name FROM supplier ORDER BY name LIMIT 1').get()?.name

function resolveSupplier(preferred) {
  if (ingHasSupplier(preferred)) return preferred
  return firstSupplier()
}

const NEW_INGREDIENTS = [
  ['豬腳', 25, 10, '隻', '包', 5,  resolveSupplier('大成肉品')],
  ['滷蛋', 60, 30, '顆', '盒', 30, resolveSupplier('大成肉品')],
  ['湯品', 20, 10, '份', '鍋', 10, resolveSupplier('糧油行')],
  ['菜脯', 40, 20, '份', '包', 50, resolveSupplier('糧油行')],
]

const NEW_RECIPES = [
  // 滷豬腳便當：改用 豬腳
  ['滷豬腳便當', '豬腳', 1],
  // 滷排骨便當：附滷蛋
  ['滷排骨便當', '滷蛋', 1],
  // 單點主餐 12-20
  ['大比目魚排', '魚排',     1],
  ['酥炸豬排',   '豬排',     1],
  ['酥嫩雞腿',   '酥嫩雞腿', 1],
  ['紅麴豬五花', '紅麴豬',   1],
  ['沙茶燴牛肉', '牛肉',     0.2],
  ['滷排骨',     '帶骨排骨', 1],
  ['沙茶燴豬肉', '豬肉',     0.2],
  ['酥炸排骨',   '炸排骨',   1],
  ['滷雞腿',     '滷雞腿',   1],
  // 單點配菜 / 加購 21-25
  ['季節炒時蔬', '高麗菜',   1],
  ['白飯',       '白米',     0.3],
  ['滷蛋',       '滷蛋',     1],
  ['加購湯品',   '湯品',     1],
  ['加購菜脯',   '菜脯',     1],
]

const tx = db.transaction(() => {
  // 1) ingredients
  const insIng = db.prepare(`
    INSERT OR IGNORE INTO ingredient
      (name, stock_qty, safety_stock, stock_unit, order_unit, qty_per_order_unit, supplier_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  let ingAdded = 0
  for (const ing of NEW_INGREDIENTS) {
    const r = insIng.run(...ing)
    if (r.changes > 0) { ingAdded++; console.log(`  + ingredient ${ing[0]}`) }
  }
  console.log(`  ingredient 新增 ${ingAdded} 筆\n`)

  // 2) 移除舊的「滷豬腳便當 → 帶骨排骨」recipe（避免雙食材）
  const porkFeet = db.prepare("SELECT item_id FROM menu_item WHERE name = '滷豬腳便當'").get()
  if (porkFeet) {
    const r = db.prepare("DELETE FROM recipe WHERE item_id = ? AND ingredient_name = '帶骨排骨'").run(porkFeet.item_id)
    if (r.changes > 0) console.log(`  - 滷豬腳便當 移除舊 帶骨排骨 recipe`)
  }

  // 3) recipes
  const insRec = db.prepare(`
    INSERT OR IGNORE INTO recipe (item_id, ingredient_name, consume_qty) VALUES (?, ?, ?)
  `)
  const idByName = (name) =>
    db.prepare('SELECT item_id FROM menu_item WHERE name = ?').get(name)?.item_id
  let recAdded = 0
  for (const [menu, ing, qty] of NEW_RECIPES) {
    const id = idByName(menu)
    if (!id) { console.warn(`  ⚠ 找不到 menu_item: ${menu}`); continue }
    const ingExists = db.prepare('SELECT 1 FROM ingredient WHERE name = ?').get(ing)
    if (!ingExists) { console.warn(`  ⚠ 找不到 ingredient: ${ing}（${menu} recipe 跳過）`); continue }
    const r = insRec.run(id, ing, qty)
    if (r.changes > 0) { recAdded++; console.log(`  + recipe ${menu} → ${ing}*${qty}`) }
  }
  console.log(`  recipe 新增 ${recAdded} 筆`)
})

tx()
console.log('\n完成')
db.close()
