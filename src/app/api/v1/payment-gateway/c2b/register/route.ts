import { NextResponse } from "next/server";
import { isDemoRequest, jsonError } from "@/lib/captive/server";
import { registerC2BUrls } from "@/lib/payments/daraja";
import {
  gatewayAdminError,
  getGatewayView,
  markGatewayRegistration,
  resolveGatewayCredentials,
  withWebhookToken,
} from "@/lib/payments/gateway-server";
import { getOrgClient } from "@/lib/sites/server";

export const dynamic = "force-dynamic";

/** POST /api/v1/payment-gateway/c2b/register — Daraja URL registration. */
export async function POST() {
  if (await isDemoRequest()) {
    return jsonError(403, "DEMO_READ_ONLY", "C2B URLs cannot be registered in demo mode.");
  }

  try {
    const ctx = await getOrgClient();
    if (!ctx.ok) return ctx.response;
    const denied = gatewayAdminError(ctx.role);
    if (denied) return denied;

    const gateway = await resolveGatewayCredentials(ctx.orgId);
    if (!gateway.ok) return jsonError(gateway.status, gateway.code, gateway.message);

    const { view, warning } = await getGatewayView(ctx.orgId);
    const response = await registerC2BUrls(gateway.credentials, {
      confirmationUrl: withWebhookToken(view.confirmationUrl),
      validationUrl: withWebhookToken(view.validationUrl),
    });

    await markGatewayRegistration(ctx.orgId);
    return NextResponse.json({
      success: true,
      data: response,
      ...(warning ? { warning } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "C2B registration failed.";
    console.error("[Payment gateway] C2B registration failed:", message);
    try {
      const ctx = await getOrgClient();
      if (ctx.ok) await markGatewayRegistration(ctx.orgId, message.slice(0, 500));
    } catch {
      // Best-effort audit marker only.
    }
    return jsonError(502, "C2B_REGISTRATION_FAILED", message);
  }
}
