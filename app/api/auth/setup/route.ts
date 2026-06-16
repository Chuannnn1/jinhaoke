// app/api/auth/setup/route.ts
// First-boot 密碼註冊：當 getStoredHash() 為空（env 沒設且 DB 也沒）時，
// 第一位進來的人有權設定密碼。設完同時：
//   1. 寫進 admin_setting DB（不寫檔，避免 dev 環境 .env 變動觸發 Next reload 把連線打斷）
//   2. 自動發 session cookie，順便登入
// 一旦 hash 存在，這支端點回 410 Gone，避免被搶占覆蓋。
import { NextResponse } from 'next/server'
import {
  hashPassword,
  createSession,
  buildSessionCookie,
  getStoredHash,
  setAdminSetting,
} from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface SetupBody {
  password?: string
}

export async function POST(req: Request) {
  if (getStoredHash()) {
    return NextResponse.json(
      { success: false, error: 'already_configured' },
      { status: 410 }
    )
  }

  let body: SetupBody = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: '請傳 JSON body' },
      { status: 400 }
    )
  }

  const password = (body.password || '').toString()
  if (password.length < 6) {
    return NextResponse.json(
      { success: false, error: '密碼至少 6 字' },
      { status: 400 }
    )
  }

  const hash = hashPassword(password)

  try {
    setAdminSetting('admin_password_hash', hash)
  } catch (e) {
    console.error('[auth/setup] 寫 DB 失敗:', e)
    return NextResponse.json(
      { success: false, error: '無法寫入資料庫' },
      { status: 500 }
    )
  }

  // 順手發 session cookie
  const userAgent = req.headers.get('user-agent') ?? undefined
  const { token, expiresAt } = createSession(userAgent)

  const res = NextResponse.json({
    success: true,
    expires_at: expiresAt.toISOString(),
  })
  res.headers.set('Set-Cookie', buildSessionCookie(token, expiresAt))
  return res
}
