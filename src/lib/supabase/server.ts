// ============================================================================
// G-TECH ISP OPERATING SYSTEM
// Supabase Server Client
// Use this ONLY in Server Components, Server Actions, or Route Handlers.
// Handles cookies for session management and provides fallback values during build time.
// ============================================================================

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be safely ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  )
}

// Alias export to maintain backward compatibility across your codebase
export async function createClient() {
  return createSupabaseServerClient()
}
