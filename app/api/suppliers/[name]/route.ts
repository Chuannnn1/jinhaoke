// app/api/suppliers/[name]/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

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

const SELECT_SQL = 'SELECT name, phone, owner_name, category FROM supplier WHERE name = ?'

// ============================================================
// GET /api/suppliers/:name
// ============================================================
export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
) {
  try {
    const db = getDb()
    const supplier = db.prepare(SELECT_SQL).get(params.name) as Supplier | undefined

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
    const db = getDb()

    const existing = db.prepare(SELECT_SQL).get(params.name) as Supplier | undefined
    if (!existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到該供應商' },
        { status: 404 }
      )
    }

    const sets: string[] = []
    const values: (string | null)[] = []

    if (body.phone !== undefined) {
      sets.push('phone = ?')
      values.push(body.phone.trim() === '' ? null : body.phone.trim())
    }
    if (Object.prototype.hasOwnProperty.call(body, 'owner_name')) {
      const v = body.owner_name
      sets.push('owner_name = ?')
      values.push(v === null || v === undefined || v.trim() === '' ? null : v.trim())
    }
    if (body.category !== undefined) {
      if (!CATEGORY_OPTIONS.has(body.category)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'category 必須是 豬 / 雞 / 牛 / 魚 / 其他 之一' },
          { status: 400 }
        )
      }
      sets.push('category = ?')
      values.push(body.category)
    }

    if (sets.length > 0) {
      values.push(params.name)
      db.prepare(`UPDATE supplier SET ${sets.join(', ')} WHERE name = ?`).run(...values)
    }

    const updated = db.prepare(SELECT_SQL).get(params.name) as Supplier

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
    const db = getDb()

    const existing = db.prepare('SELECT name FROM supplier WHERE name = ?').get(params.name)
    if (!existing) {
      return NextResponse.json<ApiResponse>({ success: true })
    }

    db.prepare('DELETE FROM supplier WHERE name = ?').run(params.name)
    return NextResponse.json<ApiResponse>({ success: true })
  } catch (err) {
    console.error('[DELETE /api/suppliers/:name]', err)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '未知錯誤' },
      { status: 500 }
    )
  }
}
