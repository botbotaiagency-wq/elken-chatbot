'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Link, Copy, Check, Calendar, Mic, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'

const whatsappSnippet = `{
  "message": "{{ $json.message.text }}",
  "userId": "{{ $json.message.from.id }}",
  "channel": "whatsapp",
  "conversationId": "{{ $json.message.chat.id }}"
}`

const whatsappVoiceSnippet = `{
  "voice_url": "{{ $json.message.voice.url }}",
  "userId": "{{ $json.message.from.id }}",
  "channel": "whatsapp",
  "conversationId": "{{ $json.message.chat.id }}"
}`

const telegramSnippet = `{
  "message": "{{ $json.message.text }}",
  "userId": "{{ $json.message.from.id }}",
  "channel": "telegram",
  "conversationId": "{{ $json.message.chat.id }}"
}`

const telegramVoiceSnippet = `{
  "voice_url": "{{ $json.message.voice.file_url }}",
  "userId": "{{ $json.message.from.id }}",
  "channel": "telegram",
  "conversationId": "{{ $json.message.chat.id }}"
}`

function CopyButton({ value, ariaLabel }: { value: string; ariaLabel: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={ariaLabel}
      onClick={handleCopy}
      className="shrink-0"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}

interface ChannelTabProps {
  webhookUrl: string
  textSnippet: string
  voiceSnippet: string
}

function ChannelTab({ webhookUrl, textSnippet, voiceSnippet }: ChannelTabProps) {
  return (
    <div className="space-y-4">
      {/* Webhook URL card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Webhook URL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={webhookUrl}
              className="font-mono text-sm"
            />
            <CopyButton value={webhookUrl} ariaLabel="Copy webhook URL" />
          </div>
          <p className="text-sm text-muted-foreground">
            Send POST requests to this URL with your API key in the{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">X-API-Key</code>{' '}
            header.
          </p>
        </CardContent>
      </Card>

      {/* Text message snippet */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Text Message — n8n Request Body</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <pre className="bg-muted rounded-md p-4 text-sm font-mono overflow-x-auto">
              <code>{textSnippet}</code>
            </pre>
            <div className="absolute right-2 top-2">
              <CopyButton value={textSnippet} ariaLabel="Copy text snippet" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voice message snippet */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Voice Message — n8n Request Body
          </CardTitle>
          <CardDescription>
            Pass <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">voice_url</code> instead of <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">message</code>. The API transcribes audio via Whisper, then processes it as a text query. Requires <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">OPENAI_API_KEY</code> to be set on the server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <pre className="bg-muted rounded-md p-4 text-sm font-mono overflow-x-auto">
              <code>{voiceSnippet}</code>
            </pre>
            <div className="absolute right-2 top-2">
              <CopyButton value={voiceSnippet} ariaLabel="Copy voice snippet" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The <code className="rounded bg-muted px-1 py-0.5 font-mono">voice_url</code> must be a publicly accessible direct download URL. The transcribed text is returned in the <code className="rounded bg-muted px-1 py-0.5 font-mono">X-Transcription</code> response header.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

interface CalendarOption { id: string; summary: string; primary: boolean }

function GoogleCalendarSection({ botId }: { botId: string }) {
  const searchParams = useSearchParams()

  const [calendarId, setCalendarId] = useState('')
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [oauthConfigured, setOauthConfigured] = useState(false)
  const [calendars, setCalendars] = useState<CalendarOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  function loadConfig() {
    setLoading(true)
    fetch(`/api/config/${botId}/google-calendar`)
      .then((r) => r.json())
      .then((data) => {
        setCalendarId(data.google_calendar_id ?? '')
        setConnectedEmail(data.connected_email ?? null)
        setIsConnected(data.is_connected ?? false)
        setOauthConfigured(data.oauth_configured ?? false)
        setCalendars(data.calendars ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadConfig()
    // Show toast based on OAuth redirect result
    if (searchParams.get('cal_connected') === '1') {
      toast.success('Google Calendar connected successfully!')
    }
    const calError = searchParams.get('cal_error')
    if (calError) {
      toast.error(`Google Calendar error: ${calError}`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/config/${botId}/google-calendar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ google_calendar_id: calendarId }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Calendar selected.')
    } catch {
      toast.error('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      const res = await fetch(`/api/config/${botId}/google-calendar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disconnect: true }),
      })
      if (!res.ok) throw new Error('Failed to disconnect')
      toast.success('Google Calendar disconnected.')
      setIsConnected(false)
      setConnectedEmail(null)
      setCalendars([])
      setCalendarId('')
    } catch {
      toast.error('Failed to disconnect.')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground py-4">Loading...</div>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar
          </CardTitle>
          <CardDescription>
            When a booking is confirmed, a Google Calendar event is automatically created. When cancelled or rescheduled, the event is updated or removed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {!oauthConfigured && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700 space-y-1">
              <p className="font-medium">OAuth not configured</p>
              <p>Add <code className="rounded bg-amber-100 px-1 font-mono">GOOGLE_CLIENT_ID</code> and <code className="rounded bg-amber-100 px-1 font-mono">GOOGLE_CLIENT_SECRET</code> to your <code className="rounded bg-amber-100 px-1 font-mono">.env</code> file, then redeploy.</p>
              <p className="mt-1">In the Google Cloud Console: APIs &amp; Services → Credentials → Create OAuth 2.0 Client ID (Web application). Add <code className="rounded bg-amber-100 px-1 font-mono">{typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/google-calendar/callback</code> as an authorised redirect URI.</p>
            </div>
          )}

          {/* Connection status */}
          {isConnected ? (
            <div className="flex items-center justify-between rounded-lg border bg-green-50 border-green-200 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>Connected as <strong>{connectedEmail ?? 'unknown'}</strong></span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 text-xs"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="h-4 w-4 flex-shrink-0" />
                <span>No Google account connected</span>
              </div>
              <Button
                size="sm"
                disabled={!oauthConfigured}
                onClick={() => {
                  window.location.href = `/api/auth/google-calendar/connect?botId=${botId}`
                }}
              >
                Connect Google Account
              </Button>
            </div>
          )}

          {/* Calendar selector — shown only when connected */}
          {isConnected && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Select Calendar</Label>
                {calendars.length > 0 ? (
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={calendarId}
                    onChange={(e) => setCalendarId(e.target.value)}
                  >
                    <option value="">— choose a calendar —</option>
                    {calendars.map((cal) => (
                      <option key={cal.id} value={cal.id}>
                        {cal.summary}{cal.primary ? ' (primary)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2">
                    <Input
                      value={calendarId}
                      onChange={(e) => setCalendarId(e.target.value)}
                      placeholder="e.g. abc123@group.calendar.google.com"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Found in Google Calendar → Settings → Integrate calendar → Calendar ID
                    </p>
                  </div>
                )}
              </div>
              <Button size="sm" onClick={handleSave} disabled={saving || !calendarId}>
                {saving ? 'Saving…' : 'Save Calendar'}
              </Button>
              {calendarId && (
                <p className="text-xs text-muted-foreground">
                  Active: <code className="rounded bg-muted px-1 font-mono">{calendarId}</code>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function IntegrationsPageInner() {
  const params = useParams()
  const botId = params.botId as string

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/chat/${botId}`
      : `/api/chat/${botId}`

  return (
    <div className="space-y-6">
      <Toaster />
      <div>
        <div className="flex items-center gap-2">
          <Link className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Integrations</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect this bot to WhatsApp, Telegram, or Google Calendar.
        </p>
      </div>

      <Tabs defaultValue="whatsapp">
        <TabsList>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="telegram">Telegram</TabsTrigger>
          <TabsTrigger value="google-calendar">Google Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="mt-4">
          <ChannelTab
            webhookUrl={webhookUrl}
            textSnippet={whatsappSnippet}
            voiceSnippet={whatsappVoiceSnippet}
          />
        </TabsContent>

        <TabsContent value="telegram" className="mt-4">
          <ChannelTab
            webhookUrl={webhookUrl}
            textSnippet={telegramSnippet}
            voiceSnippet={telegramVoiceSnippet}
          />
        </TabsContent>

        <TabsContent value="google-calendar" className="mt-4">
          <GoogleCalendarSection botId={botId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>}>
      <IntegrationsPageInner />
    </Suspense>
  )
}
