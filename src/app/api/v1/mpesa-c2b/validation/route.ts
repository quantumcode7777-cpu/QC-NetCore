import { NextRequest, NextResponse } from "next/server";
import { parseC2BEvent } from "@/lib/payments/daraja";
import { verifyWebhookToken } from "@/lib/payments/gateway";
import { resolveOrgByShortcode } from "@/lib/payments/gateway-server";

export const dynamic = "force-dynamic";

const accepted = () => NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
const rejected = (reason: string) => NextResponse.json({ ResultCode: 1, ResultDesc: reason });

/**
 * Optional C2B validation callback. Returning ResultCode 0 lets Daraja accept
 * the transaction; a non-zero code rejects it before money moves.
 */
export async function POST(req: NextRequest) {
  try {
    if (
      !verifyWebhookToken(
        process.env.MPESA_WEBHOOK_TOKEN,
        new URL(req.url).searchParams.get("token")
      )
    ) {
      return rejected("Unauthorized callback");
    }

    const event = parseC2BEvent(await req.json());
    if (!event.accountReference && !event.msisdnPhone) {
      return rejected("Missing account reference or phone number");
    }
    const org = await resolveOrgByShortcode(event.shortcode);
    if (!org) return rejected("Unknown paybill recipient");
    return accepted();
  } catch (err) {
    console.error("[M-Pesa C2B] validation failed:", err);
    return rejected("Invalid transaction payload");
  }
}
