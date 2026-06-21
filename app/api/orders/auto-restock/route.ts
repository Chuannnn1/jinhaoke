import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

interface LowStockRow extends RowDataPacket {
  食材名稱: string
  庫存數量: number
  安全存量: number
  庫存單位: string
  供應商名稱: string | null
}

interface RestockItem {
  食材名稱: string
  數量: number
}

// ============================================================
// POST /api/orders/auto-restock — 一鍵補貨
//
// 找出低於安全存量的食材，按供應商分組建立採購單
// ============================================================
export async function POST(req: Request) {
  try {
    const pool = getPool()
    const body = await req.json().catch(() => ({}))

    let sql = 'SELECT `食材名稱`, `庫存數量`, `安全存量`, `庫存單位`, `供應商名稱` FROM `食材` WHERE `庫存數量` < `安全存量`'
    const params: string[] = []

    if (body.supplier_name) {
      sql += ' AND `供應商名稱` = ?'
      params.push(String(body.supplier_name).trim())
    }

    sql += ' ORDER BY `供應商名稱`, `食材名稱`'

    const [lowStockItems] = await pool.execute<LowStockRow[]>(sql, params)

    if (lowStockItems.length === 0) {
      return NextResponse.json({
        success: true,
        data: { po_id: null, items: [], message: '所有食材庫存充足' },
      })
    }

    // 計算補貨量：(安全存量 - 庫存數量) × 1.5，向上取整
    const restockPlan: (RestockItem & { 供應商名稱: string | null })[] = lowStockItems.map(ing => {
      const deficit = ing.安全存量 - ing.庫存數量
      const target = Math.ceil(deficit * 1.5)
      return {
        食材名稱: ing.食材名稱,
        數量: Math.max(1, target),
        供應商名稱: ing.供應商名稱,
      }
    })

    // 按供應商分組
    const groupBySupplier = new Map<string, RestockItem[]>()
    for (const item of restockPlan) {
      if (!item.供應商名稱) continue
      if (!groupBySupplier.has(item.供應商名稱)) {
        groupBySupplier.set(item.供應商名稱, [])
      }
      groupBySupplier.get(item.供應商名稱)!.push({ 食材名稱: item.食材名稱, 數量: item.數量 })
    }

    const createdOrders: Array<{ po_id: number; supplier_name: string; items: RestockItem[] }> = []

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)

      for (const [supplierName, items] of groupBySupplier) {
        // 確認供應商存在
        const [supRows] = await conn.execute<RowDataPacket[]>(
          'SELECT `供應商名稱` FROM `供應商` WHERE `供應商名稱` = ?', [supplierName]
        )
        if (supRows.length === 0) continue

        const [result] = await conn.execute<ResultSetHeader>(
          'INSERT INTO `採購單` (`採購單日期`, `供應商名稱`, `進貨食材總成本`, `採購單狀態`) VALUES (?, ?, 0, ?)',
          [today, supplierName, '已下單']
        )
        const poId = result.insertId

        for (const item of items) {
          await conn.execute(
            'INSERT INTO `採購單明細` (`採購單編號`, `食材名稱`, `數量`) VALUES (?, ?, ?)',
            [poId, item.食材名稱, item.數量]
          )
        }

        createdOrders.push({ po_id: poId, supplier_name: supplierName, items })
      }

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }

    return NextResponse.json({
      success: true,
      data: {
        po_id: createdOrders.length > 0 ? createdOrders[0].po_id : null,
        orders: createdOrders,
        message: `已為 ${createdOrders.length} 個供應商建立採購單，共 ${restockPlan.length} 項食材需要補貨`,
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/orders/auto-restock]', err)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
