import Anthropic from '@anthropic-ai/sdk'
import type { Intent, Language } from '@/types/database'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export interface DetectionResult {
  language: Language
  intent: Intent
}

export async function detectIntentAndLanguage(message: string): Promise<DetectionResult> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [{ role: 'user', content: message }],
    system: `You are a language and intent classifier for a chatbot. Respond with ONLY a JSON object, no markdown, no explanation.

Classify the user message:
- language: "en" (English) | "bm" (Bahasa Malaysia) | "zh" (Chinese)
- intent: "browse_product" | "health_issue" | "book_session" | "faq" | "general"

Intent definitions:
- browse_product: user asks about, mentions, or enquires about ANY product, brand, or item by name. Includes "tell me about X", "what is X", "info on X", "what products do you have", "recommend me something". When in doubt between browse_product and general, choose browse_product.
- health_issue: user describes a health concern, symptom, body condition, or asks what product helps with a health problem
- book_session: user wants to book, reserve, or schedule a facility, session, room, or appointment
- faq: user asks about location, opening hours, prices, policies, contact, membership, how-to
- general: ONLY for pure greetings (hi, hello, thanks) or completely off-topic messages

Examples:
{"language":"en","intent":"browse_product"} — "Tell me about Nutrishake"
{"language":"en","intent":"browse_product"} — "What products do you have?"
{"language":"en","intent":"browse_product"} — "Info on Bespro"
{"language":"bm","intent":"browse_product"} — "Cerita pasal produk kecantikan"
{"language":"en","intent":"health_issue"} — "I have joint pain, what do you recommend?"
{"language":"en","intent":"book_session"} — "I want to book a GenQi room"
{"language":"en","intent":"faq"} — "What are your opening hours?"
{"language":"en","intent":"general"} — "Hi" or "Thank you"`,
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
