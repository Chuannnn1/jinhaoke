// lib/availability.ts
// 計算菜單品項可售性：依食材庫存 / 配方算出 max_servings 與 blocked 狀態。
// blocked 規則：stock_qty <= 0 時封鎖
import { getPool } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'

export interface BlockingIngredient {
  name: string
  stock_qty: number
  threshold: number
}

export interface AvailabilityRow {
  item_id: number
  name: string
  max_servings: number
  blocked: boolean
  blocking_ingredients: BlockingIngredient[]
}

interface RecipeJoinRow extends RowDataPacket {
  餐點編號: number
  餐點名稱: string
  食材名稱: string
  食材數量: number
  庫存數量: number
}

interface ActiveItemRow extends RowDataPacket {
  餐點編號: number
  餐點名稱: string
}

export async function computeAvailability(): Promise<AvailabilityRow[]> {
  const pool = getPool()

  const [rows1] = await pool.execute<RowDataPacket[]>(`
    SELECT \`餐點編號\`, \`餐點名稱\` FROM \`餐點\` WHERE \`上下架狀態\` = 1
  `)
  const activeItems = rows1 as ActiveItemRow[]

  const [rows2] = await pool.execute<RecipeJoinRow[]>(`
    SELECT
      r.\`餐點編號\`,
      m.\`餐點名稱\`,
      r.\`食材名稱\`,
      r.\`食材數量\`,
      i.\`庫存數量\`
    FROM \`食譜\` r
    INNER JOIN \`餐點\` m ON m.\`餐點編號\` = r.\`餐點編號\`
    INNER JOIN \`食材\` i ON i.\`食材名稱\` = r.\`食材名稱\`
    WHERE m.\`上下架狀態\` = 1
  `)

  const byItem = new Map<number, RecipeJoinRow[]>()
  for (const row of rows2) {
    const arr = byItem.get(row.餐點編號)
    if (arr) arr.push(row)
    else byItem.set(row.餐點編號, [row])
  }

  const result: AvailabilityRow[] = []
  for (const item of activeItems) {
    const recipes = byItem.get(item.餐點編號) ?? []

    if (recipes.length === 0) {
      result.push({
        item_id: item.餐點編號,
        name: item.餐點名稱,
        max_servings: Number.POSITIVE_INFINITY,
        blocked: false,
        blocking_ingredients: [],
      })
      continue
    }

    let maxServings = Number.POSITIVE_INFINITY
    const blocking: BlockingIngredient[] = []

    for (const r of recipes) {
      if (r.食材數量 > 0) {
        const can = Math.floor(r.庫存數量 / r.食材數量)
        if (can < maxServings) maxServings = can
      }

      if (r.庫存數量 <= 0) {
        blocking.push({
          name: r.食材名稱,
          stock_qty: r.庫存數量,
          threshold: 0,
        })
      }
    }

    result.push({
      item_id: item.餐點編號,
      name: item.餐點名稱,
      max_servings: Number.isFinite(maxServings) ? maxServings : 0,
      blocked: blocking.length > 0,
      blocking_ingredients: blocking,
    })
  }

  return result
}
