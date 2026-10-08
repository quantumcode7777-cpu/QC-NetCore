import { NextRequest, NextResponse } from "next/server";
import { resolveActor, issueBootstrap } from "@/lib/provisioning/service";
import { validateBootstrapRequest } from "@/lib/provisioning/core";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const actorResult = await resolveActor();
    if (!actorResult.ok) {
      return NextResponse.json(
        { success: false, code: actorResult.code, error: actorResult.message },
        { status: actorResult.status }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, code: "INVALID_JSON", error: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const validation = validateBootstrapRequest(body);
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, code: "VALIDATION_ERROR", error: validation.message, field: validation.field },
        { status: 400 }
      );
    }

    const result = await issueBootstrap(actorResult.actor, validation.value);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, code: result.code, error: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        script: result.script,
        filename: result.filename,
        expiresAt: result.expiresAt,
        status: result.status,
        routerName: result.routerName,
      },
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[api/mikrotik-provisioning/bootstrap] unexpected error:", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", error: "An unexpected error occurred while generating the provisioning script." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const actorResult = await resolveActor();
    if (!actorResult.ok) {
      return NextResponse.json(
        { success: false, code: actorResult.code, error: actorResult.message },
        { status: actorResult.status }
      );
    }

    const { searchParams } = new URL(req.url);
    const tokenId = searchParams.get("tokenId");
    if (!tokenId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tokenId)) {
      return NextResponse.json(
        { success: false, code: "INVALID_TOKEN_ID", error: "A valid tokenId UUID query parameter is required." },
        { status: 400 }
      );
    }

    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();

    // Query router_provisioning_tokens scoped strictly to the authenticated organization
    const { data, error } = await (supabase as any)
      .from("router_provisioning_tokens")
      .select("id, router_name, routeros_version, tunnel_ip, status, expires_at, consumed_at, created_at, router_id")
      .eq("id", tokenId)
      .eq("organization_id", actorResult.actor.organizationId)
      .maybeSingle();

    const tok = data as Record<string, any> | null;

    if (error || !tok) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", error: "Provisioning token not found in your organization." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: tok.id,
        routerName: tok.router_name,
        routerOsVersion: tok.routeros_version,
        tunnelIp: tok.tunnel_ip,
        status: tok.status,
        expiresAt: tok.expires_at,
        consumedAt: tok.consumed_at,
        createdAt: tok.created_at,
        routerId: tok.router_id,
      },
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[api/mikrotik-provisioning/bootstrap GET] unexpected error:", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", error: "An unexpected error occurred while fetching token status." },
      { status: 500 }
    );
  }
}
