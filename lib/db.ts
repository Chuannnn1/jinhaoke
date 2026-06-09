// lib/db.ts
// 更新日期：2026-06-09（對齊 schema v3，整合 init-db idempotent seed）
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'data', 'jinhaoke.db')
const SCHEMA_PATH = path.join(process.cwd(), 'lib', 'schema.sql')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    // 確保 data 目錄存在
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    // 執行 schema（IF NOT EXISTS，舊 DB 不會被破壞）
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8')
    db.exec(schema)

    // 初始化 seed（per-table idempotent）
    seedIfEmpty(db)

    console.log('[db] 資料庫初始化完成，DB 路徑：', DB_PATH)
  }
  return db
}

function seedIfEmpty(database: Database.Database) {
  // 若 menu_item 已有資料 → 視為已 seed 過，整批跳過
  // （避免每次 boot 都跑 per-table 檢查的小開銷）
  const count = database.prepare('SELECT COUNT(*) as c FROM menu_item').get() as { c: number }
  if (count.c > 0) return

  console.log('[db] menu_item 為空，跑 seed...')

  // 借用 scripts/seed-data.js 的 seedAll（JS 模組，per-table 檢查）
  // Next.js server runtime 是 CJS，可直接用 eval 拿到原生 require
  const seedDataPath = path.join(process.cwd(), 'scripts', 'seed-data.js')
  if (!fs.existsSync(seedDataPath)) {
    console.warn('[db] ⚠️  找不到 scripts/seed-data.js，跳過 seed')
    return
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const seedMod = eval('require')(seedDataPath) as { seedAll: (db: Database.Database) => void }
  seedMod.seedAll(database)

  const menuCount = database.prepare('SELECT COUNT(*) as c FROM menu_item').get() as { c: number }
  const ingCount = database.prepare('SELECT COUNT(*) as c FROM ingredient').get() as { c: number }
  console.log(`[db] seed 完成：${menuCount.c} 個餐點、${ingCount.c} 種食材`)
}
