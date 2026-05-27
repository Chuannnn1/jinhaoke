import { getDb } from '@/lib/db'
import { NextResponse } from 'next/server'

// ============================================================
// GET /api/orders — 取得全部訂單
// ============================================================
export async function GET() {
  try {
    const db = getDb()
    const orders = db.prepare(`
      SELECT
        o.order_id,
        o.customer_name,
        o.status,
        o.note,
        o.created_at,
        oi.item_id,
        oi.quantity,
        mi.name AS item_name,
        mi.price
      FROM "order" o
      LEFT JOIN order_item oi ON o.order_id = oi.order_id
      LEFT JOIN menu_item mi ON oi.item_id = mi.item_id
      ORDER BY o.created_at DESC
    `).all()

    // 將扁平的 join 結果整理成巢狀結構
    const grouped = {}
    for (const row of orders) {
      if (!grouped[row.order_id]) {
        grouped[row.order_id] = {
          order_id: row.order_id,
          customer_name: row.customer_name,
          status: row.status,
          note: row.note,
          created_at: row.created_at,
          items: [],
          total: 0,
        }
      }
      if (row.item_id) {
        grouped[row.order_id].items.push({
          item_id: row.item_id,
          name: row.item_name,
          quantity: row.quantity,
          unit_price: row.price,
          subtotal: row.price * row.quantity,
        })
        grouped[row.order_id].total += row.price * row.quantity
      }
    }

    return NextResponse.json({ success: true, data: Object.values(grouped) })
  } catch (error) {
    console.error('GET /api/orders error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/orders — 前台送出訂單
// ============================================================
export async function POST(request) {
  try {
    const body = await request.json()
    const { customer_name, customer_phone, note, items } = body

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

    const db = getDb()

    // 產生訂單編號
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randomDigits = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
    const orderId = `A${today}${randomDigits}`

    // 電話處理：空字串時產生暫時電話（內用）
    const phone = customer_phone?.trim() || `09${orderId.slice(-8)}`

    // Transaction：全部成功或全部失敗
    const insertOrder = db.prepare(`
      INSERT INTO "order" (order_id, order_date, status, customer_phone, note)
      VALUES (?, ?, '待製作', ?, ?)
    `)

    const getMenuPrice = db.prepare('SELECT price FROM menu_item WHERE item_id = ?')

    const insertOrderItem = db.prepare(`
      INSERT INTO order_item (order_id, item_id, quantity, unit_price)
      VALUES (?, ?, ?, ?)
    `)

    db.transaction(() => {
      // 先 upsert delivery_customer（避免 FK constraint fail）
      if (phone && phone.length >= 8) {
        db.prepare(`
          INSERT INTO delivery_customer (phone, name, address) VALUES (?, ?, '')
          ON CONFLICT(phone) DO UPDATE SET name = excluded.name
        `).run(phone, customer_name.trim())
      }

      // 寫入訂單主表
      insertOrder.run(orderId, today, phone, note || '')

      // 寫入訂單明細（用下單時的單價快照）
      for (const item of items) {
        const menuItem = getMenuPrice.get(item.item_id)
        if (menuItem) {
          insertOrderItem.run(orderId, item.item_id, item.quantity, menuItem.price)
        }
      }
    })()

    return NextResponse.json(
      { success: true, data: { order_id: orderId } },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error('POST /api/orders error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    )
  }
}