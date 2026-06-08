// lib/availability.ts
// 計算菜單品項可售性：依食材庫存 / 配方算出 max_servings 與 blocked 狀態。
// 規則：
//   effective_block = order_block_threshold ?? (safety_stock * 0.2)
//   若任一食材 stock_qty <= effective_block → blocked = true
//   max_servings = floor(min over ingredients of stock_qty / consume_qty)
import { getDb } from '@/lib/db'

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

interface RecipeJoinRow {
  item_id: number
  item_name: string
  ingredient_name: string
  consume_qty: number
  stock_qty: number
  safety_stock: number
  order_block_threshold: number | null
}

interface ActiveItemRow {
  item_id: number
  name: string
}

export function computeAvailability(): AvailabilityRow[] {
  const db = getDb()

  // 取得所有上架餐點
  const activeItems = db.prepare(`
    SELECT item_id, name FROM menu_item WHERE is_active = 1
  `).all() as ActiveItemRow[]

  // 一次撈所有 active 餐點的 recipe + ingredient 狀態
  const rows = db.prepare(`
    SELECT
      r.item_id AS item_id,
      mi.name AS item_name,
      r.ingredient_name AS ingredient_name,
      r.consume_qty AS consume_qty,
      i.stock_qty AS stock_qty,
      i.safety_stock AS safety_stock,
      i.order_block_threshold AS order_block_threshold
    FROM recipe r
    INNER JOIN menu_item mi ON mi.item_id = r.item_id
    INNER JOIN ingredient i ON i.name = r.ingredient_name
    WHERE mi.is_active = 1
  `).all() as RecipeJoinRow[]

  // 以 item_id 分群
  const byItem = new Map<number, RecipeJoinRow[]>()
  for (const row of rows) {
    const arr = byItem.get(row.item_id)
    if (arr) arr.push(row)
    else byItem.set(row.item_id, [row])
  }

  const result: AvailabilityRow[] = []
  for (const item of activeItems) {
    const recipes = byItem.get(item.item_id) ?? []

    // 沒有 recipe 的品項：視為無限量、不封鎖（保留現況；前台仍可下單）
    if (recipes.length === 0) {
      result.push({
        item_id: item.item_id,
        name: item.name,
        max_servings: Number.POSITIVE_INFINITY,
        blocked: false,
        blocking_ingredients: [],
      })
      continue
    }

    let maxServings = Number.POSITIVE_INFINITY
    const blocking: BlockingIngredient[] = []

    for (const r of recipes) {
      const effectiveBlock =
        r.order_block_threshold !== null && r.order_block_threshold !== undefined
          ? r.order_block_threshold
          : r.safety_stock * 0.2

      if (r.consume_qty > 0) {
        const can = Math.floor(r.stock_qty / r.consume_qty)
        if (can < maxServings) maxServings = can
      }

      if (r.stock_qty <= effectiveBlock) {
        blocking.push({
          name: r.ingredient_name,
          stock_qty: r.stock_qty,
          threshold: effectiveBlock,
        })
      }
    }

    result.push({
      item_id: item.item_id,
      name: item.name,
      max_servings: Number.isFinite(maxServings) ? maxServings : 0,
      blocked: blocking.length > 0,
      blocking_ingredients: blocking,
    })
  }

  return result
}
