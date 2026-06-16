// app/api/auth/setup-status/route.ts
// 公開端點：告訴前端「這台機器目前還沒設密碼，要走 first-boot 註冊流程」
// 同時看 env 和 DB（getStoredHash）
import { NextResponse } from 'next/server'
import { hasAdminPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ needs_setup: !hasAdminPassword() })
}
