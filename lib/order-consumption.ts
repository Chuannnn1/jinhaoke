// lib/order-consumption.ts
// 給一張訂單算「會消耗哪些食材、各多少」的共用 helper。
import { getPool } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'

export const ADDON_TO_REF_ITEM: Record<string, Record<number, number>> = {
  extra_rice: {
    1: 22, 2: 22, 3: 22, 4: 22, 5: 22, 6: 22, 7: 22, 8: 22,
    9: 22, 10: 22, 11: 22,
  },
  extra_veg: {
    9: 21, 10: 21, 11: 21,
  },
  extra_meat: {
    1: 12, 2: 13, 3: 14, 4: 15, 5: 19, 7: 20, 8: 17,
    9: 16, 10: 26, 11: 18,
  },
}

export interface OrderItemInput {
  item_id: number
  quantity: number
  customizations?: string[][]
}

interface RecipeRow extends RowDataPacket {
  餐點編號: number
  食材名稱: string
  食材數量: number
}

export async function computeOrderConsumption(
  items: OrderItemInput[]
): Promise<Map<string, number>> {
  const consumption = new Map<string, number>()
  const pool = getPool()

  const allItemIds = new Set<number>()
  for (const it of items) {
    allItemIds.add(it.item_id)
    const cust = it.customizations ?? []
    for (const unit of cust) {
      if (!Array.isArray(unit)) continue
      for (const addonId of unit) {
        const refItem = ADDON_TO_REF_ITEM[addonId]?.[it.item_id]
        if (refItem) allItemIds.add(refItem)
      }
    }
  }
  if (allItemIds.size === 0) return consumption

  const ids = Array.from(allItemIds)
  const placeholders = ids.map(() => '?').join(',')
  const [rows] = await pool.execute<RecipeRow[]>(
    `SELECT \`餐點編號\`, \`食材名稱\`, \`食材數量\`
     FROM \`食譜\`
     WHERE \`餐點編號\` IN (${placeholders})`,
    ids
  )

  const byItem = new Map<number, RecipeRow[]>()
  for (const r of rows) {
    const arr = byItem.get(r.餐點編號)
    if (arr) arr.push(r)
    else byItem.set(r.餐點編號, [r])
  }

  function addConsumption(itemId: number, multiplier: number) {
    const rs = byItem.get(itemId)
    if (!rs) return
    for (const r of rs) {
      const cur = consumption.get(r.食材名稱) ?? 0
      consumption.set(r.食材名稱, cur + r.食材數量 * multiplier)
    }
  }

  for (const it of items) {
    addConsumption(it.item_id, it.quantity)

    const cust = it.customizations ?? []
    for (const unit of cust) {
      if (!Array.isArray(unit)) continue
      for (const addonId of unit) {
        const refItem = ADDON_TO_REF_ITEM[addonId]?.[it.item_id]
        if (refItem) addConsumption(refItem, 1)
      }
    }
  }

  return consumption
}

interface InsufficientIngredient {
  ingredient_name: string
  needed: number
  in_stock: number
}

export async function findInsufficientIngredients(
  consumption: Map<string, number>
): Promise<InsufficientIngredient[]> {
  if (consumption.size === 0) return []
  const pool = getPool()
  const names = Array.from(consumption.keys())
  const placeholders = names.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT \`食材名稱\`, \`庫存數量\` FROM \`食材\` WHERE \`食材名稱\` IN (${placeholders})`,
    names
  )
  const stockByName = new Map((rows as { 食材名稱: string; 庫存數量: number }[]).map(r => [r.食材名稱, r.庫存數量]))

  const insufficient: InsufficientIngredient[] = []
  for (const [ingName, needed] of consumption) {
    const inStock = stockByName.get(ingName) ?? 0
    if (needed > inStock) {
      insufficient.push({ ingredient_name: ingName, needed, in_stock: inStock })
    }
  }
  return insufficient
}
