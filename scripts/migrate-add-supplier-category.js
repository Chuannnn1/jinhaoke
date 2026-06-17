// scripts/migrate-add-supplier-category.js
//
// 加上：
//   supplier.category   TEXT NOT NULL DEFAULT '其他'   — 廠商主分類（豬/雞/牛/魚/其他）
//   supplier.owner_name TEXT                            — 老闆姓名（NULLable）
//   ingredient.category TEXT NOT NULL DEFAULT '其他'   — 食材分類（給庫存→採購時帶 default）
//
// 食材 category 用 name 關鍵字 heuristic 初始化：
//   含「魚 / 蝦 / 蟹」→ 魚
//   含「牛」          → 牛
//   含「雞」          → 雞
//   含「豬 / 排骨 / 五花 / 排（不含上面）」→ 豬
//   其它              → 其他
//
// Supplier 不 heuristic（一家廠商常賣多分類）— 全部留 '其他'，由老闆自己分類。
//
// Idempotent：欄位已存在就跳過 ALTER；ingredient.category 已是非 '其他' 也不覆蓋。
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

function hasCol(table, col) {
  return db.prepare(`PRAGMA table_info("${table}")`).all().some(c => c.name === col)
}

let altered = 0

if (!hasCol('supplier', 'category')) {
  db.exec(`ALTER TABLE supplier ADD COLUMN category TEXT NOT NULL DEFAULT '其他'`)
  console.log('  [+] supplier.category')
  altered++
}
if (!hasCol('supplier', 'owner_name')) {
  db.exec('ALTER TABLE supplier ADD COLUMN owner_name TEXT')
  console.log('  [+] supplier.owner_name')
  altered++
}
if (!hasCol('ingredient', 'category')) {
  db.exec(`ALTER TABLE ingredient ADD COLUMN category TEXT NOT NULL DEFAULT '其他'`)
  console.log('  [+] ingredient.category')
  altered++
}

if (altered === 0) {
  console.log('  欄位都已存在，跳過 ALTER')
}

function guessIngredientCategory(name) {
  if (/魚|蝦|蟹|鱈|干貝/.test(name)) return '魚'
  if (/牛/.test(name)) return '牛'
  if (/雞/.test(name)) return '雞'
  if (/豬|排骨|五花|腿$/.test(name)) return '豬'   // 「排」「腿」尾用來抓「排骨」「豬腳」等
  return '其他'
}

// 只回填仍是 '其他' 的 ingredient（避免覆蓋 user 已調整的值）
const ingredients = db.prepare('SELECT name, category FROM ingredient').all()
const updIng = db.prepare('UPDATE ingredient SET category = ? WHERE name = ?')
let updated = 0
const tx = db.transaction(() => {
  for (const row of ingredients) {
    if (row.category && row.category !== '其他') continue
    const guess = guessIngredientCategory(row.name)
    if (guess === row.category) continue
    updIng.run(guess, row.name)
    console.log(`  ${row.name} → ${guess}`)
    updated++
  }
})
tx()

console.log(`\n完成：alter ${altered}、ingredient category 套用 ${updated} 筆`)
db.close()
