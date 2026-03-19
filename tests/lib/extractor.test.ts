import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractPdf, extractDocx, extractTxt } from '@/lib/ingest/extractor'

// Mock pdf-parse
vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}))

// Mock mammoth
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn(),
  },
}))

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
    vi.resetAllMocks()
  })

  it('returns extracted text for text-based PDF', async () => {
    const pdfParse = (await import('pdf-parse')).default as ReturnType<typeof vi.fn>
    pdfParse.mockResolvedValue({ text: 'This is a valid PDF document with plenty of text content for testing purposes and extraction.' })

    const buf = Buffer.from('fake-pdf')
    const result = await extractPdf(buf)
    expect(result).toBe('This is a valid PDF document with plenty of text content for testing purposes and extraction.')
  })

  it('throws for scanned PDF with text under 100 characters', async () => {
    const pdfParse = (await import('pdf-parse')).default as ReturnType<typeof vi.fn>
    pdfParse.mockResolvedValue({ text: 'short text' })

    const buf = Buffer.from('fake-scanned-pdf')
    await expect(extractPdf(buf)).rejects.toThrow('Scanned PDFs are not supported')
  })

  it('throws for scanned PDF with empty text', async () => {
    const pdfParse = (await import('pdf-parse')).default as ReturnType<typeof vi.fn>
    pdfParse.mockResolvedValue({ text: '' })

    const buf = Buffer.from('fake-scanned-pdf')
    await expect(extractPdf(buf)).rejects.toThrow('Scanned PDFs are not supported')
  })
})

describe('extractDocx', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns extracted text from DOCX buffer', async () => {
    const mammoth = (await import('mammoth')).default
    ;(mammoth.extractRawText as ReturnType<typeof vi.fn>).mockResolvedValue({ value: 'Document content here' })

    const buf = Buffer.from('fake-docx')
    const result = await extractDocx(buf)
    expect(result).toBe('Document content here')
  })
})
