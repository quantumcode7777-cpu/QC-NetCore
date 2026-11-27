import { jsonError, type AnyClient } from "@/lib/captive/server";

/** Session-bound Supabase client + organization ID, reused by sites routes. */
export async function getOrgClient() {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false as const,
      response: jsonError(401, "UNAUTHENTICATED", "Sign in to manage network sites."),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  const orgId = profile?.organization_id ? String(profile.organization_id) : null;
  if (!orgId) {
    return {
      ok: false as const,
      response: jsonError(403, "NO_ORGANIZATION", "No organization is linked to this account."),
    };
  }

  return {
    ok: true as const,
    supabase: supabase as unknown as AnyClient,
    orgId,
    userId: user.id,
  };
}
