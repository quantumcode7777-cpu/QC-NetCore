import { NextRequest, NextResponse } from "next/server";
import { isDemoRequest, jsonError } from "@/lib/captive/server";
import { getOrgClient } from "@/lib/sites/server";
import { validateSiteInput } from "@/lib/sites";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/v1/sites/:id — update a site. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!id) return jsonError(400, "INVALID_ID", "A site id is required.");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_REQUEST", "Request body must be JSON.");
  }

  const checked = validateSiteInput(body, true);
  if (!checked.ok) return jsonError(checked.status, checked.code, checked.message);

  if (await isDemoRequest()) {
    return NextResponse.json({ success: true, demo: true, data: { id, ...checked.value } });
  }

  try {
    const ctx = await getOrgClient();
    if (!ctx.ok) return ctx.response;

    const patch = {
      name: checked.value.name || undefined,
      location_description: Object.prototype.hasOwnProperty.call(body, "locationDescription")
        ? checked.value.locationDescription
        : undefined,
      latitude: Object.prototype.hasOwnProperty.call(body, "latitude") ? checked.value.latitude : undefined,
      longitude: Object.prototype.hasOwnProperty.call(body, "longitude") ? checked.value.longitude : undefined,
      power_backup_type: Object.prototype.hasOwnProperty.call(body, "powerBackupType")
        ? checked.value.powerBackupType
        : undefined,
      is_active: Object.prototype.hasOwnProperty.call(body, "isActive") ? checked.value.isActive : undefined,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await ctx.supabase
      .from("sites")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", ctx.orgId)
      .select("id, name, location_description, latitude, longitude, power_backup_type, is_active, created_at")
      .maybeSingle();

    if (error || !data) {
      return jsonError(404, "SITE_NOT_FOUND", "Site not found or you cannot edit it.");
    }
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[Sites] update failed:", err);
    return jsonError(503, "SITES_UNAVAILABLE", "Could not update the site. Please try again.");
  }
}

/** DELETE /api/v1/sites/:id — deactivate, preserving router/customer history. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!id) return jsonError(400, "INVALID_ID", "A site id is required.");

  if (await isDemoRequest()) {
    return NextResponse.json({ success: true, demo: true, data: { id, isActive: false } });
  }

  try {
    const ctx = await getOrgClient();
    if (!ctx.ok) return ctx.response;

    const { data, error } = await ctx.supabase
      .from("sites")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", ctx.orgId)
      .select("id, is_active")
      .maybeSingle();

    if (error || !data) {
      return jsonError(404, "SITE_NOT_FOUND", "Site not found or you cannot remove it.");
    }
    return NextResponse.json({
      success: true,
      data,
      message: "Site deactivated. Existing routers and customers were kept.",
    });
  } catch (err) {
    console.error("[Sites] deactivate failed:", err);
    return jsonError(503, "SITES_UNAVAILABLE", "Could not deactivate the site. Please try again.");
  }
}
