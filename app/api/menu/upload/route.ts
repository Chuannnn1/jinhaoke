import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { getPool } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'

const MAX_SIZE = 2 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'menu')

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const itemIdRaw = formData.get('item_id')

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: '缺少 file 欄位' }, { status: 400 })
    }
    if (!itemIdRaw) {
      return NextResponse.json({ success: false, error: '缺少 item_id 欄位' }, { status: 400 })
    }

    const itemId = parseInt(String(itemIdRaw), 10)
    if (isNaN(itemId)) {
      return NextResponse.json({ success: false, error: '無效的 item_id' }, { status: 400 })
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ success: false, error: '僅支援 JPEG / PNG / WebP 圖片' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: '圖片需小於 2MB' }, { status: 400 })
    }

    const pool = getPool()
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT `餐點編號` FROM `餐點` WHERE `餐點編號` = ?', [itemId]
    )
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: '找不到品項' }, { status: 404 })
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true })

    const buf = Buffer.from(await file.arrayBuffer())
    const ts = Date.now()
    const baseName = `${itemId}_${ts}`
    const displayFile = `${baseName}.webp`
    const thumbFile = `${baseName}_thumb.webp`

    await sharp(buf).resize(800, 600, { fit: 'cover' }).webp({ quality: 80 }).toFile(path.join(UPLOAD_DIR, displayFile))
    await sharp(buf).resize(200, 200, { fit: 'cover' }).webp({ quality: 80 }).toFile(path.join(UPLOAD_DIR, thumbFile))

    const imageUrl = `/uploads/menu/${displayFile}`
    const thumbUrl = `/uploads/menu/${thumbFile}`

    await pool.execute(
      'UPDATE `餐點` SET `圖片網址` = ? WHERE `餐點編號` = ?',
      [imageUrl, itemId]
    )

    return NextResponse.json({ success: true, image_url: imageUrl, thumb_url: thumbUrl })
  } catch (err) {
    console.error('[POST /api/menu/upload]', err)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}
