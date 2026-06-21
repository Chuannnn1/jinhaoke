// lib/auth.ts — 後台單一密碼登入機制
import { NextResponse } from 'next/server'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { getPool } from './db'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

export const COOKIE_NAME = 'jinhaoke_admin_session'
export const SESSION_DAYS = 60

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false
  const parts = stored.split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = parts[1]
  const expectedHex = parts[2]
  try {
    const testHex = scryptSync(password, salt, 64).toString('hex')
    if (testHex.length !== expectedHex.length) return false
    return timingSafeEqual(Buffer.from(testHex, 'hex'), Buffer.from(expectedHex, 'hex'))
  } catch {
    return false
  }
}

export async function createSession(userAgent?: string): Promise<{
  token: string
  expiresAt: Date
}> {
  const pool = getPool()
  const token = randomBytes(32).toString('hex')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86400 * 1000)
  await pool.execute(
    `INSERT INTO \`管理員登入\` (\`登入令牌\`, \`建立時間\`, \`過期時間\`, \`最後活動\`, \`裝置資訊\`)
     VALUES (?, ?, ?, ?, ?)`,
    [token, now.toISOString(), expiresAt.toISOString(), now.toISOString(), userAgent?.slice(0, 200) ?? null]
  )
  return { token, expiresAt }
}

export async function isValidSession(token: string | undefined | null): Promise<boolean> {
  if (!token || typeof token !== 'string' || token.length !== 64) return false
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT `過期時間` FROM `管理員登入` WHERE `登入令牌` = ?',
    [token]
  )
  const row = rows[0] as { 過期時間: string } | undefined
  if (!row) return false
  if (Date.parse(row.過期時間) < Date.now()) {
    await pool.execute('DELETE FROM `管理員登入` WHERE `登入令牌` = ?', [token])
    return false
  }
  await pool.execute(
    'UPDATE `管理員登入` SET `最後活動` = ? WHERE `登入令牌` = ?',
    [new Date().toISOString(), token]
  )
  return true
}

export async function deleteSession(token: string): Promise<void> {
  const pool = getPool()
  await pool.execute('DELETE FROM `管理員登入` WHERE `登入令牌` = ?', [token])
}

export async function cleanExpiredSessions(): Promise<number> {
  const pool = getPool()
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM `管理員登入` WHERE `過期時間` < ?',
    [new Date().toISOString()]
  )
  return result.affectedRows
}

export async function getAdminSetting(key: string): Promise<string | null> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT `設定值` FROM `管理員設定` WHERE `設定鍵` = ?',
    [key]
  )
  const row = rows[0] as { 設定值: string } | undefined
  return row?.設定值 ?? null
}

export async function setAdminSetting(key: string, value: string): Promise<void> {
  const pool = getPool()
  await pool.execute(
    `INSERT INTO \`管理員設定\` (\`設定鍵\`, \`設定值\`, \`更新時間\`)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE \`設定值\` = VALUES(\`設定值\`), \`更新時間\` = VALUES(\`更新時間\`)`,
    [key, value, new Date().toISOString()]
  )
}

export async function getStoredHash(): Promise<string | undefined> {
  const fromDb = await getAdminSetting('admin_password_hash')
  if (fromDb) return fromDb
  return process.env.ADMIN_PASSWORD_HASH || undefined
}

export async function hasAdminPassword(): Promise<boolean> {
  return !!(await getStoredHash())
}

export function getSessionTokenFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') ?? ''
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === COOKIE_NAME) return decodeURIComponent(rest.join('='))
  }
  return null
}

export async function requireAdmin(req: Request): Promise<NextResponse | null> {
  const token = getSessionTokenFromRequest(req)
  if (!(await isValidSession(token))) {
    return NextResponse.json(
      { success: false, error: 'unauthorized' },
      { status: 401 }
    )
  }
  return null
}

export function buildSessionCookie(token: string, expiresAt: Date, req?: Request): string {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  if (shouldUseSecure(req)) parts.push('Secure')
  return parts.join('; ')
}

function shouldUseSecure(req?: Request): boolean {
  if (process.env.COOKIE_INSECURE === '1') return false
  if (process.env.COOKIE_FORCE_SECURE === '1') return true
  if (!req) return false
  const xfp = req.headers.get('x-forwarded-proto')
  if (xfp) return xfp.split(',')[0].trim().toLowerCase() === 'https'
  try {
    return new URL(req.url).protocol === 'https:'
  } catch {
    return false
  }
}

export function buildClearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}
