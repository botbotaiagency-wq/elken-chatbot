import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mock factories for Supabase service client
// ---------------------------------------------------------------------------
const { mockSelect, mockUpsert } = vi.hoisted(() => {
  return {
    mockSelect: vi.fn(),
    mockUpsert: vi.fn(),
  }
})

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => {
    const chain: Record<string, unknown> = {}
    chain.eq = vi.fn(() => chain)
    chain.order = vi.fn(async () => mockSelect())
    chain.select = vi.fn(() => chain)
    chain.upsert = vi.fn(async () => mockUpsert())
    chain.from = vi.fn(() => chain)
    return { from: chain.from }
  },
}))

// ---------------------------------------------------------------------------
// GET /api/config/[botId]/templates
// ---------------------------------------------------------------------------
describe('GET /api/config/[botId]/templates', () => {
  it.todo('returns all templates for the bot')
  it.todo('filters by language query param when provided')
})

// ---------------------------------------------------------------------------
// PATCH /api/config/[botId]/templates
// ---------------------------------------------------------------------------
describe('PATCH /api/config/[botId]/templates', () => {
  it.todo('upserts template with onConflict bot_id,intent_key,language')
  it.todo('validates intent_key is one of the 5 known intents')
  it.todo('validates language is en/bm/zh')
})
