// app/api/reports/monthly/route.ts
import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

export const dynamic = 'force-dynamic'

interface MonthlyReport {
  year: number
  month: number
  orders_count: number
  total_revenue: number
  avg_per_order: number
}

interface ApiResponse<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

// ============================================================
// GET /api/reports/monthly — 月營收報表
//
// 計算邏輯：
//   1. 只統計 status = '已完成' 的訂單
//   2. 根據 order_date 篩選年月
//   3. avg_per_order = 總營收 / 訂單數
// ============================================================
export async function GET(req: Request) {
  try {
    const pool = getPool()
    const { searchParams } = new URL(req.url)
    const now = new Date()
    const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()), 10)
    const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1), 10)

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'year 與 month 參數格式錯誤' },
        { status: 400 }
      )
    }

    // SQLite 的 date 格式化：YYYY-MM-DD 前綴匹配
    const monthStr = String(month).padStart(2, '0')
    const datePrefix = `${year}-${monthStr}`

    // ── 訂單筆數 + 總營收 ─────────────────
    const stats = (await pool.execute<RowDataPacket[]>(`
      SELECT
        COUNT(DISTINCT o.訂單編號) AS orders_count,
        COALESCE(SUM(m.餐點價格 * od.數量), 0) AS total_revenue
      FROM 訂單 o
      JOIN 訂單明細 od ON o.訂單編號 = od.訂單編號
      WHERE o.訂單日期 LIKE ? AND o.訂單狀態 = '已完成'
    `, [`${datePrefix}%`]))[0][0] as { orders_count: number; total_revenue: number }

    const report: MonthlyReport = {
      year,
      month,
      orders_count: stats.orders_count,
      total_revenue: Math.round(stats.total_revenue),
      avg_per_order: stats.orders_count > 0
        ? Math.round(stats.total_revenue / stats.orders_count)
        : 0,
    }

    return NextResponse.json<ApiResponse<MonthlyReport>>(
      { success: true, data: report },
      { status: 200 }
    )

  } catch (err) {
    console.error('[GET /api/reports/monthly]', err)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '未知錯誤' },
      { status: 500 }
    )
  }
}