'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Toaster } from '@/components/ui/sonner'

export default function PersonalityPage() {
  const params = useParams()
  const botId = params.botId as string

  const [botName, setBotName] = useState('')
  const [greetingEn, setGreetingEn] = useState('')
  const [greetingBm, setGreetingBm] = useState('')
  const [greetingZh, setGreetingZh] = useState('')
  const [tone, setTone] = useState('Professional')
  const [fallbackMessage, setFallbackMessage] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch(`/api/config/${botId}/personality`)
        if (!res.ok) throw new Error('Failed to load personality config')
        const data = await res.json()
        setBotName(data.name ?? '')
        setGreetingEn(data.greeting_en ?? '')
        setGreetingBm(data.greeting_bm ?? '')
        setGreetingZh(data.greeting_zh ?? '')
        setTone(data.tone ?? 'Professional')
        setFallbackMessage(data.fallback_message ?? '')
        setSystemPrompt(data.system_prompt ?? '')
      } catch {
        // silent — fields remain empty on error
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [botId])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/config/${botId}/personality`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: botName,
          greeting_en: greetingEn,
          greeting_bm: greetingBm,
          greeting_zh: greetingZh,
          tone,
          fallback_message: fallbackMessage,
          system_prompt: systemPrompt,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Bot configuration saved.')
    } catch {
      toast.error('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <>
        <Toaster />
        <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
      </>
    )
  }

  return (
    <>
      <Toaster />
      <div className="space-y-6">

        {/* System Prompt */}
        <Card>
          <CardHeader>
            <CardTitle>System Prompt</CardTitle>
            <CardDescription>
              Override the auto-generated system instructions sent to the AI. Leave blank to use the default persona built from the fields below (name, tone, guardrails). When set, this replaces the preamble — RAG context is still appended automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Custom System Prompt</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                rows={8}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder={`You are Ethan, a helpful assistant for Elken. Respond in the user's language (English, Bahasa Malaysia, or Chinese).
Answer questions based only on the knowledge base context provided.
Be concise, friendly, and professional.`}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Tip: include language instructions, persona, and any rules. The knowledge base (FAQs, documents, products) is always injected after this.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Personality */}
        <Card>
          <CardHeader>
            <CardTitle>Personality</CardTitle>
            <CardDescription>
              Used when no custom system prompt is set above.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Bot Name</Label>
              <Input
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder="e.g. Elken Assistant"
              />
            </div>

            <div>
              <Label>Tone</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                <option value="Professional">Professional</option>
                <option value="Friendly">Friendly</option>
                <option value="Formal">Formal</option>
              </select>
            </div>

            <div>
              <Label>Fallback Message</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={fallbackMessage}
                onChange={(e) => setFallbackMessage(e.target.value)}
                placeholder="I don't have specific information about that. Please contact our team for more details."
              />
            </div>
          </CardContent>
        </Card>

        {/* First Messages */}
        <Card>
          <CardHeader>
            <CardTitle>First Message</CardTitle>
            <CardDescription>
              The opening message sent to users when they start a new conversation. Set one per language.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>First Message (EN)</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={greetingEn}
                onChange={(e) => setGreetingEn(e.target.value)}
                placeholder="Hello! How can I help you today?"
              />
            </div>

            <div>
              <Label>First Message (BM)</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={greetingBm}
                onChange={(e) => setGreetingBm(e.target.value)}
                placeholder="Helo! Bagaimana saya boleh membantu anda hari ini?"
              />
            </div>

            <div>
              <Label>First Message (ZH)</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={greetingZh}
                onChange={(e) => setGreetingZh(e.target.value)}
                placeholder="您好！今天有什么可以帮您？"
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </>
  )
}
