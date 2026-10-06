import { NextRequest, NextResponse } from "next/server";
import { PaymentsService } from "@/lib/services";

export const dynamic = "force-dynamic";

// Read-only payment ledger listing for the operations console.
// Uses the session-bound Supabase client inside PaymentsService.list, so
// tenant isolation and staff-only SELECT policies (RLS) apply unchanged.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 100;

  const result = await PaymentsService.list({ limit });

  if (result.error && !result.data) {
    return NextResponse.json({ success: false, error: result.error }, { status: 503 });
  }

  return NextResponse.json({
    success: true,
    count: result.count ?? result.data?.length ?? 0,
    data: result.data ?? [],
  });
}
