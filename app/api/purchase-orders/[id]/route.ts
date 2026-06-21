// app/api/purchase-orders/[id]/route.ts
import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

interface PurchaseOrder {
  po_id: number
  po_date: string
  supplier_name: string
  total_amount: number
  status: string
  items?: PurchaseOrderItem[]
}

interface PurchaseOrderItem {
  ingredient_name: string
  order_qty: number
  total_cost: number
}

interface ApiResponse<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

// ============================================================
// GET /api/purchase-orders/:id — 查詢單一進貨單（含明細）
// ============================================================
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const pool = getPool()
    const poId = parseInt(params.id, 10)
    if (isNaN(poId)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無效的進貨單 ID' },
        { status: 400 }
      )
    }

    const po = (await pool.execute<RowDataPacket[]>(`SELECT 採購單編號, 採購單日期, 供應商名稱, 進貨食材總成本, 採購單狀態 FROM 採購單 WHERE 採購單編號 = ?`, [poId]))[0][0] as PurchaseOrder | undefined

    if (!po) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到該進貨單' },
        { status: 404 }
      )
    }

    const items = (await pool.execute<RowDataPacket[]>(`SELECT 食材名稱, 數量 FROM 採購單明細 WHERE 採購單編號 = ?`, [poId]))[0] as PurchaseOrderItem[]
    po.items = items

    return NextResponse.json<ApiResponse<PurchaseOrder>>(
      { success: true, data: po },
      { status: 200 }
    )
  } catch (err) {
    console.error('[GET /api/purchase-orders/:id]', err)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '未知錯誤' },
      { status: 500 }
    )
  }
}