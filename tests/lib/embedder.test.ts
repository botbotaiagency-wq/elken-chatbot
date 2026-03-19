import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to ensure mockEmbed is available when vi.mock factory runs
const { mockEmbed } = vi.hoisted(() => {
  return { mockEmbed: vi.fn() }
})

vi.mock('voyageai', () => {
  return {
    VoyageAIClient: vi.fn(function (this: unknown) {
      return { embed: mockEmbed }
    }),
  }
})

import { embedDocumentChunks, embedQuery } from '@/lib/ingest/embedder'

describe('embedDocumentChunks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array for empty input', async () => {
    const result = await embedDocumentChunks([])
    expect(result).toEqual([])
    expect(mockEmbed).not.toHaveBeenCalled()
  })

  it('calls voyage.embed with correct model, inputType document, and outputDimension 1024', async () => {
    mockEmbed.mockResolvedValue({
      data: [
        { embedding: [0.1, 0.2, 0.3], index: 0 },
        { embedding: [0.4, 0.5, 0.6], index: 1 },
      ],
    })

    await embedDocumentChunks(['chunk one', 'chunk two'])

    expect(mockEmbed).toHaveBeenCalledWith({
      input: ['chunk one', 'chunk two'],
      model: 'voyage-3-large',
      inputType: 'document',
      outputDimension: 1024,
    })
  })

  it('returns array of embeddings matching input length', async () => {
    mockEmbed.mockResolvedValue({
      data: [
        { embedding: [0.1, 0.2], index: 0 },
        { embedding: [0.3, 0.4], index: 1 },
        { embedding: [0.5, 0.6], index: 2 },
      ],
    })

    const result = await embedDocumentChunks(['a', 'b', 'c'])
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual([0.1, 0.2])
    expect(result[1]).toEqual([0.3, 0.4])
    expect(result[2]).toEqual([0.5, 0.6])
  })
})

describe('embedQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls voyage.embed with inputType query and outputDimension 1024', async () => {
    mockEmbed.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
    })

    await embedQuery('what products help with joint pain?')

    expect(mockEmbed).toHaveBeenCalledWith({
      input: ['what products help with joint pain?'],
      model: 'voyage-3-large',
      inputType: 'query',
      outputDimension: 1024,
    })
  })

  it('returns single embedding array', async () => {
    mockEmbed.mockResolvedValue({
      data: [{ embedding: [0.7, 0.8, 0.9], index: 0 }],
    })

    const result = await embedQuery('test query')
    expect(result).toEqual([0.7, 0.8, 0.9])
  })
})
