import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mocks are available in vi.mock factory closures
const { mockFrom, mockInsert, mockSelect, mockEq, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockEq = vi.fn()
  // eq chains: second eq returns { single }
  mockEq.mockReturnValue({ eq: mockEq, single: mockSingle })
  const mockSelect = vi.fn(() => ({ eq: mockEq, single: mockSingle }))
  const mockInsert = vi.fn(() => ({ select: mockSelect }))
  const mockFrom = vi.fn(() => ({ select: mockSelect, insert: mockInsert }))
  return { mockFrom, mockInsert, mockSelect, mockEq, mockSingle }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

import { logMessage, getOrCreateConversation } from '@/lib/rag/logger'

describe('logMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset default chain after clearAllMocks
    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert })
  })

  it('inserts into messages table with all required fields and returns id', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'msg-uuid-1' }, error: null })

    const id = await logMessage({
      conversationId: 'conv-123',
      botId: 'bot-456',
      role: 'user',
      content: 'Hello there',
      intent: null,
      sourceChunks: null,
      ragFound: null,
      latencyMs: null,
    })

    expect(id).toBe('msg-uuid-1')
    expect(mockFrom).toHaveBeenCalledWith('messages')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: 'conv-123',
        bot_id: 'bot-456',
        role: 'user',
        content: 'Hello there',
        intent: null,
        source_chunks: null,
        rag_found: null,
        latency_ms: null,
      })
    )
  })

  it('includes source_chunks as JSONB array when provided', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'msg-uuid-2' }, error: null })

    const sourceChunks = [
      { chunk_id: 'chunk-1', similarity: 0.92 },
      { chunk_id: 'chunk-2', similarity: 0.85 },
    ]

    await logMessage({
      conversationId: 'conv-123',
      botId: 'bot-456',
      role: 'assistant',
      content: 'Here is the answer...',
      intent: 'faq',
      sourceChunks,
      ragFound: true,
      latencyMs: 1234,
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_chunks: sourceChunks,
        rag_found: true,
        latency_ms: 1234,
        intent: 'faq',
      })
    )
  })

  it('throws and logs error when Supabase insert fails', async () => {
    const supabaseError = { message: 'insert failed', code: '23503' }
    mockSingle.mockResolvedValue({ data: null, error: supabaseError })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      logMessage({
        conversationId: 'conv-123',
        botId: 'bot-456',
        role: 'user',
        content: 'test',
        intent: null,
        sourceChunks: null,
        ragFound: null,
        latencyMs: null,
      })
    ).rejects.toEqual(supabaseError)

    expect(consoleSpy).toHaveBeenCalledWith('Failed to log message:', supabaseError)
    consoleSpy.mockRestore()
  })
})

describe('getOrCreateConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert })
  })

  it('returns existing conversation id when conversationId is provided and valid', async () => {
    // First call: SELECT for existing conversation
    mockSingle.mockResolvedValueOnce({ data: { id: 'existing-conv-id' }, error: null })

    const id = await getOrCreateConversation('bot-123', 'user-456', 'whatsapp', 'existing-conv-id')

    expect(id).toBe('existing-conv-id')
    expect(mockFrom).toHaveBeenCalledWith('conversations')
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('creates new conversation when no conversationId is provided', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'new-conv-uuid' }, error: null })

    const id = await getOrCreateConversation('bot-123', 'user-789', 'web')

    expect(id).toBe('new-conv-uuid')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        bot_id: 'bot-123',
        user_id: 'user-789',
        channel: 'web',
      })
    )
  })

  it('creates new conversation when provided conversationId does not exist', async () => {
    // First call: SELECT returns no data (conversation not found)
    mockSingle.mockResolvedValueOnce({ data: null, error: null })
    // Second call: INSERT new conversation
    mockSingle.mockResolvedValueOnce({ data: { id: 'fresh-conv-id' }, error: null })

    const id = await getOrCreateConversation('bot-123', 'user-111', 'telegram', 'nonexistent-conv')

    expect(id).toBe('fresh-conv-id')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        bot_id: 'bot-123',
        user_id: 'user-111',
        channel: 'telegram',
      })
    )
  })

  it('throws when Supabase insert fails during conversation creation', async () => {
    const insertError = { message: 'insert error', code: '23503' }
    mockSingle.mockResolvedValue({ data: null, error: insertError })

    await expect(
      getOrCreateConversation('bot-123', 'user-999', 'whatsapp')
    ).rejects.toEqual(insertError)
  })
})
