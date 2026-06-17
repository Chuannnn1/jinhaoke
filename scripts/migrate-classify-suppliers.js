// scripts/migrate-classify-suppliers.js
//
// 用「該廠商主要賣的食材分類」自動回填 supplier.category。
// 規則：
//   找每個廠商賣的食材 (ingredient.supplier_name = supplier.name)，
//   數每個 ingredient.category 的出現次數，取多數。
//   多數中含「其他」時，若另有非『其他』的分類，優先非『其他』。
//   如果廠商完全沒掛食材 → 維持原值。
//
// Idempotent：只回填 category === '其他' 的 supplier，已分類的不動。
// 這樣使用者手動分過的廠商不會被覆寫。
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

// 只看仍是 '其他' 的廠商
const targets = db.prepare(`SELECT name FROM supplier WHERE category = '其他'`).all()
if (targets.length === 0) {
  console.log('  沒有 category=其他 的廠商，跳過')
  db.close()
  process.exit(0)
}

const getIngredients = db.prepare(`
  SELECT category FROM ingredient WHERE supplier_name = ?
`)
const update = db.prepare(`UPDATE supplier SET category = ? WHERE name = ?`)

let assigned = 0
let kept = 0
const tx = db.transaction(() => {
  for (const sup of targets) {
    const rows = getIngredients.all(sup.name)
    if (rows.length === 0) {
      kept++
      continue
    }
    // 統計次數
    const counts = new Map()
    for (const r of rows) counts.set(r.category, (counts.get(r.category) ?? 0) + 1)

    // 找出現次數最多的分類；如果最多的是 '其他' 但另有非 '其他' 同數或次高，優先非 '其他'
    let bestCat = null
    let bestCount = -1
    for (const [cat, n] of counts) {
      if (cat === '其他') continue                            // 先忽略其他
      if (n > bestCount) { bestCat = cat; bestCount = n }
    }
    if (bestCat === null) {
      // 全部都是其他 → 沒得猜，跳過
      kept++
      continue
    }
    update.run(bestCat, sup.name)
    console.log(`  ${sup.name} → ${bestCat} (counts: ${JSON.stringify(Array.from(counts))})`)
    assigned++
  }
})
tx()

console.log(`\n完成：自動分類 ${assigned} 家、維持原樣 ${kept} 家`)
db.close()
