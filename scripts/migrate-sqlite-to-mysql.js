// scripts/migrate-sqlite-to-mysql.js
// One-shot migration: read SQLite DB → insert into MySQL
//
// Usage:
//   node scripts/migrate-sqlite-to-mysql.js [path-to-sqlite.db]
//
// Default SQLite path: ../data/jinhaoke.db (relative to this script)
// MySQL connection from .env.local or env vars.
//
// Prerequisites:
//   1. MySQL tables already created (run `npm run db:init` first — it creates tables but seed is idempotent)
//   2. better-sqlite3 must be installed: npm install better-sqlite3 --no-save
//
// FK insertion order:
//   supplier → ingredient → ingredient_supplier → menu_item → recipe →
//   delivery_customer → order → order_item → purchase_order →
//   purchase_order_item → return_order → admin_setting → admin_session

const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')
const mysql = require('mysql2/promise')

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const SQLITE_PATH = process.argv[2] || path.join(__dirname, '..', 'data', 'jinhaoke.db')

const TABLES_IN_ORDER = [
  'supplier',
  'ingredient',
  'ingredient_supplier',
  'menu_item',
  'recipe',
  'delivery_customer',
  { sqlite: '"order"', mysql: '`order`', name: 'order' },
  'order_item',
  'purchase_order',
  'purchase_order_item',
  'return_order',
  'admin_setting',
  'admin_session',
]

function getTableName(entry) {
  if (typeof entry === 'string') return entry
  return entry.name
}
function sqliteTableRef(entry) {
  if (typeof entry === 'string') return entry
  return entry.sqlite
}
function mysqlTableRef(entry) {
  if (typeof entry === 'string') return `\`${entry}\``
  return entry.mysql
}

async function main() {
  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`SQLite DB not found: ${SQLITE_PATH}`)
    console.error('Pass the path as argument: node scripts/migrate-sqlite-to-mysql.js /path/to/jinhaoke.db')
    process.exit(1)
  }

  console.log(`\n[migrate] SQLite: ${SQLITE_PATH}`)

  const sqlite = new Database(SQLITE_PATH, { readonly: true })
  sqlite.pragma('journal_mode = WAL')

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'jinhaoke',
    charset: 'utf8mb4',
  })

  console.log('[migrate] Connected to MySQL\n')

  await conn.execute('SET FOREIGN_KEY_CHECKS = 0')

  let totalRows = 0

  for (const entry of TABLES_IN_ORDER) {
    const name = getTableName(entry)
    const sqliteRef = sqliteTableRef(entry)
    const mysqlRef = mysqlTableRef(entry)

    // Check if table exists in SQLite
    const tableExists = sqlite.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
    ).get(name)

    if (!tableExists) {
      console.log(`  ${name.padEnd(25)} -- not in SQLite, skip`)
      continue
    }

    const rows = sqlite.prepare(`SELECT * FROM ${sqliteRef}`).all()
    if (rows.length === 0) {
      console.log(`  ${name.padEnd(25)} 0 rows`)
      continue
    }

    // Get column names from first row
    const cols = Object.keys(rows[0])
    const mysqlCols = cols.map(c => {
      // Reserved words
      if (c === 'order') return '`order`'
      if (c === 'key') return '`key`'
      if (c === 'value') return '`value`'
      if (c === 'option') return '`option`'
      return `\`${c}\``
    }).join(', ')
    const placeholders = cols.map(() => '?').join(', ')
    const insertSQL = `INSERT INTO ${mysqlRef} (${mysqlCols}) VALUES (${placeholders})`

    // Batch insert with transaction
    await conn.beginTransaction()
    try {
      for (const row of rows) {
        const values = cols.map(c => {
          const v = row[c]
          if (v === null || v === undefined) return null
          return v
        })
        await conn.execute(insertSQL, values)
      }
      await conn.commit()
      console.log(`  ${name.padEnd(25)} ${rows.length} rows`)
      totalRows += rows.length
    } catch (err) {
      await conn.rollback()
      console.error(`  ${name.padEnd(25)} ERROR: ${err.message}`)
      // If duplicate key, try IGNORE mode
      if (err.code === 'ER_DUP_ENTRY') {
        console.log(`  ${name.padEnd(25)} retrying with INSERT IGNORE...`)
        const insertIgnoreSQL = `INSERT IGNORE INTO ${mysqlRef} (${mysqlCols}) VALUES (${placeholders})`
        await conn.beginTransaction()
        try {
          let inserted = 0
          for (const row of rows) {
            const values = cols.map(c => row[c] ?? null)
            const [result] = await conn.execute(insertIgnoreSQL, values)
            if (result.affectedRows > 0) inserted++
          }
          await conn.commit()
          console.log(`  ${name.padEnd(25)} ${inserted} new rows (${rows.length - inserted} duplicates skipped)`)
          totalRows += inserted
        } catch (err2) {
          await conn.rollback()
          console.error(`  ${name.padEnd(25)} FAILED even with IGNORE: ${err2.message}`)
          throw err2
        }
      } else {
        throw err
      }
    }
  }

  await conn.execute('SET FOREIGN_KEY_CHECKS = 1')

  console.log(`\n[migrate] Total: ${totalRows} rows migrated`)

  sqlite.close()
  await conn.end()
  console.log('[migrate] Done')
}

main().catch(err => {
  console.error('[migrate] Fatal:', err)
  process.exit(1)
})
