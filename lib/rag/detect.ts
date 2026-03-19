import Anthropic from '@anthropic-ai/sdk'
import type { Intent, Language } from '@/types/database'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export interface DetectionResult {
  language: Language
  intent: Intent
}

export async function detectIntentAndLanguage(message: string): Promise<DetectionResult> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-20241022',
    max_tokens: 100,
    messages: [{ role: 'user', content: message }],
    system: `You are a language and intent classifier for a multi-tenant chatbot platform. Respond with ONLY a JSON object, no markdown, no explanation.

Classify the user message:
- language: "en" (English) | "bm" (Bahasa Malaysia) | "zh" (Chinese)
- intent: "browse_product" | "health_issue" | "book_session" | "faq" | "general"

Intent definitions:
- browse_product: user wants to see, search, or buy a product
- health_issue: user describes a health concern, symptom, or condition
- book_session: user wants to book a facility, session, or appointment
- faq: user asks about locations, hours, policies, general info
- general: greeting, thank you, or anything that doesn't fit above

Example: {"language":"en","intent":"browse_product"}`,
  })

  const text = (response.content[0] as { type: 'text'; text: string }).text.trim()

  try {
    const parsed = JSON.parse(text) as DetectionResult
    // Validate fields
    const validLanguages: Language[] = ['en', 'bm', 'zh']
    const validIntents: Intent[] = ['browse_product', 'health_issue', 'book_session', 'faq', 'general']
    if (!validLanguages.includes(parsed.language)) parsed.language = 'en'
    if (!validIntents.includes(parsed.intent)) parsed.intent = 'general'
    return parsed
  } catch {
    // Default fallback if Claude returns non-JSON
    return { language: 'en', intent: 'general' }
  }
}
