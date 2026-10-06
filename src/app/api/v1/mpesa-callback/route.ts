import { NextRequest, NextResponse } from "next/server";
import { MpesaService } from "@/lib/payments/mpesa";
import { PaymentsService } from "@/lib/services";

export const dynamic = "force-dynamic";

// This endpoint receives callbacks from Safaricom Daraja.
// It must always return HTTP 200 with the Daraja acknowledgement format,
// even on internal errors, otherwise Daraja will retry indefinitely.
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const result = MpesaService.parseCallback(payload);

    if (result.success && result.receiptNumber && result.amount && result.phoneNumber) {
      // Persist the payment server-side via service_role
      // This never reaches the browser — it's a server-to-server callback
      await PaymentsService.recordMpesaPayment({
        organizationId: "org-gtech-kenya-01", // TODO: resolve from account reference
        amount: result.amount,
        transactionReference: result.receiptNumber,
        msisdnPhone: result.phoneNumber,
        paymentMethod: "MPESA_EXPRESS",
        rawPayload: payload,
      });
    }

    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: "Accepted and Reconciled Successfully",
    });
  } catch {
    // Always return 200 to Daraja to prevent retries
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: "Received",
    });
  }
}
