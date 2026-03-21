import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// ---------------------------------------------------------------------------
// Hoisted mock factories for Supabase service client
// ---------------------------------------------------------------------------
const {
  mockPostInsertSingle,
  mockPostRevokeMatcher,
  mockGetSelect,
  mockDeleteRevoke,
} = vi.hoisted(() => {
  return {
    mockPostInsertSingle: vi.fn(),
    mockPostRevokeMatcher: vi.fn(),
    mockGetSelect: vi.fn(),
    mockDeleteRevoke: vi.fn(),
  }
})

// The mock needs to support different Supabase chain shapes:
//   POST revoke: .from('api_keys').update({...}).eq(...).eq(...).is(...)
//   POST insert:  .from('api_keys').insert({...}).select(...).single()
//   GET list:     .from('api_keys').select(...).eq(...).is(...).order(...)
//   DELETE:       .from('api_keys').update({...}).eq(...).eq(...).is(...)
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => {
    // Track which operation is being performed to route to the right mock
    let _operationType: 'revoke' | 'insert' | 'get' | 'delete' | null = null

    const chain: Record<string, unknown> = {}

    chain.is = vi.fn(() => chain)
    chain.order = vi.fn(async () => mockGetSelect())
    chain.single = vi.fn(async () => mockPostInsertSingle())

    chain.eq = vi.fn(() => chain)

    chain.select = vi.fn((..._args: unknown[]) => {
      if (_operationType === 'get') {
        return chain
      }
      return chain
    })

    chain.insert = vi.fn(() => {
      _operationType = 'insert'
      return chain
    })

    chain.update = vi.fn(() => {
      // distinguish revoke (POST) vs delete by tracking separately via mockPostRevokeMatcher / mockDeleteRevoke
      return {
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(async () => {
          // We'll route based on call order — but this is fragile. Instead,
          // let the tests control via the mock return values.
          // Actually we call mockPostRevokeMatcher for all update chains
          return mockPostRevokeMatcher()
        }),
      }
    })

    chain.from = vi.fn((table: string) => {
      if (table === 'api_keys') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn(async () => mockPostRevokeMatcher()),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => mockPostInsertSingle()),
            })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn(async () => mockGetSelect()),
          })),
        }
      }
      return chain
    })

    return { from: chain.from }
  },
}))

import { generateApiKey } from '@/lib/api-keys/generate'
import { POST, GET, DELETE } from '@/app/api/keys/[botId]/route'

// ---------------------------------------------------------------------------
// generateApiKey unit tests
// ---------------------------------------------------------------------------
describe('generateApiKey()', () => {
  it('returns an object with raw, hash, and prefix fields', () => {
    const result = generateApiKey()
    expect(result).toHaveProperty('raw')
    expect(result).toHaveProperty('hash')
    expect(result).toHaveProperty('prefix')
  })

  it('raw starts with "ethan_live_" and matches pattern ethan_live_[0-9a-f]{24}', () => {
    const { raw } = generateApiKey()
    expect(raw).toMatch(/^ethan_live_[0-9a-f]{24}$/)
  })

  it('raw has 35 total characters (11 prefix + 24 hex)', () => {
    const { raw } = generateApiKey()
    expect(raw.length).toBe(35)
  })

  it('prefix is 8 chars and equals raw.slice(11, 19)', () => {
    const { raw, prefix } = generateApiKey()
    expect(prefix.length).toBe(8)
    expect(prefix).toBe(raw.slice(11, 19))
  })

  it('hash is 64 hex chars and equals SHA-256 of raw', () => {
    const { raw, hash } = generateApiKey()
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    const expected = crypto.createHash('sha256').update(raw).digest('hex')
    expect(hash).toBe(expected)
  })

  it('two calls produce different raw values (randomness)', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.raw).not.toBe(b.raw)
  })
})

// ---------------------------------------------------------------------------
// Helpers for route tests
// ---------------------------------------------------------------------------
function makeParams(botId = 'bot-456') {
  return { params: Promise.resolve({ botId }) }
}

