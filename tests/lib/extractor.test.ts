import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to ensure mock functions are available when vi.mock factory runs
const { mockGetText, mockExtractRawText } = vi.hoisted(() => {
  return {
    mockGetText: vi.fn(),
    mockExtractRawText: vi.fn(),
  }
})

// Mock pdf-parse with class-based PDFParse API (pdf-parse v2)
vi.mock('pdf-parse', () => {
  return {
    PDFParse: vi.fn(function (this: unknown) {
      return { getText: mockGetText }
    }),
  }
})

// Mock mammoth
vi.mock('mammoth', () => {
  return {
    default: {
      extractRawText: mockExtractRawText,
    },
  }
})

import { extractPdf, extractDocx, extractTxt } from '@/lib/ingest/extractor'

describe('extractTxt', () => {
  it('returns string content from buffer', () => {
    const buf = Buffer.from('hello world')
    expect(extractTxt(buf)).toBe('hello world')
  })

  it('handles empty buffer', () => {
    const buf = Buffer.from('')
    expect(extractTxt(buf)).toBe('')
  })
})

describe('extractPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns extracted text for text-based PDF', async () => {
    const longText = 'This is a valid PDF document with plenty of text content for testing purposes. It has more than one hundred characters total.'
    mockGetText.mockResolvedValue({ text: longText })

    const buf = Buffer.from('fake-pdf')
    const result = await extractPdf(buf)
    expect(result).toBe(longText)
  })

  it('throws for scanned PDF with text under 100 characters', async () => {
    mockGetText.mockResolvedValue({ text: 'short text' })

    const buf = Buffer.from('fake-scanned-pdf')
    await expect(extractPdf(buf)).rejects.toThrow('Scanned PDFs are not supported')
  })

  it('throws for scanned PDF with empty text', async () => {
    mockGetText.mockResolvedValue({ text: '' })

    const buf = Buffer.from('fake-scanned-pdf')
    await expect(extractPdf(buf)).rejects.toThrow('Scanned PDFs are not supported')
  })
})

describe('extractDocx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns extracted text from DOCX buffer', async () => {
    mockExtractRawText.mockResolvedValue({
      value: 'Document content here',
      messages: [],
    })

    const buf = Buffer.from('fake-docx')
    const result = await extractDocx(buf)
    expect(result).toBe('Document content here')
  })
})
