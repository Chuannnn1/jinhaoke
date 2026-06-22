import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const pool = getPool()
    const { searchParams } = new URL(req.url)
    const todayTW = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
    const date = searchParams.get('date') ?? todayTW

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ success: false, error: '日期格式需為 YYYY-MM-DD' }, { status: 400 })
    }

    const fromDT = `${date} 00:00:00`
    const toDT = `${date} 23:59:59`

    const [countRows] = await pool.execute<RowDataPacket[]>(`
      SELECT COUNT(DISTINCT o.\`訂單編號\`) AS orders_count
      FROM \`訂單\` o
      WHERE o.\`訂單日期\` BETWEEN ? AND ? AND o.\`訂單狀態\` = '已完成'
    `, [fromDT, toDT])

    const [revRows] = await pool.execute<RowDataPacket[]>(`
      SELECT COALESCE(SUM(m.\`餐點價格\` * od.\`數量\`), 0) AS total_revenue
      FROM \`訂單\` o
      JOIN \`訂單明細\` od ON o.\`訂單編號\` = od.\`訂單編號\`
      JOIN \`餐點\` m ON od.\`餐點編號\` = m.\`餐點編號\`
      WHERE o.\`訂單日期\` BETWEEN ? AND ? AND o.\`訂單狀態\` = '已完成'
    `, [fromDT, toDT])

    const [topRows] = await pool.execute<RowDataPacket[]>(`
      SELECT
        m.\`餐點名稱\` AS name,
        SUM(od.\`數量\`) AS qty,
        SUM(m.\`餐點價格\` * od.\`數量\`) AS revenue
      FROM \`訂單\` o
      JOIN \`訂單明細\` od ON o.\`訂單編號\` = od.\`訂單編號\`
      JOIN \`餐點\` m ON od.\`餐點編號\` = m.\`餐點編號\`
      WHERE o.\`訂單日期\` BETWEEN ? AND ? AND o.\`訂單狀態\` = '已完成'
      GROUP BY m.\`餐點編號\`, m.\`餐點名稱\`
      ORDER BY qty DESC
      LIMIT 5
    `, [fromDT, toDT])

    return NextResponse.json({
      success: true,
      data: {
        date,
        orders_count: Number((countRows[0] as { orders_count: number }).orders_count),
        total_revenue: Math.round(Number((revRows[0] as { total_revenue: number }).total_revenue)),
        top_items: (topRows as Array<{ name: string; qty: number; revenue: number }>).map(r => ({
          name: r.name,
          qty: Number(r.qty),
          revenue: Math.round(Number(r.revenue)),
        })),
      },
    })
  } catch (err) {
    console.error('[GET /api/reports/daily]', err)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
