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
} from 'lucide-react'
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
}

interface StagedFile {
  uid: string
  file: File
  category: string
  subcategory: string
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
  const [view, setView] = useState<'list' | 'tree'>('list')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
            Upload documents (PDF, DOCX, TXT) — they are chunked and embedded for RAG retrieval.
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
  indent = false,
}: {
  doc: Document
  deletingId: string | null
  onDelete: (id: string) => void
  indent?: boolean
}) {
  const badge = STATUS_BADGE[doc.status] ?? STATUS_BADGE.pending
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
            {doc.chunk_count != null && ` · ${doc.chunk_count} chunks`}
            {doc.error_message && ` · ${doc.error_message}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge className={`text-xs ${badge.className} hover:${badge.className}`}>
          {badge.label}
        </Badge>
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
