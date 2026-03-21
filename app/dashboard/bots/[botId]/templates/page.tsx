'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Toaster } from '@/components/ui/sonner'

interface Template {
  id: string
  intent_key: string
  language: string
  content: string
  created_at: string
}

const INTENTS = ['no_product_found', 'slot_full', 'booking_confirmed', 'reminder_24h', 'post_survey'] as const
const LANGUAGES = ['en', 'bm', 'zh'] as const

export default function TemplatesPage() {
  const params = useParams()
  const botId = params.botId as string

  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [languageFilter, setLanguageFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingIntent, setEditingIntent] = useState('')
  const [formEn, setFormEn] = useState('')
  const [formBm, setFormBm] = useState('')
  const [formZh, setFormZh] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/config/${botId}/templates`)
      if (!res.ok) throw new Error('Failed to fetch templates')
      const data = await res.json()
      setTemplates(data.templates ?? [])
    } catch {
      // silent — page starts empty on error
    } finally {
      setLoading(false)
    }
  }, [botId])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const grouped = INTENTS.map(intent => {
    const variants = templates.filter(t => t.intent_key === intent)
    return {
      intent,
      en: variants.find(v => v.language === 'en'),
      bm: variants.find(v => v.language === 'bm'),
      zh: variants.find(v => v.language === 'zh'),
    }
  })

  const filteredGrouped = languageFilter === 'all'
    ? grouped
    : grouped.filter(row => {
        if (languageFilter === 'en') return !!row.en
        if (languageFilter === 'bm') return !!row.bm
        if (languageFilter === 'zh') return !!row.zh
        return true
      })

  function openEditDialog(intent: string) {
    const variants = templates.filter(t => t.intent_key === intent)
    setEditingIntent(intent)
    setFormEn(variants.find(v => v.language === 'en')?.content ?? '')
    setFormBm(variants.find(v => v.language === 'bm')?.content ?? '')
    setFormZh(variants.find(v => v.language === 'zh')?.content ?? '')
    setDialogOpen(true)
  }

  async function handleSaveTemplate() {
    setSaving(true)
    try {
      const saves = LANGUAGES.map(lang => {
        const content = { en: formEn, bm: formBm, zh: formZh }[lang]
        if (!content.trim()) return Promise.resolve()
        return fetch(`/api/config/${botId}/templates`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent_key: editingIntent, language: lang, content }),
        })
      })
      const results = await Promise.all(saves)
      const failed = results.some(r => r && !r.ok)
      if (failed) throw new Error('Failed to save')
      toast.success('Template saved.')
      setDialogOpen(false)
      await fetchTemplates()
    } catch {
      toast.error('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Toaster />
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Response Templates</h1>
          <p className="text-sm text-muted-foreground">Manage response templates for specific intents.</p>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-4">
          <Label>Language:</Label>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={languageFilter}
            onChange={e => setLanguageFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="en">EN</option>
            <option value="bm">BM</option>
            <option value="zh">ZH</option>
          </select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading templates...</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-4 pb-3 pt-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Intent</th>
                    <th className="px-4 pb-3 pt-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">EN</th>
                    <th className="px-4 pb-3 pt-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">BM</th>
                    <th className="px-4 pb-3 pt-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">ZH</th>
                    <th className="px-4 pb-3 pt-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGrouped.map(row => (
                    <tr key={row.intent} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{row.intent}</span>
                      </td>
                      <td className="px-4 py-3">
                        {row.en ? (
                          <span className="text-green-600">&#10003;</span>
                        ) : (
                          <span className="text-muted-foreground">&#8212;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.bm ? (
                          <span className="text-green-600">&#10003;</span>
                        ) : (
                          <span className="text-muted-foreground">&#8212;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.zh ? (
                          <span className="text-green-600">&#10003;</span>
                        ) : (
                          <span className="text-muted-foreground">&#8212;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(row.intent)}>Edit</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Template: {editingIntent}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>EN</Label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={4}
                  value={formEn}
                  onChange={e => setFormEn(e.target.value)}
                />
              </div>
              <div>
                <Label>BM</Label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={4}
                  value={formBm}
                  onChange={e => setFormBm(e.target.value)}
                />
              </div>
              <div>
                <Label>ZH</Label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={4}
                  value={formZh}
                  onChange={e => setFormZh(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Discard</Button>
              <Button onClick={handleSaveTemplate} disabled={saving}>
                {saving ? 'Saving...' : 'Save Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
