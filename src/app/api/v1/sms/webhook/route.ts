import { NextRequest, NextResponse } from "next/server";
import { SEED_ORGANIZATION } from "@/lib/db/mock-db";
import {
  processSmsDeliveryWebhook,
  type SmsDeliveryStatus,
} from "@/lib/sms/engine";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set<SmsDeliveryStatus>([
  "QUEUED",
  "SENT",
  "DELIVERED",
  "FAILED",
  "REJECTED",
  "UNKNOWN",
]);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const organizationId =
      typeof body.organizationId === "string" && body.organizationId.trim()
        ? body.organizationId.trim()
        : SEED_ORGANIZATION.id;

    const webhookToken =
      req.headers.get("x-sms-webhook-signature") ||
      (typeof body.webhookToken === "string" ? body.webhookToken : undefined);

    const eventId =
      typeof body.eventId === "string" && body.eventId.trim()
        ? body.eventId.trim()
        : "";
    const providerMessageId =
      typeof body.providerMessageId === "string" && body.providerMessageId.trim()
        ? body.providerMessageId.trim()
        : typeof body.id === "string"
        ? body.id.trim()
        : "";

    const rawStatus = String(body.status || "UNKNOWN")
      .trim()
      .toUpperCase() as SmsDeliveryStatus;
    const status: SmsDeliveryStatus = ALLOWED_STATUSES.has(rawStatus)
      ? rawStatus
      : "UNKNOWN";

    const failureReason =
      typeof body.failureReason === "string" ? body.failureReason : undefined;

    if (!eventId || !providerMessageId) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_PAYLOAD",
          message: "Both eventId and providerMessageId are required.",
        },
        { status: 400 }
      );
    }

    const result = processSmsDeliveryWebhook({
      organizationId,
      webhookToken,
      eventId,
      providerMessageId,
      status,
      failureReason,
    });

    if (!result.ok) {
      const httpStatus =
        result.code === "UNAUTHORIZED"
          ? 401
          : result.code === "REPLAY_DETECTED"
          ? 409
          : 404;
      return NextResponse.json(
        {
          success: false,
          code: result.code,
          message: result.error,
        },
        { status: httpStatus }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Delivery report recorded.",
      data: {
        messageId: result.updatedMessage?.id,
        providerMessageId: result.updatedMessage?.providerMessageId,
        status: result.updatedMessage?.status,
        deliveredAt: result.updatedMessage?.deliveredAt,
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid delivery webhook request.",
      },
      { status: 400 }
    );
  }
}
