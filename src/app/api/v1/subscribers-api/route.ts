import { NextRequest, NextResponse } from "next/server";
import { CustomerService } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const search = searchParams.get("q") ?? undefined;

  const result = await CustomerService.list({
    status,
    searchQuery: search,
  });

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, phoneNumber, email, physicalAddress, siteId, altPhoneNumber, nationalId } = body;

    if (!fullName || !phoneNumber) {
      return NextResponse.json(
        { success: false, error: "Full name and phone number are required." },
        { status: 400 }
      );
    }

    let organizationId = "org-gtech-kenya-01";
    try {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.organization_id) {
          organizationId = profile.organization_id;
        }
      }
    } catch {
      // Fallback for isolated demo mode
    }

    const result = await CustomerService.create(
      organizationId,
      { fullName, phoneNumber, email, physicalAddress, siteId, altPhoneNumber, nationalId }
    );

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Customer provisioned successfully",
        data: result.data,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to create customer. Please try again." },
      { status: 500 }
    );
  }
}
