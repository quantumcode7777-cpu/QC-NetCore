<<<<<<< HEAD
// ====================================================================
// QC NETCORE OPERATING SYSTEM
=======
// ============================================================================
// G-TECH ISP OPERATING SYSTEM
>>>>>>> 0ff4c6be7968271c4202d99ed7dc1bc6924d004e
// Supabase Browser Client
// Use this ONLY in Client Components ('use client').
// Never use this for privileged/server-only operations.
// Uses the public ANON key - safe to expose to the browser.
// ============================================================================

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

// Alias export to maintain backward compatibility with components using createClient()
export function createClient() {
  return createSupabaseBrowserClient()
}
