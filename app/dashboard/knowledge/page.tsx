'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Upload,
  Trash2,
  FileText,
  RefreshCw,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  X,
  LayoutList,
  LayoutGrid,
  RotateCcw,
  MessageSquareText,
  Pencil,
  Check,
  Plus,
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Toaster } from '@/components/ui/sonner'

interface Bot { id: string; name: string }

interface Document {
  id: string
  filename: string
  category: string
  subcategory: string | null
  status: 'pending' | 'processing' | 'ready' | 'error' | 'failed'
  chunk_count: number | null
  error_message: string | null
  created_at: string
  parse_mode?: 'chunks' | 'qna'
}

interface Faq {
  id: string
  question: string
  answer: string
  language: string
  source_document_id: string | null
}

interface StagedFile {
  uid: string
  file: File
  category: string
  subcategory: string
  parseMode: 'chunks' | 'qna'
  progress: 'idle' | 'uploading' | 'done' | 'error'
  error?: string
}

const CATEGORIES = ['Beauty', 'FMCG', 'GenQi', 'Healthfood', 'Home Appliances', 'Other'] as const
const ACCEPT_TYPES = ['.pdf', '.docx', '.txt']
const ACCEPT_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

/** Derive a valid MIME type from file.type or fall back to extension-based lookup */
function getFileContentType(file: File): string {
  if (file.type && ACCEPT_MIME.includes(file.type)) return file.type
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.docx'))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return 'text/plain'
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending:    { label: 'Pending',    className: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800' },
  ready:      { label: 'Ready',      className: 'bg-green-100 text-green-800' },
  failed:     { label: 'Failed',     className: 'bg-red-100 text-red-800' },
  error:      { label: 'Error',      className: 'bg-red-100 text-red-800' },
}

function uid() {
  return Math.random().toString(36).slice(2)
}

function isAccepted(file: File) {
  return ACCEPT_MIME.includes(file.type) || ACCEPT_TYPES.some((ext) => file.name.endsWith(ext))
}

/** Recursively read a FileSystemDirectoryEntry and collect all matching File objects */
function readDirectory(entry: FileSystemDirectoryEntry): Promise<File[]> {
  return new Promise((resolve) => {
    const files: File[] = []
    const reader = entry.createReader()

    function readBatch() {
      reader.readEntries(async (entries) => {
        if (!entries.length) return resolve(files)
        for (const e of entries) {
          if (e.isFile) {
            await new Promise<void>((res) => {
              (e as FileSystemFileEntry).file((f) => {
                if (isAccepted(f)) files.push(f)
                res()
              })
            })
          } else if (e.isDirectory) {
            const nested = await readDirectory(e as FileSystemDirectoryEntry)
            files.push(...nested)
          }
        }
        readBatch()
      })
    }

    readBatch()
  })
}

export default function KnowledgePage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [selectedBotId, setSelectedBotId] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)

  const [staged, setStaged] = useState<StagedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkSubcategory, setBulkSubcategory] = useState('')
  const [bulkParseMode, setBulkParseMode] = useState<'chunks' | 'qna'>('chunks')
  const [view, setView] = useState<'list' | 'tree'>('list')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [faqPanel, setFaqPanel] = useState<{ docId: string; filename: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  // ── Bots
  useEffect(() => {
    fetch('/api/bots')
      .then((r) => r.json())
      .then((data) => {
        const list: Bot[] = data.bots ?? []
        setBots(list)
        if (list.length === 1) setSelectedBotId(list[0].id)
      })
      .catch(() => {})
  }, [])

  // ── Documents
  const fetchDocuments = useCallback(async (botId: string) => {
    setLoadingDocs(true)
    try {
      const res = await fetch(`/api/documents/${botId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDocuments(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Failed to load documents')
      setDocuments([])
    } finally {
      setLoadingDocs(false)
    }
  }, [])

  useEffect(() => {
    if (selectedBotId) fetchDocuments(selectedBotId)
    else setDocuments([])
  }, [selectedBotId, fetchDocuments])

  // ── Stage files
  function stageFiles(files: File[]) {
    const accepted = files.filter(isAccepted)
    const rejected = files.length - accepted.length
    if (rejected > 0) toast.error(`${rejected} file(s) skipped — only PDF, DOCX, TXT allowed`)
    if (!accepted.length) return
    setStaged((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        uid: uid(),
        file,
        category: 'Other',
        subcategory: '',
        parseMode: 'chunks' as const,
        progress: 'idle' as const,
      })),
    ])
  }

  // ── File input change
  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    stageFiles(files)
    e.target.value = ''
  }

  // ── Drag & drop
  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDragging(false)

    const allFiles: File[] = []
    const items = Array.from(e.dataTransfer.items)

    for (const item of items) {
      const entry = item.webkitGetAsEntry?.()
      if (!entry) continue
      if (entry.isDirectory) {
        const nested = await readDirectory(entry as FileSystemDirectoryEntry)
        allFiles.push(...nested)
      } else if (entry.isFile) {
        const file = item.getAsFile()
        if (file) allFiles.push(file)
      }
    }

    stageFiles(allFiles)
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault()
    dragCounterRef.current++
    setIsDragging(true)
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragging(false)
  }

  // ── Bulk apply
  function applyBulkCategory() {
    if (!bulkCategory) return
    setStaged((prev) => prev.map((s) => ({ ...s, category: bulkCategory })))
  }

  function applyBulkSubcategory() {
    setStaged((prev) => prev.map((s) => ({ ...s, subcategory: bulkSubcategory })))
  }

  function applyBulkParseMode() {
    setStaged((prev) => prev.map((s) => ({ ...s, parseMode: bulkParseMode })))
  }

  // ── Upload all staged files (sequential)
  async function uploadAll() {
    if (!selectedBotId || !staged.length) return
    setUploading(true)

    for (const sf of staged) {
      setStaged((prev) =>
        prev.map((s) => (s.uid === sf.uid ? { ...s, progress: 'uploading' } : s))
      )

      try {
        // Step 1: init
        const contentType = getFileContentType(sf.file)

        const initRes = await fetch(`/api/ingest/${selectedBotId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: sf.file.name,
            category: sf.category,
            subcategory: sf.subcategory || undefined,
            contentType,
            parseMode: sf.parseMode,
          }),
        })
        if (!initRes.ok) {
          const err = await initRes.json().catch(() => ({}))
          throw new Error(err.error ?? `Init failed (${initRes.status})`)
        }
        const { documentId, signedUrl } = await initRes.json()

        // Step 2: storage upload
        const uploadRes = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: sf.file,
        })
        if (!uploadRes.ok) throw new Error('Storage upload failed')

        // Step 3: process
        const processRes = await fetch(`/api/ingest/${selectedBotId}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId }),
        })
        if (!processRes.ok) {
          const err = await processRes.json()
          throw new Error(err.error ?? 'Processing failed')
        }

        setStaged((prev) =>
          prev.map((s) => (s.uid === sf.uid ? { ...s, progress: 'done' } : s))
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed'
        setStaged((prev) =>
          prev.map((s) => (s.uid === sf.uid ? { ...s, progress: 'error', error: msg } : s))
        )
      }
    }

    setUploading(false)
    toast.success('Upload complete')
    setTimeout(() => {
      setStaged([])
      fetchDocuments(selectedBotId)
    }, 800)
  }

  // ── Retry processing
  async function handleRetry(documentId: string) {
    if (!selectedBotId) return
    setRetryingId(documentId)
    try {
      const res = await fetch(`/api/ingest/${selectedBotId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Processing failed (${res.status})`)
      toast.success(`Processed — ${data.chunkCount} chunks created`)
      fetchDocuments(selectedBotId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Retry failed'
      toast.error(msg)
    } finally {
      setRetryingId(null)
    }
  }

  // ── Delete
  async function handleDelete(documentId: string) {
    if (!selectedBotId) return
    setDeletingId(documentId)
    try {
      const res = await fetch(`/api/documents/${selectedBotId}/${documentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      setDocuments((prev) => prev.filter((d) => d.id !== documentId))
      toast.success('Document deleted.')
    } catch {
      toast.error('Failed to delete document')
    } finally {
      setDeletingId(null)
    }
  }

  // ── Tree: group documents by category > subcategory
  const categoryTree = documents.reduce<
    Record<string, Record<string, Document[]>>
  >((acc, doc) => {
    const cat = doc.category || 'Other'
    const sub = doc.subcategory || '—'
    if (!acc[cat]) acc[cat] = {}
    if (!acc[cat][sub]) acc[cat][sub] = []
    acc[cat][sub].push(doc)
    return acc
  }, {})

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  function toggleSubcategory(key: string) {
    setExpandedSubcategories((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const hasStagedIdle = staged.some((s) => s.progress === 'idle')

  return (
    <div className="space-y-6">
      <Toaster />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Knowledge Base</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload documents (PDF, DOCX, TXT). Use <strong>Chunks</strong> mode for regular documents or <strong>Q&amp;A</strong> mode to parse scripts into Q&amp;A pairs (FAQ format).
          </p>
        </div>
        {selectedBotId && !staged.length && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDocuments(selectedBotId)}
            disabled={loadingDocs}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loadingDocs ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>

      {/* Bot selector */}
      <div className="space-y-1">
        <Label className="text-sm font-medium">Select a bot:</Label>
        <Select value={selectedBotId} onValueChange={setSelectedBotId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Choose a bot..." />
          </SelectTrigger>
          <SelectContent>
            {bots.map((bot) => (
              <SelectItem key={bot.id} value={bot.id}>
                {bot.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedBotId && (
        <>
          {/* Drop Zone */}
          <div
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className={`relative rounded-xl border-2 border-dashed transition-colors p-8 text-center cursor-pointer
              ${isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">
              {isDragging ? 'Drop files or folders here' : 'Drag & drop files or folders here'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or{' '}
              <span
                className="underline cursor-pointer"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
              >
                browse files
              </span>
              {' '}·{' '}
              <span
                className="underline cursor-pointer"
                onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click() }}
              >
                browse folder
              </span>
              {' '}· PDF, DOCX, TXT
            </p>
            {/* Hidden inputs — onClick stopPropagation prevents programmatic .click() from bubbling to the outer div and triggering the file picker twice */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              multiple
              className="hidden"
              onClick={(e) => e.stopPropagation()}
              onChange={onFileInputChange}
            />
            <input
              ref={folderInputRef}
              type="file"
              // @ts-expect-error — webkitdirectory is non-standard
              webkitdirectory=""
              multiple
              className="hidden"
              onClick={(e) => e.stopPropagation()}
              onChange={onFileInputChange}
            />
          </div>

          {/* Staged files panel */}
          {staged.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    Staged ({staged.length} file{staged.length !== 1 ? 's' : ''})
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setStaged([])}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear all
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Bulk apply row */}
                <div className="flex flex-wrap gap-2 items-end p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground w-full mb-1">
                    Apply to all:
                  </p>
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="space-y-1">
                      <Label className="text-xs">Category</Label>
                      <Select value={bulkCategory} onValueChange={setBulkCategory}>
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue placeholder="Pick category..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={!bulkCategory}
                      onClick={applyBulkCategory}
                    >
                      Apply
                    </Button>
                    <div className="space-y-1">
                      <Label className="text-xs">Subcategory</Label>
                      <Input
                        className="h-8 w-40"
                        placeholder="e.g. Skincare"
                        value={bulkSubcategory}
                        onChange={(e) => setBulkSubcategory(e.target.value)}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={applyBulkSubcategory}
                    >
                      Apply
                    </Button>
                    <div className="space-y-1">
                      <Label className="text-xs">Parse Mode</Label>
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={bulkParseMode}
                        onChange={(e) => setBulkParseMode(e.target.value as 'chunks' | 'qna')}
                      >
                        <option value="chunks">Chunks (default)</option>
                        <option value="qna">Q&amp;A Script</option>
                      </select>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={applyBulkParseMode}
                    >
                      Apply
                    </Button>
                  </div>
                </div>

                {/* Per-file rows */}
                <div className="divide-y border rounded-lg overflow-hidden">
                  {staged.map((sf) => (
                    <div
                      key={sf.uid}
                      className={`flex items-center gap-3 px-3 py-2.5 text-sm
                        ${sf.progress === 'done' ? 'bg-green-50' : ''}
                        ${sf.progress === 'error' ? 'bg-red-50' : ''}
                        ${sf.progress === 'uploading' ? 'bg-blue-50' : ''}
                      `}
                    >
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 truncate text-xs font-mono">{sf.file.name}</span>

                      {sf.progress === 'idle' && (
                        <>
                          <Select
                            value={sf.category}
                            onValueChange={(v) =>
                              setStaged((prev) =>
                                prev.map((s) => s.uid === sf.uid ? { ...s, category: v } : s)
                              )
                            }
                          >
                            <SelectTrigger className="h-7 w-36 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            className="h-7 w-32 text-xs"
                            placeholder="Subcategory"
                            value={sf.subcategory}
                            onChange={(e) =>
                              setStaged((prev) =>
                                prev.map((s) =>
                                  s.uid === sf.uid ? { ...s, subcategory: e.target.value } : s
                                )
                              )
                            }
                          />
                          <select
                            className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                            value={sf.parseMode}
                            onChange={(e) =>
                              setStaged((prev) =>
                                prev.map((s) =>
                                  s.uid === sf.uid ? { ...s, parseMode: e.target.value as 'chunks' | 'qna' } : s
                                )
                              )
                            }
                          >
                            <option value="chunks">Chunks</option>
                            <option value="qna">Q&amp;A</option>
                          </select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                            onClick={() =>
                              setStaged((prev) => prev.filter((s) => s.uid !== sf.uid))
                            }
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}

                      {sf.progress === 'uploading' && (
                        <span className="text-xs text-blue-600 flex-shrink-0">Uploading…</span>
                      )}
                      {sf.progress === 'done' && (
                        <span className="text-xs text-green-600 flex-shrink-0">Done</span>
                      )}
                      {sf.progress === 'error' && (
                        <span className="text-xs text-red-600 flex-shrink-0 truncate max-w-[160px]">
                          {sf.error ?? 'Error'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Upload button */}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStaged([])}
                    disabled={uploading}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={uploadAll}
                    disabled={uploading || !hasStagedIdle}
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload All ({staged.filter((s) => s.progress === 'idle').length})
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* View toggle + document library */}
          {!staged.length && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {documents.length} document{documents.length !== 1 ? 's' : ''}
                </p>
                <div className="flex gap-1 border rounded-md p-0.5">
                  <Button
                    variant={view === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setView('list')}
                  >
                    <LayoutList className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={view === 'tree' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setView('tree')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* ── LIST VIEW ── */}
              {view === 'list' && (
                <Card>
                  <CardContent className="p-0">
                    {loadingDocs ? (
                      <div className="space-y-2 p-4">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="h-10 animate-pulse bg-muted rounded" />
                        ))}
                      </div>
                    ) : documents.length === 0 ? (
                      <EmptyState />
                    ) : (
                      <div className="divide-y">
                        {documents.map((doc) => (
                          <DocRow
                            key={doc.id}
                            doc={doc}
                            deletingId={deletingId}
                            onDelete={handleDelete}
                            retryingId={retryingId}
                            onRetry={handleRetry}
                            onViewFaqs={(id, name) => setFaqPanel({ docId: id, filename: name })}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── TREE VIEW ── */}
              {view === 'tree' && (
                <div className="space-y-2">
                  {loadingDocs ? (
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-12 animate-pulse bg-muted rounded-lg" />
                      ))}
                    </div>
                  ) : documents.length === 0 ? (
                    <Card>
                      <CardContent className="p-0">
                        <EmptyState />
                      </CardContent>
                    </Card>
                  ) : (
                    Object.entries(categoryTree).map(([cat, subcats]) => {
                      const isExpanded = expandedCategories.has(cat)
                      const totalDocs = Object.values(subcats).flat().length
                      const totalChunks = Object.values(subcats)
                        .flat()
                        .reduce((sum, d) => sum + (d.chunk_count ?? 0), 0)

                      return (
                        <Card key={cat} className="overflow-hidden">
                          <button
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                            onClick={() => toggleCategory(cat)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <FolderOpen className="h-4 w-4 text-amber-500 flex-shrink-0" />
                            <span className="font-medium text-sm flex-1">{cat}</span>
                            <span className="text-xs text-muted-foreground">
                              {totalDocs} file{totalDocs !== 1 ? 's' : ''}
                              {totalChunks > 0 && ` · ${totalChunks} chunks`}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="border-t divide-y">
                              {Object.entries(subcats).map(([sub, docs]) => {
                                const subKey = `${cat}::${sub}`
                                const isSubExpanded = expandedSubcategories.has(subKey)
                                const subChunks = docs.reduce(
                                  (sum, d) => sum + (d.chunk_count ?? 0),
                                  0
                                )

                                return (
                                  <div key={sub}>
                                    <button
                                      className="w-full flex items-center gap-3 pl-10 pr-4 py-2.5 hover:bg-muted/30 transition-colors text-left bg-muted/10"
                                      onClick={() => toggleSubcategory(subKey)}
                                    >
                                      {isSubExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                      )}
                                      <span className="text-sm flex-1">
                                        {sub === '—' ? (
                                          <span className="text-muted-foreground italic">Uncategorized</span>
                                        ) : (
                                          sub
                                        )}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {docs.length} file{docs.length !== 1 ? 's' : ''}
                                        {subChunks > 0 && ` · ${subChunks} chunks`}
                                      </span>
                                    </button>

                                    {isSubExpanded && (
                                      <div className="divide-y">
                                        {docs.map((doc) => (
                                          <DocRow
                                            key={doc.id}
                                            doc={doc}
                                            deletingId={deletingId}
                                            onDelete={handleDelete}
                                            retryingId={retryingId}
                                            onRetry={handleRetry}
                                            onViewFaqs={(id, name) => setFaqPanel({ docId: id, filename: name })}
                                            indent
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </Card>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!selectedBotId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">Select a bot to manage its knowledge base.</p>
          </CardContent>
        </Card>
      )}

      {faqPanel && (
        <FaqPanel
          botId={selectedBotId}
          docId={faqPanel.docId}
          filename={faqPanel.filename}
          onClose={() => setFaqPanel(null)}
        />
      )}
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <FileText className="h-8 w-8 text-muted-foreground mb-3" />
      <p className="text-sm font-semibold">No documents yet</p>
      <p className="mt-1 text-xs text-muted-foreground max-w-xs">
        Drop files or a folder into the zone above to get started.
      </p>
    </div>
  )
}

function DocRow({
  doc,
  deletingId,
  onDelete,
  retryingId,
  onRetry,
  onViewFaqs,
  indent = false,
}: {
  doc: Document
  deletingId: string | null
  onDelete: (id: string) => void
  retryingId: string | null
  onRetry: (id: string) => void
  onViewFaqs?: (docId: string, filename: string) => void
  indent?: boolean
}) {
  const badge = STATUS_BADGE[doc.status] ?? STATUS_BADGE.pending
  const canRetry = doc.status === 'pending' || doc.status === 'failed' || doc.status === 'error'
  return (
    <div
      className={`flex items-center justify-between py-3 gap-3 ${indent ? 'pl-14 pr-4' : 'px-4'}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{doc.filename}</p>
          <p className="text-xs text-muted-foreground">
            {doc.category}
            {doc.subcategory && ` › ${doc.subcategory}`}
            {doc.chunk_count != null && ` · ${doc.chunk_count} ${doc.parse_mode === 'qna' ? 'Q&A pairs' : 'chunks'}`}
            {doc.error_message && (
              <span className="text-red-500"> · {doc.error_message}</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge className={`text-xs ${badge.className} hover:${badge.className}`}>
          {badge.label}
        </Badge>
        {doc.parse_mode === 'qna' && doc.status === 'ready' && onViewFaqs && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            onClick={() => onViewFaqs(doc.id, doc.filename)}
            title="View & edit parsed FAQs"
          >
            <MessageSquareText className="h-4 w-4" />
          </Button>
        )}
        {canRetry && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-blue-600"
            disabled={retryingId === doc.id}
            onClick={() => onRetry(doc.id)}
            aria-label={`Retry processing ${doc.filename}`}
            title="Retry processing"
          >
            <RotateCcw className={`h-4 w-4 ${retryingId === doc.id ? 'animate-spin' : ''}`} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          disabled={deletingId === doc.id}
          onClick={() => onDelete(doc.id)}
          aria-label={`Delete ${doc.filename}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ── FAQ Panel (slide-over) ──────────────────────────────────────────────────

function FaqPanel({
  botId,
  docId,
  filename,
  onClose,
}: {
  botId: string
  docId: string
  filename: string
  onClose: () => void
}) {
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQ, setEditQ] = useState('')
  const [editA, setEditA] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newQ, setNewQ] = useState('')
  const [newA, setNewA] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/config/${botId}/faqs?source_document_id=${docId}`)
      .then((r) => r.json())
      .then((d) => setFaqs(d.faqs ?? []))
      .catch(() => toast.error('Failed to load FAQs'))
      .finally(() => setLoading(false))
  }, [botId, docId])

  function startEdit(faq: Faq) {
    setEditingId(faq.id)
    setEditQ(faq.question)
    setEditA(faq.answer)
  }

  async function saveEdit(faqId: string, language: string) {
    if (!editQ.trim() || !editA.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/config/${botId}/faqs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faqId, question: editQ.trim(), answer: editA.trim(), language }),
      })
      if (!res.ok) throw new Error()
      setFaqs((prev) =>
        prev.map((f) => (f.id === faqId ? { ...f, question: editQ.trim(), answer: editA.trim() } : f))
      )
      setEditingId(null)
      toast.success('FAQ updated')
    } catch {
      toast.error('Failed to save FAQ')
    } finally {
      setSaving(false)
    }
  }

  async function deleteFaq(faqId: string) {
    setDeletingId(faqId)
    try {
      const res = await fetch(`/api/config/${botId}/faqs`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faqId }),
      })
      if (!res.ok) throw new Error()
      setFaqs((prev) => prev.filter((f) => f.id !== faqId))
      toast.success('FAQ deleted')
    } catch {
      toast.error('Failed to delete FAQ')
    } finally {
      setDeletingId(null)
    }
  }

  async function addFaq() {
    if (!newQ.trim() || !newA.trim()) return
    setAddSaving(true)
    try {
      const res = await fetch(`/api/config/${botId}/faqs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: newQ.trim(), answer: newA.trim(), language: 'en' }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      setFaqs((prev) => [created, ...prev])
      setNewQ('')
      setNewA('')
      setAdding(false)
      toast.success('FAQ added')
    } catch {
      toast.error('Failed to add FAQ')
    } finally {
      setAddSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-background border-l shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">FAQs — {filename}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? 'Loading…' : `${faqs.length} Q&A pair${faqs.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* FAQ list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-4 animate-pulse bg-muted rounded w-3/4" />
                  <div className="h-8 animate-pulse bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : faqs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <MessageSquareText className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No FAQs found</p>
              <p className="text-xs text-muted-foreground mt-1">Add one below or re-process the document.</p>
            </div>
          ) : (
            <div className="divide-y">
              {faqs.map((faq, idx) => (
                <div key={faq.id} className="px-5 py-4 group">
                  {editingId === faq.id ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-muted-foreground">Question</Label>
                        <Textarea
                          className="text-sm resize-none"
                          rows={2}
                          value={editQ}
                          onChange={(e) => setEditQ(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-muted-foreground">Answer</Label>
                        <Textarea
                          className="text-sm resize-none"
                          rows={3}
                          value={editA}
                          onChange={(e) => setEditA(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveEdit(faq.id, faq.language)}
                          disabled={saving || !editQ.trim() || !editA.trim()}
                        >
                          {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">#{idx + 1}</p>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-primary"
                            onClick={() => startEdit(faq)}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            disabled={deletingId === faq.id}
                            onClick={() => deleteFaq(faq.id)}
                            title="Delete"
                          >
                            {deletingId === faq.id
                              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />
                            }
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm font-medium leading-snug">{faq.question}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add FAQ */}
        <div className="border-t px-5 py-4 space-y-3">
          {adding ? (
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Question</Label>
                <Textarea
                  className="text-sm resize-none"
                  rows={2}
                  placeholder="e.g. What is GenQi?"
                  value={newQ}
                  onChange={(e) => setNewQ(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Answer</Label>
                <Textarea
                  className="text-sm resize-none"
                  rows={3}
                  placeholder="e.g. GenQi is a wellness facility..."
                  value={newA}
                  onChange={(e) => setNewA(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setAdding(false); setNewQ(''); setNewA('') }}
                  disabled={addSaving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={addFaq}
                  disabled={addSaving || !newQ.trim() || !newA.trim()}
                >
                  {addSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                  Add FAQ
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add FAQ
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
