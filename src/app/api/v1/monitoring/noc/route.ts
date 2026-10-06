import { NextResponse } from "next/server";
import { NOCService } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await NOCService.getStats();

  return NextResponse.json({
    success: true,
    data: result.data,
    ...(result.error ? { warning: result.error } : {}),
  });
}
