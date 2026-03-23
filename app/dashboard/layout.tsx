import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = profile?.role === 'super_admin'

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
          {isSuperAdmin && (
            <>
              <div className="pt-2 pb-1">
                <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Super Admin
                </p>
              </div>
              <a
                href="/dashboard/admin/users"
                className="block px-3 py-2 rounded-md hover:bg-muted"
              >
                Users
              </a>
            </>
          )}
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <Suspense>{children}</Suspense>
      </main>
    </div>
  )
}
