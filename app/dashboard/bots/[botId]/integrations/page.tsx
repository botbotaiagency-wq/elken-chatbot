'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Link, Copy, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

const whatsappSnippet = `{
  "message": "{{ $json.message.text }}",
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
  snippet: string
}

function ChannelTab({ webhookUrl, snippet }: ChannelTabProps) {
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

      {/* n8n Request Body card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">n8n Request Body</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <pre className="bg-muted rounded-md p-4 text-sm font-mono overflow-x-auto">
              <code>{snippet}</code>
            </pre>
            <div className="absolute right-2 top-2">
              <CopyButton value={snippet} ariaLabel="Copy n8n snippet" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Paste this into your n8n HTTP Request node. Replace template expressions with your
            trigger node&apos;s actual field names.
          </p>
          <p className="text-xs text-muted-foreground">
            Note:{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">$json.message.text</code>
            {', '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">$json.message.from.id</code>
            {', and '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">$json.message.chat.id</code>{' '}
            are placeholder n8n expressions. Adjust these to match your actual trigger node&apos;s
            output fields.
          </p>
        </CardContent>
      </Card>

      {/* Setup note */}
      <p className="text-sm text-muted-foreground">
        In your n8n workflow, add an HTTP Request node pointed at this URL. Set method to POST,
        content type to JSON, and add an{' '}
        <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">X-API-Key</code> header
        with your API key value.
      </p>
    </div>
  )
}

export default function IntegrationsPage() {
  const params = useParams()
  const botId = params.botId as string

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/chat/${botId}`
      : `/api/chat/${botId}`

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Link className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Integrations</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Copy your webhook URL and n8n request body to connect this bot to WhatsApp or Telegram.
        </p>
      </div>

      <Tabs defaultValue="whatsapp">
        <TabsList>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="telegram">Telegram</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="mt-4">
          <ChannelTab webhookUrl={webhookUrl} snippet={whatsappSnippet} />
        </TabsContent>

        <TabsContent value="telegram" className="mt-4">
          <ChannelTab webhookUrl={webhookUrl} snippet={telegramSnippet} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
