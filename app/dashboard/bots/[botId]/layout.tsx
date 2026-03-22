'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'

const TABS = [
  { label: 'Personality', path: 'personality' },
  { label: 'Guardrails', path: 'guardrails' },
  { label: 'FAQs', path: 'faqs' },
  { label: 'Templates', path: 'templates' },
  { label: 'Testing', path: 'testing' },
  { label: 'API Keys', path: 'api-keys' },
  { label: 'Integrations', path: 'integrations' },
  { label: 'Booking', path: 'booking' },
]

export default function BotDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { botId } = useParams() as { botId: string }
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 border-b">
        {TABS.map((tab) => {
          const href = `/dashboard/bots/${botId}/${tab.path}`
          const isActive = pathname.startsWith(href)

          return (
            <Link
              key={tab.path}
              href={href}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                isActive
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}
