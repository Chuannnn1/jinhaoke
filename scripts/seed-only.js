// scripts/seed-only.js — MySQL version
// 只跑 seed（不建表）。當你已經有 DB 但想補預設品項時用。
//
// 使用：node scripts/seed-only.js
const path = require('path')
const fs = require('fs')
const mysql = require('mysql2/promise')

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'jinhaoke',
    charset: 'utf8mb4',
  })

  console.log('[seed-only] Connected to MySQL')

  const { seedAll } = require('./seed-data')
  await seedAll(conn)

  await conn.end()
  console.log('[seed-only] Done')
}

main().catch(err => {
  console.error('[seed-only] Fatal:', err)
  process.exit(1)
})
