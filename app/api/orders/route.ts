import { getDb } from '@/lib/db'
import { computeAvailability } from '@/lib/availability'
import { NextResponse } from 'next/server'

// ============================================================
// 型別定義
// ============================================================
interface OrderRow {
  order_id: string
  status: string
  created_at: string
  item_id: number | null
  quantity: number | null
  item_name: string | null
  price: number | null
}

interface OrderItem {
  item_id: number
  name: string
  quantity: number
  unit_price: number
  subtotal: number
}

interface GroupedOrder {
  order_id: string
  customer_name: string
  status: string
  created_at: string
  items: OrderItem[]
  total: number
}

// ============================================================
// GET /api/orders — 取得全部訂單
// ============================================================
export async function GET() {
  try {
    const db = getDb()
    const orders = db.prepare(`
      SELECT
        o.order_id,
        o.status,
        o.created_at,
        oi.item_id,
        oi.quantity,
        mi.name AS item_name,
        oi.unit_price AS price,
        dc.name AS customer_name
      FROM "order" o
      LEFT JOIN order_item oi ON o.order_id = oi.order_id
      LEFT JOIN menu_item mi ON oi.item_id = mi.item_id
      LEFT JOIN delivery_customer dc ON o.customer_phone = dc.phone
      ORDER BY o.created_at DESC
    `).all() as (OrderRow & { customer_name: string | null })[]

    // 將扁平的 join 結果整理成巢狀結構
    const grouped: Record<string, GroupedOrder> = {}
    for (const row of orders) {
      if (!grouped[row.order_id]) {
        grouped[row.order_id] = {
          order_id: row.order_id,
          customer_name: row.customer_name ?? '內用顧客',
          status: row.status,
          created_at: row.created_at,
          items: [],
          total: 0,
        }
      }
      if (row.item_id !== null && row.price !== null) {
        grouped[row.order_id].items.push({
          item_id: row.item_id,
          name: row.item_name!,
          quantity: row.quantity!,
          unit_price: row.price,
          subtotal: row.price * row.quantity!,
        })
        grouped[row.order_id].total += row.price * row.quantity!
      }
    }

    return NextResponse.json({ success: true, data: Object.values(grouped) })
  } catch (error) {
    console.error('GET /api/orders error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/orders — 前台送出訂單
//
// 設計邏輯：
// - "order" 表不存 customer_name，只存 customer_phone（FK → delivery_customer）
// - delivery_customer 表存：phone(PK) / name / address
// - 內用時沒有電話 → 用時間戳產生暫時電話
// - note 存在 order 表的 customer_phone 欄位（實際上 DB 沒有 note 欄）
//   目前 order 表沒有 note，先略過
// ============================================================
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { customer_name, customer_phone, items } = body

    // 驗證必填
    if (!customer_name?.trim()) {
      return NextResponse.json(
        { success: false, error: '請輸入顧客姓名' },
        { status: 400 }
      )
    }
    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: '購物車是空的' },
        { status: 400 }
      )
    }

    // 預檢可售性：任一品項 blocked 直接擋下
    const availability = computeAvailability()
    const availMap = new Map(availability.map(a => [a.item_id, a]))
    const blockedNames: string[] = []
    for (const item of items) {
      const a = availMap.get(item.item_id)
      if (a && a.blocked) blockedNames.push(a.name)
    }
    if (blockedNames.length > 0) {
      return NextResponse.json(
        { success: false, error: `品項已售完：${blockedNames.join(', ')}` },
        { status: 400 }
      )
    }

    const db = getDb()

    // 產生訂單編號：A202606030001
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randomDigits = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
    const orderId = `A${today}${randomDigits}`

    // 電話處理：內用沒電話 → 產暫時電話
    const phone = customer_phone?.trim() || `09${orderId.slice(-8)}`

    const getMenuPrice = db.prepare('SELECT price FROM menu_item WHERE item_id = ?')

    // Transaction：全部成功或全部失敗
    db.transaction(() => {
      // 1. upsert delivery_customer（避免 FK constraint fail）
      db.prepare(`
        INSERT INTO delivery_customer (phone, name, address) VALUES (?, ?, '')
        ON CONFLICT(phone) DO UPDATE SET name = excluded.name
      `).run(phone, customer_name.trim())

      // 2. 寫入訂單主表（order 表沒有 note 欄，所以略過）
      db.prepare(`
        INSERT INTO "order" (order_id, order_date, status, customer_phone)
        VALUES (?, ?, '待製作', ?)
      `).run(orderId, today, phone)

      // 3. 寫入訂單明細（用下單時的單價快照）
      for (const item of items) {
        const menuItem = getMenuPrice.get(item.item_id) as { price: number } | undefined
        if (menuItem) {
          db.prepare(`
            INSERT INTO order_item (order_id, item_id, quantity, unit_price)
            VALUES (?, ?, ?, ?)
          `).run(orderId, item.item_id, item.quantity, menuItem.price)
        }
      }
    })()

    return NextResponse.json(
      { success: true, data: { order_id: orderId } },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/orders error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    )
  }
}