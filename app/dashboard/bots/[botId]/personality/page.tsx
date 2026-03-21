'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
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
        <Card>
          <CardHeader>
            <CardTitle>Personality</CardTitle>
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
              <Label>Greeting (EN)</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={greetingEn}
                onChange={(e) => setGreetingEn(e.target.value)}
                placeholder="Hello! How can I help you today?"
              />
            </div>

            <div>
              <Label>Greeting (BM)</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={greetingBm}
                onChange={(e) => setGreetingBm(e.target.value)}
                placeholder="Helo! Bagaimana saya boleh membantu anda hari ini?"
              />
            </div>

            <div>
              <Label>Greeting (ZH)</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={greetingZh}
                onChange={(e) => setGreetingZh(e.target.value)}
                placeholder="您好！今天有什么可以帮您？"
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

            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
