// ====================================================================
// G-TECH ISP OPERATING SYSTEM
// Next.js Middleware
// Refreshes Supabase Auth sessions on every request.
// Preserves all existing routes and does not enforce auth redirects
// (the application uses client-side auth state checks currently).
// ====================================================================

import { type NextRequest } from 'next/server'
import { updateSupabaseSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSupabaseSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, manifest.json (browser files)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
