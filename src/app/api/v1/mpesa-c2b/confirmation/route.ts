import { NextRequest, NextResponse } from "next/server";
import type { AnyClient } from "@/lib/captive/server";
import { parseC2BEvent } from "@/lib/payments/daraja";
import { verifyWebhookToken } from "@/lib/payments/gateway";
import { resolveOrgByShortcode } from "@/lib/payments/gateway-server";
import { reconcileIncomingPayment, type ReconcilableSubscriber } from "@/lib/payments/reconciliation";
import { PaymentsService } from "@/lib/services";

export const dynamic = "force-dynamic";

const ack = () => NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

async function matchCustomer(
  db: AnyClient,
  orgId: string,
  phone: string,
  account: string,
  senderName: string
): Promise<string | undefined> {
  const { data } = await db
    .from("customers")
    .select("id, account_number, full_name, phone_number, alt_phone_number")
    .eq("organization_id", orgId)
    .limit(2000);
  const subscribers: ReconcilableSubscriber[] = ((data ?? []) as Array<Record<string, unknown>>).map(
    (c) => ({
      id: String(c.id),
      accountNumber: String(c.account_number ?? ""),
      fullName: String(c.full_name ?? ""),
      phoneNumber: String(c.phone_number ?? ""),
      altPhoneNumber: c.alt_phone_number ? String(c.alt_phone_number) : undefined,
      balanceDue: 0,
    })
  );
  const result = reconcileIncomingPayment({
    payment: {
      transactionReference: "c2b-confirmation",
      channel: "MPESA_C2B",
      amount: 0,
      msisdnPhone: phone,
      accountReference: account,
      senderName,
    },
    subscribers,
    openInvoices: [],
  });
  return result.matchedCustomerId;
}

/** Daraja calls this after a successful Paybill/Till C2B transaction. */
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

    const payload: unknown = await req.json();
    const event = parseC2BEvent(payload);
    const org = await resolveOrgByShortcode(event.shortcode);
    if (!org) {
      console.error("[M-Pesa C2B] no organization for shortcode", event.shortcode || "(missing)");
      return ack();
    }

    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    const db = createSupabaseServiceClient() as unknown as AnyClient;
    const customerId = await matchCustomer(
      db,
      org.organizationId,
      event.msisdnPhone,
      event.accountReference,
      event.senderName
    );

    const recorded = await PaymentsService.recordMpesaPayment({
      organizationId: org.organizationId,
      customerId,
      amount: event.amount,
      transactionReference: event.transactionReference,
      msisdnPhone: event.msisdnPhone || "UNKNOWN",
      senderName: event.senderName || undefined,
      paymentMethod: "MPESA_C2B",
      rawPayload: payload,
      providerReceipt: event.transactionReference,
    });
    if (recorded.error) {
      console.error("[M-Pesa C2B] could not record payment:", recorded.error);
    }
    return ack();
  } catch (err) {
    console.error("[M-Pesa C2B] confirmation failed:", err);
    return ack();
  }
}
