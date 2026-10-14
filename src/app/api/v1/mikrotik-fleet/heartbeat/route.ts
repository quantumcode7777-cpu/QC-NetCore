import { NextRequest, NextResponse } from "next/server";
import { recordHeartbeat } from "@/lib/provisioning/service";
import { validateHeartbeatPayload } from "@/lib/provisioning/core";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, code: "INVALID_JSON", error: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const validation = validateHeartbeatPayload(body);
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, code: "VALIDATION_ERROR", error: validation.message, field: validation.field },
        { status: 400 }
      );
    }

    const result = await recordHeartbeat(validation.value);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, code: result.code, error: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, data: { routerId: result.routerId } });
  } catch (err) {
    console.error("[api/mikrotik-fleet/heartbeat] unexpected error:", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", error: "An unexpected error occurred while recording the heartbeat." },
      { status: 500 }
    );
  }
}
