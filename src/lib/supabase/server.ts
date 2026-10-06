// ====================================================================
// G-TECH ISP OPERATING SYSTEM
// Supabase Server Client
// Use this in Server Components, Route Handlers, and Server Actions.
// Reads the auth session from cookies automatically.
// Never expose the service_role key through this client.
// ====================================================================

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'

export async function createSupabaseServerClient() {
  let cookieStore: any = null
  try {
    cookieStore = await cookies()
  } catch {
    // Static build analysis pass
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore ? cookieStore.getAll() : []
        },
        setAll(cookiesToSet) {
          if (!cookieStore) return
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method is called from a Server Component.
          }
        },
      },
    }
  )
}

/**
 * Service-role Supabase client for privileged server-side operations.
 *
 * CRITICAL SECURITY RULES:
 * - NEVER use this client in any code that runs in the browser.
 * - NEVER import this into Client Components.
 * - NEVER expose SUPABASE_SERVICE_ROLE_KEY to the client bundle.
 * - Use ONLY for: payment callbacks, network provisioning,
 *   admin operations, and scheduled server-side tasks.
 */
export function createSupabaseServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-service-key';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';

  return createClient<Database>(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
