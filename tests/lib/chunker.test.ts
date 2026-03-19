import { describe, it, expect } from 'vitest'
import { encode } from 'gpt-tokenizer'
import { chunkText } from '@/lib/ingest/chunker'

describe('chunkText', () => {
  it('returns empty array for empty string', () => {
    expect(chunkText('')).toEqual([])
  })

  it('returns empty array for whitespace-only string', () => {
    expect(chunkText('   ')).toEqual([])
  })

  it('returns single chunk for text shorter than chunkSize', () => {
    const text = 'hello world'
    const chunks = chunkText(text, 500, 50)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe(text)
  })

  it('returns multiple chunks for text longer than chunkSize', () => {
    // Generate a text that is clearly more than 500 tokens
    const word = 'the quick brown fox jumps over the lazy dog '
    const longText = word.repeat(30) // ~270 tokens per repetition of 9 words
    const chunks = chunkText(longText, 500, 50)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
  })

  it('each chunk except last has exactly chunkSize tokens', () => {
    const word = 'hello '
    const longText = word.repeat(600)
    const chunks = chunkText(longText, 500, 50)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    // All chunks except last should have exactly 500 tokens
    for (let i = 0; i < chunks.length - 1; i++) {
      const tokenCount = encode(chunks[i]).length
      expect(tokenCount).toBe(500)
    }
  })

  it('consecutive chunks overlap by the specified overlap tokens', () => {
    const word = 'hello '
    const longText = word.repeat(600)
    const chunks = chunkText(longText, 500, 50)
    expect(chunks.length).toBeGreaterThanOrEqual(2)

    // The last 50 tokens of chunk[0] should equal the first 50 tokens of chunk[1]
    const tokens0 = encode(chunks[0])
    const tokens1 = encode(chunks[1])
    const tailOf0 = tokens0.slice(-50)
    const headOf1 = tokens1.slice(0, 50)
    expect(tailOf0).toEqual(headOf1)
  })
})
