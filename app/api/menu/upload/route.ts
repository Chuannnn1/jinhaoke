// app/api/menu/upload/route.ts
// 接受 multipart/form-data：file + item_id
// 使用 sharp 產生 800x600 display 與 200x200 thumb，存入 public/uploads/menu/
// 完成後更新 menu_item.image_url
import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { getDb } from '@/lib/db'

interface ApiResponse {
  success: boolean
  error?: string
  image_url?: string
  thumb_url?: string
}

const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'menu')

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const itemIdRaw = formData.get('item_id')

    if (!(file instanceof File)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 file 欄位' },
        { status: 400 }
      )
    }

    if (!itemIdRaw) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 item_id 欄位' },
        { status: 400 }
      )
    }

    const itemId = parseInt(String(itemIdRaw), 10)
    if (isNaN(itemId)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '無效的 item_id' },
        { status: 400 }
      )
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '僅支援 JPEG / PNG / WebP 圖片' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '圖片需小於 2MB' },
        { status: 400 }
      )
    }

    const db = getDb()
    const existing = db.prepare(
      'SELECT item_id FROM menu_item WHERE item_id = ?'
    ).get(itemId)

    if (!existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到品項' },
        { status: 404 }
      )
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true })

    const buf = Buffer.from(await file.arrayBuffer())
    const ts = Date.now()
    const baseName = `${itemId}_${ts}`
    const displayFile = `${baseName}.webp`
    const thumbFile = `${baseName}_thumb.webp`
    const displayPath = path.join(UPLOAD_DIR, displayFile)
    const thumbPath = path.join(UPLOAD_DIR, thumbFile)

    await sharp(buf)
      .resize(800, 600, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(displayPath)

    await sharp(buf)
      .resize(200, 200, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(thumbPath)

    const imageUrl = `/uploads/menu/${displayFile}`
    const thumbUrl = `/uploads/menu/${thumbFile}`

    db.prepare('UPDATE menu_item SET image_url = ? WHERE item_id = ?').run(
      imageUrl,
      itemId
    )

    return NextResponse.json<ApiResponse>({
      success: true,
      image_url: imageUrl,
      thumb_url: thumbUrl,
    })
  } catch (err) {
    console.error('[POST /api/menu/upload]', err)
    return NextResponse.json<ApiResponse>(
      { success: false, error: err instanceof Error ? err.message : '未知錯誤' },
      { status: 500 }
    )
  }
}
