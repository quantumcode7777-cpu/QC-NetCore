import { NextRequest, NextResponse } from "next/server";
import { isDemoRequest, jsonError, type AnyClient } from "@/lib/captive/server";
import { MpesaService } from "@/lib/payments/mpesa";
import { initiateDarajaSTKPush } from "@/lib/payments/daraja";
import { PaymentsService } from "@/lib/services";
import { getOrgClient } from "@/lib/sites/server";
import { resolveGatewayCredentials } from "@/lib/payments/gateway-server";

export const dynamic = "force-dynamic";

async function resolveOrg(
  body: Record<string, unknown>
): Promise<
  | { ok: true; organizationId: string }
  | { ok: false; response: NextResponse }
> {
  const slug = typeof body.org === "string" ? body.org.trim() : "";
  if (slug) {
    try {
      const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
      const db = createSupabaseServiceClient() as unknown as AnyClient;
      const { data, error } = await db
        .from("organizations")
        .select("id, is_active")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !data || data.is_active === false) {
        return { ok: false, response: jsonError(404, "ORG_NOT_FOUND", "This ISP portal is not available.") };
      }
      return { ok: true, organizationId: String(data.id) };
    } catch {
      return {
        ok: false,
        response: jsonError(503, "ORG_UNAVAILABLE", "Could not resolve the ISP account right now."),
      };
    }
  }

  const ctx = await getOrgClient();
  if (!ctx.ok) return { ok: false, response: ctx.response };
  return { ok: true, organizationId: ctx.orgId };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const phone = String(body.phoneNumber ?? "").trim();
    const amount = Number(body.amount);
    const accountReference = String(body.accountReference ?? "").trim();
    const transactionDesc = String(body.transactionDesc ?? "").trim();

    if (!phone || !Number.isFinite(amount) || amount <= 0 || !accountReference) {
      const message = "Please enter a phone number, amount, and account reference.";
      return jsonError(400, "VALIDATION_ERROR", message);
    }
    if (!/^(?:\+?254|0)?[17]\d{8}$/.test(phone.replace(/[\s-]/g, ""))) {
      return jsonError(400, "INVALID_PHONE", "Enter a valid M-Pesa phone number, e.g. 0712345678.");
    }

    const formattedPhone = MpesaService.formatPhoneNumber(phone);

    if (await isDemoRequest()) {
      const demo = await MpesaService.simulateSTKPush({
        phoneNumber: phone,
        amount,
        accountReference,
        transactionDesc: transactionDesc || `Internet Bill ${accountReference}`,
      });
      return NextResponse.json({ ...demo, demo: true });
    }

    const org = await resolveOrg(body);
    if (!org.ok) return org.response;

    const gateway = await resolveGatewayCredentials(org.organizationId);
    if (!gateway.ok) return jsonError(gateway.status, gateway.code, gateway.message);

    const result = await initiateDarajaSTKPush(gateway.credentials, {
      phoneNumber: formattedPhone,
      amount,
      accountReference,
      transactionDesc: transactionDesc || `Internet Bill ${accountReference}`,
      callbackUrl: gateway.callbackUrl,
    });

    // Persist the request immediately. The callback will confirm this exact row
    // by CheckoutRequestID, so retries cannot double-count a payment.
    const recorded = await PaymentsService.recordInitiatedPayment({
      organizationId: org.organizationId,
      amount,
      checkoutRequestId: result.checkoutRequestId,
      msisdnPhone: formattedPhone,
      rawPayload: { stkPushResponse: result, accountReference },
    });
    if (recorded.error) {
      console.error("[M-Pesa STK Push] Request accepted but ledger row failed:", recorded.error);
      return jsonError(
        503,
        "PAYMENT_RECORD_FAILED",
        "M-Pesa accepted the prompt but the payment ledger is unavailable. Please retry."
      );
    }

    return NextResponse.json({
      ...result,
      source: gateway.source,
      ...(gateway.warning ? { warning: gateway.warning } : {}),
    });
  } catch (err) {
    console.error("[M-Pesa STK Push] Request failed:", err);
    return jsonError(500, "PAYMENT_REQUEST_FAILED", "Payment could not be requested. No charge was made.");
  }
}
