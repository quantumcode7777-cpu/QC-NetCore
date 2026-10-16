// ====================================================================
// QC NetCore — Real outbound SMS via Africa's Talking (server-only).
// NEVER import into client components (reads service-side env secrets).
// Credentials: AFRICASTALKING_USERNAME / AFRICASTALKING_API_KEY
//   (+ optional AFRICASTALKING_SENDER_ID). Username "sandbox" targets the
//   sandbox gateway; anything else targets production.
// ====================================================================

export interface SmsSendResult {
  ok: boolean;
  messageId: string | null;
  sandbox: boolean;
  /** Machine-readable outcome for the UI (UNCONFIGURED / PROVIDER_ERROR / OK). */
  code: "OK" | "UNCONFIGURED" | "PROVIDER_ERROR" | "SERVER_ERROR";
  message: string;
}

export function smsProviderStatus(): {
  configured: boolean;
  sandbox: boolean;
  username: string | null;
} {
  const username = process.env.AFRICASTALKING_USERNAME?.trim() || null;
  const apiKey = process.env.AFRICASTALKING_API_KEY?.trim() || null;
  const sandbox = username === "sandbox";
  return { configured: Boolean(username && apiKey), sandbox, username };
}

function gatewayBase(username: string): string {
  return username === "sandbox"
    ? "https://api.sandbox.africastalking.com/version1"
    : "https://api.africastalking.com/version1";
}

export async function sendSms(to: string, message: string): Promise<SmsSendResult> {
  const username = process.env.AFRICASTALKING_USERNAME?.trim();
  const apiKey = process.env.AFRICASTALKING_API_KEY?.trim();
  const senderId = process.env.AFRICASTALKING_SENDER_ID?.trim() || undefined;
  if (!username || !apiKey) {
    return {
      ok: false,
      messageId: null,
      sandbox: false,
      code: "UNCONFIGURED",
      message:
        "SMS is not configured. Add AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY to the billing environment and redeploy.",
    };
  }
  try {
    const params = new URLSearchParams({ username, to, message });
    if (senderId) params.set("from", senderId);
    const res = await fetch(`${gatewayBase(username)}/messaging`, {
      method: "POST",
      headers: { apiKey, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: params.toString(),
    });
    const json = (await res.json().catch(() => null)) as {
      SMSMessageData?: { Recipients?: Array<{ status?: string; messageId?: string; cost?: string }> };
    } | null;
    const recipient = json?.SMSMessageData?.Recipients?.[0];
    const status = recipient?.status ?? "";
    if (res.ok && /^success|sent|throttled/i.test(status)) {
      return {
        ok: true,
        messageId: recipient?.messageId ?? null,
        sandbox: username === "sandbox",
        code: "OK",
        message: username === "sandbox" ? "Sent via sandbox gateway (test mode)." : "SMS accepted by provider.",
      };
    }
    return {
      ok: false,
      messageId: null,
      sandbox: username === "sandbox",
      code: "PROVIDER_ERROR",
      message: `Provider rejected the message${status ? `: ${status}` : `. HTTP ${res.status}`}.`,
    };
  } catch (err) {
    console.error("[SMS] send failed:", err);
    return {
      ok: false,
      messageId: null,
      sandbox: false,
      code: "SERVER_ERROR",
      message: "Could not reach the SMS provider. Please try again.",
    };
  }
}
