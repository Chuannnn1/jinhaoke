// scripts/migrate-fix-menu-images.js
// 將既有 DB 的 menu_item.image_url 對齊到 seed-data.js 的預設值。
//
// 用途：
//   - 既有環境的 menu_item 在升級前 image_url 是空字串
//   - lib/db.ts 的 seed 只在 menu_item 空表時跑，所以不會自動補
//   - 本 script 依「品項名稱」對應 seed-data.js MENU_ITEMS.image_url，逐筆填回
//
// 跑法：
//   先停 dev server，然後 `node scripts/migrate-fix-menu-images.js`
// Idempotent：已對齊的不動；自訂上傳的（image_url 已非空且不同）也不蓋掉。

const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

const { MENU_ITEMS } = require('./seed-data')

const DB_PATH = path.join(__dirname, '..', 'data', 'jinhaoke.db')
if (!fs.existsSync(DB_PATH)) {
  console.error('找不到 DB：', DB_PATH)
  process.exit(1)
}

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

const hasImageUrl = db.prepare("PRAGMA table_info(menu_item)").all().some(c => c.name === 'image_url')
if (!hasImageUrl) {
  console.error('menu_item 沒有 image_url 欄位，請先跑 scripts/migrate-add-menu-image.js')
  process.exit(1)
}

const select = db.prepare('SELECT item_id, image_url FROM menu_item WHERE name = ?')
const update = db.prepare('UPDATE menu_item SET image_url = ? WHERE item_id = ?')

let filledEmpty = 0
let alreadyOK = 0
let skippedCustom = 0
let missingTarget = 0
let notFound = 0

for (const m of MENU_ITEMS) {
  const target = m.image_url || ''
  const row = select.get(m.name)
  if (!row) {
    notFound++
    console.warn(`  ⚠ 找不到品項：${m.name}`)
    continue
  }
  if (!target) {
    missingTarget++
    continue
  }
  if (row.image_url === target) {
    alreadyOK++
    continue
  }
  if (row.image_url && row.image_url !== target) {
    // 已有自訂圖（非預設），保留不動
    skippedCustom++
    console.log(`  · ${m.name}: 保留現有 ${row.image_url}（預設值 ${target}）`)
    continue
  }
  // image_url 為空 → 補進預設
  update.run(target, row.item_id)
  filledEmpty++
  console.log(`  ✓ ${m.name}: (空) → ${target}`)
}

console.log(`\n完成：補入預設 ${filledEmpty} 筆、已對齊跳過 ${alreadyOK} 筆、自訂保留 ${skippedCustom} 筆、無預設可補 ${missingTarget} 筆、找不到品項 ${notFound} 筆。`)
db.close()
