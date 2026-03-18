import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <>{children}</>
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-muted/40 p-4">
        <h2 className="text-lg font-semibold mb-4">Dashboard</h2>
        <nav className="space-y-2">
          <a href="/dashboard" className="block px-3 py-2 rounded-md hover:bg-muted">Overview</a>
          <a href="/dashboard/bots" className="block px-3 py-2 rounded-md hover:bg-muted">Bots</a>
          <a href="/dashboard/knowledge" className="block px-3 py-2 rounded-md hover:bg-muted">Knowledge Base</a>
          <a href="/dashboard/bookings" className="block px-3 py-2 rounded-md hover:bg-muted">Bookings</a>
          <a href="/dashboard/analytics" className="block px-3 py-2 rounded-md hover:bg-muted">Analytics</a>
          <a href="/dashboard/settings" className="block px-3 py-2 rounded-md hover:bg-muted">Settings</a>
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <Suspense>
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </main>
    </div>
  )
}
