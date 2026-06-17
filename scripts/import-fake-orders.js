#!/usr/bin/env node
// scripts/import-fake-orders.js
// Batch-import fake order CSVs (March–June) directly into local SQLite DB.
// Usage: node scripts/import-fake-orders.js [csv_dir] [--months 03,04,05,06]

const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'jinhaoke.db')
const CSV_DIR = process.argv[2] || 'C:\\Users\\Richuannnn\\Downloads\\fake_orders_v3\\fake_orders_v3'
const MONTHS = new Set(['03', '04', '05', '06'])

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Load menu items for code→item_id mapping
const menuRows = db.prepare('SELECT item_id, name, price, is_active FROM menu_item ORDER BY item_id').all()
const menuById = new Map()
for (const m of menuRows) menuById.set(m.item_id, m)

// Existing order_ids
const existingIds = new Set(
  db.prepare('SELECT order_id FROM "order"').all().map(r => r.order_id)
)

// Prepared statements
const insertOrder = db.prepare(`
  INSERT INTO "order" (order_id, order_date, created_at, updated_at, status, customer_phone, note)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)
const insertItem = db.prepare(`
  INSERT OR IGNORE INTO order_item (order_id, item_id, quantity, unit_price)
  VALUES (?, ?, ?, ?)
`)
const insertCustomer = db.prepare(`INSERT OR IGNORE INTO delivery_customer (phone) VALUES (?)`)

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length === 0) return []
  return lines.slice(1).map(l => l.split(',').map(s => s.trim()))
}

function parseItems(raw) {
  const items = []
  const parts = raw.split(';').map(s => s.trim()).filter(s => s.length > 0)
  for (const p of parts) {
    let codeStr = p, qtyStr = '1'
    if (p.includes('*')) {
      const [c, q] = p.split('*').map(s => s.trim())
      codeStr = c; qtyStr = q
    }
    const code = parseInt(codeStr, 10)
    const qty = parseInt(qtyStr, 10)
    if (code > 0 && qty > 0) items.push({ code, qty })
  }
  return items
}

function parseSpice(raw) {
  if (!raw || raw.toLowerCase() === 'null') return []
  return raw.split(';').map(s => s.trim())
}

// Gather CSV files for target months
const files = fs.readdirSync(CSV_DIR)
  .filter(f => f.endsWith('.csv') && MONTHS.has(f.slice(0, 2)))
  .sort()

console.log(`Found ${files.length} CSV files for months: ${[...MONTHS].join(',')}`)

let totalOrders = 0, totalItems = 0, skippedDup = 0, skippedUnmapped = 0

const tx = db.transaction(() => {
  for (const filename of files) {
    const mm = filename.slice(0, 2)
    const dd = filename.slice(2, 4)
    const orderDate = `2026-${mm}-${dd}`
    const ymdCompact = `2026${mm}${dd}`
    const createdAt = `${orderDate} 12:00:00`

    const text = fs.readFileSync(path.join(CSV_DIR, filename), 'utf-8')
    const rows = parseCsv(text)

    let fileOrders = 0, fileItems = 0

    for (const cells of rows) {
      const [seqRaw = '', amountRaw = '', phoneRaw = '', paidRaw = '', itemsRaw = '', spiceRaw = ''] = cells
      if (!seqRaw || !itemsRaw) continue

      const seq = parseInt(seqRaw, 10)
      if (!(seq > 0)) continue

      const orderId = `A${ymdCompact}${String(seq).padStart(4, '0')}`
      if (existingIds.has(orderId)) { skippedDup++; continue }
      existingIds.add(orderId)

      const phone = (phoneRaw && phoneRaw.toLowerCase() !== 'null' && /^\d{3,15}$/.test(phoneRaw))
        ? phoneRaw : null

      const items = parseItems(itemsRaw)
      const spice = parseSpice(spiceRaw)

      // Build note from spice
      const noteParts = []
      for (let i = 0; i < items.length; i++) {
        const sp = spice[i]
        if (sp && sp.toLowerCase() !== 'null') {
          const menu = menuById.get(items[i].code)
          noteParts.push(`${menu ? menu.name : `code${items[i].code}`}:${sp}`)
        }
      }

      // Filter items to mapped ones only
      const mappedItems = []
      for (const it of items) {
        const menu = menuById.get(it.code)
        if (menu) {
          mappedItems.push({ item_id: menu.item_id, qty: it.qty, price: menu.price })
        } else {
          skippedUnmapped++
        }
      }
      if (mappedItems.length === 0) continue

      // All past orders → 已完成
      if (phone) insertCustomer.run(phone)
      insertOrder.run(orderId, orderDate, createdAt, createdAt, '已完成', phone, noteParts.join('；') || null)

      // Aggregate same item_id per order
      const agg = new Map()
      for (const it of mappedItems) {
        const cur = agg.get(it.item_id)
        if (cur) { cur.qty += it.qty }
        else { agg.set(it.item_id, { qty: it.qty, price: it.price }) }
      }
      for (const [itemId, info] of agg) {
        insertItem.run(orderId, itemId, info.qty, info.price)
        fileItems++
      }
      fileOrders++
    }

    totalOrders += fileOrders
    totalItems += fileItems
    if (fileOrders > 0) console.log(`  ${filename} → ${fileOrders} orders, ${fileItems} items`)
  }
})

tx()

console.log(`\nDone!`)
console.log(`  Imported: ${totalOrders} orders, ${totalItems} order items`)
console.log(`  Skipped (duplicate): ${skippedDup}`)
console.log(`  Skipped (unmapped codes): ${skippedUnmapped}`)
