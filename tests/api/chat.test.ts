import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mocks are available in vi.mock factory closures
const {
  mockAnthropicCreate,
  mockDetect,
  mockRetrieve,
  mockBuildSystemPrompt,
  mockLogMessage,
  mockGetOrCreateConversation,
  mockSupabaseSelect,
} = vi.hoisted(() => {
  const mockSupabaseSelect = vi.fn()
  return {
    mockAnthropicCreate: vi.fn(),
    mockDetect: vi.fn(),
    mockRetrieve: vi.fn(),
    mockBuildSystemPrompt: vi.fn(),
    mockLogMessage: vi.fn(),
    mockGetOrCreateConversation: vi.fn(),
    mockSupabaseSelect,
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

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat/bot-123', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(botId = 'bot-123') {
  return { params: Promise.resolve({ botId }) }
}

describe('POST /api/chat/[botId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: bot exists with no api_key_hash (dev mode — all requests allowed through)
    mockSupabaseSelect.mockResolvedValue({ data: { id: 'bot-123', api_key_hash: null }, error: null })

    // Default happy-path mocks
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
    mockAnthropicCreate.mockResolvedValue(makeStreamEvents(['Hello ', 'there!']))
  })

  it('returns 400 when message is missing', async () => {
    const req = makeRequest({ userId: 'user-1', channel: 'whatsapp' })
    const res = await POST(req, makeParams())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/message/i)
  })

  it('returns 400 when userId is missing', async () => {
    const req = makeRequest({ message: 'hello', channel: 'web' })
    const res = await POST(req, makeParams())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/userId/i)
  })

  it('returns 400 when channel is missing', async () => {
    const req = makeRequest({ message: 'hello', userId: 'user-1' })
    const res = await POST(req, makeParams())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/channel/i)
  })

  it('returns 400 when channel is invalid', async () => {
    const req = makeRequest({ message: 'hello', userId: 'user-1', channel: 'sms' })
    const res = await POST(req, makeParams())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/channel/i)
  })

  it('returns 200 streaming response for valid request', async () => {
    const req = makeRequest({ message: 'hello', userId: 'user-1', channel: 'web' })
    const res = await POST(req, makeParams())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
  })

  it('response headers include X-Conversation-Id', async () => {
    const req = makeRequest({ message: 'hello', userId: 'user-1', channel: 'web' })
    const res = await POST(req, makeParams())
    expect(res.headers.get('X-Conversation-Id')).toBe('conv-uuid-1')
  })

  it('response headers include X-Intent', async () => {
    mockDetect.mockResolvedValue({ language: 'en', intent: 'browse_product' })
    const req = makeRequest({ message: 'show me products', userId: 'user-1', channel: 'web' })
    const res = await POST(req, makeParams())
    expect(res.headers.get('X-Intent')).toBe('browse_product')
  })

  it('response headers include X-Language', async () => {
    mockDetect.mockResolvedValue({ language: 'bm', intent: 'general' })
    const req = makeRequest({ message: 'helo', userId: 'user-1', channel: 'whatsapp' })
    const res = await POST(req, makeParams())
    expect(res.headers.get('X-Language')).toBe('bm')
  })

  it('response headers include X-Rag-Found', async () => {
    mockRetrieve.mockResolvedValue({
      faqs: [{ id: 'faq-1', question: 'Q', answer: 'A', language: 'en', similarity: 0.9 }],
      chunks: [],
      products: [],
      ragFound: true,
    })
    const req = makeRequest({ message: 'what are your hours', userId: 'user-1', channel: 'web' })
    const res = await POST(req, makeParams())
    expect(res.headers.get('X-Rag-Found')).toBe('true')
  })

  it('calls detectIntentAndLanguage with user message', async () => {
    const req = makeRequest({ message: 'I want to buy omega-3', userId: 'user-1', channel: 'web' })
    await POST(req, makeParams())
    expect(mockDetect).toHaveBeenCalledWith('I want to buy omega-3')
  })

  it('calls retrieveContext with message, botId, and intent', async () => {
    mockDetect.mockResolvedValue({ language: 'en', intent: 'browse_product' })
    const req = makeRequest({ message: 'find products', userId: 'user-1', channel: 'web' })
    await POST(req, makeParams('bot-abc'))
    expect(mockRetrieve).toHaveBeenCalledWith('find products', 'bot-abc', 'browse_product')
  })

  it('calls Anthropic messages.create with stream: true', async () => {
    const req = makeRequest({ message: 'hello', userId: 'user-1', channel: 'web' })
    await POST(req, makeParams())
    expect(mockAnthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true })
    )
  })

  it('calls getOrCreateConversation with botId, userId, channel', async () => {
    const req = makeRequest({ message: 'hello', userId: 'user-xyz', channel: 'telegram' })
    await POST(req, makeParams('bot-789'))
    expect(mockGetOrCreateConversation).toHaveBeenCalledWith(
      'bot-789', 'user-xyz', 'telegram', undefined
    )
  })

  it('passes conversationId to getOrCreateConversation when provided', async () => {
    const req = makeRequest({ message: 'hello', userId: 'user-1', channel: 'web', conversationId: 'existing-conv' })
    await POST(req, makeParams())
    expect(mockGetOrCreateConversation).toHaveBeenCalledWith(
      'bot-123', 'user-1', 'web', 'existing-conv'
    )
  })
})
