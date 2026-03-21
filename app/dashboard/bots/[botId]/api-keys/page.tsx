'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Key, Copy, Check, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Toaster } from '@/components/ui/sonner'

interface ApiKey {
  id: string
  label: string
  key_prefix: string
  last_used_at: string | null
  created_at: string
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffYears > 0) return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`
  if (diffMonths > 0) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
  return 'just now'
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function ApiKeysPage() {
  const params = useParams()
  const botId = params.botId as string

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [labelInput, setLabelInput] = useState('')
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null)

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch(`/api/keys/${botId}`)
      if (!res.ok) throw new Error('Failed to fetch keys')
      const data = await res.json()
      setKeys(data.keys ?? [])
    } catch {
      // silent — page starts empty on error
    } finally {
      setLoading(false)
    }
  }, [botId])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  async function handleGenerate() {
    if (!labelInput.trim()) return
    setGenerating(true)
    try {
      const res = await fetch(`/api/keys/${botId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: labelInput.trim() }),
      })
      if (!res.ok) throw new Error('Failed to generate key')
      const data = await res.json()
      setGeneratedKey(data.key)
      setShowKeyModal(true)
      setLabelInput('')
      await fetchKeys()
    } catch {
      toast.error('Failed to generate key. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  function handleCopyKey() {
    if (!generatedKey) return
    navigator.clipboard.writeText(generatedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDismissModal() {
    setShowKeyModal(false)
    setGeneratedKey(null)
    setCopied(false)
  }

  async function handleRevoke(keyId: string) {
    const prevKeys = keys
    setKeys((prev) => prev.filter((k) => k.id !== keyId))
    setRevokingKeyId(null)
    try {
      const res = await fetch(`/api/keys/${botId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId }),
      })
      if (!res.ok) throw new Error('Failed to revoke key')
    } catch {
      setKeys(prevKeys)
      toast.error('Failed to revoke key. Please try again.')
    }
  }

  return (
    <>
      <Toaster />

      {/* Show-Once Modal */}
      <Dialog open={showKeyModal} onOpenChange={() => {}}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Your new API key</DialogTitle>
            <DialogDescription>
              This key will not be shown again. Copy it now and store it securely.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Once you close this dialog, the key cannot be retrieved.</span>
          </div>

          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={generatedKey ?? ''}
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy API key"
              onClick={handleCopyKey}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <Button onClick={handleDismissModal} className="w-full">
            I&apos;ve copied this key
          </Button>
        </DialogContent>
      </Dialog>

      {/* Page */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Key className="h-6 w-6" />
            <h1 className="text-2xl font-semibold">API Keys</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage API keys for authenticating webhook requests to this bot.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>API Keys</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="label-input" className="sr-only">
                  Key Label
                </Label>
                <Input
                  id="label-input"
                  placeholder="e.g. n8n Production"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGenerate()
                  }}
                  className="w-52"
                />
              </div>
              <Button onClick={handleGenerate} disabled={generating || !labelInput.trim()}>
                {generating ? 'Generating...' : 'Generate Key'}
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading keys...
              </div>
            ) : keys.length === 0 ? (
              <div className="py-12 text-center">
                <h3 className="text-sm font-semibold">No API keys yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generate your first API key to start authenticating webhook requests.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium">Label</th>
                      <th className="pb-3 pr-4 font-medium">Key Prefix</th>
                      <th className="pb-3 pr-4 font-medium">Last Used</th>
                      <th className="pb-3 pr-4 font-medium">Created</th>
                      <th className="pb-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((key) => (
                      <>
                        <tr key={key.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-medium">{key.label}</td>
                          <td className="py-3 pr-4">
                            <Badge variant="outline" className="font-mono">
                              {key.key_prefix}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {key.last_used_at ? formatRelativeTime(key.last_used_at) : 'Never'}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {formatDate(key.created_at)}
                          </td>
                          <td className="py-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Revoke key"
                              title="Revoke key"
                              onClick={() =>
                                setRevokingKeyId(
                                  revokingKeyId === key.id ? null : key.id
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                        {revokingKeyId === key.id && (
                          <tr key={`${key.id}-confirm`} className="bg-destructive/5">
                            <td colSpan={5} className="px-2 py-3">
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-destructive">
                                  Revoke this key? Requests using it will immediately return 401.
                                </span>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleRevoke(key.id)}
                                >
                                  Yes, revoke
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setRevokingKeyId(null)}
                                >
                                  Keep key
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
