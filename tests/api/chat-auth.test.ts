import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// Use vi.hoisted so mocks are available in vi.mock factory closures
const {
  mockSupabaseSelect,
  mockAnthropicCreate,
  mockDetect,
  mockRetrieve,
  mockBuildSystemPrompt,
  mockLogMessage,
  mockGetOrCreateConversation,
} = vi.hoisted(() => {
  const mockSupabaseSelect = vi.fn()
  return {
    mockSupabaseSelect,
    mockAnthropicCreate: vi.fn(),
    mockDetect: vi.fn(),
    mockRetrieve: vi.fn(),
    mockBuildSystemPrompt: vi.fn(),
    mockLogMessage: vi.fn(),
    mockGetOrCreateConversation: vi.fn(),
  }
})

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSupabaseSelect,
        }),
      }),
    }),
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
  })

  it('returns 401 with missing X-API-Key when bot has api_key_hash set', async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: { id: 'bot-123', api_key_hash: VALID_API_KEY_HASH },
      error: null,
    })

    // Request with no X-API-Key header
    const req = makeRequest({ message: 'hello', userId: 'user-1', channel: 'web' })
    const res = await POST(req, makeParams())

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Missing X-API-Key header')
  })

  it('returns 401 with wrong X-API-Key when bot has api_key_hash set', async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: { id: 'bot-123', api_key_hash: VALID_API_KEY_HASH },
      error: null,
    })

    // Request with wrong key
    const req = makeRequest(
      { message: 'hello', userId: 'user-1', channel: 'web' },
      { 'X-API-Key': 'wrong-key-totally-invalid' }
    )
    const res = await POST(req, makeParams())

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Invalid API key')
  })

  it('proceeds past validation (200) when correct X-API-Key is provided', async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: { id: 'bot-123', api_key_hash: VALID_API_KEY_HASH },
      error: null,
    })

    // Request with correct key (SHA-256 hash matches)
    const req = makeRequest(
      { message: 'hello', userId: 'user-1', channel: 'web' },
      { 'X-API-Key': VALID_API_KEY }
    )
    const res = await POST(req, makeParams())

    expect(res.status).toBe(200)
  })

  it('proceeds past validation when api_key_hash is null (dev mode) and emits console.warn', async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: { id: 'bot-123', api_key_hash: null },
      error: null,
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // No X-API-Key header needed in dev mode
    const req = makeRequest({ message: 'hello', userId: 'user-1', channel: 'web' })
    const res = await POST(req, makeParams())

    expect(res.status).toBe(200)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('DEV MODE')
    )

    warnSpy.mockRestore()
  })

  it('returns 404 when bot does not exist', async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: null,
      error: { message: 'Row not found', code: 'PGRST116' },
    })

    const req = makeRequest({ message: 'hello', userId: 'user-1', channel: 'web' })
    const res = await POST(req, makeParams('non-existent-bot'))

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Bot not found')
  })
})
