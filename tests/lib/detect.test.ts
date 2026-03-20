import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to ensure mockCreate is available when vi.mock factory runs
const { mockCreate } = vi.hoisted(() => {
  return { mockCreate: vi.fn() }
})

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn(function (this: unknown) {
      return {
        messages: { create: mockCreate },
      }
    }),
  }
})

import { detectIntentAndLanguage } from '@/lib/rag/detect'

describe('detectIntentAndLanguage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { language: "en", intent: "browse_product" } for English product query', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"language":"en","intent":"browse_product"}' }],
    })

    const result = await detectIntentAndLanguage('I want to buy a product')
    expect(result).toEqual({ language: 'en', intent: 'browse_product' })
  })

  it('returns { language: "bm", intent: "health_issue" } for Malay health query', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"language":"bm","intent":"health_issue"}' }],
    })

    const result = await detectIntentAndLanguage('Saya ada sakit belakang')
    expect(result).toEqual({ language: 'bm', intent: 'health_issue' })
  })

  it('calls anthropic.messages.create with model "claude-haiku-4-5-20251001"', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"language":"en","intent":"general"}' }],
    })

    await detectIntentAndLanguage('hello')

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5-20251001',
      })
    )
  })

  it('returns default { language: "en", intent: "general" } when Claude returns invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not valid json at all' }],
    })

    const result = await detectIntentAndLanguage('some message')
    expect(result).toEqual({ language: 'en', intent: 'general' })
  })

  it('handles whitespace around JSON response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '  {"language":"zh","intent":"faq"}  ' }],
    })

    const result = await detectIntentAndLanguage('什么时候开门？')
    expect(result).toEqual({ language: 'zh', intent: 'faq' })
  })

  it('normalizes invalid language to "en"', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"language":"fr","intent":"browse_product"}' }],
    })

    const result = await detectIntentAndLanguage('some message')
    expect(result.language).toBe('en')
  })

  it('normalizes invalid intent to "general"', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"language":"en","intent":"unknown_intent"}' }],
    })

    const result = await detectIntentAndLanguage('some message')
    expect(result.intent).toBe('general')
  })
})
