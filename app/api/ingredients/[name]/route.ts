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

// GET /api/ingredients/:name
export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
) {
  try {
    const pool = getPool()
    const name = decodeURIComponent(params.name)

    const [rows] = await pool.execute<IngredientRow[]>(
      'SELECT `食材名稱`, `庫存數量`, `安全存量`, `庫存單位`, `供應商名稱` FROM `食材` WHERE `食材名稱` = ?',
      [name]
    )

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: '找不到該食材' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: rows[0] })
  } catch (err) {
    console.error('[GET /api/ingredients/:name]', err)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}

// PUT /api/ingredients/:name — 修改食材
interface UpdateBody {
  庫存數量?: number
  安全存量?: number
  庫存單位?: string
  供應商名稱?: string | null
}

export async function PUT(
  req: Request,
  { params }: { params: { name: string } }
) {
  try {
    const body: UpdateBody = await req.json()
    const pool = getPool()
    const name = decodeURIComponent(params.name)

    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT `食材名稱` FROM `食材` WHERE `食材名稱` = ?', [name]
    )
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: '找不到該食材' }, { status: 404 })
    }

    // FK 驗證
    if (body.供應商名稱 !== undefined && body.供應商名稱 !== null) {
      const [supRows] = await pool.execute<RowDataPacket[]>(
        'SELECT `供應商名稱` FROM `供應商` WHERE `供應商名稱` = ?', [body.供應商名稱]
      )
      if (supRows.length === 0) {
        return NextResponse.json({ success: false, error: '找不到該供應商' }, { status: 400 })
      }
    }

    const sets: string[] = []
    const values: (string | number | null)[] = []

    if (body.庫存數量 !== undefined) {
      sets.push('`庫存數量` = ?')
      values.push(body.庫存數量)
    }
    if (body.安全存量 !== undefined) {
      sets.push('`安全存量` = ?')
      values.push(body.安全存量)
    }
    if (body.庫存單位 !== undefined) {
      sets.push('`庫存單位` = ?')
      values.push(body.庫存單位.trim())
    }
    if (body.供應商名稱 !== undefined) {
      sets.push('`供應商名稱` = ?')
      values.push(body.供應商名稱 === null ? null : body.供應商名稱.trim())
    }

    if (sets.length === 0) {
      return NextResponse.json({ success: false, error: '沒有要更新的欄位' }, { status: 400 })
    }

    values.push(name)
    await pool.execute(
      `UPDATE \`食材\` SET ${sets.join(', ')} WHERE \`食材名稱\` = ?`,
      values
    )

    const [updated] = await pool.execute<IngredientRow[]>(
      'SELECT `食材名稱`, `庫存數量`, `安全存量`, `庫存單位`, `供應商名稱` FROM `食材` WHERE `食材名稱` = ?',
      [name]
    )

    return NextResponse.json({ success: true, data: updated[0] })
  } catch (err) {
    console.error('[PUT /api/ingredients/:name]', err)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