function makeRequest(method: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/keys/bot-456`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// POST /api/keys/[botId] — generate key
// ---------------------------------------------------------------------------
describe('POST /api/keys/[botId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: revoke returns success, insert returns a row
    mockPostRevokeMatcher.mockResolvedValue({ error: null })
    mockPostInsertSingle.mockResolvedValue({
      data: {
        id: 'key-uuid-1',
        label: 'n8n-prod',
        key_prefix: 'abcd1234',
        created_at: '2026-03-21T00:00:00Z',
      },
      error: null,
    })
  })

  it('returns key, id, label, key_prefix, created_at on success', async () => {
    const req = makeRequest('POST', { label: 'n8n-prod' })
    const res = await POST(req, makeParams())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('key')
    expect(body.key).toMatch(/^ethan_live_[0-9a-f]{24}$/)
    expect(body).toHaveProperty('id', 'key-uuid-1')
    expect(body).toHaveProperty('label', 'n8n-prod')
    expect(body).toHaveProperty('key_prefix', 'abcd1234')
    expect(body).toHaveProperty('created_at')
  })

  it('returns 400 when label is missing', async () => {
    const req = makeRequest('POST', {})
    const res = await POST(req, makeParams())

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/label/i)
  })

  it('returns 400 when label is empty string', async () => {
    const req = makeRequest('POST', { label: '' })
    const res = await POST(req, makeParams())

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/label/i)
  })

  it('calls revoke before insert (label de-duplication)', async () => {
    const req = makeRequest('POST', { label: 'n8n-prod' })
    await POST(req, makeParams())

    // mockPostRevokeMatcher was called (revoke existing key with same label)
    expect(mockPostRevokeMatcher).toHaveBeenCalled()
    // mockPostInsertSingle was called (insert new key)
    expect(mockPostInsertSingle).toHaveBeenCalled()
  })

  it('returns 500 when insert fails', async () => {
    mockPostInsertSingle.mockResolvedValue({
      data: null,
      error: { message: 'DB constraint violation' },
    })

    const req = makeRequest('POST', { label: 'n8n-prod' })
    const res = await POST(req, makeParams())

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('DB constraint violation')
  })
})

// ---------------------------------------------------------------------------
// GET /api/keys/[botId] — list active keys
// ---------------------------------------------------------------------------
describe('GET /api/keys/[botId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSelect.mockResolvedValue({
      data: [
        {
          id: 'key-uuid-1',
          label: 'n8n-prod',
          key_prefix: 'abcd1234',
          last_used_at: null,
          created_at: '2026-03-21T00:00:00Z',
        },
      ],
      error: null,
    })
  })

  it('returns { keys: [...] } with id, label, key_prefix, last_used_at, created_at', async () => {
    const req = new Request('http://localhost/api/keys/bot-456', { method: 'GET' })
    const res = await GET(req, makeParams())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('keys')
    expect(Array.isArray(body.keys)).toBe(true)
    expect(body.keys[0]).toHaveProperty('id')
    expect(body.keys[0]).toHaveProperty('label')
    expect(body.keys[0]).toHaveProperty('key_prefix')
    expect(body.keys[0]).toHaveProperty('last_used_at')
    expect(body.keys[0]).toHaveProperty('created_at')
  })

  it('does NOT return key_hash in response', async () => {
    const req = new Request('http://localhost/api/keys/bot-456', { method: 'GET' })
    const res = await GET(req, makeParams())

    const body = await res.json()
    for (const key of body.keys) {
      expect(key).not.toHaveProperty('key_hash')
    }
  })

  it('returns empty array when no active keys', async () => {
    mockGetSelect.mockResolvedValue({ data: [], error: null })

    const req = new Request('http://localhost/api/keys/bot-456', { method: 'GET' })
    const res = await GET(req, makeParams())

    const body = await res.json()
    expect(body.keys).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/keys/[botId] — revoke key
// ---------------------------------------------------------------------------
describe('DELETE /api/keys/[botId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPostRevokeMatcher.mockResolvedValue({ error: null })
  })

  it('returns { success: true } on successful revocation', async () => {
    const req = makeRequest('DELETE', { keyId: 'key-uuid-1' })
    const res = await DELETE(req, makeParams())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('returns 400 when keyId is missing', async () => {
    const req = makeRequest('DELETE', {})
    const res = await DELETE(req, makeParams())

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/keyId/i)
  })

  it('calls update (soft delete) not hard delete', async () => {
    const req = makeRequest('DELETE', { keyId: 'key-uuid-1' })
    await DELETE(req, makeParams())

    // revoke mock was called (update with revoked_at)
    expect(mockPostRevokeMatcher).toHaveBeenCalled()
  })
})
