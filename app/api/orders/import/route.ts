import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'

// ============================================================
// POST /api/orders/import
// CSV 匯入訂單
//
// CSV 格式：MMDD.csv，標頭：編號,金額,電話,付款狀態,品項,辣度
// ============================================================

interface ParsedItem {
  code: number
  qty: number
}

interface ParsedRow {
  rowNum: number
  daily_seq: number
  amount_csv: number
  phone: string
  paid: boolean
  items: ParsedItem[]
  spice: string[]
}

interface ValidItemPreview {
  code: number
  qty: number
  spice: string
  item_name?: string
  item_id?: number
  is_active?: number
}

interface ValidOrderPreview {
  order_id: string
  status: string
  items: ValidItemPreview[]
  total: number
  amount_csv: number
  phone: string
  note: string
}

interface RowError {
  row: number
  reason: string
}

interface MenuLookupRow extends RowDataPacket {
  餐點編號: number
  餐點名稱: string
  餐點價格: number
  上下架狀態: number
}

function splitCsvLine(line: string): string[] {
  return line.split(',').map(s => s.trim())
}

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length === 0) return { header: [], rows: [] }
  const header = splitCsvLine(lines[0])
  const rows = lines.slice(1).map(splitCsvLine)
  return { header, rows }
}

function parseItems(raw: string): { ok: boolean; items: ParsedItem[]; reason?: string } {
  const items: ParsedItem[] = []
  const parts = raw.split(';').map(s => s.trim()).filter(s => s.length > 0)
  for (const p of parts) {
    let codeStr = p
    let qtyStr = '1'
    if (p.includes('*')) {
      const [c, q] = p.split('*').map(s => s.trim())
      codeStr = c
      qtyStr = q
    }
    const code = parseInt(codeStr, 10)
    const qty = parseInt(qtyStr, 10)
    if (!Number.isFinite(code) || code <= 0) {
      return { ok: false, items: [], reason: `品項 code 格式錯誤：${p}` }
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, items: [], reason: `品項 qty 格式錯誤：${p}` }
    }
    items.push({ code, qty })
  }
  return { ok: true, items }
}

function parseSpice(raw: string): string[] {
  if (!raw || raw.toLowerCase() === 'null') return []
  return raw.split(';').map(s => s.trim())
}

function parsePhone(raw: string): { ok: boolean; phone: string; reason?: string } {
  if (!raw || raw.toLowerCase() === 'null') return { ok: true, phone: '' }
  if (!/^\d{3,15}$/.test(raw)) return { ok: false, phone: '', reason: `電話格式錯誤：${raw}` }
  return { ok: true, phone: raw }
}

