import { NextRequest, NextResponse } from "next/server";
import { PlansService } from "@/lib/services";
import type { ServiceType } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as ServiceType | null;

  const result = await PlansService.list(type ?? undefined);

  if (result.error && !result.data) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 503 }
    );
  }

  return NextResponse.json({
    success: true,
    count: result.count ?? result.data?.length ?? 0,
    data: result.data ?? [],
  });
}
