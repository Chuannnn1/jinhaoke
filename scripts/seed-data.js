// scripts/seed-data.js — MySQL version (schema v4 中文版)
// Seed data + insert logic (idempotent — only inserts into empty tables)
//
// Usage:
//   const { seedAll } = require('./seed-data')
//   await seedAll(conn)   // conn is a mysql2/promise connection

const SUPPLIERS = [
  { name: '海鮮批發工', phone: '05-2200001' },
  { name: '肉品大王',   phone: '05-2200002' },
  { name: '大成肉品',   phone: '05-2200003' },
  { name: '糧油行',     phone: '05-2200004' },
  { name: '蔬果行',     phone: '05-2200005' },
]

// [食材名稱, 庫存數量, 安全存量, 庫存單位, 供應商名稱]
const INGREDIENTS = [
  ['魚排',       30, 15, '片',   '海鮮批發工'],
  ['豬排',       45, 20, '片',   '肉品大王'],
  ['帶骨排骨',   32, 15, '片',   '大成肉品'],
  ['紅麴豬',     28, 15, '份',   '肉品大王'],
  ['炸排骨',     8,  10, '份',   '大成肉品'],
  ['酥嫩雞腿',   22, 10, '隻',   '肉品大王'],
  ['滷雞腿',     15, 10, '隻',   '大成肉品'],
  ['牛肉',       60, 30, 'kg',   '肉品大王'],
  ['豬肉',       50, 30, 'kg',   '肉品大王'],
  ['沙茶雞',     6,  4,  'kg',   '肉品大王'],
  ['白米',       80, 30, '公斤', '糧油行'],
  ['高麗菜',     30, 8,  '顆',   '蔬果行'],
  ['豬腳',       25, 10, '隻',   '大成肉品'],
  ['滷蛋',       60, 30, '顆',   '大成肉品'],
  ['湯品',       20, 10, '份',   '糧油行'],
  ['菜脯',       40, 20, '份',   '糧油行'],
]

const ADDONS_BENTO_RICE = [
  { id: 'extra_rice', label: '加飯', price: 10 },
]
const bentoAddons = (meatLabel, meatPrice) => ([
  { id: 'extra_meat', label: meatLabel, price: meatPrice },
  { id: 'extra_rice', label: '加飯', price: 10 },
])
const sauceAddons = (meatLabel, meatPrice) => ([
  { id: 'extra_veg',  label: '加菜', price: 10 },
  { id: 'extra_meat', label: meatLabel, price: meatPrice },
  { id: 'extra_rice', label: '加飯', price: 10 },
])

