import { NextRequest, NextResponse } from "next/server";
import { SEED_ORGANIZATION } from "@/lib/db/mock-db";
import {
  DEFAULT_DEMO_HOTSPOT_PLANS,
  getDefaultDemoPortalConfig,
  getDefaultPortalConfig,
  sanitizePortalConfig,
  AUTH_METHOD_REGISTRY,
  type PortalConfig,
  type PlanLike,
} from "@/lib/captive/config";
import {
  SUPABASE_READY,
  PLAN_COLUMNS,
  assetValidatorFor,
  authorizePortalAdmin,
  isDemoRequest,
  jsonError,
  logPortalAudit,
  mapPlanRows,
  rowToVersion,
  type PortalConfigRow,
} from "@/lib/captive/server";

export const dynamic = "force-dynamic";

/** Stored configs are re-sanitized on read so a tampered row can never reach the UI. */
function parseStored(row: PortalConfigRow | undefined, orgId: string, name: string, planIds: Set<string>): PortalConfig | null {
  if (!row) return null;
  return sanitizePortalConfig(row.config, {
    isAllowedAssetUrl: assetValidatorFor(orgId),
    validPlanIds: planIds,
    businessNameFallback: name,
  }).config;
}

function buildDemoConfigResponse(demoPlans: PlanLike[]) {
  const def = getDefaultDemoPortalConfig(SEED_ORGANIZATION.name);
  return NextResponse.json({
    success: true,
    data: {
      isDemo: true,
      canEdit: true,
      organization: { name: SEED_ORGANIZATION.name, slug: SEED_ORGANIZATION.slug },
      draft: def,
      published: def,
      versions: [
        {
          id: "demo-ver-1",
          version: 1,
          status: "PUBLISHED",
          createdAt: new Date().toISOString(),
          publishedAt: new Date().toISOString(),
        },
      ],
      plans: demoPlans,
      methods: AUTH_METHOD_REGISTRY,
    },
  });
}

// GET — draft + published + version history for the caller's OWN organization.
export async function GET() {
  const demoPlans: PlanLike[] = DEFAULT_DEMO_HOTSPOT_PLANS;
  if ((await isDemoRequest()) || !SUPABASE_READY) {
    return buildDemoConfigResponse(demoPlans);
  }

  const auth = await authorizePortalAdmin();
  if (!auth.ok) {
    // Allow interactive Demo Mode preview & customization when not signed into a live tenant
    return buildDemoConfigResponse(demoPlans);
  }
  const { supabase, orgId } = auth.ctx;

  try {
    const [{ data: org }, { data: rows, error }, { data: planRows }] = await Promise.all([
      supabase.from("organizations").select("name, slug").eq("id", orgId).single(),
      supabase
        .from("captive_portal_configs")
        .select("id, organization_id, version, status, config, created_at, published_at")
        .eq("organization_id", orgId)
        .order("version", { ascending: false })
        .limit(25),
      supabase
        .from("plans")
        .select(PLAN_COLUMNS)
        .eq("organization_id", orgId)
        .eq("service_type", "HOTSPOT")
        .eq("is_active", true)
        .order("price", { ascending: true }),
    ]);
    if (error) {
      console.error("[CaptivePortal] load failed:", error.message);
      return jsonError(503, "PORTAL_LOAD_FAILED", "Portal settings could not be loaded. Please try again.");
    }

    const name = (org?.name as string) ?? "My ISP";
    const plans = mapPlanRows(planRows as Array<Record<string, unknown>> | null);
    const planIds = new Set(plans.map((p) => p.id));
    const list = (rows ?? []) as unknown as PortalConfigRow[];
    const draftRow = list.find((r) => r.status === "DRAFT");
    const pubRow = list.find((r) => r.status === "PUBLISHED");
    const published = parseStored(pubRow, orgId, name, planIds);
    const draft = parseStored(draftRow, orgId, name, planIds);

    return NextResponse.json({
      success: true,
      data: {
        isDemo: false,
        canEdit: true,
        organization: { name, slug: org?.slug ?? "" },
        // editing always starts from: draft → published → defaults
        draft: draft ?? published ?? getDefaultPortalConfig(name),
        hasDraft: Boolean(draft),
        published,
        draftVersion: draftRow ? rowToVersion(draftRow) : null,
        publishedVersion: pubRow ? rowToVersion(pubRow) : null,
        versions: list.map(rowToVersion),
        plans,
        methods: AUTH_METHOD_REGISTRY,
      },
    });
  } catch (err) {
    console.error("[CaptivePortal] GET failed:", err);
    return jsonError(500, "SERVER_ERROR", "Something went wrong. Please try again.");
  }
}

