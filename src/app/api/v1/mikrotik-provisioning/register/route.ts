import { NextRequest, NextResponse } from "next/server";
import { registerRouter } from "@/lib/provisioning/service";
import { validateRegistrationPayload } from "@/lib/provisioning/core";

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

    const validation = validateRegistrationPayload(body);
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, code: "VALIDATION_ERROR", error: validation.message, field: validation.field },
        { status: 400 }
      );
    }

    // Determine router source IP if forwarded
    const forwardedFor = req.headers.get("x-forwarded-for");
    const sourceIp = forwardedFor ? forwardedFor.split(",")[0].trim() : req.headers.get("x-real-ip");

    const result = await registerRouter(validation.value, sourceIp);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, code: result.code, error: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        routerId: result.routerId,
        status: "ONLINE",
      },
    });
  } catch (err) {
    console.error("[api/mikrotik-provisioning/register] unexpected error:", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", error: "An unexpected error occurred during router registration." },
      { status: 500 }
    );
  }
}
