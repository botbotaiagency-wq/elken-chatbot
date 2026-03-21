import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// Use vi.hoisted so mocks are available in vi.mock factory closures
const {
  mockBotsSelect,
  mockApiKeysSelect,
  mockApiKeysUpdate,
  mockAnthropicCreate,
  mockDetect,
  mockRetrieve,
  mockBuildSystemPrompt,
  mockLogMessage,
  mockGetOrCreateConversation,
} = vi.hoisted(() => {
  // mockApiKeysUpdate is the .update() function — receives { last_used_at } payload
  const mockApiKeysUpdate = vi.fn(() => ({ eq: vi.fn().mockReturnThis() }))
  return {
    mockBotsSelect: vi.fn(),
    mockApiKeysSelect: vi.fn(),
    mockApiKeysUpdate,
    mockAnthropicCreate: vi.fn(),
    mockDetect: vi.fn(),
    mockRetrieve: vi.fn(),
    mockBuildSystemPrompt: vi.fn(),
    mockLogMessage: vi.fn(),
    mockGetOrCreateConversation: vi.fn(),
  }
})

// Table-aware mock: routes .from('bots') vs .from('api_keys') to separate mocks
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'bots') {
        return {
          select: () => ({
            eq: () => ({
              single: mockBotsSelect,
            }),
          }),
        }
      }
      if (table === 'api_keys') {
        return {
          // lookup chain: .select().eq().eq().is().maybeSingle()
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
                  maybeSingle: mockApiKeysSelect,
                }),
              }),
            }),
          }),
          // fire-and-forget update: .update(payload).eq(...)
          // mockApiKeysUpdate IS the update function, receives { last_used_at }
          update: mockApiKeysUpdate,
        }
      }
      return {
        select: () => ({
          eq: () => ({
            single: vi.fn(),
          }),
        }),
      }
    },
  }),
}))

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn(function (this: unknown) {
      return {
        messages: { create: mockAnthropicCreate },
      }
    }),
  }
})

vi.mock('@/lib/rag/detect', () => ({
  detectIntentAndLanguage: mockDetect,
}))

vi.mock('@/lib/rag/retrieve', () => ({
  retrieveContext: mockRetrieve,
}))

vi.mock('@/lib/rag/prompt', () => ({
  buildSystemPrompt: mockBuildSystemPrompt,
}))

vi.mock('@/lib/rag/logger', () => ({
  logMessage: mockLogMessage,
  getOrCreateConversation: mockGetOrCreateConversation,
}))

import { POST } from '@/app/api/chat/[botId]/route'

// Helper: create an async generator for simulating Anthropic stream events
async function* makeStreamEvents(textChunks: string[]) {
  for (const text of textChunks) {
    yield {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text },
    }
  }
}

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/chat/bot-123', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function makeParams(botId = 'bot-123') {
  return { params: Promise.resolve({ botId }) }
}

const VALID_API_KEY = 'test-api-key-abc123'
const VALID_API_KEY_HASH = crypto.createHash('sha256').update(VALID_API_KEY).digest('hex')

