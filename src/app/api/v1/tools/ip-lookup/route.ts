import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isPrivateOrLocalIp(ip: string): boolean {
  const clean = ip.trim().toLowerCase();
  if (
    !clean ||
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean === "localhost" ||
    clean.startsWith("10.") ||
    clean.startsWith("192.168.") ||
    clean.startsWith("169.254.") ||
    clean.startsWith("fc") ||
    clean.startsWith("fd") ||
    clean.startsWith("fe80:")
  ) {
    return true;
  }
  if (clean.startsWith("172.")) {
    const second = Number(clean.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function detectIpVersion(ip: string): "IPv4" | "IPv6" {
  return ip.includes(":") ? "IPv6" : "IPv4";
}

export async function GET(request: NextRequest) {
  try {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-real-ip") ||
      (forwardedFor ? forwardedFor.split(",")[0].trim() : "");

    const targetIp = realIp && !isPrivateOrLocalIp(realIp) ? realIp : "";
    const lookupUrl = targetIp
      ? `https://ipwho.is/${encodeURIComponent(targetIp)}`
      : "https://ipwho.is/";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(lookupUrl, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.success !== false && data.ip) {
          const resolvedIp = String(data.ip);
          return NextResponse.json(
            {
              success: true,
              ip: resolvedIp,
              version:
                data.type === "IPv4" || data.type === "IPv6"
                  ? data.type
                  : detectIpVersion(resolvedIp),
              isp:
                data.connection?.isp ||
                data.connection?.org ||
                "Public Network Provider",
              org:
                data.connection?.org ||
                data.connection?.isp ||
                "Autonomous System Network",
              asn: data.connection?.asn
                ? `AS${String(data.connection.asn).replace(/^AS/i, "")}`
                : "N/A",
              domain: data.connection?.domain || null,
              country: data.country || "Unknown",
              region: data.region || null,
              city: data.city || null,
              timezone: data.timezone?.id || data.timezone?.utc || "UTC",
            },
            {
              headers: { "Cache-Control": "no-store, max-age=0" },
            }
          );
        }
      }
    } catch {
      clearTimeout(timeoutId);
    }

    // Fallback to header IP if upstream enrichment service is unreachable
    if (targetIp) {
      return NextResponse.json(
        {
          success: true,
          ip: targetIp,
          version: detectIpVersion(targetIp),
          isp: "Detected via Edge Gateway",
          org: "Public Internet Endpoint",
          asn: "N/A",
          domain: null,
          country: request.headers.get("x-vercel-ip-country") || "Unknown",
          region: request.headers.get("x-vercel-ip-country-region") || null,
          city: request.headers.get("x-vercel-ip-city") || null,
          timezone: request.headers.get("x-vercel-ip-timezone") || "UTC",
        },
        {
          headers: { "Cache-Control": "no-store, max-age=0" },
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to resolve public IP metadata from server endpoint.",
      },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "IP lookup service is temporarily unavailable.",
      },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
