import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'

interface IngredientRow extends RowDataPacket {
  食材名稱: string
  庫存數量: number
  安全存量: number
  庫存單位: string
  供應商名稱: string | null
}

// GET /api/inventory
export async function GET() {
  try {
    const pool = getPool()
    const [rows] = await pool.execute<IngredientRow[]>(
      'SELECT `食材名稱`, `庫存數量`, `安全存量`, `庫存單位`, `供應商名稱` FROM `食材` ORDER BY `食材名稱`'
    )
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('[GET /api/inventory]', err)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
