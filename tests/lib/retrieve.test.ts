import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mocks are available in vi.mock factory closures
const { mockRpc, mockEmbedQuery } = vi.hoisted(() => {
  return {
    mockRpc: vi.fn(),
    mockEmbedQuery: vi.fn(),
  }
})

vi.mock('@/lib/supabase/service', () => {
  return {
    createServiceClient: vi.fn(() => ({
      rpc: mockRpc,
    })),
  }
})

vi.mock('@/lib/ingest/embedder', () => {
  return {
    embedQuery: mockEmbedQuery,
  }
})

import { retrieveContext } from '@/lib/rag/retrieve'

describe('retrieveContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: embedQuery returns a mock embedding
    mockEmbedQuery.mockResolvedValue([0.1, 0.2, 0.3])
  })

  it('returns empty arrays and ragFound: false when no matches', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    const result = await retrieveContext('test query', 'bot-123', 'general')

    expect(result).toEqual({
      faqs: [],
      chunks: [],
      products: [],
      ragFound: false,
    })
  })

  it('returns faqs array with question/answer when FAQ match above 0.75', async () => {
    const faqMatch = {
      id: 'faq-1',
      question: 'What are your operating hours?',
      answer: 'We are open 9am-6pm Monday to Friday.',
      language: 'en',
      similarity: 0.92,
    }

    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'match_faqs') return Promise.resolve({ data: [faqMatch], error: null })
      return Promise.resolve({ data: [], error: null })
    })

    const result = await retrieveContext('what time do you open?', 'bot-123', 'faq')

    expect(result.faqs).toHaveLength(1)
    expect(result.faqs[0].question).toBe('What are your operating hours?')
    expect(result.faqs[0].answer).toBe('We are open 9am-6pm Monday to Friday.')
    expect(result.ragFound).toBe(true)
  })

  it('returns chunks array with content/similarity when chunk match found', async () => {
    const chunkMatch = {
      id: 'chunk-1',
      content: 'GenQi is a health supplement brand.',
      document_id: 'doc-1',
      similarity: 0.88,
    }

    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'match_chunks') return Promise.resolve({ data: [chunkMatch], error: null })
      return Promise.resolve({ data: [], error: null })
    })

    const result = await retrieveContext('tell me about GenQi', 'bot-123', 'general')

    expect(result.chunks).toHaveLength(1)
    expect(result.chunks[0].content).toBe('GenQi is a health supplement brand.')
    expect(result.chunks[0].similarity).toBe(0.88)
    expect(result.ragFound).toBe(true)
  })

  it('returns full product fields when product match found for browse_product intent', async () => {
    const productMatch = {
      id: 'prod-1',
      name: 'GenQi Omega-3',
      description: 'Premium fish oil supplement',
      key_ingredients: 'EPA, DHA',
      health_benefits: 'Heart health, brain function',
      pricing: 'RM 89.90',
      suggested_usage: '2 capsules daily with meals',
      category: 'Healthfood',
      similarity: 0.85,
    }

    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'match_products') return Promise.resolve({ data: [productMatch], error: null })
      return Promise.resolve({ data: [], error: null })
    })

    const result = await retrieveContext('I want to buy omega 3', 'bot-123', 'browse_product')

    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('GenQi Omega-3')
    expect(result.products[0].key_ingredients).toBe('EPA, DHA')
    expect(result.products[0].health_benefits).toBe('Heart health, brain function')
    expect(result.products[0].pricing).toBe('RM 89.90')
    expect(result.products[0].suggested_usage).toBe('2 capsules daily with meals')
    expect(result.ragFound).toBe(true)
  })

  it('returns products for health_issue intent', async () => {
    const productMatch = {
      id: 'prod-2',
      name: 'Joint Care Plus',
      description: 'Joint support formula',
      key_ingredients: 'Glucosamine, Chondroitin',
      health_benefits: 'Reduces joint pain',
      pricing: 'RM 120.00',
      suggested_usage: '1 tablet daily',
      category: 'Healthfood',
      similarity: 0.80,
    }

    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'match_products') return Promise.resolve({ data: [productMatch], error: null })
      return Promise.resolve({ data: [], error: null })
    })

    const result = await retrieveContext('I have joint pain', 'bot-123', 'health_issue')

    expect(result.products).toHaveLength(1)
    expect(result.ragFound).toBe(true)
  })

  it('does NOT call match_products for general intent', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    await retrieveContext('hello', 'bot-123', 'general')

    const rpcCalls = mockRpc.mock.calls.map((call: unknown[]) => call[0])
    expect(rpcCalls).not.toContain('match_products')
  })

  it('does NOT call match_products for faq intent', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    await retrieveContext('what are your hours', 'bot-123', 'faq')

    const rpcCalls = mockRpc.mock.calls.map((call: unknown[]) => call[0])
    expect(rpcCalls).not.toContain('match_products')
  })

  it('ragFound is false when all results are empty arrays', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    const result = await retrieveContext('test', 'bot-123', 'browse_product')

    expect(result.ragFound).toBe(false)
    expect(result.faqs).toEqual([])
    expect(result.chunks).toEqual([])
    expect(result.products).toEqual([])
  })

  it('calls match_faqs first with correct parameters', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    await retrieveContext('test query', 'bot-abc', 'faq')

    expect(mockRpc).toHaveBeenCalledWith('match_faqs', expect.objectContaining({
      match_threshold: 0.75,
      p_bot_id: 'bot-abc',
    }))
  })

  it('calls match_chunks with correct bot_id', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    await retrieveContext('test query', 'bot-xyz', 'general')

    expect(mockRpc).toHaveBeenCalledWith('match_chunks', expect.objectContaining({
      match_threshold: 0.75,
      p_bot_id: 'bot-xyz',
    }))
  })
})
