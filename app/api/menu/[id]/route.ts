import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'

interface MenuItemRow extends RowDataPacket {
  餐點編號: number
  餐點名稱: string
  餐點分類: string
  餐點價格: number
  圖示: string
  分類標籤: string
  餐點描述: string
  上下架狀態: number
  圖片網址: string
  客製化屬性: string
}

function parseAddons(raw: string | null): Array<{ id: string; label: string; price: number }> {
  try {
    const p = JSON.parse(raw ?? '[]')
    return Array.isArray(p) ? p : []
  } catch { return [] }
}

function toResponse(r: MenuItemRow) {
  return {
    item_id: r.餐點編號,
    name: r.餐點名稱,
    category: r.餐點分類,
    price: r.餐點價格,
    emoji: r.圖示,
    tag: r.分類標籤,
    description: r.餐點描述,
    active: r.上下架狀態,
    image_url: r.圖片網址,
    addons: parseAddons(r.客製化屬性),
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const pool = getPool()
    const id = parseInt(params.id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: '無效的品項 ID' }, { status: 400 })
    }

    const [rows] = await pool.execute<MenuItemRow[]>(
      'SELECT `餐點編號`,`餐點名稱`,`餐點分類`,`餐點價格`,`圖示`,`分類標籤`,`餐點描述`,`上下架狀態`,`圖片網址`,`客製化屬性` FROM `餐點` WHERE `餐點編號` = ?',
      [id]
    )
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: '找不到品項' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: toResponse(rows[0]) })
  } catch (err) {
    console.error('[GET /api/menu/:id]', err)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const pool = getPool()
    const id = parseInt(params.id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: '無效的品項 ID' }, { status: 400 })
    }

    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT `餐點編號` FROM `餐點` WHERE `餐點編號` = ?', [id]
    )
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: '找不到品項' }, { status: 404 })
    }

    const body = await req.json()
    const fieldMap: Record<string, string> = {
      '餐點名稱': '餐點名稱', '餐點分類': '餐點分類', '餐點價格': '餐點價格',
      '圖示': '圖示', '分類標籤': '分類標籤', '餐點描述': '餐點描述',
      '上下架狀態': '上下架狀態', '圖片網址': '圖片網址', '客製化屬性': '客製化屬性',
    }

    const sets: string[] = []
    const values: (string | number)[] = []

    for (const [bodyKey, colName] of Object.entries(fieldMap)) {
      if (body[bodyKey] !== undefined) {
        const val = bodyKey === '客製化屬性' ? JSON.stringify(body[bodyKey]) : body[bodyKey]
        sets.push(`\`${colName}\` = ?`)
        values.push(val)
      }
    }

    if (sets.length === 0) {
      return NextResponse.json({ success: false, error: '沒有要更新的欄位' }, { status: 400 })
    }

    values.push(id)
    await pool.execute(`UPDATE \`餐點\` SET ${sets.join(', ')} WHERE \`餐點編號\` = ?`, values)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PUT /api/menu/:id]', err)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const pool = getPool()
    const id = parseInt(params.id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: '無效的品項 ID' }, { status: 400 })
    }

    const body = await req.json()
    const active = body['上下架狀態'] ?? body.is_active
    if (active !== 0 && active !== 1) {
      return NextResponse.json({ success: false, error: '上下架狀態 必須為 0 或 1' }, { status: 400 })
    }

    await pool.execute('UPDATE `餐點` SET `上下架狀態` = ? WHERE `餐點編號` = ?', [active, id])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/menu/:id]', err)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const pool = getPool()
    const id = parseInt(params.id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: '無效的品項 ID' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    if (searchParams.get('permanent') === '1') {
      const [refs] = await pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) AS cnt FROM `訂單明細` WHERE `餐點編號` = ?', [id]
      )
      if ((refs[0] as { cnt: number }).cnt > 0) {
        return NextResponse.json({ success: false, error: '該品項有關聯訂單，無法刪除' }, { status: 400 })
      }
      await pool.execute('DELETE FROM `餐點` WHERE `餐點編號` = ?', [id])
    } else {
      await pool.execute('UPDATE `餐點` SET `上下架狀態` = 0 WHERE `餐點編號` = ?', [id])
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/menu/:id]', err)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
