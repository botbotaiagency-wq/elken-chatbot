'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Toaster } from '@/components/ui/sonner'

interface FAQ {
  id: string
  question: string
  answer: string
  language: string
  created_at: string
}

export default function FaqsPage() {
  const params = useParams()
  const botId = params.botId as string

  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [languageFilter, setLanguageFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null)
  const [formQuestion, setFormQuestion] = useState('')
  const [formAnswer, setFormAnswer] = useState('')
  const [formLanguage, setFormLanguage] = useState('en')
  const [deletingFaqId, setDeletingFaqId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchFaqs = useCallback(async () => {
    try {
      const res = await fetch(`/api/config/${botId}/faqs`)
      if (!res.ok) throw new Error('Failed to fetch FAQs')
      const data = await res.json()
      setFaqs(data.faqs ?? [])
    } catch {
      // silent — page starts empty on error
    } finally {
      setLoading(false)
    }
  }, [botId])

  useEffect(() => {
    fetchFaqs()
  }, [fetchFaqs])

  const filteredFaqs = languageFilter === 'all' ? faqs : faqs.filter(f => f.language === languageFilter)

  function openCreateDialog() {
    setEditingFaq(null)
    setFormQuestion('')
    setFormAnswer('')
    setFormLanguage('en')
    setDialogOpen(true)
  }

  function openEditDialog(faq: FAQ) {
    setEditingFaq(faq)
    setFormQuestion(faq.question)
    setFormAnswer(faq.answer)
    setFormLanguage(faq.language)
    setDialogOpen(true)
  }

  async function handleSaveFaq() {
    setSaving(true)
    try {
      if (editingFaq === null) {
        // Creating
        const res = await fetch(`/api/config/${botId}/faqs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: formQuestion, answer: formAnswer, language: formLanguage }),
        })
        if (!res.ok) throw new Error('Failed to save')
        toast.success('FAQ added.')
      } else {
        // Editing
        const res = await fetch(`/api/config/${botId}/faqs`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ faqId: editingFaq.id, question: formQuestion, answer: formAnswer, language: formLanguage }),
        })
        if (!res.ok) throw new Error('Failed to save')
        toast.success('FAQ updated.')
      }
      setDialogOpen(false)
      await fetchFaqs()
    } catch {
      toast.error('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(faqId: string) {
    try {
      const res = await fetch(`/api/config/${botId}/faqs`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faqId }),
      })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('FAQ deleted.')
      setFaqs(prev => prev.filter(f => f.id !== faqId))
      setDeletingFaqId(null)
    } catch {
      toast.error('Failed to save. Please try again.')
    }
  }

  return (
    <>
      <Toaster />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">FAQs</h1>
            <p className="text-sm text-muted-foreground">Manage frequently asked questions for your bot.</p>
          </div>
          <Button onClick={openCreateDialog}>Add FAQ</Button>
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
              <div className="py-8 text-center text-sm text-muted-foreground">Loading FAQs...</div>
            ) : filteredFaqs.length === 0 ? (
              <div className="py-12 text-center">
                <h3 className="text-sm font-semibold">No FAQs yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">Add your first FAQ to help the bot answer common questions accurately.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-4 pb-3 pt-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Question</th>
                    <th className="px-4 pb-3 pt-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Language</th>
                    <th className="px-4 pb-3 pt-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Answer Preview</th>
                    <th className="px-4 pb-3 pt-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFaqs.map(faq => (
                    <Fragment key={faq.id}>
                      <tr className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{faq.question}</td>
                        <td className="px-4 py-3">
                          <Badge>{faq.language.toUpperCase()}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {faq.answer.length > 80 ? faq.answer.slice(0, 80) + '...' : faq.answer}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(faq)}>Edit</Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => setDeletingFaqId(deletingFaqId === faq.id ? null : faq.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {deletingFaqId === faq.id && (
                        <tr key={`${faq.id}-confirm`} className="bg-destructive/5">
                          <td colSpan={4} className="px-2 py-2">
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-destructive">Delete this FAQ?</span>
                              <Button variant="destructive" size="sm" onClick={() => handleDelete(faq.id)}>Yes, delete</Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeletingFaqId(null)}>Keep FAQ</Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingFaq ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Question</Label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  value={formQuestion}
                  onChange={e => setFormQuestion(e.target.value)}
                />
              </div>
              <div>
                <Label>Answer</Label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={5}
                  value={formAnswer}
                  onChange={e => setFormAnswer(e.target.value)}
                />
              </div>
              <div>
                <Label>Language</Label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formLanguage}
                  onChange={e => setFormLanguage(e.target.value)}
                >
                  <option value="en">EN</option>
                  <option value="bm">BM</option>
                  <option value="zh">ZH</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Discard</Button>
              <Button
                onClick={handleSaveFaq}
                disabled={saving || !formQuestion.trim() || !formAnswer.trim()}
              >
                {saving ? 'Saving...' : 'Save FAQ'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
