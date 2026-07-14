import { createHmac, createHash, timingSafeEqual } from 'node:crypto'

// Edit gate. Reads are public; only create/edit/delete are gated, and the gate
// lives here on the server — the client only ever holds an opaque token.
//
// Token = hex(HMAC-SHA256(SESSION_SECRET, "recipes-edit-v1")): a single
// long-lived value, deliberately not per-session. Revoke everyone by rotating
// SESSION_SECRET. All comparisons are constant-time.

const TOKEN_MESSAGE = 'recipes-edit-v1'

function requireSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')
  return secret
}

export function issueToken(): string {
  return createHmac('sha256', requireSecret()).update(TOKEN_MESSAGE).digest('hex')
}

// Constant-time string comparison. Both sides are SHA-256'd first so the compare
// runs over fixed-length buffers regardless of input length (timingSafeEqual
// throws on length mismatch, and equal-length buffers avoid leaking length).
function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function verifyPassword(password: unknown): boolean {
  const expected = process.env.EDIT_PASSWORD
  if (!expected || typeof password !== 'string') return false
  return constantTimeEqual(password, expected)
}

export function verifyToken(token: unknown): boolean {
  if (typeof token !== 'string' || token.length === 0) return false
  return constantTimeEqual(token, issueToken())
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? ''
  const match = /^Bearer (.+)$/.exec(header)
  return match ? match[1] : null
}

// The single gate every write route calls first.
export function requireAuth(req: Request): boolean {
  return verifyToken(bearerToken(req))
}
