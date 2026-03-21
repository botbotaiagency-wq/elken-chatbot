'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Toaster } from '@/components/ui/sonner'
import { Send, RotateCcw } from 'lucide-react'

interface SourceChunk {
  chunk_id: string
  similarity: number
  content_preview: string
  document_name: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
  intent?: string | null
  ragFound?: boolean | null
  latencyMs?: number | null
  sourceChunks?: SourceChunk[]
  error?: boolean
}

export default function TestingPage() {
  const params = useParams()
  const botId = params.botId as string

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [languageOverride, setLanguageOverride] = useState('auto')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [expandedMsgId, setExpandedMsgId] = useState<string | null>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!inputText.trim() || streaming) return

    const text = inputText
    setInputText('')
    setStreaming(true)

    const userMsgId = crypto.randomUUID()
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: text }])

    const botMsgId = crypto.randomUUID()
    setMessages(prev => [...prev, { id: botMsgId, role: 'assistant', content: '', pending: true }])

    const startTime = Date.now()

    try {
      const res = await fetch(`/api/config/${botId}/test-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          userId: 'admin-test',
          channel: 'web',
          conversationId: conversationId || undefined,
          language_override: languageOverride !== 'auto' ? languageOverride : undefined,
        }),
      })

      if (!res.ok) throw new Error(`Request failed: ${res.status}`)

      // Read metadata from headers immediately (before body consumption)
      const intent = res.headers.get('X-Intent')
      const ragFound = res.headers.get('X-Rag-Found') === 'true'
      const newConversationId = res.headers.get('X-Conversation-Id')
      if (newConversationId) setConversationId(newConversationId)

      // Stream the body
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk
        setMessages(prev =>
          prev.map(m =>
            m.id === botMsgId ? { ...m, content: fullText, pending: false } : m
          )
        )
      }

      // Calculate latency
      const latencyMs = Date.now() - startTime

      // After stream completes, fetch debug data
      let sourceChunks: SourceChunk[] = []
      if (newConversationId) {
        try {
          const debugRes = await fetch(
            `/api/config/${botId}/debug?conversationId=${newConversationId}`
          )
          if (debugRes.ok) {
            const debugData = await debugRes.json()
            sourceChunks = debugData.source_chunks ?? []
          }
        } catch {
          // silent — debug data is non-critical
        }
      }

      // Update bot message with all metadata
      setMessages(prev =>
        prev.map(m =>
          m.id === botMsgId
            ? { ...m, intent, ragFound, latencyMs, sourceChunks }
            : m
        )
      )
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === botMsgId
            ? {
                ...m,
                content:
                  'Something went wrong. The bot did not respond. Check the console and try again.',
                pending: false,
                error: true,
              }
            : m
        )
      )
    } finally {
      setStreaming(false)
    }
  }

  function handleReset() {
    setMessages([])
    setConversationId(null)
    setLanguageOverride('auto')
    setExpandedMsgId(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      <Toaster />
      <div className="flex flex-col h-[calc(100vh-12rem)]">

        {/* Toolbar */}
        <div className="flex items-center gap-4 px-4 py-2 border-b bg-background">
          <Label className="text-sm">Language:</Label>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={languageOverride}
            onChange={e => setLanguageOverride(e.target.value)}
          >
            <option value="auto">Auto</option>
            <option value="en">EN</option>
            <option value="bm">BM</option>
            <option value="zh">ZH</option>
          </select>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Conversation
          </Button>
        </div>

        {/* Chat window */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4">
          {messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <h3 className="text-sm font-semibold">Start a conversation</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Send a test message to see how your bot responds.
              </p>
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[70%] ${
                msg.role === 'user' ? 'items-end self-end' : 'items-start self-start'
              }`}
            >
              {/* Message bubble */}
              <div
                className={`rounded-2xl px-4 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : msg.error
                    ? 'bg-destructive/10 text-destructive rounded-bl-sm'
                    : 'bg-secondary text-secondary-foreground rounded-bl-sm'
                }`}
              >
                {msg.pending ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  msg.content
                )}
              </div>

              {/* Debug panel for assistant messages */}
              {msg.role === 'assistant' && !msg.pending && !msg.error && (
                <div className="mt-1">
                  <button
                    className="text-xs text-muted-foreground underline cursor-pointer"
                    onClick={() =>
                      setExpandedMsgId(expandedMsgId === msg.id ? null : msg.id)
                    }
                  >
                    {expandedMsgId === msg.id ? 'Hide details' : 'View details'}
                  </button>

                  {expandedMsgId === msg.id && (
                    <div className="border-t mt-2 pt-2 space-y-1 text-xs text-muted-foreground">
                      <div>
                        <strong>Intent:</strong> {msg.intent ?? 'N/A'}
                      </div>
                      <div>
                        <strong>RAG Found:</strong>{' '}
                        <Badge variant={msg.ragFound ? 'default' : 'secondary'}>
                          {msg.ragFound ? 'true' : 'false'}
                        </Badge>
                      </div>
                      <div>
                        <strong>Latency:</strong>{' '}
                        {msg.latencyMs != null ? `${msg.latencyMs}ms` : 'N/A'}
                      </div>
                      {msg.sourceChunks && msg.sourceChunks.length > 0 && (
                        <div>
                          <strong>Source Chunks:</strong>
                          <div className="space-y-1 mt-1">
                            {msg.sourceChunks.map((chunk, i) => (
                              <div key={i} className="rounded bg-muted px-2 py-1">
                                <div className="font-medium">
                                  {chunk.document_name} (score:{' '}
                                  {chunk.similarity.toFixed(2)})
                                </div>
                                <div className="text-muted-foreground">
                                  {chunk.content_preview}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <div ref={chatEndRef} />
        </div>

        {/* Input bar */}
        <div className="flex gap-2 p-4 border-t">
          <Input
            type="text"
            placeholder="Type a test message..."
            className="flex-1"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
          />
          <Button
            onClick={() => sendMessage()}
            disabled={!inputText.trim() || streaming}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

      </div>
    </>
  )
}
