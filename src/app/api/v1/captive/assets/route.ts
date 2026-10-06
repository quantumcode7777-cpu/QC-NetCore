import { NextRequest, NextResponse } from "next/server";
import {
  ASSET_KINDS,
  ASSET_MIME_TYPES,
  ASSET_RULES,
  PORTAL_ASSET_BUCKET,
  detectImageType,
  type AssetKind,
} from "@/lib/captive/config";
import { authorizePortalAdmin, isDemoRequest, jsonError, orgAssetPrefix, isOrgAssetUrlSafe } from "@/lib/captive/server";

export const dynamic = "force-dynamic";

/**
 * POST multipart/form-data { kind, file }
 * - tenant folder is derived from the session (never from the request)
 * - type is verified by magic bytes; SVG and anything else is rejected
 * - size limits per asset kind
 * - upload goes through the caller's own Supabase session, so Storage RLS
 *   (folder == auth_org_id()) is the final enforcement layer.
 */
export async function POST(req: NextRequest) {
  if (await isDemoRequest()) {
    return jsonError(403, "DEMO_READ_ONLY", "Sign in to an administrator account to upload images.");
  }
  const auth = await authorizePortalAdmin();
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Upload could not be read. Please try again.");
  }

  const kind = String(form.get("kind") ?? "") as AssetKind;
  const file = form.get("file");
  if (!ASSET_KINDS.includes(kind)) return jsonError(400, "VALIDATION_ERROR", "Unknown image type.");
  if (!(file instanceof File)) return jsonError(400, "VALIDATION_ERROR", "Choose an image to upload.");

  const rule = ASSET_RULES[kind];
  if (file.size === 0) return jsonError(400, "VALIDATION_ERROR", "The file is empty.");
  if (file.size > rule.maxBytes) {
    return jsonError(413, "FILE_TOO_LARGE", `Image is too large. Maximum size is ${Math.round(rule.maxBytes / 1024)} KB.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageType(bytes);
  if (!detected || !ASSET_MIME_TYPES[detected]) {
    return jsonError(415, "UNSUPPORTED_FILE", "Only PNG, JPEG, WebP or ICO images are allowed.");
  }
  if (kind === "favicon" && detected !== "image/png" && detected !== "image/x-icon") {
    return jsonError(415, "UNSUPPORTED_FILE", "Favicon must be a PNG or ICO file.");
  }

  const ext = ASSET_MIME_TYPES[detected];
  const path = `${orgId}/${kind}-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(PORTAL_ASSET_BUCKET).upload(path, bytes, {
    contentType: detected,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    console.error("[CaptivePortal] upload failed:", error.message);
    return jsonError(500, "UPLOAD_FAILED", "The image could not be uploaded. Please try again.");
  }

  const { data } = supabase.storage.from(PORTAL_ASSET_BUCKET).getPublicUrl(path);
  const url = data.publicUrl;
  // The stored URL must satisfy the same ownership rule the sanitizer enforces.
  if (!isOrgAssetUrlSafe(url, orgId)) {
    console.error("[CaptivePortal] upload produced unexpected URL host/prefix", orgAssetPrefix(orgId));
    return jsonError(500, "UPLOAD_FAILED", "The image could not be uploaded. Please try again.");
  }

  return NextResponse.json({ success: true, data: { url, kind, bytes: file.size } });
}
