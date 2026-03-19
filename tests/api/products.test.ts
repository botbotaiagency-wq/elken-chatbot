import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mocks are available in vi.mock factory closures
const { mockEmbed, mockFrom, mockInsert, mockSelect, mockEq, mockOrder, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockOrder = vi.fn()
  const mockEq = vi.fn(() => ({ order: mockOrder, single: mockSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq, single: mockSingle }))
  const mockInsert = vi.fn(() => ({ select: mockSelect }))
  const mockFrom = vi.fn(() => ({ select: mockSelect, insert: mockInsert }))
  const mockEmbed = vi.fn()
  return { mockEmbed, mockFrom, mockInsert, mockSelect, mockEq, mockOrder, mockSingle }
})

vi.mock('voyageai', () => ({
  VoyageAIClient: vi.fn(function (this: unknown) {
    return { embed: mockEmbed }
  }),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

// Import after mocks are set up
import { POST, GET } from '@/app/api/products/[botId]/route'
import { NextRequest } from 'next/server'

function makeParams(botId: string) {
  return { params: Promise.resolve({ botId }) }
}

function makeJsonRequest(body: unknown, method = 'POST'): NextRequest {
  return new NextRequest('http://localhost/api/products/bot123', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeCsvRequest(csvBody: string): NextRequest {
  return new NextRequest('http://localhost/api/products/bot123', {
    method: 'POST',
    headers: { 'content-type': 'text/csv' },
    body: csvBody,
  })
}

describe('POST /api/products/[botId] — single product', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when name is missing', async () => {
    const req = makeJsonRequest({ description: 'test product' })
    const res = await POST(req, makeParams('bot123'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/name is required/i)
  })

  it('returns 400 when name is empty string', async () => {
    const req = makeJsonRequest({ name: '   ' })
    const res = await POST(req, makeParams('bot123'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/name is required/i)
  })

  it('creates product with embedding when valid JSON body provided', async () => {
    mockEmbed.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
    })

    const createdProduct = {
      id: 'prod-uuid',
      bot_id: 'bot123',
      name: 'AloeVera Gel',
      description: 'Soothing gel',
      key_ingredients: null,
      health_benefits: null,
      pricing: null,
      suggested_usage: null,
      category: 'Beauty',
      created_at: '2026-03-19T00:00:00Z',
    }

    mockSingle.mockResolvedValue({ data: createdProduct, error: null })

    const req = makeJsonRequest({ name: 'AloeVera Gel', description: 'Soothing gel', category: 'Beauty' })
    const res = await POST(req, makeParams('bot123'))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('AloeVera Gel')
    // Embedding should be called once
    expect(mockEmbed).toHaveBeenCalledOnce()
  })

  it('defaults category to Other when invalid category provided', async () => {
    mockEmbed.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2], index: 0 }],
    })

    const createdProduct = {
      id: 'prod-uuid',
      bot_id: 'bot123',
      name: 'Test Product',
      category: 'Other',
      created_at: '2026-03-19T00:00:00Z',
    }
    mockSingle.mockResolvedValue({ data: createdProduct, error: null })

    const req = makeJsonRequest({ name: 'Test Product', category: 'InvalidCategory' })
    const res = await POST(req, makeParams('bot123'))
    expect(res.status).toBe(201)

    // The insert should have been called with category: 'Other'
    const insertCall = mockInsert.mock.calls[0][0]
    expect(insertCall.category).toBe('Other')
  })
})

describe('POST /api/products/[botId] — CSV bulk import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses valid CSV and returns correct import count', async () => {
    mockEmbed.mockResolvedValue({
      data: [
        { embedding: [0.1, 0.2], index: 0 },
        { embedding: [0.3, 0.4], index: 1 },
      ],
    })

    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: vi.fn(() => ({ error: null })),
    })

    const csv = `name,description,key_ingredients,health_benefits,pricing,suggested_usage,category
AloeVera Gel,Soothing gel,Aloe vera,Hydration,RM 25,Apply daily,Beauty
Omega-3 Capsules,Fish oil supplement,Omega-3,Heart health,RM 60,Take with meals,Healthfood`

    const req = makeCsvRequest(csv)
    const res = await POST(req, makeParams('bot123'))
    const body = await res.json()
    expect(body.imported).toBe(2)
    expect(body.errors).toHaveLength(0)
  })

  it('skips rows missing name and reports them in errors', async () => {
    mockEmbed.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2], index: 0 }],
    })

    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: vi.fn(() => ({ error: null })),
    })

    const csv = `name,description,category
,No name product,FMCG
Valid Product,Has name,FMCG`

    const req = makeCsvRequest(csv)
    const res = await POST(req, makeParams('bot123'))
    const body = await res.json()
    expect(body.imported).toBe(1)
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].message).toMatch(/name is required/i)
  })

  it('returns 400 when CSV is empty', async () => {
    const req = makeCsvRequest('')
    const res = await POST(req, makeParams('bot123'))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/products/[botId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns products without embedding field', async () => {
    const products = [
      {
        id: 'p1',
        bot_id: 'bot123',
        name: 'Product A',
        description: null,
        key_ingredients: null,
        health_benefits: null,
        pricing: null,
        suggested_usage: null,
        category: 'FMCG',
        created_at: '2026-03-19T00:00:00Z',
      },
    ]

    mockOrder.mockResolvedValue({ data: products, error: null })

    const req = new NextRequest('http://localhost/api/products/bot123', { method: 'GET' })
    const res = await GET(req, makeParams('bot123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0]).not.toHaveProperty('embedding')
    expect(body[0].name).toBe('Product A')
  })
})
