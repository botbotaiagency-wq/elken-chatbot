'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { TenantInvite } from '@/types/database'

interface InviteData {
  invite: TenantInvite
  tenant_name?: string
}

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [invite, setInvite] = useState<InviteData | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)

  useEffect(() => {
    async function validateToken() {
      const res = await fetch(`/api/onboarding/invite/${token}`)
      if (!res.ok) {
        const { error } = await res.json()
        setFetchError(error ?? 'Invalid or expired invite link.')
      } else {
        const data: InviteData = await res.json()
        setInvite(data)
      }
      setValidating(false)
    }
    validateToken()
  }, [token])

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault()
    if (!invite) return

    setLoading(true)
    setError(null)

    const res = await fetch(`/api/onboarding/invite/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, password }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to accept invite.')
      setLoading(false)
      return
    }

    // Sign in with the new credentials
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invite.invite.email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    router.push('/onboarding/create-bot')
  }

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Validating invite...</p>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm space-y-4 p-8 text-center">
          <h1 className="text-xl font-bold text-red-500">Invite Invalid</h1>
          <p className="text-sm text-muted-foreground">{fetchError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">You&apos;re Invited</h1>
          <p className="text-sm text-muted-foreground">
            {invite?.tenant_name
              ? `Join ${invite.tenant_name} on BotBase`
              : 'Create your BotBase account'}
          </p>
          <p className="text-xs text-muted-foreground">{invite?.invite.email}</p>
        </div>

        <form onSubmit={handleAccept} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="fullName" className="text-sm font-medium">Full Name</label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
              minLength={8}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Accept Invite & Get Started'}
          </button>
        </form>
      </div>
    </div>
  )
}
