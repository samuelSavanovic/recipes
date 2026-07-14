import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest'

// Env must be in place before the route modules read it. Our auth/db helpers
// read process.env lazily (at call time), so setting it here is enough.
beforeAll(() => {
  process.env.TURSO_DATABASE_URL = ':memory:'
  process.env.SESSION_SECRET = 'test-secret'
  process.env.EDIT_PASSWORD = 'letmein'
})

import { GET, POST } from '@/app/api/recipes/route'
import { PUT, DELETE } from '@/app/api/recipes/[slug]/route'
import { POST as AUTH_POST } from '@/app/api/auth/route'
import { ensureSchema, getDb, resetDb } from '@/lib/db'
import { issueToken } from '@/lib/auth'
import type { RecipeInput } from '@/lib/types'

const FIXED_TS = 1_700_000_000_000
const TOKEN = () => issueToken()

const sample = (over: Partial<RecipeInput> = {}): RecipeInput => ({
  title: 'Cacio e Pepe',
  cuisine: 'Italian',
  cook_time: '15_30',
  main: 'Pecorino Romano, Pepper',
  body_md: '## Ingredients\n\n- Pasta',
  ...over,
})

function postReq(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return new Request('http://localhost/api/recipes', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

function writeReq(
  slug: string,
  method: 'PUT' | 'DELETE',
  body: unknown,
  token?: string,
): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return new Request(`http://localhost/api/recipes/${slug}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) })

beforeEach(async () => {
  resetDb()
  await ensureSchema(getDb())
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_TS)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/recipes (create)', () => {
  it('rejects a missing token with 401', async () => {
    const res = await POST(postReq(sample()))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('rejects a wrong token with 401', async () => {
    const res = await POST(postReq(sample(), 'not-the-token'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('creates a recipe and returns the full shape (main included)', async () => {
    const res = await POST(postReq(sample(), TOKEN()))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({
      id: 'cacio-e-pepe',
      title: 'Cacio e Pepe',
      cuisine: 'Italian',
      cook_time: '15_30',
      main: 'Pecorino Romano, Pepper',
      body_md: '## Ingredients\n\n- Pasta',
      created_at: FIXED_TS,
      updated_at: FIXED_TS,
    })
  })

  it('rejects an invalid cook_time with 400 and a field error', async () => {
    const res = await POST(postReq(sample({ cook_time: 'banana' as never }), TOKEN()))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'Validation failed',
      fields: { cook_time: 'cook_time must be one of: under_15, 15_30, 30_60, over_60' },
    })
  })

  it('rejects a missing title with 400 and a field error', async () => {
    const res = await POST(postReq(sample({ title: '   ' }), TOKEN()))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'Validation failed',
      fields: { title: 'title is required' },
    })
  })
})

describe('GET /api/recipes (public)', () => {
  it('returns all recipes ordered by title, no token required', async () => {
    await POST(postReq(sample({ title: 'Zabaglione' }), TOKEN()))
    await POST(postReq(sample({ title: 'Amatriciana' }), TOKEN()))

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.map((r: { title: string }) => r.title)).toEqual([
      'Amatriciana',
      'Zabaglione',
    ])
  })
})

describe('PUT /api/recipes/[slug] (update)', () => {
  it('rejects a missing token with 401', async () => {
    const res = await PUT(writeReq('cacio-e-pepe', 'PUT', sample()), ctx('cacio-e-pepe'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('updates fields but keeps the slug on rename', async () => {
    await POST(postReq(sample({ title: 'Focaccia' }), TOKEN())) // → id "focaccia"

    const res = await PUT(
      writeReq(
        'focaccia',
        'PUT',
        sample({
          title: 'Focaccia Genovese',
          cook_time: 'over_60',
          main: 'Flour, Olive oil',
          body_md: '## Dough',
        }),
        TOKEN(),
      ),
      ctx('focaccia'),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      id: 'focaccia', // unchanged
      title: 'Focaccia Genovese',
      cuisine: 'Italian',
      cook_time: 'over_60',
      main: 'Flour, Olive oil',
      body_md: '## Dough',
      created_at: FIXED_TS,
      updated_at: FIXED_TS,
    })
  })

  it('returns 404 for an unknown slug', async () => {
    const res = await PUT(
      writeReq('ghost', 'PUT', sample(), TOKEN()),
      ctx('ghost'),
    )
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Recipe not found' })
  })
})

describe('DELETE /api/recipes/[slug]', () => {
  it('rejects a missing token with 401', async () => {
    const res = await DELETE(writeReq('cacio-e-pepe', 'DELETE', undefined), ctx('cacio-e-pepe'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('deletes an existing recipe', async () => {
    await POST(postReq(sample({ title: 'Doomed' }), TOKEN())) // → "doomed"

    const res = await DELETE(writeReq('doomed', 'DELETE', undefined, TOKEN()), ctx('doomed'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    const list = await (await GET()).json()
    expect(list).toEqual([])
  })

  it('returns 404 for an unknown slug', async () => {
    const res = await DELETE(writeReq('ghost', 'DELETE', undefined, TOKEN()), ctx('ghost'))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Recipe not found' })
  })
})

describe('POST /api/auth', () => {
  const authReq = (body: unknown) =>
    new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  it('returns a token for the correct password', async () => {
    const res = await AUTH_POST(authReq({ password: 'letmein' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ token: issueToken() })
  })

  it('rejects the wrong password with 401', async () => {
    const res = await AUTH_POST(authReq({ password: 'nope' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Incorrect password' })
  })
})
