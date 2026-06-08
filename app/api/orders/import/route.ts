import { getDb } from '@/lib/db'
import { NextResponse } from 'next/server'

// ============================================================
// POST /api/orders/import
// 透過 multipart/form-data 上傳 CSV，預覽或匯入訂單
// CSV 欄位：order_id,item_name,qty,note,phone,time
// 同 order_id 多列代表多項目，聚合成一張訂單
// ============================================================

interface ParsedRow {
  rowNum: number
  order_id: string
  item_name: string
  qty: number
  note: string
  phone: string
  time: string
}

interface ValidItem {
  item_name: string
  qty: number
  unit_price: number
}

interface ValidOrder {
  order_id: string
  items: ValidItem[]
  total: number
  phone: string
  time: string
  notes: string
}

interface RowError {
  row: number
  reason: string
}

interface MenuLookupRow {
  item_id: number
  name: string
  price: number
}

function splitCsvLine(line: string): string[] {
  // 簡易 CSV 切割（不支援欄位內含逗號的雙引號跳脫，因模板格式單純）
  return line.split(',').map(s => s.trim())
}

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  // 去除 BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length === 0) return { header: [], rows: [] }
  const header = splitCsvLine(lines[0])
  const rows = lines.slice(1).map(splitCsvLine)
  return { header, rows }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const confirm = formData.get('confirm') === '1'

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, error: '請上傳 CSV 檔案' },
        { status: 400 }
      )
    }

    const text = await (file as File).text()
    const { header, rows } = parseCsv(text)

    const expected = ['order_id', 'item_name', 'qty', 'note', 'phone', 'time']
    if (header.length < expected.length || expected.some((c, i) => header[i] !== c)) {
      return NextResponse.json(
        { success: false, error: 'CSV 標頭必須為：order_id,item_name,qty,note,phone,time' },
        { status: 400 }
      )
    }

    const db = getDb()

    // 預載 menu_item 對照
    const menuRows = db
      .prepare('SELECT item_id, name, price FROM menu_item WHERE is_active = 1')
      .all() as MenuLookupRow[]
    const menuByName = new Map<string, MenuLookupRow>()
    for (const m of menuRows) menuByName.set(m.name, m)

    // 預載既有 order_id（用於衝突判斷）
    const existingOrderIds = new Set<string>(
      (db.prepare('SELECT order_id FROM "order"').all() as { order_id: string }[])
        .map(r => r.order_id)
    )

    const errors: RowError[] = []
    const parsedByOrder = new Map<string, ParsedRow[]>()

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2 // header 為第 1 列
      const cells = rows[i]
      const [order_id = '', item_name = '', qtyRaw = '', note = '', phone = '', time = ''] = cells

      if (!order_id || !item_name || !qtyRaw) {
        errors.push({ row: rowNum, reason: '缺少必要欄位（order_id / item_name / qty）' })
        continue
      }
      if (!/^\d{8,12}$/.test(order_id)) {
        errors.push({ row: rowNum, reason: `order_id 格式錯誤：${order_id}` })
        continue
      }
      const qty = parseInt(qtyRaw, 10)
      if (!Number.isFinite(qty) || qty <= 0) {
        errors.push({ row: rowNum, reason: `qty 必須為正整數：${qtyRaw}` })
        continue
      }
      if (!menuByName.has(item_name)) {
        errors.push({ row: rowNum, reason: `找不到餐點：${item_name}` })
        continue
      }
      if (phone && !/^\d{8,15}$/.test(phone)) {
        errors.push({ row: rowNum, reason: `電話格式錯誤：${phone}` })
        continue
      }
      if (time && Number.isNaN(Date.parse(time))) {
        errors.push({ row: rowNum, reason: `time 格式錯誤：${time}` })
        continue
      }
      if (existingOrderIds.has(order_id)) {
        errors.push({ row: rowNum, reason: `order_id 已存在：${order_id}` })
        continue
      }

      const parsed: ParsedRow = { rowNum, order_id, item_name, qty, note, phone, time }
      if (!parsedByOrder.has(order_id)) parsedByOrder.set(order_id, [])
      parsedByOrder.get(order_id)!.push(parsed)
    }

    // 聚合成訂單
    const valid: ValidOrder[] = []
    for (const [orderId, list] of parsedByOrder) {
      // 同一筆訂單應共用 phone / time（取第一筆有值）
      const phone = list.find(r => r.phone)?.phone ?? ''
      const time = list.find(r => r.time)?.time ?? ''
      const items: ValidItem[] = []
      let total = 0
      for (const r of list) {
        const m = menuByName.get(r.item_name)!
        items.push({ item_name: r.item_name, qty: r.qty, unit_price: m.price })
        total += m.price * r.qty
      }
      const notes = list.map(r => r.note).filter(n => n).join('；')
      valid.push({ order_id: orderId, items, total, phone, time, notes })
    }

    const itemsCount = valid.reduce((s, o) => s + o.items.length, 0)
    const summary = { orders: valid.length, items: itemsCount, errors: errors.length }

    // 預覽
    if (!confirm) {
      return NextResponse.json({
        success: true,
        preview: true,
        summary,
        valid,
        errors,
      })
    }

    // 確認匯入
    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: '尚有錯誤，無法匯入', errors },
        { status: 400 }
      )
    }

    const insertOrder = db.prepare(`
      INSERT INTO "order" (order_id, order_date, created_at, updated_at, status, customer_phone)
      VALUES (?, ?, ?, ?, '待製作', ?)
    `)
    const insertItem = db.prepare(`
      INSERT INTO order_item (order_id, item_id, quantity, unit_price)
      VALUES (?, ?, ?, ?)
    `)
    const insertCustomer = db.prepare(`
      INSERT OR IGNORE INTO delivery_customer (phone) VALUES (?)
    `)
    const nowFallback = db.prepare(`SELECT datetime('now', '+8 hours') AS t`)

    const fallbackRow = nowFallback.get() as { t: string }
    const fallbackTime = fallbackRow.t

    const tx = db.transaction(() => {
      for (const order of valid) {
        const orderDate = `${order.order_id.slice(0, 4)}-${order.order_id.slice(4, 6)}-${order.order_id.slice(6, 8)}`
        const ts = order.time || fallbackTime
        const phoneOrNull = order.phone || null
        if (phoneOrNull) insertCustomer.run(phoneOrNull)
        insertOrder.run(order.order_id, orderDate, ts, ts, phoneOrNull)
        for (const it of order.items) {
          const m = menuByName.get(it.item_name)!
          insertItem.run(order.order_id, m.item_id, it.qty, it.unit_price)
        }
      }
    })
    tx()

    return NextResponse.json({
      success: true,
      preview: false,
      imported: valid.length,
    })
  } catch (error) {
    console.error('POST /api/orders/import error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    )
  }
}
