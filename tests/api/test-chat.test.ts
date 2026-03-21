import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mock factories for Supabase service client
// ---------------------------------------------------------------------------
const { mockBotSelect, mockConversation, mockLogMessage } = vi.hoisted(() => {
  return {
    mockBotSelect: vi.fn(),
    mockConversation: vi.fn(),
    mockLogMessage: vi.fn(),
  }
})

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => {
    const chain: Record<string, unknown> = {}
    chain.eq = vi.fn(() => chain)
    chain.single = vi.fn(async () => mockBotSelect())
    chain.select = vi.fn(() => chain)
    chain.from = vi.fn(() => chain)
    chain.in = vi.fn(() => chain)
    chain.order = vi.fn(() => chain)
    chain.limit = vi.fn(() => chain)
    return { from: chain.from }
  },
}))

vi.mock('@/lib/rag/detect', () => ({
  detectIntentAndLanguage: vi.fn(async () => ({ intent: 'general', language: 'en' })),
}))

vi.mock('@/lib/rag/retrieve', () => ({
  retrieveContext: vi.fn(async () => ({ chunks: [], found: false })),
}))

vi.mock('@/lib/rag/prompt', () => ({
  buildSystemPrompt: vi.fn(() => 'mock system prompt'),
}))

vi.mock('@/lib/rag/logger', () => ({
  getOrCreateConversation: vi.fn(async () => 'mock-conv-id'),
  logMessage: vi.fn(async () => {}),
}))

// ---------------------------------------------------------------------------
// POST /api/config/[botId]/test-chat
// ---------------------------------------------------------------------------
describe('POST /api/config/[botId]/test-chat', () => {
  it.todo('accepts a message and returns a streamed response (TEST-01)')
  it.todo('does NOT require API key authentication')
  it.todo('returns X-Intent header (TEST-02)')
  it.todo('returns X-Rag-Found header (TEST-02)')
  it.todo('returns X-Conversation-Id header')
  it.todo('honors language_override in request body (TEST-03)')
  it.todo('generates new conversationId when none provided (TEST-04)')
})

// ---------------------------------------------------------------------------
// GET /api/config/[botId]/debug
// ---------------------------------------------------------------------------
describe('GET /api/config/[botId]/debug', () => {
  it.todo('returns debug metadata for the last assistant message')
  it.todo('returns 400 when conversationId is missing')
  it.todo('returns 404 when conversation does not belong to bot')
  it.todo('resolves source chunks with content preview and document name')
})
