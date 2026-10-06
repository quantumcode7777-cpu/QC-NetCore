import { NextRequest, NextResponse } from "next/server";
import { SEED_ORGANIZATION } from "@/lib/db/mock-db";
import {
  DEFAULT_DEMO_HOTSPOT_PLANS,
  getDefaultDemoPortalConfig,
  getDefaultPortalConfig,
  resolveTenantKey,
  sanitizePortalConfig,
  AUTH_METHOD_REGISTRY,
} from "@/lib/captive/config";
import {
  PLAN_COLUMNS,
  SUPABASE_READY,
  assetValidatorFor,
  isDemoRequest,
  jsonError,
  mapPlanRows,
  type AnyClient,
} from "@/lib/captive/server";

export const dynamic = "force-dynamic";

const CACHE = { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" };

function buildDemoPortalResponse() {
  return NextResponse.json(
    {
      success: true,
      data: {
        isDemo: true,
        organization: { name: SEED_ORGANIZATION.name, slug: SEED_ORGANIZATION.slug },
        config: getDefaultDemoPortalConfig(SEED_ORGANIZATION.name),
        plans: DEFAULT_DEMO_HOTSPOT_PLANS,
        methods: AUTH_METHOD_REGISTRY.filter((m) => m.supported).map((m) => m.id),
        published: true,
      },
    },
    { headers: CACHE }
  );
}

/**
 * PUBLIC captive-portal resolution (no login — hotspot clients are anonymous).
 *
 * Tenant resolution order:
 *   1. ?org=<organization slug>   (what the MikroTik hotspot login redirect carries)
 *   2. Host header matching a published custom domain  (future: wifi.exampleisp.co.ke)
 *   3. Interactive Demo fallback when accessed directly on platform host or with ?demo=true
 */
export async function GET(req: NextRequest) {
  const isExplicitDemo =
    req.nextUrl.searchParams.get("demo") === "true" ||
    req.nextUrl.searchParams.get("org") === SEED_ORGANIZATION.slug;

  const key = resolveTenantKey({
    org: req.nextUrl.searchParams.get("org"),
    host: req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
    platformHosts: [process.env.NEXT_PUBLIC_APP_HOST ?? ""].filter(Boolean),
  });

  // Local / unconfigured backend or direct Demo Mode preview: serve the seeded demo tenant.
  if (!SUPABASE_READY || !key || (await isDemoRequest())) {
    if (!key || isExplicitDemo || !SUPABASE_READY) {
      return buildDemoPortalResponse();
    }
  }

  try {
    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    const db = createSupabaseServiceClient() as unknown as AnyClient;

    let orgId: string | null = null;
    let orgName = "";
    let orgSlug = "";

    if (key.type === "slug") {
      const { data } = await db
        .from("organizations")
        .select("id, name, slug")
        .eq("slug", key.value)
        .eq("is_active", true)
        .maybeSingle();
      if (data) ({ id: orgId, name: orgName, slug: orgSlug } = data as { id: string; name: string; slug: string });
    } else {
      const { data: dom } = await db
        .from("captive_portal_configs")
        .select("organization_id")
        .eq("status", "PUBLISHED")
        .ilike("custom_domain", key.value)
        .maybeSingle();
      if (dom) {
        const { data } = await db
          .from("organizations")
          .select("id, name, slug")
          .eq("id", (dom as { organization_id: string }).organization_id)
          .eq("is_active", true)
          .maybeSingle();
        if (data) ({ id: orgId, name: orgName, slug: orgSlug } = data as { id: string; name: string; slug: string });
      }
    }

    if (!orgId) {
      if (isExplicitDemo) {
        return buildDemoPortalResponse();
      }
      return jsonError(404, "PORTAL_NOT_FOUND", "This WiFi portal could not be found. Please scan the QR code or reconnect to the network.");
    }

    const [{ data: pub }, { data: planRows }] = await Promise.all([
      db
        .from("captive_portal_configs")
        .select("config")
        .eq("organization_id", orgId)
        .eq("status", "PUBLISHED")
        .maybeSingle(),
      db
        .from("plans")
        .select(PLAN_COLUMNS)
        .eq("organization_id", orgId)
        .eq("service_type", "HOTSPOT")
        .eq("is_active", true)
        .order("price", { ascending: true }),
    ]);

    const dbPlans = mapPlanRows(planRows as Array<Record<string, unknown>> | null);
    const plans = dbPlans.length > 0 ? dbPlans : isExplicitDemo ? DEFAULT_DEMO_HOTSPOT_PLANS : dbPlans;
    const config = pub
      ? sanitizePortalConfig((pub as { config: unknown }).config, {
          isAllowedAssetUrl: assetValidatorFor(orgId),
          validPlanIds: new Set(plans.map((p) => p.id)),
          businessNameFallback: orgName,
        }).config
      : isExplicitDemo
        ? getDefaultDemoPortalConfig(orgName)
        : getDefaultPortalConfig(orgName);

    return NextResponse.json(
      {
        success: true,
        data: {
          isDemo: isExplicitDemo && dbPlans.length === 0,
          organization: { name: orgName, slug: orgSlug },
          config,
          plans,
          methods: AUTH_METHOD_REGISTRY.filter((m) => m.supported).map((m) => m.id),
          published: Boolean(pub),
        },
      },
      { headers: CACHE }
    );
  } catch (err) {
    console.error("[CaptivePortal] public resolve failed:", err);
    if (isExplicitDemo) {
      return buildDemoPortalResponse();
    }
    return jsonError(503, "PORTAL_UNAVAILABLE", "The WiFi portal is temporarily unavailable. Please try again.");
  }
}
