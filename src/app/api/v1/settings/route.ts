import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SEED_ORGANIZATION } from "@/lib/db/mock-db";
import { handleSupabaseError } from "@/lib/supabase/errors";
import { validateOrganizationSettingsInput } from "@/lib/settings-validation";
import type { OrganizationRow, Json } from "@/types/database.types";

export const dynamic = "force-dynamic";

const SUPABASE_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://[PROJECT_REF].supabase.co"
);

const ADMIN_ROLES = new Set(["super_admin", "isp_owner", "isp_admin"]);

/**
 * Internal server-side integration verification.
 * Validates configuration state for server logs/monitoring without exposing
 * environment variable names, endpoints, or infrastructure details to clients.
 */
function verifyServerIntegrations(): void {
  const mpesaConfigured = Boolean(
    process.env.DARAJA_CONSUMER_KEY &&
      process.env.DARAJA_CONSUMER_SECRET &&
      process.env.DARAJA_PASSKEY &&
      process.env.DARAJA_SHORTCODE &&
      process.env.MPESA_CALLBACK_URL
  );
  const gatewayConfigured = Boolean(
    process.env.NETWORK_GATEWAY_URL && process.env.NETWORK_GATEWAY_SECRET
  );
  const smsConfigured = Boolean(
    process.env.AFRICASTALKING_API_KEY && process.env.AFRICASTALKING_USERNAME
  );

  if (process.env.NODE_ENV === "development") {
    console.info("[G-Tech ISP] Server integration check:", {
      supabaseReady: SUPABASE_READY,
      mpesaConfigured,
      gatewayConfigured,
      smsConfigured,
    });
  }
}

function getSeedOrganizationRow(): OrganizationRow {
  return {
    id: SEED_ORGANIZATION.id,
    name: SEED_ORGANIZATION.name,
    slug: SEED_ORGANIZATION.slug,
    business_number: SEED_ORGANIZATION.businessNumber ?? "4084200",
    email: SEED_ORGANIZATION.email,
    phone: SEED_ORGANIZATION.phone,
    currency: SEED_ORGANIZATION.currency || "KES",
    logo_url: SEED_ORGANIZATION.logoUrl ?? null,
    timezone: SEED_ORGANIZATION.timezone || "Africa/Nairobi",
    billing_cycle_type: SEED_ORGANIZATION.billingCycleType || "ANNIVERSARY",
    grace_period_days: SEED_ORGANIZATION.gracePeriodDays ?? 2,
    is_active: SEED_ORGANIZATION.isActive ?? true,
    created_at: SEED_ORGANIZATION.createdAt,
    updated_at: SEED_ORGANIZATION.createdAt,
  };
}

