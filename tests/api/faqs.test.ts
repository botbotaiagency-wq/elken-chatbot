import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mock factories for Supabase service client
// ---------------------------------------------------------------------------
const { mockSelect, mockInsert, mockDelete, mockPatchUpdate } = vi.hoisted(() => {
  return {
    mockSelect: vi.fn(),
    mockInsert: vi.fn(),
    mockDelete: vi.fn(),
    mockPatchUpdate: vi.fn(),
  }
})

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => {
    const chain: Record<string, unknown> = {}
    chain.eq = vi.fn(() => chain)
    chain.order = vi.fn(async () => mockSelect())
    chain.select = vi.fn(() => chain)
    chain.insert = vi.fn(() => chain)
    chain.single = vi.fn(async () => mockInsert())
    chain.delete = vi.fn(() => chain)
    chain.update = vi.fn(() => chain)
    chain.from = vi.fn(() => chain)
    return { from: chain.from }
  },
}))

// ---------------------------------------------------------------------------
// GET /api/config/[botId]/faqs
// ---------------------------------------------------------------------------
describe('GET /api/config/[botId]/faqs', () => {
  it.todo('returns all FAQs for the bot')
  it.todo('filters by language query param when provided')
})

// ---------------------------------------------------------------------------
// POST /api/config/[botId]/faqs
// ---------------------------------------------------------------------------
describe('POST /api/config/[botId]/faqs', () => {
  it.todo('creates a new FAQ and returns 201')
  it.todo('validates language is en/bm/zh')
  it.todo('validates question and answer are non-empty')
})

// ---------------------------------------------------------------------------
// PATCH /api/config/[botId]/faqs
// ---------------------------------------------------------------------------
describe('PATCH /api/config/[botId]/faqs', () => {
  it.todo('updates an existing FAQ by faqId')
  it.todo('scopes update by bot_id for security')
})

// ---------------------------------------------------------------------------
// DELETE /api/config/[botId]/faqs
// ---------------------------------------------------------------------------
describe('DELETE /api/config/[botId]/faqs', () => {
  it.todo('deletes FAQ by faqId scoped to bot_id')
})
