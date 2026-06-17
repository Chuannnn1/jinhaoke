import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { computeOrderConsumption } from '@/lib/order-consumption'

// ============================================================
// 型別定義
// ============================================================
interface UpdateStatusBody {
  order_id: string
  status: string
}

interface ApiResponse {
  success: boolean
  error?: string
}

interface OrderItemRow {
  item_id: number
  quantity: number
  customizations: string | null
  item_name: string
}

// ============================================================
// PATCH /api/orders/status — 更新訂單狀態（含出餐扣庫存）
// ============================================================
export async function PATCH(request: Request) {
  try {
    const body: UpdateStatusBody = await request.json()

    if (!body.order_id || !body.status) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 order_id 或 status' },
        { status: 400 }
      )
    }

    // 對應前後台五個狀態
    // pending=待製作 / preparing=製作中 / awaiting_payment=待付款 / done=已完成 / cancelled=已取消
    const statusMap: Record<string, string> = {
      pending:          '待製作',
      preparing:        '製作中',
      awaiting_payment: '待付款',
      done:             '已完成',
      cancelled:        '已取消',
    }

    const dbStatus = statusMap[body.status] || body.status
    const db = getDb()

    // ── 不是「已完成」：只更新狀態，不扣庫存 ──
    if (dbStatus !== '已完成') {
      db.prepare(`UPDATE "order" SET status = ? WHERE order_id = ?`)
        .run(dbStatus, body.order_id)
      return NextResponse.json<ApiResponse>({ success: true })
    }

    // ── 以下只有「已完成」才會執行到 ──

    // Step 1：查這張訂單的品項 + quantity + 客製化
    const orderItems = db.prepare(`
      SELECT oi.item_id, oi.quantity, oi.customizations, mi.name AS item_name
      FROM order_item oi
      JOIN menu_item mi ON oi.item_id = mi.item_id
      WHERE oi.order_id = ?
    `).all(body.order_id) as OrderItemRow[]

    if (orderItems.length === 0) {
      // 訂單沒有品項資料：可能是舊資料（Bug A 修復前的訂單）或資料被誤刪
      // 仍允許標記完成，但不扣庫存，並 log warning
      console.warn(`[orders/status] order ${body.order_id} 沒有品項資料，僅更新狀態不扣庫存`)
      db.prepare(`UPDATE "order" SET status = ? WHERE order_id = ?`)
        .run('已完成', body.order_id)
      return NextResponse.json<ApiResponse>({ success: true })
    }

    // Step 2：用共用 helper 算總消耗
    //   - 包含 base item recipe + 每筆客製化 addon 對應的 ref item recipe
    //   - 沒 recipe 的品項自動跳過（單點類無配方就無扣料）
    const consumption = computeOrderConsumption(db, orderItems.map(o => {
      let cust: string[][] = []
      try {
        const parsed = JSON.parse(o.customizations ?? '[]')
        if (Array.isArray(parsed)) cust = parsed
      } catch { /* 容錯 */ }
      return { item_id: o.item_id, quantity: o.quantity, customizations: cust }
    }))

    // Step 3：Transaction 包在一起 — 更新狀態 + 扣庫存
    const updateIngredient = db.prepare(`
      UPDATE ingredient
      SET stock_qty = stock_qty - ?
      WHERE name = ?
    `)
    db.transaction(() => {
      // 3a. 更新訂單狀態為已完成
      db.prepare(`UPDATE "order" SET status = ? WHERE order_id = ?`)
        .run('已完成', body.order_id)

      // 3b. 扣庫存：遍歷消耗 map
      for (const [ingName, qty] of consumption) {
        const result = updateIngredient.run(qty, ingName)
        if (result.changes === 0) {
          console.warn(`[orders/status] 食材 "${ingName}" 不存在，跳過扣除`)
        }
      }
    })()

    return NextResponse.json<ApiResponse>({ success: true })

  } catch (error) {
    console.error('PATCH /api/orders/status error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    )
  }
}