function parseDateFromFilename(filename: string): { ok: boolean; date?: string; ymdCompact?: string; reason?: string } {
  const base = filename.replace(/\.csv$/i, '').trim()
  const m = base.match(/^(\d{2})(\d{2})$/)
  if (!m) return { ok: false, reason: `檔名必須為 MMDD.csv 格式（例 0519.csv），目前：${filename}` }
  const mm = m[1]
  const dd = m[2]
  const mmNum = parseInt(mm, 10)
  const ddNum = parseInt(dd, 10)
  if (mmNum < 1 || mmNum > 12 || ddNum < 1 || ddNum > 31) {
    return { ok: false, reason: `檔名月份/日期超出範圍：${filename}` }
  }
  const year = 2026
  return { ok: true, date: `${year}-${mm}-${dd}`, ymdCompact: `${year}${mm}${dd}` }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const confirm = formData.get('confirm') === '1'
    const mappingRaw = formData.get('mapping')

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, error: '請上傳 CSV 檔案' },
        { status: 400 }
      )
    }

    const filename = (file as File).name || ''
    const dateParse = parseDateFromFilename(filename)
    if (!dateParse.ok) {
      return NextResponse.json(
        { success: false, error: dateParse.reason || '檔名格式錯誤' },
        { status: 400 }
      )
    }
    const orderDate = dateParse.date!
    const ymdCompact = dateParse.ymdCompact!

    const todayISO = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
    const isPastOrder = orderDate !== todayISO

    const text = await (file as File).text()
    const { header, rows } = parseCsv(text)

    const expected = ['編號', '金額', '電話', '付款狀態', '品項', '辣度']
    if (header.length < expected.length || expected.some((c, i) => header[i] !== c)) {
      return NextResponse.json(
        { success: false, error: 'CSV 標頭必須為：編號,金額,電話,付款狀態,品項,辣度' },
        { status: 400 }
      )
    }

    const pool = getPool()

    // 預載餐點（含已下架）
    const [menuRows] = await pool.execute<MenuLookupRow[]>(
      'SELECT `餐點編號`, `餐點名稱`, `餐點價格`, `上下架狀態` FROM `餐點` ORDER BY `餐點編號`'
    )
    const menuById = new Map<number, MenuLookupRow>()
    for (const m of menuRows) menuById.set(m.餐點編號, m)

    // 預載既有訂單編號
    const [existingRows] = await pool.execute<RowDataPacket[]>(
      'SELECT `訂單編號` FROM `訂單`'
    )
    const existingOrderIds = new Set<string>(existingRows.map(r => r.訂單編號 as string))

    const errors: RowError[] = []
    const parsedRows: ParsedRow[] = []
    const seenSeq = new Set<number>()

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2
      const cells = rows[i]
      const [seqRaw = '', amountRaw = '', phoneRaw = '', paidRaw = '', itemsRaw = '', spiceRaw = ''] = cells

      if (!seqRaw || !itemsRaw) {
        errors.push({ row: rowNum, reason: '缺少必要欄位（編號 / 品項）' })
        continue
      }

      const seq = parseInt(seqRaw, 10)
      if (!Number.isFinite(seq) || seq <= 0) {
        errors.push({ row: rowNum, reason: `編號必須為正整數：${seqRaw}` })
        continue
      }
      if (seenSeq.has(seq)) {
        errors.push({ row: rowNum, reason: `編號重複：${seq}` })
        continue
      }

      const amount = parseInt(amountRaw, 10)
      if (amountRaw && (!Number.isFinite(amount) || amount < 0)) {
        errors.push({ row: rowNum, reason: `金額格式錯誤：${amountRaw}` })
        continue
      }

      const phoneRes = parsePhone(phoneRaw)
      if (!phoneRes.ok) {
        errors.push({ row: rowNum, reason: phoneRes.reason || '電話錯誤' })
        continue
      }

      let paid = false
      if (paidRaw === '0') paid = false
      else if (paidRaw === '1') paid = true
      else {
        errors.push({ row: rowNum, reason: `付款狀態必須為 0 或 1：${paidRaw}` })
        continue
      }

      const itemsRes = parseItems(itemsRaw)
      if (!itemsRes.ok) {
        errors.push({ row: rowNum, reason: itemsRes.reason || '品項錯誤' })
        continue
      }

      const spice = parseSpice(spiceRaw)

      const orderId = `A${ymdCompact}${String(seq).padStart(4, '0')}`
      if (existingOrderIds.has(orderId)) {
        errors.push({ row: rowNum, reason: `order_id 已存在：${orderId}` })
        continue
      }

      seenSeq.add(seq)
      parsedRows.push({
        rowNum,
        daily_seq: seq,
        amount_csv: Number.isFinite(amount) ? amount : 0,
        phone: phoneRes.phone,
        paid,
        items: itemsRes.items,
        spice,
      })
    }

    // 蒐集 codes
    const codeSet = new Set<number>()
    for (const r of parsedRows) for (const it of r.items) codeSet.add(it.code)

    // 解析 mapping
    let mapping: Record<string, number> = {}
    if (mappingRaw && typeof mappingRaw === 'string') {
      try {
        const parsed = JSON.parse(mappingRaw)
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            const id = typeof v === 'number' ? v : parseInt(String(v), 10)
            if (Number.isFinite(id) && id > 0) mapping[k] = id
          }
        }
      } catch {
        return NextResponse.json(
          { success: false, error: 'mapping JSON 解析失敗' },
          { status: 400 }
        )
      }
    }

    // 自動對應：code === 餐點編號
    for (const code of Array.from(codeSet)) {
      if (!mapping[String(code)] && menuById.has(code)) {
        mapping[String(code)] = code
      }
    }

    const unmappedCodes: number[] = []
    for (const code of Array.from(codeSet).sort((a, b) => a - b)) {
      const mapped = mapping[String(code)]
      if (!mapped || !menuById.has(mapped)) unmappedCodes.push(code)
    }

    // 組合預覽訂單
    const valid: ValidOrderPreview[] = parsedRows.map(r => {
      const orderId = `A${ymdCompact}${String(r.daily_seq).padStart(4, '0')}`
      const status = isPastOrder ? '已完成' : (r.paid ? '已完成' : '待付款')
      const items: ValidItemPreview[] = r.items.map((it, idx) => {
        const mapped = mapping[String(it.code)]
        const menu = mapped ? menuById.get(mapped) : undefined
        return {
          code: it.code,
          qty: it.qty,
          spice: r.spice[idx] ?? '',
          item_name: menu?.餐點名稱,
          item_id: menu?.餐點編號,
          is_active: menu?.上下架狀態,
        }
      })
      const total = items.reduce((s, it) => {
        const menu = it.item_id ? menuById.get(it.item_id) : undefined
        return s + (menu?.餐點價格 ?? 0) * it.qty
      }, 0)
      const noteParts = r.spice
        .map((sp, idx) => sp ? `${items[idx]?.item_name ?? `code${items[idx]?.code}`}:${sp}` : '')
        .filter(s => s.length > 0)
      return {
        order_id: orderId,
        status,
        items,
        total,
        amount_csv: r.amount_csv,
        phone: r.phone,
        note: noteParts.join('；'),
      }
    })

    const itemsCount = valid.reduce((s, o) => s + o.items.length, 0)
    const summary = {
      orders: valid.length,
      items: itemsCount,
      errors: errors.length,
      file: filename,
      order_date: orderDate,
    }

    // 預覽
    if (!confirm) {
      return NextResponse.json({
        success: true,
        preview: true,
        summary,
        valid,
        errors,
        unmapped_codes: unmappedCodes,
        menu_options: menuRows.map(m => ({
          item_id: m.餐點編號,
          name: m.餐點名稱,
          price: m.餐點價格,
          is_active: m.上下架狀態,
        })),
      })
    }

    // 確認匯入
    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: '尚有錯誤，無法匯入', errors },
        { status: 400 }
      )
    }
    if (unmappedCodes.length > 0) {
      console.warn(`CSV import 發現未對應 code：${unmappedCodes.join(', ')}，將跳過這些品項`)
    }

    // 訂單日期用 DATETIME
    const datetimeStr = `${orderDate} 12:00:00`

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      for (const order of valid) {
        const phoneOrNull = order.phone || null

        await conn.execute(
          'INSERT INTO `訂單` (`訂單編號`, `訂單日期`, `訂單狀態`, `顧客電話`, `備註`) VALUES (?, ?, ?, ?, ?)',
          [order.order_id, datetimeStr, order.status, phoneOrNull, order.note || null]
        )

        // 聚合同一 餐點編號 的數量（PK 是複合鍵）
        const agg = new Map<number, number>()
        for (const it of order.items) {
          if (!it.item_id) continue
          const cur = agg.get(it.item_id) ?? 0
          agg.set(it.item_id, cur + it.qty)
        }
        for (const [itemId, qty] of agg) {
          await conn.execute(
            'INSERT INTO `訂單明細` (`訂單編號`, `餐點編號`, `數量`, `客製化`) VALUES (?, ?, ?, ?)',
            [order.order_id, itemId, qty, '[]']
          )
        }
      }

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }

    const actualImportedOrders = valid.filter(o =>
      o.items.some(it => it.item_id !== undefined)
    )

    return NextResponse.json({
      success: true,
      preview: false,
      imported: actualImportedOrders.length,
      total_csv_orders: valid.length,
      skipped_unmapped_codes: unmappedCodes.length > 0 ? unmappedCodes : undefined,
    })
  } catch (error) {
    console.error('POST /api/orders/import error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    )
  }
}
