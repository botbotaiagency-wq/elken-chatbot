'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Toaster } from '@/components/ui/sonner'

export default function GuardrailsPage() {
  const params = useParams()
  const botId = params.botId as string

  const [blockedKeywords, setBlockedKeywords] = useState('')
  const [refuseMessage, setRefuseMessage] = useState('')
  const [disclaimerText, setDisclaimerText] = useState('')
  const [maxResponseLength, setMaxResponseLength] = useState('1000')
  const [offTopicMessage, setOffTopicMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch(`/api/config/${botId}/guardrails`)
        if (!res.ok) throw new Error('Failed to load guardrails config')
        const data = await res.json()
        setBlockedKeywords(data.blocked_keywords ?? '')
        setRefuseMessage(data.refuse_message ?? '')
        setDisclaimerText(data.disclaimer_text ?? '')
        setMaxResponseLength(data.max_response_length != null ? String(data.max_response_length) : '1000')
        setOffTopicMessage(data.off_topic_message ?? '')
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
      const res = await fetch(`/api/config/${botId}/guardrails`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocked_keywords: blockedKeywords,
          refuse_message: refuseMessage,
          disclaimer_text: disclaimerText,
          max_response_length: parseInt(maxResponseLength) || 1000,
          off_topic_message: offTopicMessage,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Guardrails saved.')
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
            <CardTitle>Guardrails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Blocked Topic Keywords</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={4}
                value={blockedKeywords}
                onChange={(e) => setBlockedKeywords(e.target.value)}
                placeholder="competitor&#10;refund&#10;lawsuit"
              />
              <p className="text-xs text-muted-foreground">
                One keyword per line. Messages matching these will trigger the refuse message.
              </p>
            </div>

            <div>
              <Label>Custom Refuse Message</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={refuseMessage}
                onChange={(e) => setRefuseMessage(e.target.value)}
                placeholder="I'm sorry, I'm not able to help with that topic."
              />
            </div>

            <div>
              <Label>Mandatory Disclaimer Text</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={disclaimerText}
                onChange={(e) => setDisclaimerText(e.target.value)}
                placeholder="This information is for general guidance only. Please consult a healthcare professional."
              />
              <p className="text-xs text-muted-foreground">Appended to every bot response.</p>
            </div>

            <div>
              <Label>Max Response Length</Label>
              <Input
                type="number"
                value={maxResponseLength}
                onChange={(e) => setMaxResponseLength(e.target.value)}
                min={100}
                max={5000}
              />
              <p className="text-xs text-muted-foreground">Characters. Recommended: 500-1500.</p>
            </div>

            <div>
              <Label>Off-Topic Deflection Message</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={offTopicMessage}
                onChange={(e) => setOffTopicMessage(e.target.value)}
                placeholder="I can only help with questions about Elken products and services."
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
