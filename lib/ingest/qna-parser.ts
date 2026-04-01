export interface QnAPair {
  question: string
  answer: string
}

/**
 * Parses a script/document text into Q&A pairs.
 * Supports multiple formats:
 *   Q: ... / A: ...
 *   Question: ... / Answer: ...
 *   Numbered blocks: 1. Question? \n Answer text
 */
export function parseQnA(text: string): QnAPair[] {
  // Normalise line endings
  const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Try Q:/A: format first
  const pairs = tryQAFormat(normalised)
  if (pairs.length > 0) return pairs

  // Try Question:/Answer: format
  const pairs2 = tryQuestionAnswerFormat(normalised)
  if (pairs2.length > 0) return pairs2

  // Try numbered format
  return tryNumberedFormat(normalised)
}

function tryQAFormat(text: string): QnAPair[] {
  const pairs: QnAPair[] = []
  // Match "Q: <question>\nA: <answer>" blocks (answer continues until next Q: or double newline)
  const regex = /^Q:\s*(.+?)\s*\nA:\s*([\s\S]+?)(?=\nQ:|\n\n\n|$)/gim
  let match
  while ((match = regex.exec(text)) !== null) {
    const question = match[1].trim()
    const answer = match[2].trim()
    if (question && answer) {
      pairs.push({ question, answer })
    }
  }
  return pairs
}

function tryQuestionAnswerFormat(text: string): QnAPair[] {
  const pairs: QnAPair[] = []
  const regex = /^Question:\s*(.+?)\s*\nAnswer:\s*([\s\S]+?)(?=\nQuestion:|\n\n\n|$)/gim
  let match
  while ((match = regex.exec(text)) !== null) {
    const question = match[1].trim()
    const answer = match[2].trim()
    if (question && answer) {
      pairs.push({ question, answer })
    }
  }
  return pairs
}

function tryNumberedFormat(text: string): QnAPair[] {
  const pairs: QnAPair[] = []
  // Split on numbered items like "1." "2." etc.
  const blocks = text.split(/\n\s*\d+\.\s+/).filter((b) => b.trim())

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) continue

    // First line is the question, rest is the answer
    const question = lines[0].replace(/\?$/, '').trim() + '?'
    const answer = lines.slice(1).join(' ').trim()

    // Skip if it looks like a question but has no meaningful answer
    if (question.length > 5 && answer.length > 5) {
      pairs.push({ question, answer })
    }
  }
  return pairs
}
