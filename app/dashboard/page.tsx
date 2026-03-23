'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Bot,
  BookOpen,
  CalendarCheck,
  BarChart3,
  Settings,
  MessageSquare,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Bot {
  id: string
  name: string
  feature_flags: Record<string, unknown>
  created_at: string
}

export default function DashboardPage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/bots')
      .then((r) => r.json())
      .then((data) => setBots(data.bots ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const quickLinks = [
    {
      title: 'Bots',
      description: 'Configure bot personality, FAQs, templates, and guardrails',
      icon: Bot,
      href: '/dashboard/bots',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Knowledge Base',
      description: 'Upload PDF, DOCX, and TXT documents for RAG retrieval',
      icon: BookOpen,
      href: '/dashboard/knowledge',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      title: 'Bookings',
      description: 'View and manage GenQi facility bookings',
      icon: CalendarCheck,
      href: '/dashboard/bookings',
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Analytics',
      description: 'Message volume, intent breakdown, and booking reports',
      icon: BarChart3,
      href: '/dashboard/analytics',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      title: 'Settings',
      description: 'API keys, integrations, and per-bot configuration',
      icon: Settings,
      href: '/dashboard/settings',
      color: 'text-gray-600',
      bg: 'bg-gray-50',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome to your chatbot dashboard.
        </p>
      </div>

      {/* Bot summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Bots
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {loading ? (
                <span className="h-8 w-8 animate-pulse bg-muted rounded inline-block" />
              ) : (
                bots.length
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configured bots */}
      {!loading && bots.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3">Your Bots</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bots.map((bot) => (
              <Card key={bot.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold">{bot.name}</CardTitle>
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                    Active
                  </Badge>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/bots/${bot.id}/personality`}>
                      Configure
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick navigation */}
      <div>
        <h2 className="text-base font-semibold mb-3">Navigate</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link key={link.href} href={link.href} className="block group">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-lg p-2 ${link.bg}`}>
                        <Icon className={`h-5 w-5 ${link.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                          {link.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                          {link.description}
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
    </div>
  )
}
