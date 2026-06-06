import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

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
  item_name: string
}

interface RecipeRow {
  item_id: number
  ingredient_name: string
  consume_qty: number
  stock: number
  stock_unit: string
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

    // Step 1：查這張訂單的品項和數量
    const orderItems = db.prepare(`
      SELECT oi.item_id, oi.quantity, mi.name AS item_name
      FROM order_item oi
      JOIN menu_item mi ON oi.item_id = mi.item_id
      WHERE oi.order_id = ?
    `).all(body.order_id) as OrderItemRow[]

    if (orderItems.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到該筆訂單的品項資料' },
        { status: 404 }
      )
    }

    // Step 2：查這些品項的配方（每份消耗多少食材）
    const itemIds = orderItems.map(i => i.item_id)
    const recipes = db.prepare(`
      SELECT r.item_id, r.ingredient_name, r.consume_qty, i.stock_qty AS stock, i.stock_unit
      FROM recipe r
      JOIN ingredient i ON r.ingredient_name = i.name
      WHERE r.item_id IN (${itemIds.map(() => '?').join(',')})
    `).all(...itemIds) as RecipeRow[]

    // Step 3：Transaction 包在一起 —— 更新狀態 + 扣庫存
    db.transaction(() => {
      // 3a. 更新訂單狀態為已完成
      db.prepare(`UPDATE "order" SET status = ? WHERE order_id = ?`)
        .run('已完成', body.order_id)

      // 3b. 扣庫存：對每個品項 × 每個食材
      for (const orderItem of orderItems) {
        const itemRecipes = recipes.filter(r => r.item_id === orderItem.item_id)
        for (const recipe of itemRecipes) {
          const consumed = recipe.consume_qty * orderItem.quantity
          db.prepare(`
            UPDATE ingredient
            SET stock = stock - ?
            WHERE name = ?
          `).run(consumed, recipe.ingredient_name)
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