// app/api/menu/availability/route.ts
// GET：回傳所有上架餐點的可售性
import { NextResponse } from 'next/server'
import { computeAvailability } from '@/lib/availability'

interface ApiResponse<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

export async function GET() {
  try {
    const data = computeAvailability().map(row => ({
      item_id: row.item_id,
      name: row.name,
      // JSON 不支援 Infinity，回傳前轉為大數字（無 recipe 的品項）
      max_servings: Number.isFinite(row.max_servings) ? row.max_servings : 9999,
      blocked: row.blocked,
      blocking_ingredients: row.blocking_ingredients,
    }))

    return NextResponse.json<ApiResponse<typeof data>>(
      { success: true, data },
      { status: 200 }
    )
  } catch (err) {
    console.error('[GET /api/menu/availability]', err)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '未知錯誤' },
      { status: 500 }
    )
  }
}
