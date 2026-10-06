// ====================================================================
// G-TECH ISP OPERATING SYSTEM
// Supabase Middleware & Route Guard
// Refreshes session and protects dashboard routes gracefully.
// Never throws 500 errors.
// ====================================================================

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/customers",
  "/routers",
  "/vouchers",
  "/billing",
  "/plans",
  "/monitoring",
  "/technicians",
  "/settings",
];

const AUTH_ROUTES = ["/sign-in", "/register"];

export async function updateSupabaseSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // 1. Check Demo Mode indicators (query param or cookie)
  const isDemoQuery = request.nextUrl.searchParams.get("demo") === "true";
  const isDemoCookie = request.cookies.get("gtech_demo_mode")?.value === "true";
  const isDemoActive = isDemoQuery || isDemoCookie;

  // 2. Initialize Supabase SSR client safely
  let user = null;

  try {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.error("[Middleware] Non-fatal auth session check error:", err);
  }

  // 3. Protected Route Enforcement
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute && !user && !isDemoActive) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 4. Already Authenticated User Redirect (from /sign-in or /register to /dashboard)
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  if (isAuthRoute && user && !isDemoQuery) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
