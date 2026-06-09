// scripts/init-db.js
// ============================================================
// 金濠客 POS 系統 — 資料庫一鍵初始化
// ============================================================
// 流程：
//   1. 確保 data/ 目錄存在
//   2. 跑 lib/schema.sql 建表（CREATE TABLE IF NOT EXISTS）
//   3. 依序跑所有 migration（idempotent，已新版會自動 skip）
//   4. 跑 seed（per-table COUNT 檢查，空才插入）
//
// 使用：
//   node scripts/init-db.js
//
// 適用情境：
//   - 新環境 clone repo 後第一次建 DB
//   - 舊環境想補上 migration 跟預設品項
//   - 砍掉 data/jinhaoke.db 後重建
//
// ⚠️  跑之前先確保 dev server 已停（better-sqlite3 file lock）

const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

const ROOT = path.join(__dirname, '..')
const DB_PATH = path.join(ROOT, 'data', 'jinhaoke.db')
const SCHEMA_PATH = path.join(ROOT, 'lib', 'schema.sql')

// migration 檔案順序（依時間順序）
const MIGRATIONS = [
  'migrate-order-status-constraint.js',
  'migrate-add-menu-image.js',
  'migrate-add-block-threshold.js',
]

function log(section, msg) {
  console.log(`[${section}] ${msg}`)
}

function section(name) {
  console.log('')
  console.log('═'.repeat(60))
  console.log(`  ${name}`)
  console.log('═'.repeat(60))
}

function ensureDataDir() {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    log('init', `建立目錄：${dir}`)
  }
}

function runSchema(db) {
  section('Step 1: 跑 schema.sql 建表')
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8')
  db.exec(schema)
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all().map(r => r.name)
  log('schema', `現有 table：${tables.join(', ')}`)
}

function runMigrations() {
  section('Step 2: 跑 migrations（idempotent）')
  for (const file of MIGRATIONS) {
    const full = path.join(__dirname, file)
    if (!fs.existsSync(full)) {
      log('migrate', `⚠️  跳過：找不到 ${file}`)
      continue
    }
    log('migrate', `執行：${file}`)
    try {
      // 用 child_process 跑，每個 migration 各自開 / 關 DB connection
      // 這避免 file lock 衝突（migration 本身用 sync API）
      const { execSync } = require('child_process')
      execSync(`node "${full}"`, {
        stdio: 'inherit',
        cwd: ROOT,
      })
    } catch (err) {
      console.error(`[migrate] ❌ ${file} 失敗：`, err.message)
      throw err
    }
  }
}

function runSeed() {
  section('Step 3: 跑 seed 資料（空表才插入）')
  // 重新開 DB connection（migration 跑完已經關過）
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  try {
    const { seedAll } = require('./seed-data')
    seedAll(db)

    // 統計
    const stats = {
      supplier:          db.prepare('SELECT COUNT(*) c FROM supplier').get().c,
      ingredient:        db.prepare('SELECT COUNT(*) c FROM ingredient').get().c,
      menu_item:         db.prepare('SELECT COUNT(*) c FROM menu_item').get().c,
      recipe:            db.prepare('SELECT COUNT(*) c FROM recipe').get().c,
      delivery_customer: db.prepare('SELECT COUNT(*) c FROM delivery_customer').get().c,
      order:             db.prepare('SELECT COUNT(*) c FROM "order"').get().c,
    }
    console.log('')
    log('seed', '目前資料量：')
    for (const [k, v] of Object.entries(stats)) {
      console.log(`         ${k.padEnd(20)} ${v}`)
    }
  } finally {
    db.close()
  }
}

function main() {
  console.log('')
  console.log('🍱 金濠客 POS — 資料庫一鍵初始化')
  console.log(`   DB 路徑: ${DB_PATH}`)
  console.log('')

  ensureDataDir()

  // Step 1: schema
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  try {
    runSchema(db)
  } finally {
    db.close()
  }

  // Step 2: migrations（child_process 跑，自己開 DB）
  runMigrations()

  // Step 3: seed（重新開 DB）
  runSeed()

  section('✅ 完成')
  console.log('  下一步：npm run dev')
  console.log('')
}

main()
