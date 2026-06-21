// app/api/suppliers/[name]/route.ts
import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

interface Supplier {
  name: string
  phone: string | null
  owner_name: string | null
  category: string
}

interface UpdateSupplierBody {
  phone?: string
  owner_name?: string | null
  category?: string
}

interface ApiResponse<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

const CATEGORY_OPTIONS = new Set(['豬', '雞', '牛', '魚', '其他'])

const SELECT_SQL = 'SELECT `供應商名稱`, `電話`, `負責人`, `分類` FROM `供應商` WHERE `供應商名稱` = ?'

// ============================================================
// GET /api/suppliers/:name
// ============================================================
export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
) {
  try {
    const pool = getPool()
    const [rows] = await pool.execute(SELECT_SQL, [params.name])
    const supplier = (rows as Supplier[])[0]

    if (!supplier) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到該供應商' },
        { status: 404 }
      )
    }

    return NextResponse.json<ApiResponse<Supplier>>({ success: true, data: supplier })
  } catch (err) {
    console.error('[GET /api/suppliers/:name]', err)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '未知錯誤' },
      { status: 500 }
    )
  }
}

// ============================================================
// PUT /api/suppliers/:name — 部分更新（phone / owner_name / category）
// ============================================================
export async function PUT(
  req: Request,
  { params }: { params: { name: string } }
) {
  try {
    const body: UpdateSupplierBody = await req.json()
    const pool = getPool()

    const [rows] = await pool.execute(SELECT_SQL, [params.name])
    const existing = (rows as Supplier[])[0]
    if (!existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到該供應商' },
        { status: 404 }
      )
    }

    const sets: string[] = []
    const values: (string | null)[] = []

    if (body.phone !== undefined) {
      sets.push('`電話` = ?')
      values.push(body.phone.trim() === '' ? null : body.phone.trim())
    }
    if (Object.prototype.hasOwnProperty.call(body, 'owner_name')) {
      const v = body.owner_name
      sets.push('`負責人` = ?')
      values.push(v === null || v === undefined || v.trim() === '' ? null : v.trim())
    }
    if (body.category !== undefined) {
      if (!CATEGORY_OPTIONS.has(body.category)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'category 必須是 豬 / 雞 / 牛 / 魚 / 其他 之一' },
          { status: 400 }
        )
      }
      sets.push('`分類` = ?')
      values.push(body.category)
    }

    if (sets.length > 0) {
      values.push(params.name)
      await pool.execute(`UPDATE \`供應商\` SET ${sets.join(', ')} WHERE \`供應商名稱\` = ?`, values)
    }

    const [updatedRows] = await pool.execute(SELECT_SQL, [params.name])
    const updated = (updatedRows as Supplier[])[0]

    return NextResponse.json<ApiResponse<Supplier>>({ success: true, data: updated })
  } catch (err) {
    console.error('[PUT /api/suppliers/:name]', err)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '未知錯誤' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/suppliers/:name
// ============================================================
export async function DELETE(
  _req: Request,
  { params }: { params: { name: string } }
) {
  try {
    const pool = getPool()

    const [rows] = await pool.execute('SELECT `供應商名稱` FROM `供應商` WHERE `供應商名稱` = ?', [params.name])
    const existing = (rows as { 供應商名稱: string }[])[0]
    if (!existing) {
      return NextResponse.json<ApiResponse>({ success: true })
    }

    await pool.execute('DELETE FROM `供應商` WHERE `供應商名稱` = ?', [params.name])
    return NextResponse.json<ApiResponse>({ success: true })
  } catch (err) {
    console.error('[DELETE /api/suppliers/:name]', err)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '未知錯誤' },
      { status: 500 }
    )
  }
}