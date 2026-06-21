// lib/db.ts — MySQL connection pool (mysql2/promise)
import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'jinhaoke',
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
    })
    console.log('[db] MySQL pool created:', {
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'jinhaoke',
    })
  }
  return pool
}
