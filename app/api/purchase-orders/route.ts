import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

export const dynamic = 'force-dynamic'

interface PORow extends RowDataPacket {
  採購單編號: number
  採購單日期: string
  供應商名稱: string
  進貨食材總成本: number
  採購單狀態: string
}

interface POItemRow extends RowDataPacket {
  食材名稱: string
  數量: number
}

// ============================================================
// GET /api/purchase-orders
// ============================================================
export async function GET(req: Request) {
  try {
    const pool = getPool()
    const { searchParams } = new URL(req.url)
    const supplierName = searchParams.get('supplier_name')
    const status = searchParams.get('status')

    let sql = 'SELECT `採購單編號`, `採購單日期`, `供應商名稱`, `進貨食材總成本`, `採購單狀態` FROM `採購單` WHERE 1=1'
    const params: string[] = []

    if (supplierName) {
      sql += ' AND `供應商名稱` = ?'
      params.push(supplierName)
    }
    if (status) {
      sql += ' AND `採購單狀態` = ?'
      params.push(status)
    }
    sql += ' ORDER BY `採購單日期` DESC, `採購單編號` DESC'

    const [orders] = await pool.execute<PORow[]>(sql, params)

    const result = []
    for (const order of orders) {
      const [items] = await pool.execute<POItemRow[]>(
        'SELECT `食材名稱`, `數量` FROM `採購單明細` WHERE `採購單編號` = ?',
        [order.採購單編號]
      )
      result.push({
        採購單編號: order.採購單編號,
        採購單日期: order.採購單日期,
        供應商名稱: order.供應商名稱,
        進貨食材總成本: order.進貨食材總成本,
        採購單狀態: order.採購單狀態,
        items: items.map(it => ({ 食材名稱: it.食材名稱, 數量: it.數量 })),
      })
    }

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error('[GET /api/purchase-orders]', err)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}

// ============================================================
// POST /api/purchase-orders — 新建採購單
// ============================================================
interface CreatePOBody {
  supplier_name: string
  items: Array<{
    ingredient_name: string
    qty: number
  }>
  total_cost?: number
}

export async function POST(req: Request) {
  try {
    const body: CreatePOBody = await req.json()
    const pool = getPool()

    if (!body.supplier_name || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'supplier_name 與 items 為必填' },
        { status: 400 }
      )
    }

    // 驗證供應商存在
    const [supRows] = await pool.execute<RowDataPacket[]>(
      'SELECT `供應商名稱` FROM `供應商` WHERE `供應商名稱` = ?',
      [body.supplier_name.trim()]
    )
    if (supRows.length === 0) {
      return NextResponse.json(
        { success: false, error: '找不到該供應商' },
        { status: 400 }
      )
    }

    // 驗證食材
    for (const item of body.items) {
      const [ingRows] = await pool.execute<RowDataPacket[]>(
        'SELECT `食材名稱` FROM `食材` WHERE `食材名稱` = ?',
        [item.ingredient_name.trim()]
      )
      if (ingRows.length === 0) {
        return NextResponse.json(
          { success: false, error: `找不到食材：${item.ingredient_name}` },
          { status: 400 }
        )
      }
      if (typeof item.qty !== 'number' || item.qty <= 0) {
        return NextResponse.json(
          { success: false, error: `${item.ingredient_name} 的數量需為正數` },
          { status: 400 }
        )
      }
    }

    const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
    const totalCost = body.total_cost ?? 0

    const conn = await pool.getConnection()
    let newPoId = 0
    try {
      await conn.beginTransaction()

      const [result] = await conn.execute<ResultSetHeader>(
        'INSERT INTO `採購單` (`採購單日期`, `供應商名稱`, `進貨食材總成本`, `採購單狀態`) VALUES (?, ?, ?, ?)',
        [today, body.supplier_name.trim(), totalCost, '已下單']
      )
      newPoId = result.insertId

      for (const item of body.items) {
        await conn.execute(
          'INSERT INTO `採購單明細` (`採購單編號`, `食材名稱`, `數量`) VALUES (?, ?, ?)',
          [newPoId, item.ingredient_name.trim(), item.qty]
        )
      }

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }

    const [newRows] = await pool.execute<PORow[]>(
      'SELECT `採購單編號`, `採購單日期`, `供應商名稱`, `進貨食材總成本`, `採購單狀態` FROM `採購單` WHERE `採購單編號` = ?',
      [newPoId]
    )
    const [newItems] = await pool.execute<POItemRow[]>(
      'SELECT `食材名稱`, `數量` FROM `採購單明細` WHERE `採購單編號` = ?',
      [newPoId]
    )

    return NextResponse.json({
      success: true,
      data: {
        ...newRows[0],
        items: newItems.map(it => ({ 食材名稱: it.食材名稱, 數量: it.數量 })),
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/purchase-orders]', err)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
