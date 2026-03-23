'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface User {
  id: string
  email: string
  full_name: string
  role: string
  tenant_id: string | null
  tenant_name: string
}

interface Tenant {
  id: string
  name: string
  slug: string
}

type Draft = { tenant_id: string | null; role: string }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((data) => {
        const fetchedUsers: User[] = data.users ?? []
        setUsers(fetchedUsers)
        setTenants(data.tenants ?? [])
        const init: Record<string, Draft> = {}
        for (const u of fetchedUsers) {
          init[u.id] = { tenant_id: u.tenant_id, role: u.role }
        }
        setDrafts(init)
      })
      .finally(() => setLoading(false))
  }, [])

  function setDraft(userId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [userId]: { ...prev[userId], ...patch } }))
  }

  async function save(user: User) {
    setSaving(user.id)
    const draft = drafts[user.id]
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, ...draft }),
    })
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? {
                ...u,
                role: draft.role,
                tenant_id: draft.tenant_id,
                tenant_name: tenants.find((t) => t.id === draft.tenant_id)?.name ?? '',
              }
            : u
        )
      )
    }
    setSaving(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Loading users...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Assign tenants and roles to platform users
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Tenant</th>
                  <th className="px-4 py-3 text-left font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                )}
                {users.map((user) => {
                  const draft = drafts[user.id] ?? { tenant_id: user.tenant_id, role: user.role }
                  const isDirty =
                    draft.tenant_id !== user.tenant_id || draft.role !== user.role

                  return (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="px-4 py-3">{user.full_name || '—'}</td>
                      <td className="px-4 py-3">
                        <Select
                          value={draft.role}
                          onValueChange={(v) => setDraft(user.id, { role: v })}
                        >
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tenant_admin">tenant_admin</SelectItem>
                            <SelectItem value="super_admin">super_admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={draft.tenant_id ?? 'none'}
                          onValueChange={(v) =>
                            setDraft(user.id, { tenant_id: v === 'none' ? null : v })
                          }
                        >
                          <SelectTrigger className="h-8 w-44">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Unassigned</SelectItem>
                            {tenants.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          disabled={!isDirty || saving === user.id}
                          onClick={() => save(user)}
                        >
                          {saving === user.id ? 'Saving…' : 'Save'}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
