import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'

interface LowStockRow extends RowDataPacket {
  食材名稱: string
  庫存數量: number
  安全存量: number
  庫存單位: string
  供應商名稱: string | null
}

export async function GET() {
  try {
    const pool = getPool()

    const [rows] = await pool.execute<LowStockRow[]>(`
      SELECT \`食材名稱\`, \`庫存數量\`, \`安全存量\`, \`庫存單位\`, \`供應商名稱\`
      FROM \`食材\`
      WHERE \`安全存量\` > 0 AND \`庫存數量\` <= \`安全存量\`
      ORDER BY (\`庫存數量\` / NULLIF(\`安全存量\`, 0)) ASC, \`食材名稱\`
    `)

    const data = rows.map(it => {
      const target = it.安全存量 * 2
      const needed = Math.max(0, target - it.庫存數量)
      return {
        食材名稱: it.食材名稱,
        庫存數量: it.庫存數量,
        安全存量: it.安全存量,
        庫存單位: it.庫存單位,
        供應商名稱: it.供應商名稱,
        suggested_qty: Math.round(needed * 10) / 10,
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/inventory/low-stock]', err)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
