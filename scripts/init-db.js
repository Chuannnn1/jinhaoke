// scripts/init-db.js — MySQL version
// Usage: node scripts/init-db.js
//
// 1. Connect to MySQL (reads .env.local or env vars)
// 2. Run lib/schema.sql to create tables
// 3. Run seed (idempotent — only inserts into empty tables)
const path = require('path')
const fs = require('fs')
const mysql = require('mysql2/promise')

// Load .env.local manually (Next.js doesn't load it for scripts)
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const SCHEMA_PATH = path.join(__dirname, '..', 'lib', 'schema.sql')

async function main() {
  console.log('\njinhaoke POS — MySQL init')

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'jinhaoke',
    charset: 'utf8mb4',
    multipleStatements: true,
  })

  console.log('[init] Connected to MySQL')

  // Step 1: Run schema
  console.log('\n[init] Running schema.sql...')
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8')
  // Split by semicolons, filter empty, run each statement
  // (multipleStatements is enabled but running individually gives better error messages)
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
  for (const stmt of statements) {
    try {
      await conn.execute(stmt)
    } catch (err) {
      // Ignore "index already exists" errors (1061)
      if (err.errno === 1061) continue
      console.error(`[init] Error in statement: ${stmt.slice(0, 80)}...`)
      throw err
    }
  }

  const [tables] = await conn.execute('SHOW TABLES')
  console.log(`[init] Tables: ${tables.map(r => Object.values(r)[0]).join(', ')}`)

  // Step 2: Seed
  console.log('\n[init] Running seed...')
  const { seedAll } = require('./seed-data')
  await seedAll(conn)

  // Stats
  const countTables = ['供應商', '食材', '餐點', '食譜']
  for (const t of countTables) {
    const [[row]] = await conn.execute(`SELECT COUNT(*) AS c FROM \`${t}\``)
    console.log(`  ${t.padEnd(10)} ${row.c}`)
  }

  await conn.end()
  console.log('\n[init] Done. Run: npm run dev')
}

main().catch(err => {
  console.error('[init] Fatal:', err)
  process.exit(1)
})
