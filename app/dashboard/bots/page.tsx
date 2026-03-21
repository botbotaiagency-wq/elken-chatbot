'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Bot {
  id: string
  name: string
  feature_flags: Record<string, unknown>
  created_at: string
  tenant_id: string
}

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/bots')
      .then((res) => res.json())
      .then((data) => setBots(data.bots ?? []))
      .catch(() => {
        // silent — page starts empty on error
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Loading bots...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Bots</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your chatbots</p>
      </div>

      {bots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-base font-semibold">No bots configured</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Create a bot to get started. Contact your super-admin if you need assistance.
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
    </div>
  )
}