// description = 原 sub + option + description 合併
const MENU_ITEMS = [
  { name: '大比目魚排便當',  category: '手作便當', price: 130, emoji: '🐟', tag: '魚',   description: '扁鱈魚排配三樣配菜',         image_url: '/uploads/menu/青甘魚排手作便當.webp',                addons: bentoAddons('加魚排',   100) },
  { name: '酥炸豬排便當',    category: '手作便當', price: 130, emoji: '🐷', tag: '豬',   description: '酥炸厚切豬排配三樣配菜',     image_url: '/uploads/menu/炸豬排手作便當.webp',                  addons: bentoAddons('加豬排',   100) },
  { name: '酥嫩雞腿便當',    category: '手作便當', price: 130, emoji: '🍗', tag: '雞',   description: '酥嫩雞腿配三樣配菜',         image_url: '/uploads/menu/炸雞腿手作便當.webp',                  addons: bentoAddons('加雞腿',   100) },
  { name: '紅麴豬五花便當',  category: '手作便當', price: 120, emoji: '🐷', tag: '豬',   description: '紅麴豬五花配三樣配菜',       image_url: '/uploads/menu/紅麴豬手作便當.webp',                  addons: bentoAddons('加豬五花',  90) },
  { name: '酥炸排骨便當',    category: '手作便當', price: 100, emoji: '🐷', tag: '豬',   description: '無骨酥炸排骨配三樣配菜',     image_url: '/uploads/menu/炸排骨手作便當.webp',                  addons: bentoAddons('加排骨',    70) },
  { name: '滷豬腳便當',      category: '手作便當', price: 100, emoji: '🐷', tag: '豬',   description: '滷豬腳配三樣配菜',           image_url: '', is_active: 0,                                       addons: ADDONS_BENTO_RICE },
  { name: '滷雞腿便當',      category: '手作便當', price: 100, emoji: '🍗', tag: '雞',   description: '滷雞腿配三樣配菜',           image_url: '/uploads/menu/滷雞腿手作便當.webp',                  addons: bentoAddons('加滷雞腿',  70) },
  { name: '滷排骨便當',      category: '手作便當', price: 100, emoji: '🥚', tag: '豬',   description: '帶骨滷排骨附滷蛋配三樣配菜', image_url: '/uploads/menu/滷排骨手作便當.webp',                  addons: bentoAddons('加滷排骨',  80) },
  { name: '沙茶牛肉燴飯',    category: '燴飯',     price: 110, emoji: '🥩', tag: '牛',   description: '沙茶牛肉',                   image_url: '/uploads/menu/沙茶牛肉燴飯.webp',                    addons: sauceAddons('加牛', 60) },
  { name: '沙茶雞柳燴飯',    category: '燴飯',     price: 110, emoji: '🍗', tag: '雞',   description: '沙茶雞柳',                   image_url: '/uploads/menu/沙茶雞柳燴飯.webp',                    addons: sauceAddons('加雞', 60) },
  { name: '沙茶豬肉燴飯',    category: '燴飯',     price: 100, emoji: '🐷', tag: '豬',   description: '沙茶豬肉',                   image_url: '/uploads/menu/沙茶豬肉燴飯.webp',                    addons: sauceAddons('加豬', 50) },
  { name: '大比目魚排',      category: '單點',     price: 100, emoji: '🐟', tag: '魚',   description: '扁鱈魚排',                   image_url: '/uploads/menu/青甘魚排手作便當.webp' },
  { name: '酥炸豬排',        category: '單點',     price: 100, emoji: '🐷', tag: '豬',   description: '酥炸厚切豬排',               image_url: '/uploads/menu/炸豬排手作便當.webp' },
  { name: '酥嫩雞腿',        category: '單點',     price: 100, emoji: '🍗', tag: '雞',   description: '酥嫩雞腿',                   image_url: '/uploads/menu/炸雞腿手作便當.webp' },
  { name: '紅麴豬五花',      category: '單點',     price: 90,  emoji: '🐷', tag: '豬',   description: '紅麴豬五花',                 image_url: '/uploads/menu/紅麴豬手作便當.webp' },
  { name: '沙茶燴牛肉',      category: '單點',     price: 90,  emoji: '🥩', tag: '牛',   description: '沙茶燴牛肉',                 image_url: '/uploads/menu/沙茶牛肉燴飯.webp' },
  { name: '滷排骨',          category: '單點',     price: 80,  emoji: '🐷', tag: '豬',   description: '二片',                       image_url: '/uploads/menu/滷排骨手作便當.webp' },
  { name: '沙茶燴豬肉',      category: '單點',     price: 80,  emoji: '🐷', tag: '豬',   description: '沙茶燴豬肉',                 image_url: '/uploads/menu/沙茶豬肉燴飯.webp' },
  { name: '酥炸排骨',        category: '單點',     price: 70,  emoji: '🐷', tag: '豬',   description: '無骨',                       image_url: '/uploads/menu/炸排骨手作便當.webp' },
  { name: '滷雞腿',          category: '單點',     price: 70,  emoji: '🍗', tag: '雞',   description: '滷雞腿',                     image_url: '/uploads/menu/滷雞腿手作便當.webp' },
  { name: '季節炒時蔬',      category: '單點',     price: 60,  emoji: '🥬', tag: '其他', description: '時令蔬菜',                   image_url: '/uploads/menu/單點 - 季節時蔬.webp' },
  { name: '白飯',            category: '單點',     price: 20,  emoji: '🍚', tag: '其他', description: '白飯',                       image_url: '/uploads/menu/單點 - 白飯.webp' },
  { name: '滷蛋',            category: '單點',     price: 15,  emoji: '🥚', tag: '其他', description: '滷蛋',                       image_url: '/uploads/menu/單點 - 滷蛋.webp' },
  { name: '加購湯品',        category: '單點',     price: 10,  emoji: '🍜', tag: '其他', description: '例湯',                       image_url: '/uploads/menu/單點 - 加購湯品.webp' },
  { name: '加購菜脯',        category: '單點',     price: 5,   emoji: '🥢', tag: '其他', description: '原味/辣味',                  image_url: '/uploads/menu/單點  - 菜脯.webp' },
  { name: '沙茶燴雞肉',      category: '單點',     price: 90,  emoji: '🍗', tag: '雞',   description: '沙茶燴雞肉',                 image_url: '/uploads/menu/沙茶雞柳燴飯.webp' },
  { name: '加菜',            category: '單點',     price: 10,  emoji: '🥬', tag: '其他', description: '燴飯加菜',                   image_url: '/uploads/menu/單點 - 季節時蔬.webp' },
  { name: '加牛',            category: '單點',     price: 60,  emoji: '🥩', tag: '牛',   description: '燴飯加牛',                   image_url: '/uploads/menu/沙茶牛肉燴飯.webp' },
  { name: '加豬',            category: '單點',     price: 50,  emoji: '🐷', tag: '豬',   description: '燴飯加豬',                   image_url: '/uploads/menu/沙茶豬肉燴飯.webp' },
  { name: '加雞',            category: '單點',     price: 60,  emoji: '🍗', tag: '雞',   description: '燴飯加雞',                   image_url: '/uploads/menu/沙茶雞柳燴飯.webp' },
  { name: '加飯',            category: '單點',     price: 10,  emoji: '🍚', tag: '其他', description: '加一份白飯',                 image_url: '/uploads/menu/單點 - 白飯.webp' },
]

