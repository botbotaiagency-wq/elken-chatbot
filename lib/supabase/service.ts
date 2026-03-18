import { createClient } from '@supabase/supabase-js'

// API routes ONLY — server-side, NEVER expose to browser
// This client bypasses all RLS policies — use only for trusted server operations
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
