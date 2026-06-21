import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'

// GET /api/ingredients/:name/suppliers
// 回傳該食材的供應商（1:1 via 食材.供應商名稱）
export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
) {
  try {
    const pool = getPool()
    const name = decodeURIComponent(params.name)

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT i.\`食材名稱\`, s.\`供應商名稱\`, s.\`供應商電話\`
       FROM \`食材\` i
       LEFT JOIN \`供應商\` s ON i.\`供應商名稱\` = s.\`供應商名稱\`
       WHERE i.\`食材名稱\` = ?`,
      [name]
    )

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: '找不到該食材' }, { status: 404 })
    }

    const row = rows[0]
    const data = row.供應商名稱
      ? [{ 供應商名稱: row.供應商名稱, 供應商電話: row.供應商電話 }]
      : []

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/ingredients/:name/suppliers]', err)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