const RECIPES = [
  ['大比目魚排便當',  '魚排',     1],
  ['大比目魚排便當',  '白米',     0.3],
  ['酥炸豬排便當',    '豬排',     1],
  ['酥炸豬排便當',    '白米',     0.3],
  ['酥嫩雞腿便當',    '酥嫩雞腿', 1],
  ['酥嫩雞腿便當',    '白米',     0.3],
  ['紅麴豬五花便當',  '紅麴豬',   1],
  ['紅麴豬五花便當',  '白米',     0.3],
  ['酥炸排骨便當',    '炸排骨',   1],
  ['酥炸排骨便當',    '白米',     0.3],
  ['滷豬腳便當',      '豬腳',     1],
  ['滷豬腳便當',      '白米',     0.3],
  ['滷雞腿便當',      '滷雞腿',   1],
  ['滷雞腿便當',      '白米',     0.3],
  ['滷排骨便當',      '帶骨排骨', 1],
  ['滷排骨便當',      '滷蛋',     1],
  ['滷排骨便當',      '白米',     0.3],
  ['沙茶牛肉燴飯', '牛肉',   0.2],
  ['沙茶牛肉燴飯', '白米',   0.3],
  ['沙茶雞柳燴飯', '沙茶雞', 0.15],
  ['沙茶雞柳燴飯', '白米',   0.3],
  ['沙茶豬肉燴飯', '豬肉',   0.2],
  ['沙茶豬肉燴飯', '白米',   0.3],
  ['大比目魚排',  '魚排',     1],
  ['酥炸豬排',    '豬排',     1],
  ['酥嫩雞腿',    '酥嫩雞腿', 1],
  ['紅麴豬五花',  '紅麴豬',   1],
  ['沙茶燴牛肉',  '牛肉',     0.2],
  ['滷排骨',      '帶骨排骨', 1],
  ['沙茶燴豬肉',  '豬肉',     0.2],
  ['酥炸排骨',    '炸排骨',   1],
  ['滷雞腿',      '滷雞腿',   1],
  ['季節炒時蔬',  '高麗菜',   1],
  ['白飯',        '白米',     0.3],
  ['滷蛋',        '滷蛋',     1],
  ['加購湯品',    '湯品',     1],
  ['加購菜脯',    '菜脯',     1],
]

async function isEmpty(conn, table) {
  const [[row]] = await conn.execute(`SELECT COUNT(*) AS c FROM \`${table}\``)
  return row.c === 0
}

async function seedAll(conn) {
  const log = (msg) => console.log(`[seed] ${msg}`)

  await conn.beginTransaction()
  try {
    // 1) 供應商
    if (await isEmpty(conn, '供應商')) {
      for (const s of SUPPLIERS) {
        await conn.execute(
          'INSERT INTO `供應商` (`供應商名稱`, `供應商電話`) VALUES (?, ?)',
          [s.name, s.phone]
        )
      }
      log(`供應商  : ${SUPPLIERS.length} rows`)
    } else {
      log('供應商  : has data, skip')
    }

    // 2) 食材
    if (await isEmpty(conn, '食材')) {
      for (const ing of INGREDIENTS) {
        await conn.execute(
          'INSERT INTO `食材` (`食材名稱`, `庫存數量`, `安全存量`, `庫存單位`, `供應商名稱`) VALUES (?, ?, ?, ?, ?)',
          ing
        )
      }
      log(`食材    : ${INGREDIENTS.length} rows`)
    } else {
      log('食材    : has data, skip')
    }

    // 3) 餐點
    if (await isEmpty(conn, '餐點')) {
      for (const m of MENU_ITEMS) {
        const active = m.is_active === undefined ? 1 : m.is_active
        await conn.execute(
          'INSERT INTO `餐點` (`餐點名稱`, `餐點分類`, `餐點價格`, `圖示`, `分類標籤`, `餐點描述`, `上下架狀態`, `圖片網址`, `客製化屬性`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [m.name, m.category, m.price, m.emoji, m.tag, m.description, active, m.image_url || '', JSON.stringify(m.addons ?? [])]
        )
      }
      log(`餐點    : ${MENU_ITEMS.length} rows`)
    } else {
      log('餐點    : has data, skip')
    }

    // 4) 食譜
    if (await isEmpty(conn, '食譜')) {
      const [menuRows] = await conn.execute('SELECT `餐點編號`, `餐點名稱` FROM `餐點`')
      const idByName = new Map(menuRows.map(r => [r.餐點名稱, r.餐點編號]))

      let inserted = 0
      for (const [menuName, ingName, qty] of RECIPES) {
        const itemId = idByName.get(menuName)
        if (!itemId) {
          console.warn(`[seed] 餐點 not found: ${menuName}, skipping recipe`)
          continue
        }
        await conn.execute(
          'INSERT INTO `食譜` (`餐點編號`, `食材名稱`, `食材數量`) VALUES (?, ?, ?)',
          [itemId, ingName, qty]
        )
        inserted++
      }
      log(`食譜    : ${inserted} rows`)
    } else {
      log('食譜    : has data, skip')
    }

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  }
}

module.exports = {
  seedAll,
  SUPPLIERS,
  INGREDIENTS,
  MENU_ITEMS,
  RECIPES,
}
