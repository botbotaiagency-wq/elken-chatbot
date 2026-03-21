import type { RetrievalResult, FAQResult, ChunkResult, ProductResult } from './retrieve'
import type { DetectionResult } from './detect'

export interface BotConfig {
  name?: string | null
  greeting_en?: string | null
  greeting_bm?: string | null
  greeting_zh?: string | null
  tone?: string | null
  fallback_message?: string | null
  blocked_keywords?: string | null
  refuse_message?: string | null
  disclaimer_text?: string | null
  max_response_length?: number | null
  off_topic_message?: string | null
}

export interface PromptContext {
  retrieval: RetrievalResult
  detection: DetectionResult
  botName?: string          // keep for backward compat
  fallbackMessage?: string  // keep for backward compat
  botConfig?: BotConfig     // new: full config from DB
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const { retrieval, detection } = ctx
  const botName = ctx.botConfig?.name ?? ctx.botName ?? 'Assistant'
  const fallback = ctx.botConfig?.fallback_message ?? ctx.fallbackMessage ?? "I don't have specific information about that in my knowledge base. Let me try to help with what I know, or you can contact our team directly for more details."
  const langInstruction = {
    en: 'Respond in English.',
    bm: 'Respond in Bahasa Malaysia.',
    zh: 'Respond in Chinese (Simplified).',
  }[detection.language]

  const sections: string[] = []

  // Base persona
  sections.push(`You are ${botName}, a helpful customer service assistant. ${langInstruction}`)
  sections.push('Answer based ONLY on the context provided below. If the context does not contain enough information to answer, say so honestly.')

  // Greeting for detected language
  const greeting = ctx.botConfig?.[`greeting_${detection.language}` as keyof BotConfig] as string | null | undefined
  if (greeting) {
    sections.push(`Greeting message: "${greeting}"`)
  }

  // Tone instruction
  const tone = ctx.botConfig?.tone ?? 'Professional'
  sections.push(`Respond in a ${tone.toLowerCase()} tone.`)

  // Guardrails injection
  if (ctx.botConfig?.blocked_keywords) {
    const keywords = ctx.botConfig.blocked_keywords
      .split('\n')
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
    if (keywords.length > 0) {
      sections.push(
        `\n--- BLOCKED TOPICS ---\nIf the user's message contains any of these keywords: ${keywords.join(', ')}, respond with: "${ctx.botConfig.refuse_message ?? 'I cannot help with that topic.'}"`
      )
    }
  }

  if (ctx.botConfig?.disclaimer_text) {
    sections.push(
      `\n--- MANDATORY DISCLAIMER ---\nAppend this disclaimer to every response: "${ctx.botConfig.disclaimer_text}"`
    )
  }

  if (ctx.botConfig?.max_response_length) {
    sections.push(`Keep your response under ${ctx.botConfig.max_response_length} characters.`)
  }

  if (ctx.botConfig?.off_topic_message) {
    sections.push(`If the message is off-topic or unrelated to the knowledge base, respond with: "${ctx.botConfig.off_topic_message}"`)
  }

  // FAQ priority context (injected ABOVE RAG chunks per RAG-04)
  if (retrieval.faqs.length > 0) {
    sections.push('\n--- PRIORITY FAQ ANSWERS (use these first) ---')
    for (const faq of retrieval.faqs) {
      sections.push(`Q: ${faq.question}\nA: ${faq.answer} [similarity: ${faq.similarity.toFixed(2)}]`)
    }
  }

  // Product Detail Cards (for browse_product / health_issue intents)
  if (retrieval.products.length > 0) {
    sections.push('\n--- PRODUCT INFORMATION ---')
    for (const product of retrieval.products) {
      sections.push(formatProductCard(product))
    }
  }

  // Document chunks
  if (retrieval.chunks.length > 0) {
    sections.push('\n--- KNOWLEDGE BASE CONTEXT ---')
    for (const chunk of retrieval.chunks) {
      sections.push(`[Source chunk ${chunk.id}, similarity: ${chunk.similarity.toFixed(2)}]\n${chunk.content}`)
    }
  }

  // Fallback instruction when no RAG match
  if (!retrieval.ragFound) {
    if (detection.intent === 'health_issue') {
      // RAG-07: Wellness-specific fallback for health queries with no product match
      sections.push(
        '\n--- NO MATCHING PRODUCT FOUND FOR HEALTH CONCERN ---\n' +
        'I don\'t have a specific product match for that health concern in my knowledge base. ' +
        'However, I recommend browsing our wellness product categories:\n' +
        '- **GenQi** — wellness devices and therapy equipment for recovery, relaxation, and vitality\n' +
        '- **Healthfood** — nutritional supplements, vitamins, and health food products for overall wellbeing\n\n' +
        'Would you like me to show you products from either of these categories? ' +
        'You can also contact our team directly for personalized health product recommendations.'
      )
    } else {
      sections.push(`\n--- NO KNOWLEDGE BASE MATCH FOUND ---\n${fallback}`)
    }
  }

  // Intent-specific instructions
  if (detection.intent === 'health_issue' && retrieval.products.length > 0) {
    sections.push('\nThe customer described a health concern. Explain why the matched product helps, its key benefits, and suggested usage. Be empathetic and informative.')
  }

  if (detection.intent === 'browse_product' && retrieval.products.length > 0) {
    sections.push('\nThe customer is looking for a product. Present the Product Detail Card information clearly: name, description, key ingredients, benefits, pricing, and how to use it.')
  }

  if (detection.intent === 'book_session') {
    sections.push('\nThe customer wants to book a session. Guide them through the booking process. Ask what facility type they need.')
  }

  return sections.join('\n')
}

function formatProductCard(product: ProductResult): string {
  const lines = [`**${product.name}** (${product.category})`]
  if (product.description) lines.push(`Description: ${product.description}`)
  if (product.key_ingredients) lines.push(`Key Ingredients: ${product.key_ingredients}`)
  if (product.health_benefits) lines.push(`Health Benefits: ${product.health_benefits}`)
  if (product.pricing) lines.push(`Pricing: ${product.pricing}`)
  if (product.suggested_usage) lines.push(`Suggested Usage: ${product.suggested_usage}`)
  lines.push(`[similarity: ${product.similarity.toFixed(2)}]`)
  return lines.join('\n')
}
