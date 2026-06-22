import { NextResponse } from 'next/server'
import { computeAvailability } from '@/lib/availability'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await computeAvailability()
    const data = rows.map(row => ({
      item_id: row.item_id,
      name: row.name,
      max_servings: Number.isFinite(row.max_servings) ? row.max_servings : 9999,
      blocked: row.blocked,
      blocking_ingredients: row.blocking_ingredients,
    }))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/menu/availability]', err)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
