import { NextRequest, NextResponse } from "next/server";
import { MpesaService } from "@/lib/payments/mpesa";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, amount, accountReference, transactionDesc } = body;

    if (!phoneNumber || !amount || !accountReference) {
      const msg = "Please enter a phone number, amount, and account reference.";
      return NextResponse.json(
        { success: false, code: "VALIDATION_ERROR", message: msg, error: msg },
        { status: 400 }
      );
    }

    const result = await MpesaService.initiateSTKPush({
      phoneNumber,
      amount,
      accountReference,
      transactionDesc: transactionDesc || `Internet Bill ${accountReference}`,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[M-Pesa STK Push] Request failed:", err);
    const msg = "Payment could not be completed. Please try again.";
    return NextResponse.json(
      { success: false, code: "PAYMENT_REQUEST_FAILED", message: msg, error: msg },
      { status: 500 }
    );
  }
}
