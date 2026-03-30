'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Bot {
  id: string
  name: string
  feature_flags: Record<string, unknown>
  created_at: string
  tenant_id: string
}

interface Tenant {
  id: string
  name: string
}

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newBotName, setNewBotName] = useState('')
  const [newBotTenant, setNewBotTenant] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/bots').then((r) => r.json()),
      fetch('/api/admin/users').then((r) => r.json()),
    ])
      .then(([botsData, adminData]) => {
        setBots(botsData.bots ?? [])
        if (!adminData.error) {
          setTenants(adminData.tenants ?? [])
          setIsSuperAdmin(true)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate() {
    setError('')
    if (!newBotName.trim()) { setError('Bot name is required'); return }
    if (!newBotTenant) { setError('Tenant is required'); return }

    setCreating(true)
    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBotName.trim(), tenant_id: newBotTenant }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create bot'); return }
      setBots((prev) => [...prev, data.bot])
      setDialogOpen(false)
      setNewBotName('')
      setNewBotTenant('')
    } catch {
      setError('Failed to create bot')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Loading bots...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Bots</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your chatbots</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setDialogOpen(true)}>New Bot</Button>
        )}
      </div>

      {bots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-base font-semibold">No bots configured</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              {isSuperAdmin
                ? 'Click "New Bot" above to create your first bot.'
                : 'Contact your super-admin if you need assistance.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => {
            const isActive =
              bot.feature_flags && Object.values(bot.feature_flags).some(Boolean)

            return (
              <Card key={bot.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">{bot.name}</CardTitle>
                  {isActive ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-muted-foreground">
                      Active
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link href={`/dashboard/bots/${bot.id}/personality`}>Configure Bot</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Bot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bot Name</label>
              <Input
                placeholder="e.g. Elken Support Bot"
                value={newBotName}
                onChange={(e) => setNewBotName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tenant</label>
              <Select value={newBotTenant} onValueChange={setNewBotTenant}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create Bot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
