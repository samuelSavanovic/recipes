import { NextResponse } from 'next/server'
import { issueToken, verifyPassword } from '@/lib/auth'

// POST { password } → { token } on success, 401 otherwise. The token is then
// sent as `Authorization: Bearer <token>` on write requests.
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const password = (body as { password?: unknown } | null)?.password
  if (!verifyPassword(password)) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  return NextResponse.json({ token: issueToken() })
}
