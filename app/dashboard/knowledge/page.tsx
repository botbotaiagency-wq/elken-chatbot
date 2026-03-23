'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Upload, Trash2, FileText, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Toaster } from '@/components/ui/sonner'

interface Bot {
  id: string
  name: string
}

interface Document {
  id: string
  filename: string
  category: string
  status: 'pending' | 'processing' | 'ready' | 'error'
  chunk_count: number | null
  error_message: string | null
  created_at: string
}

const CATEGORIES = [
  'Beauty',
  'FMCG',
  'GenQi',
  'Healthfood',
  'Home Appliances',
  'Other',
] as const

const STATUS_BADGE: Record<Document['status'], { label: string; className: string }> = {
  pending:    { label: 'Pending',    className: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800' },
  ready:      { label: 'Ready',      className: 'bg-green-100 text-green-800' },
  error:      { label: 'Error',      className: 'bg-red-100 text-red-800' },
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function KnowledgePage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [selectedBotId, setSelectedBotId] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadCategory, setUploadCategory] = useState<string>('Other')
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function handleUpload() {
    if (!uploadFile || !selectedBotId) return
    setUploading(true)
    try {
      // Step 1: Get signed upload URL
      const initRes = await fetch(`/api/ingest/${selectedBotId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: uploadFile.name,
          category: uploadCategory,
          contentType: uploadFile.type || 'text/plain',
        }),
      })
      if (!initRes.ok) {
        const err = await initRes.json()
        throw new Error(err.error ?? 'Failed to initiate upload')
      }
      const { documentId, signedUrl } = await initRes.json()

      // Step 2: Upload file to Supabase Storage
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': uploadFile.type || 'application/octet-stream' },
        body: uploadFile,
      })
      if (!uploadRes.ok) throw new Error('Storage upload failed')

      // Step 3: Trigger processing (extract → chunk → embed)
      const processRes = await fetch(`/api/ingest/${selectedBotId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })
      if (!processRes.ok) {
        const err = await processRes.json()
        throw new Error(err.error ?? 'Processing failed')
      }

      toast.success(`${uploadFile.name} uploaded and processing.`)
      setUploadOpen(false)
      setUploadFile(null)
      setUploadCategory('Other')
      fetchDocuments(selectedBotId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

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

  return (
    <div className="space-y-6">
      <Toaster />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Knowledge Base</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload documents (PDF, DOCX, TXT) — they are chunked and embedded for RAG retrieval.
          </p>
        </div>
        {selectedBotId && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDocuments(selectedBotId)}
              disabled={loadingDocs}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loadingDocs ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
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

      {/* Document list */}
      {selectedBotId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Documents {!loadingDocs && `(${documents.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingDocs ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-10 animate-pulse bg-muted rounded" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <FileText className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm font-semibold">No documents yet</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                  Upload a PDF, DOCX, or TXT file to populate the knowledge base for this bot.
                </p>
                <Button className="mt-4" size="sm" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {documents.map((doc) => {
                  const badge = STATUS_BADGE[doc.status] ?? STATUS_BADGE.pending
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between px-4 py-3 gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.category}
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
                          onClick={() => handleDelete(doc.id)}
                          aria-label={`Delete ${doc.filename}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="file-input">File (PDF, DOCX, TXT)</Label>
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadFile ? (
                  <div>
                    <FileText className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">{uploadFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatBytes(uploadFile.size)}
                    </p>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to select a file
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, DOCX, or TXT
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  id="file-input"
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
              {uploading ? 'Uploading...' : 'Upload & Process'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
