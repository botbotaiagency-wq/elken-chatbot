import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mock factories for Supabase service client
// ---------------------------------------------------------------------------
const { mockSelectSingle, mockUpdate } = vi.hoisted(() => {
  return {
    mockSelectSingle: vi.fn(),
    mockUpdate: vi.fn(),
  }
})

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => {
    const chain: Record<string, unknown> = {}
    chain.eq = vi.fn(() => chain)
    chain.single = vi.fn(async () => mockSelectSingle())
    chain.select = vi.fn(() => chain)
    chain.update = vi.fn(async () => mockUpdate())
    chain.from = vi.fn(() => chain)
    return { from: chain.from }
  },
}))

// ---------------------------------------------------------------------------
// GET /api/config/[botId]/personality
// ---------------------------------------------------------------------------
describe('GET /api/config/[botId]/personality', () => {
  it.todo('returns personality fields for a valid botId')
  it.todo('returns 404 when bot does not exist')
})

// ---------------------------------------------------------------------------
// PATCH /api/config/[botId]/personality
// ---------------------------------------------------------------------------
describe('PATCH /api/config/[botId]/personality', () => {
  it.todo('updates personality fields and returns ok')
  it.todo('validates tone is one of Professional/Friendly/Formal')
  it.todo('saves fallback_message (CONF-02)')
})

// ---------------------------------------------------------------------------
// GET /api/config/[botId]/guardrails
// ---------------------------------------------------------------------------
describe('GET /api/config/[botId]/guardrails', () => {
  it.todo('returns guardrails fields for a valid botId')
})

// ---------------------------------------------------------------------------
// PATCH /api/config/[botId]/guardrails
// ---------------------------------------------------------------------------
describe('PATCH /api/config/[botId]/guardrails', () => {
  it.todo('updates guardrails fields and returns ok')
  it.todo('validates max_response_length is a positive integer')
})
