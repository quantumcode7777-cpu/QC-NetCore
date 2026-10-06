import { NextResponse } from "next/server";
import { RoutersService } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await RoutersService.list();

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
