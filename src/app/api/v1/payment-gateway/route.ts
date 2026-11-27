import { NextRequest, NextResponse } from "next/server";
import { isDemoRequest, jsonError } from "@/lib/captive/server";
import { validateGatewayInput, SECRET_MASK, type GatewayConfigView } from "@/lib/payments/gateway";
import { getGatewayView, gatewayAdminError, saveGatewayConfig } from "@/lib/payments/gateway-server";
import { getOrgClient } from "@/lib/sites/server";

export const dynamic = "force-dynamic";

function demoView(origin: string): GatewayConfigView {
  return {
    organizationId: "demo",
    provider: "MPESA_DARAJA",
    environment: "sandbox",
    shortcode: "174379",
    callbackUrl: `${origin}/api/v1/mpesa-callback`,
    confirmationUrl: `${origin}/api/v1/mpesa-c2b/confirmation`,
    validationUrl: `${origin}/api/v1/mpesa-c2b/validation`,
    consumerKey: "",
    consumerSecret: "",
    passkey: "",
    isEnabled: false,
    source: "none",
    missing: ["gateway configuration"],
  };
}

/** GET /api/v1/payment-gateway — masked, org-scoped gateway status. */
export async function GET(req: NextRequest) {
  if (await isDemoRequest()) {
    return NextResponse.json({
      success: true,
      demo: true,
      data: { ...demoView(new URL(req.url).origin), canEdit: false },
    });
  }

  try {
    const ctx = await getOrgClient();
    if (!ctx.ok) return ctx.response;
    const { view, warning } = await getGatewayView(ctx.orgId);
    return NextResponse.json({
      success: true,
      data: {
        ...view,
        canEdit: Boolean(ctx.role) && ["super_admin", "isp_owner", "isp_admin"].includes(ctx.role ?? ""),
      },
      ...(warning ? { warnings: [warning] } : {}),
    });
  } catch (err) {
    console.error("[Payment gateway] load failed:", err);
    return jsonError(503, "GATEWAY_UNAVAILABLE", "Could not load payment gateway settings.");
  }
}

/** PATCH /api/v1/payment-gateway — encrypt and store per-ISP Daraja secrets. */
export async function PATCH(req: NextRequest) {
  if (await isDemoRequest()) {
    return jsonError(403, "DEMO_READ_ONLY", "Gateway credentials cannot be changed in demo mode.");
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, "INVALID_REQUEST", "Request body must be JSON.");
  }

  const checked = validateGatewayInput(body);
  if (!checked.ok) return jsonError(checked.status, checked.code, checked.message);

  try {
    const ctx = await getOrgClient();
    if (!ctx.ok) return ctx.response;
    const denied = gatewayAdminError(ctx.role);
    if (denied) return denied;

    const saved = await saveGatewayConfig(ctx.orgId, checked.value, ctx.role);
    if (!saved.ok) return jsonError(saved.status, saved.code, saved.message);

    return NextResponse.json({
      success: true,
      data: { ...saved.view, consumerKey: SECRET_MASK, consumerSecret: SECRET_MASK, passkey: SECRET_MASK },
      message: "Gateway configuration saved. Secrets are encrypted server-side.",
    });
  } catch (err) {
    console.error("[Payment gateway] save failed:", err);
    return jsonError(503, "GATEWAY_UNAVAILABLE", "Could not save payment gateway settings.");
  }
}
