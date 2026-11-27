import { NextRequest, NextResponse } from "next/server";
import { MpesaService, type DarajaCallbackPayload } from "@/lib/payments/mpesa";
import { PaymentsService } from "@/lib/services";
import { verifyWebhookToken } from "@/lib/payments/gateway";
import { resolveOrgByCheckoutRequest } from "@/lib/payments/gateway-server";
import { reconcileIncomingPayment, type ReconcilableSubscriber } from "@/lib/payments/reconciliation";
import type { AnyClient } from "@/lib/captive/server";

export const dynamic = "force-dynamic";

const ack = (description = "Accepted and Reconciled Successfully") =>
  NextResponse.json({ ResultCode: 0, ResultDesc: description });

type CustomerRow = {
  id: string;
  account_number: string;
  full_name: string;
  phone_number: string;
  alt_phone_number: string | null;
};

async function matchCustomer(
  db: AnyClient,
  orgId: string,
  input: { phone: string; accountReference: string; senderName?: string }
): Promise<string | undefined> {
  const { data } = await db
    .from("customers")
    .select("id, account_number, full_name, phone_number, alt_phone_number")
    .eq("organization_id", orgId)
    .limit(2000);
  const subscribers: ReconcilableSubscriber[] = ((data ?? []) as CustomerRow[]).map((c) => ({
    id: String(c.id),
    accountNumber: String(c.account_number ?? ""),
    fullName: String(c.full_name ?? ""),
    phoneNumber: String(c.phone_number ?? ""),
    altPhoneNumber: c.alt_phone_number ? String(c.alt_phone_number) : undefined,
    balanceDue: 0,
  }));
  const result = reconcileIncomingPayment({
    payment: {
      transactionReference: "stk-callback",
      channel: "MPESA_EXPRESS",
      amount: 0,
      msisdnPhone: input.phone,
      accountReference: input.accountReference,
      senderName: input.senderName,
    },
    subscribers,
    openInvoices: [],
  });
  return result.matchedCustomerId;
}

// This endpoint receives callbacks from Safaricom Daraja.
// It must always return HTTP 200 with the Daraja acknowledgement format for
// accepted payloads, otherwise Daraja retries indefinitely.
export async function POST(req: NextRequest) {
  try {
    if (
      !verifyWebhookToken(
        process.env.MPESA_WEBHOOK_TOKEN,
        new URL(req.url).searchParams.get("token")
      )
    ) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Unauthorized callback" }, { status: 403 });
    }

    const payload = (await req.json()) as DarajaCallbackPayload;
    const cb = payload?.Body?.stkCallback;
    if (!cb) return ack("Received without a callback body");

    const checkoutRequestId = String(cb.CheckoutRequestID ?? "");
    const result = MpesaService.parseCallback(payload);

    if (!result.success) {
      if (checkoutRequestId) {
        try {
          const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
          const db = createSupabaseServiceClient() as unknown as AnyClient;
          await db
            .from("payments")
            .update({
              status: "FAILED",
              raw_payload: (payload as unknown) as import("@/types/database.types").Json,
              processed_at: new Date().toISOString(),
            })
            .eq("transaction_reference", checkoutRequestId);
        } catch (err) {
          console.error("[M-Pesa callback] failed-payment marker failed:", err);
        }
      }
      return ack("Received failed STK result");
    }

    if (!result.receiptNumber || !result.amount || !result.phoneNumber) {
      return ack("Received success without invoiceable metadata");
    }

    const orgId = await resolveOrgByCheckoutRequest(checkoutRequestId);
    if (!orgId) {
      console.error("[M-Pesa callback] no org for checkout", checkoutRequestId);
      return ack("Received but no linked organization");
    }

    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    const db = createSupabaseServiceClient() as unknown as AnyClient;
    const { data: initiated } = await db
      .from("payments")
      .select("raw_payload, customer_id")
      .eq("transaction_reference", checkoutRequestId)
      .maybeSingle();
    const raw = initiated?.raw_payload as { accountReference?: string } | null;
    const accountReference = String(raw?.accountReference ?? "");
    const customerId =
      (initiated?.customer_id as string | null) ||
      (await matchCustomer(db, orgId, {
        phone: result.phoneNumber,
        accountReference,
      }));

    const recorded = await PaymentsService.recordMpesaPayment({
      organizationId: orgId,
      customerId,
      amount: result.amount,
      transactionReference: result.receiptNumber,
      msisdnPhone: result.phoneNumber,
      paymentMethod: "MPESA_EXPRESS",
      rawPayload: payload,
      checkoutRequestId,
      providerReceipt: result.receiptNumber,
    });
    if (recorded.error) {
      console.error("[M-Pesa callback] could not record payment:", recorded.error);
    }

    return ack();
  } catch {
    // Always return 200 to Daraja to prevent retries
    return ack("Received");
  }
}
