import { encode, decode } from 'gpt-tokenizer'

export function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  if (!text || text.trim().length === 0) return []

  const tokens = encode(text)
  if (tokens.length === 0) return []

  const chunks: string[] = []
  let start = 0

  while (start < tokens.length) {
    const end = Math.min(start + chunkSize, tokens.length)
    chunks.push(decode(tokens.slice(start, end)))
    if (end >= tokens.length) break
    start += chunkSize - overlap
  }

  return chunks
}
