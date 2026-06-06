// app/api/inventory/[name]/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

interface UpdateInventoryBody {
  stock_qty: number
  note?: string  // 備註：為什麼手動調整（盤點差異/報廢/其他）
}

interface ApiResponse {
  success: boolean
  error?: string
}

// ============================================================
// PUT /api/inventory/:name — 手動調整庫存（後台人工介入用）
// 例如：實際盤點後發現有落差，寫入正確的庫存數量
// ============================================================
export async function PUT(
  req: Request,
  { params }: { params: { name: string } }
) {
  try {
    const body: UpdateInventoryBody = await req.json()
    const db = getDb()

    // ── 驗證 ─────────────────────────────
    if (body.stock_qty === undefined || typeof body.stock_qty !== 'number' || body.stock_qty < 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'stock_qty 為必填，且需為 >= 0 的數字' },
        { status: 400 }
      )
    }

    // ── 確認食材存在 ─────────────────────
    const existing = db.prepare('SELECT name FROM ingredient WHERE name = ?').get(params.name)
    if (!existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到該食材' },
        { status: 404 }
      )
    }

    // ── 更新庫存 ─────────────────────────
    db.prepare('UPDATE ingredient SET stock_qty = ? WHERE name = ?')
      .run(body.stock_qty, params.name)

    return NextResponse.json<ApiResponse>({ success: true })

  } catch (err) {
    console.error('[PUT /api/inventory/:name]', err)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '未知錯誤' },
      { status: 500 }
    )
  }
}