describe('POST /api/chat/[botId] — API key validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default downstream mocks for happy-path tests
    mockGetOrCreateConversation.mockResolvedValue('conv-uuid-1')
    mockLogMessage.mockResolvedValue('msg-uuid-1')
    mockDetect.mockResolvedValue({ language: 'en', intent: 'general' })
    mockRetrieve.mockResolvedValue({
      faqs: [],
      chunks: [],
      products: [],
      ragFound: false,
    })
    mockBuildSystemPrompt.mockReturnValue('You are a helpful assistant.')
    mockAnthropicCreate.mockResolvedValue(makeStreamEvents(['Hello!']))

    // Default: no api_keys rows found
    mockApiKeysSelect.mockResolvedValue({ data: null, error: null })

    // Default: update returns chained eq mock
    mockApiKeysUpdate.mockReturnValue({ eq: vi.fn().mockReturnThis() })
  })

  // -------------------------------------------------------------------------
  // Existing tests — regression suite
  // -------------------------------------------------------------------------

  it('returns 401 with missing X-API-Key when bot has api_key_hash set', async () => {
    mockBotsSelect.mockResolvedValue({
      data: { id: 'bot-123', api_key_hash: VALID_API_KEY_HASH },
      error: null,
    })

    const req = makeRequest({ message: 'hello', userId: 'user-1', channel: 'web' })
    const res = await POST(req, makeParams())

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Missing X-API-Key header')
  })

  it('returns 401 with wrong X-API-Key when bot has api_key_hash set', async () => {
    mockBotsSelect.mockResolvedValue({
      data: { id: 'bot-123', api_key_hash: VALID_API_KEY_HASH },
      error: null,
    })
    mockApiKeysSelect.mockResolvedValue({ data: null, error: null })

    const req = makeRequest(
      { message: 'hello', userId: 'user-1', channel: 'web' },
      { 'X-API-Key': 'wrong-key-totally-invalid' }
    )
    const res = await POST(req, makeParams())

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Invalid API key')
  })

  it('proceeds past validation (200) when correct X-API-Key is provided (bots.api_key_hash fallback)', async () => {
    mockBotsSelect.mockResolvedValue({
      data: { id: 'bot-123', api_key_hash: VALID_API_KEY_HASH },
      error: null,
    })
    // api_keys table returns no match — falls back to bots.api_key_hash
    mockApiKeysSelect.mockResolvedValue({ data: null, error: null })

    const req = makeRequest(
      { message: 'hello', userId: 'user-1', channel: 'web' },
      { 'X-API-Key': VALID_API_KEY }
    )
    const res = await POST(req, makeParams())

    expect(res.status).toBe(200)
  })

  it('proceeds past validation when api_key_hash is null (dev mode) and emits console.warn', async () => {
    mockBotsSelect.mockResolvedValue({
      data: { id: 'bot-123', api_key_hash: null },
      error: null,
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const req = makeRequest({ message: 'hello', userId: 'user-1', channel: 'web' })
    const res = await POST(req, makeParams())

    expect(res.status).toBe(200)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('DEV MODE')
    )

    warnSpy.mockRestore()
  })

  it('returns 404 when bot does not exist', async () => {
    mockBotsSelect.mockResolvedValue({
      data: null,
      error: { message: 'Row not found', code: 'PGRST116' },
    })

    const req = makeRequest({ message: 'hello', userId: 'user-1', channel: 'web' })
    const res = await POST(req, makeParams('non-existent-bot'))

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Bot not found')
  })

  // -------------------------------------------------------------------------
  // New tests — api_keys table validation path
  // -------------------------------------------------------------------------

  it('returns 200 when valid key matches api_keys table row', async () => {
    mockBotsSelect.mockResolvedValue({
      data: { id: 'bot-123', api_key_hash: null },
      error: null,
    })
    mockApiKeysSelect.mockResolvedValue({
      data: { id: 'key-uuid-1', key_hash: VALID_API_KEY_HASH },
      error: null,
    })

    const req = makeRequest(
      { message: 'hello', userId: 'user-1', channel: 'web' },
      { 'X-API-Key': VALID_API_KEY }
    )
    const res = await POST(req, makeParams())

    expect(res.status).toBe(200)
  })

  it('returns 401 when key does not match any api_keys row and bots.api_key_hash is also different', async () => {
    mockBotsSelect.mockResolvedValue({
      data: { id: 'bot-123', api_key_hash: VALID_API_KEY_HASH },
      error: null,
    })
    mockApiKeysSelect.mockResolvedValue({ data: null, error: null })

    const req = makeRequest(
      { message: 'hello', userId: 'user-1', channel: 'web' },
      { 'X-API-Key': 'completely-wrong-key-xyz' }
    )
    const res = await POST(req, makeParams())

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Invalid API key')
  })

  it('returns 200 via fallback when no api_keys rows exist but bots.api_key_hash matches', async () => {
    mockBotsSelect.mockResolvedValue({
      data: { id: 'bot-123', api_key_hash: VALID_API_KEY_HASH },
      error: null,
    })
    mockApiKeysSelect.mockResolvedValue({ data: null, error: null })

    const req = makeRequest(
      { message: 'hello', userId: 'user-1', channel: 'web' },
      { 'X-API-Key': VALID_API_KEY }
    )
    const res = await POST(req, makeParams())

    expect(res.status).toBe(200)
  })

  it('fire-and-forget: last_used_at update is called when api_keys row matches', async () => {
    mockBotsSelect.mockResolvedValue({
      data: { id: 'bot-123', api_key_hash: null },
      error: null,
    })
    mockApiKeysSelect.mockResolvedValue({
      data: { id: 'key-uuid-1', key_hash: VALID_API_KEY_HASH },
      error: null,
    })

    const req = makeRequest(
      { message: 'hello', userId: 'user-1', channel: 'web' },
      { 'X-API-Key': VALID_API_KEY }
    )
    await POST(req, makeParams())

    // mockApiKeysUpdate is the .update() function — must be called with { last_used_at }
    expect(mockApiKeysUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ last_used_at: expect.any(String) })
    )
  })
})
