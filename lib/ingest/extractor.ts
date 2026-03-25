import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'

export async function extractPdf(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer)
  const text = result.text
  if (text.trim().length < 100) {
    throw new Error('Scanned PDFs are not supported — please upload a text-based PDF')
  }
  return text
}

export async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

export function extractTxt(buffer: Buffer): string {
  return buffer.toString('utf-8')
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case 'application/pdf':
      return extractPdf(buffer)
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractDocx(buffer)
    case 'text/plain':
      return extractTxt(buffer)
    default:
      throw new Error(`Unsupported file type: ${mimeType}`)
  }
}
