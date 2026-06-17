// lib/order-consumption.ts
//
// 給一張訂單算「會消耗哪些食材、各多少」的共用 helper。
// 同時給「下單 POST（pre-flight 擋下會把庫存吃成負的單）」與
// 「狀態 PATCH 已完成（實際扣庫存）」使用。
//
// 客製化 addon 的扣料規則（依用戶確認）：
//   加飯 / 加菜 / 加肉「都算一份」，扣料 = 對應單點 menu_item 的 recipe 一份。
//   例：1 大比目魚便當 加魚排 → 跑「12 大比目魚排（單點）」的 recipe（1 片魚排）
//      9 沙茶牛肉燴飯 加飯 → 跑「22 白米（單點）」的 recipe（0.3 公斤白米）
//
// addon id 對應參考 menu_item 的映射表，是 hard-code 而非 DB 設定，
// 因為這是業務語意層（「加肉 = 那個品項的單點」），與 menu_item 的 addons 欄位定義對齊。
import type Database from 'better-sqlite3'

// addon_id → base_item_id → ref_item_id
// 舉例：base=1（大比目魚排便當）+ addon=extra_meat → ref=12（大比目魚排 單點）
export const ADDON_TO_REF_ITEM: Record<string, Record<number, number>> = {
  extra_rice: {
    1: 22, 2: 22, 3: 22, 4: 22, 5: 22, 6: 22, 7: 22, 8: 22,
    9: 22, 10: 22, 11: 22,
  },
  extra_veg: {
    9: 21, 10: 21, 11: 21,
  },
  extra_meat: {
    1: 12,   // 大比目魚排便當 → 大比目魚排 單點
    2: 13,   // 酥炸豬排便當 → 酥炸豬排 單點
    3: 14,   // 酥嫩雞腿便當 → 酥嫩雞腿 單點
    4: 15,   // 紅麴豬五花便當 → 紅麴豬五花 單點
    5: 19,   // 酥炸排骨便當 → 酥炸排骨 單點
    7: 20,   // 滷雞腿便當 → 滷雞腿 單點
    8: 17,   // 滷排骨便當 → 滷排骨 單點
    9: 16,   // 沙茶牛肉燴飯 → 沙茶燴牛肉 單點
    10: 26,  // 沙茶雞柳燴飯 → 沙茶燴雞肉 單點
    11: 18,  // 沙茶豬肉燴飯 → 沙茶燴豬肉 單點
  },
}

export interface OrderItemInput {
  item_id: number
  quantity: number
  // 每份的 addon id 列表；長度應該等於 quantity（為 0 視為全 [] 沒客製化）
  customizations?: string[][]
}

interface RecipeRow {
  item_id: number
  ingredient_name: string
  consume_qty: number
}

/**
 * 計算一張訂單會消耗的食材總量。
 * 包含 base item recipe + 所有 addon 的 ref item recipe。
 * 回傳 ingredient_name → 總消耗量（stock_unit 下的量）的 Map。
 */
export function computeOrderConsumption(
  db: Database.Database,
  items: OrderItemInput[]
): Map<string, number> {
  const consumption = new Map<string, number>()

  // 蒐集所有要查 recipe 的 item_id：base + addon refs
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
  const recipes = db.prepare(`
    SELECT item_id, ingredient_name, consume_qty
    FROM recipe
    WHERE item_id IN (${ids.map(() => '?').join(',')})
  `).all(...ids) as RecipeRow[]

  // 按 item_id 分群方便查
  const byItem = new Map<number, RecipeRow[]>()
  for (const r of recipes) {
    const arr = byItem.get(r.item_id)
    if (arr) arr.push(r)
    else byItem.set(r.item_id, [r])
  }

  function addConsumption(itemId: number, multiplier: number) {
    const rs = byItem.get(itemId)
    if (!rs) return
    for (const r of rs) {
      const cur = consumption.get(r.ingredient_name) ?? 0
      consumption.set(r.ingredient_name, cur + r.consume_qty * multiplier)
    }
  }

  for (const it of items) {
    // base：扣 quantity 份
    addConsumption(it.item_id, it.quantity)

    // 客製化：每個 unit 是一份；每個 addon 扣對應 ref item 一份
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

/**
 * 用消耗 Map 跟 ingredient 庫存比對。
 * 回傳不夠的食材清單；空陣列表示全部可下單。
 */
export function findInsufficientIngredients(
  db: Database.Database,
  consumption: Map<string, number>
): InsufficientIngredient[] {
  if (consumption.size === 0) return []
  const names = Array.from(consumption.keys())
  const rows = db.prepare(`
    SELECT name, stock_qty FROM ingredient
    WHERE name IN (${names.map(() => '?').join(',')})
  `).all(...names) as { name: string; stock_qty: number }[]
  const stockByName = new Map(rows.map(r => [r.name, r.stock_qty]))

  const insufficient: InsufficientIngredient[] = []
  for (const [ingName, needed] of consumption) {
    const inStock = stockByName.get(ingName) ?? 0
    if (needed > inStock) {
      insufficient.push({ ingredient_name: ingName, needed, in_stock: inStock })
    }
  }
  return insufficient
}