// PUT — save draft. Organization comes from the session; body only carries design values.
export async function PUT(req: NextRequest) {
  if (await isDemoRequest()) {
    return jsonError(403, "DEMO_READ_ONLY", "Sign in to an administrator account to save changes.");
  }
  const auth = await authorizePortalAdmin();
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Please check the highlighted fields and try again.");
  }
  const raw = (body as { config?: unknown } | null)?.config;
  if (raw === undefined || JSON.stringify(raw).length > 60_000) {
    return jsonError(400, "VALIDATION_ERROR", "The portal configuration is missing or too large.");
  }

  try {
    const { data: planRows } = await supabase
      .from("plans")
      .select("id")
      .eq("organization_id", orgId)
      .eq("service_type", "HOTSPOT");
    const planIds = new Set((planRows ?? []).map((p: { id: string }) => p.id));

    const result = sanitizePortalConfig(raw, {
      isAllowedAssetUrl: assetValidatorFor(orgId),
      validPlanIds: planIds,
    });
    if (Object.keys(result.errors).length > 0) {
      return jsonError(400, "VALIDATION_ERROR", "Please check the highlighted fields and try again.", {
        fieldErrors: result.errors,
      });
    }

    const { data, error } = await supabase.rpc("captive_save_draft", { p_config: result.config });
    if (error || !data) {
      console.error("[CaptivePortal] save draft failed:", error?.message);
      return jsonError(error?.code === "42501" ? 403 : 500, "PORTAL_SAVE_FAILED", "Your draft could not be saved. Please try again.");
    }
    const row = data as PortalConfigRow;
    await logPortalAudit(auth.ctx, "captive_portal.draft.save", row.id, req.headers.get("user-agent"), { version: row.version });

    return NextResponse.json({
      success: true,
      data: { draft: result.config, draftVersion: rowToVersion(row), warnings: result.warnings },
    });
  } catch (err) {
    console.error("[CaptivePortal] PUT failed:", err);
    return jsonError(500, "SERVER_ERROR", "Something went wrong. Please try again.");
  }
}

// POST — { action: "publish" } | { action: "restore", version: n }
export async function POST(req: NextRequest) {
  if (await isDemoRequest()) {
    return jsonError(403, "DEMO_READ_ONLY", "Sign in to an administrator account to publish changes.");
  }
  const auth = await authorizePortalAdmin();
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  let body: { action?: string; version?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Invalid request.");
  }

  try {
    if (body.action === "publish") {
      // Defence in depth: re-validate the stored draft before it can go live.
      const { data: draftRow } = await supabase
        .from("captive_portal_configs")
        .select("id, organization_id, version, status, config, created_at, published_at")
        .eq("organization_id", orgId)
        .eq("status", "DRAFT")
        .maybeSingle();
      if (!draftRow) return jsonError(409, "NO_DRAFT", "There is no draft to publish. Save a draft first.");

      const { data: planRows } = await supabase
        .from("plans").select("id").eq("organization_id", orgId).eq("service_type", "HOTSPOT");
      const check = sanitizePortalConfig((draftRow as PortalConfigRow).config, {
        isAllowedAssetUrl: assetValidatorFor(orgId),
        validPlanIds: new Set((planRows ?? []).map((p: { id: string }) => p.id)),
      });
      if (Object.keys(check.errors).length > 0) {
        return jsonError(400, "VALIDATION_ERROR", "The draft has invalid values. Fix them and save before publishing.", {
          fieldErrors: check.errors,
        });
      }

      const { data, error } = await supabase.rpc("captive_publish");
      if (error || !data) {
        console.error("[CaptivePortal] publish failed:", error?.message);
        return jsonError(error?.code === "42501" ? 403 : 500, "PORTAL_PUBLISH_FAILED", "Publishing failed. Your live portal was not changed.");
      }
      const row = data as PortalConfigRow;
      await logPortalAudit(auth.ctx, "captive_portal.publish", row.id, req.headers.get("user-agent"), { version: row.version });
      return NextResponse.json({ success: true, data: { publishedVersion: rowToVersion(row) } });
    }

    if (body.action === "restore") {
      const version = Number(body.version);
      if (!Number.isInteger(version) || version < 1) {
        return jsonError(400, "VALIDATION_ERROR", "Choose a valid version to restore.");
      }
      const { data, error } = await supabase.rpc("captive_restore_as_draft", { p_version: version });
      if (error || !data) {
        console.error("[CaptivePortal] restore failed:", error?.message);
        return jsonError(error?.code === "P0002" ? 404 : 500, "PORTAL_RESTORE_FAILED", "That version could not be restored.");
      }
      const row = data as PortalConfigRow;
      await logPortalAudit(auth.ctx, "captive_portal.restore", row.id, req.headers.get("user-agent"), { restoredFrom: version });
      return NextResponse.json({ success: true, data: { draftVersion: rowToVersion(row) } });
    }

    return jsonError(400, "VALIDATION_ERROR", "Unknown action.");
  } catch (err) {
    console.error("[CaptivePortal] POST failed:", err);
    return jsonError(500, "SERVER_ERROR", "Something went wrong. Please try again.");
  }
}
