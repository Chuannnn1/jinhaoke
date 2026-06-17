// app/api/suppliers/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// ============================================================
// 型別定義
// ============================================================
interface Supplier {
  name: string
  phone: string | null
  owner_name: string | null
  category: string
}

interface CreateSupplierBody {
  name: string
  phone?: string
  owner_name?: string
  category?: string
}

interface ApiResponse<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

const CATEGORY_OPTIONS = new Set(['豬', '雞', '牛', '魚', '其他'])

// ============================================================
// GET /api/suppliers — 取得全部供應商
//   query：
//     category=...  — 依分類篩選（豬/雞/牛/魚/其他）
// ============================================================
export async function GET(req: Request) {
  try {
    const db = getDb()
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    let suppliers: Supplier[]
    if (category && CATEGORY_OPTIONS.has(category)) {
      suppliers = db.prepare(
        'SELECT name, phone, owner_name, category FROM supplier WHERE category = ? ORDER BY name'
      ).all(category) as Supplier[]
    } else {
      suppliers = db.prepare(
        'SELECT name, phone, owner_name, category FROM supplier ORDER BY name'
      ).all() as Supplier[]
    }

    return NextResponse.json<ApiResponse<Supplier[]>>({ success: true, data: suppliers })
  } catch (err) {
    console.error('[GET /api/suppliers]', err)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '未知錯誤' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/suppliers — 新增供應商
// ============================================================
export async function POST(req: Request) {
  try {
    const body: CreateSupplierBody = await req.json()

    if (!body.name || body.name.trim() === '') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '供應商名稱為必填欄位' },
        { status: 400 }
      )
    }

    const category = (body.category && CATEGORY_OPTIONS.has(body.category))
      ? body.category
      : '其他'

    const db = getDb()

    const existing = db.prepare('SELECT name FROM supplier WHERE name = ?').get(body.name.trim())
    if (existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '供應商名稱已存在' },
        { status: 409 }
      )
    }

    db.prepare(
      'INSERT INTO supplier (name, phone, owner_name, category) VALUES (?, ?, ?, ?)'
    ).run(
      body.name.trim(),
      body.phone?.trim() || null,
      body.owner_name?.trim() || null,
      category
    )

    const newSupplier = db.prepare(
      'SELECT name, phone, owner_name, category FROM supplier WHERE name = ?'
    ).get(body.name.trim()) as Supplier

    return NextResponse.json<ApiResponse<Supplier>>(
      { success: true, data: newSupplier },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/suppliers]', err)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '未知錯誤' },
      { status: 500 }
    )
  }
}