export async function GET() {
  verifyServerIntegrations();

  const cookieStore = await cookies();
  const isDemo = cookieStore.get("gtech_demo_mode")?.value === "true";

  if (isDemo) {
    return NextResponse.json({
      success: true,
      data: {
        organization: getSeedOrganizationRow(),
        role: "demo_viewer",
        canEdit: false,
        isDemo: true,
      },
    });
  }

  if (!SUPABASE_READY) {
    return NextResponse.json(
      {
        success: false,
        code: "SETTINGS_UNAVAILABLE",
        message: "Organization settings are currently unavailable.",
        error: "Organization settings are currently unavailable.",
      },
      { status: 503 }
    );
  }

  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        {
          success: false,
          code: "AUTH_EXPIRED",
          message: "Your session has expired. Please sign in again.",
          error: "Your session has expired. Please sign in again.",
        },
        { status: 401 }
      );
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, organization_id, role, is_active")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile || !profile.is_active) {
      return NextResponse.json(
        {
          success: false,
          code: "PERMISSION_DENIED",
          message: "You don't have permission to perform this action.",
          error: "You don't have permission to perform this action.",
        },
        { status: 403 }
      );
    }

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .single();

    if (orgErr || !org) {
      const appError = handleSupabaseError(orgErr, "settings.getOrganization");
      return NextResponse.json(
        {
          success: false,
          code: appError.code,
          message: appError.userMessage,
          error: appError.userMessage,
        },
        { status: 503 }
      );
    }

    const canEdit = ADMIN_ROLES.has(profile.role);

    return NextResponse.json({
      success: true,
      data: {
        organization: org,
        role: profile.role,
        canEdit,
        isDemo: false,
      },
    });
  } catch (err) {
    const appError = handleSupabaseError(err, "settings.get");
    return NextResponse.json(
      {
        success: false,
        code: appError.code,
        message: appError.userMessage,
        error: appError.userMessage,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  verifyServerIntegrations();

  const cookieStore = await cookies();
  const isDemo = cookieStore.get("gtech_demo_mode")?.value === "true";

  if (isDemo) {
    const msg = "Sign in to an administrator account to save changes.";
    return NextResponse.json(
      {
        success: false,
        code: "DEMO_READ_ONLY",
        message: msg,
        error: msg,
      },
      { status: 403 }
    );
  }

  if (!SUPABASE_READY) {
    const msg = "Changes could not be saved. Please try again.";
    return NextResponse.json(
      {
        success: false,
        code: "SETTINGS_SAVE_FAILED",
        message: msg,
        error: msg,
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const msg = "Please check the highlighted fields and try again.";
    return NextResponse.json(
      {
        success: false,
        code: "VALIDATION_ERROR",
        message: msg,
        error: msg,
      },
      { status: 400 }
    );
  }

  const validation = validateOrganizationSettingsInput(body);
  if (!validation.valid || !validation.data) {
    const msg = "Please check the highlighted fields and try again.";
    return NextResponse.json(
      {
        success: false,
        code: "VALIDATION_ERROR",
        message: msg,
        error: msg,
        fieldErrors: validation.errors,
      },
      { status: 400 }
    );
  }

  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      const msg = "Your session has expired. Please sign in again.";
      return NextResponse.json(
        {
          success: false,
          code: "AUTH_EXPIRED",
          message: msg,
          error: msg,
        },
        { status: 401 }
      );
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, organization_id, role, is_active")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile || !profile.is_active) {
      const msg = "You don't have permission to perform this action.";
      return NextResponse.json(
        {
          success: false,
          code: "PERMISSION_DENIED",
          message: msg,
          error: msg,
        },
        { status: 403 }
      );
    }

    if (!ADMIN_ROLES.has(profile.role)) {
      const msg = "You don't have permission to perform this action.";
      return NextResponse.json(
        {
          success: false,
          code: "PERMISSION_DENIED",
          message: msg,
          error: msg,
        },
        { status: 403 }
      );
    }

    const { data: oldOrg } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .single();

    const updatePayload = {
      ...validation.data,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedOrg, error: updateErr } = await supabase
      .from("organizations")
      .update(updatePayload)
      .eq("id", profile.organization_id)
      .select("*")
      .single();

    if (updateErr || !updatedOrg) {
      const appError = handleSupabaseError(updateErr, "settings.update");
      return NextResponse.json(
        {
          success: false,
          code: appError.code,
          message: appError.userMessage,
          error: appError.userMessage,
        },
        { status: 400 }
      );
    }

    // Preserve immutable audit trail server-side
    try {
      await supabase.from("audit_log").insert({
        organization_id: profile.organization_id,
        actor_id: user.id,
        actor_email: user.email ?? null,
        action: "organization.settings.update",
        resource_type: "organization",
        resource_id: profile.organization_id,
        old_data: (oldOrg ?? null) as unknown as Json,
        new_data: updatedOrg as unknown as Json,
        user_agent: req.headers.get("user-agent") ?? null,
      });
    } catch (auditErr) {
      console.error("[G-Tech ISP] Audit log insert failed:", auditErr);
    }

    return NextResponse.json({
      success: true,
      data: updatedOrg,
    });
  } catch (err) {
    const appError = handleSupabaseError(err, "settings.patch");
    return NextResponse.json(
      {
        success: false,
        code: appError.code,
        message: appError.userMessage,
        error: appError.userMessage,
      },
      { status: 500 }
    );
  }
}
