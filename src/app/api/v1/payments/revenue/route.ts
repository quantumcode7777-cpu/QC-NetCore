import { NextRequest, NextResponse } from "next/server";
import { PaymentsService } from "@/lib/services";
import type { RevenuePeriod } from "@/lib/revenue";

export const dynamic = "force-dynamic";

// Read-only daily revenue aggregation for the dashboard chart.
// Uses the session-bound Supabase client inside PaymentsService.revenueByDay,
// so tenant isolation and staff-only SELECT policies (RLS) apply unchanged.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawDays = Number(searchParams.get("days") ?? 7);
  const days: RevenuePeriod = rawDays === 30 ? 30 : 7;

  const result = await PaymentsService.revenueByDay({ days });

  if (result.error && !result.data) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 503 }
    );
  }

  return NextResponse.json({
    success: true,
    data: result.data,
  });
}
