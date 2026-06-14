// scripts/migrate-fix-menu-images.js
// 補正 menu_item.image_url：
//   - 22 白飯 / 23 滷蛋 原本路徑漏了「單點 - 」前綴 → 修回實檔
//   - 21~25 五個 配菜/加購 改用對應的 手作便當 照片（與主餐單點一致）
//
// 跑法：先停 dev server，然後 `node scripts/migrate-fix-menu-images.js`
// Idempotent：重複跑只會把已對的維持原樣。

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

// item_id → 想要的 image_url
const TARGET = [
  // 主餐單點：對應的 手作便當 / 燴飯 照片（多數已對齊，跑這次保險）
  { id: 12, name: '大比目魚排',   url: '/uploads/menu/青甘魚排手作便當.webp' },
  { id: 13, name: '酥炸豬排',     url: '/uploads/menu/炸豬排手作便當.webp' },
  { id: 14, name: '酥嫩雞腿',     url: '/uploads/menu/炸雞腿手作便當.webp' },
  { id: 15, name: '紅麴豬五花',   url: '/uploads/menu/紅麴豬手作便當.webp' },
  { id: 16, name: '沙茶燴牛肉',   url: '/uploads/menu/沙茶牛肉燴飯.webp' },
  { id: 17, name: '滷排骨',       url: '/uploads/menu/滷排骨手作便當.webp' },
  { id: 18, name: '沙茶燴豬肉',   url: '/uploads/menu/沙茶豬肉燴飯.webp' },
  { id: 19, name: '酥炸排骨',     url: '/uploads/menu/炸排骨手作便當.webp' },
  { id: 20, name: '滷雞腿',       url: '/uploads/menu/滷雞腿手作便當.webp' },

  // 配菜/加購：原本用「單點 - XXX.webp」，現改用 手作便當 照片
  { id: 21, name: '季節炒時蔬',   url: '/uploads/menu/紅麴豬手作便當.webp' },
  { id: 22, name: '白飯',         url: '/uploads/menu/炸豬排手作便當.webp' },
  { id: 23, name: '滷蛋',         url: '/uploads/menu/滷排骨手作便當.webp' },
  { id: 24, name: '加購湯品',     url: '/uploads/menu/炸雞腿手作便當.webp' },
  { id: 25, name: '加購菜脯',     url: '/uploads/menu/滷雞腿手作便當.webp' },
]

const select = db.prepare('SELECT name, image_url FROM menu_item WHERE item_id = ?')
const update = db.prepare('UPDATE menu_item SET image_url = ? WHERE item_id = ?')

let touched = 0
let alreadyOK = 0
for (const t of TARGET) {
  const row = select.get(t.id)
  if (!row) {
    console.warn(`  ⚠ item_id=${t.id} (${t.name}) 不存在，跳過`)
    continue
  }
  if (row.image_url === t.url) {
    alreadyOK++
    continue
  }
  update.run(t.url, t.id)
  touched++
  console.log(`  ✓ ${t.id} ${t.name}: ${row.image_url || '(空)'} → ${t.url}`)
}

console.log(`\n完成：更新 ${touched} 筆、已對齊跳過 ${alreadyOK} 筆。`)
db.close()
