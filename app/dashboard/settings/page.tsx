'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  User,
  MessageSquare,
  ShieldCheck,
  FileText,
  Key,
  Plug,
  CalendarDays,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Bot {
  id: string
  name: string
}

const BOT_SETTINGS = [
  {
    key: 'personality',
    label: 'Personality',
    description: 'Bot name, greetings per language, tone, fallback message',
    icon: User,
  },
  {
    key: 'faqs',
    label: 'FAQs',
    description: 'Manage FAQ entries in English, Bahasa Malaysia, and Chinese',
    icon: MessageSquare,
  },
  {
    key: 'templates',
    label: 'Response Templates',
    description: 'Pre-defined responses for intents like slot_full, booking_confirmed, etc.',
    icon: FileText,
  },
  {
    key: 'guardrails',
    label: 'Guardrails',
    description: 'Blocked topics, disclaimers, off-topic deflection, response length',
    icon: ShieldCheck,
  },
  {
    key: 'api-keys',
    label: 'API Keys',
    description: 'Generate and revoke API keys for webhook access',
    icon: Key,
  },
  {
    key: 'integrations',
    label: 'Integrations',
    description: 'n8n copy-paste snippets for WhatsApp and Telegram',
    icon: Plug,
  },
  {
    key: 'booking',
    label: 'Booking Config',
    description: 'Facility availability, location constraints, booking module toggle',
    icon: CalendarDays,
  },
]

export default function SettingsPage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/bots')
      .then((r) => r.json())
      .then((data) => setBots(data.bots ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Loading bots...</p>
      </div>
    )
  }

  if (bots.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          No bots found. Settings are configured per bot.
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard/bots">Go to Bots</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All settings are configured per bot. Select a bot below to manage its configuration.
        </p>
      </div>

      {bots.map((bot) => (
        <div key={bot.id}>
          <h2 className="text-base font-semibold mb-3">{bot.name}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BOT_SETTINGS.map((setting) => {
              const Icon = setting.icon
              return (
                <Link
                  key={setting.key}
                  href={`/dashboard/bots/${bot.id}/${setting.key}`}
                  className="block group"
                >
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium group-hover:text-primary transition-colors">
                            {setting.label}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                            {setting.description}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
