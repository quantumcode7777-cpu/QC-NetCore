import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MIN_DOWNLOAD_BYTES = 65_536; // 64 KB
const MAX_DOWNLOAD_BYTES = 2_097_152; // 2 MB per chunk (serverless-safe)

// Pre-generate a 64KB incompressible pseudo-random block once per worker
const SEED_BLOCK = (() => {
  const buf = new Uint8Array(65_536);
  let x = 0x13579bdf;
  for (let i = 0; i < buf.length; i++) {
    // xorshift32
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    buf[i] = x & 0xff;
  }
  return buf;
})();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "ping";

  if (mode === "download") {
    const requestedBytes = Number(searchParams.get("bytes") || 524_288);
    const totalBytes = Math.min(
      MAX_DOWNLOAD_BYTES,
      Math.max(
        MIN_DOWNLOAD_BYTES,
        Number.isFinite(requestedBytes) ? Math.floor(requestedBytes) : 524_288
      )
    );

    const payload = new Uint8Array(totalBytes);
    let offset = 0;
    while (offset < totalBytes) {
      const chunkLen = Math.min(SEED_BLOCK.length, totalBytes - offset);
      payload.set(SEED_BLOCK.subarray(0, chunkLen), offset);
      offset += chunkLen;
    }

    return new NextResponse(payload, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(totalBytes),
        "Cache-Control": "no-store, no-cache, must-revalidate, no-transform",
      },
    });
  }

  // Default: lightweight ping probe
  return NextResponse.json(
    {
      ok: true,
      ts: Date.now(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const buffer = await request.arrayBuffer();
    return NextResponse.json(
      {
        ok: true,
        receivedBytes: buffer.byteLength,
        ts: Date.now(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to read upload stream.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}
