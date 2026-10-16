// ====================================================================
// QC NetCore — SaaS Owner ISP management (pure logic).
// Thinly wrapped by /api/v1/admin/isps/*. Tested by tests/admin-isps.test.mjs.
// No server imports — safe for client code.
// ====================================================================

export const ORG_SLUG_MAX_LEN = 60;
export const ORG_NAME_MAX_LEN = 255;

export interface CreateOrgInput {
  name?: unknown;
  slug?: unknown;
  email?: unknown;
  phone?: unknown;
  currency?: unknown;
}

export interface ValidCreateOrg {
  name: string;
  slug: string;
  email: string;
  phone: string;
  currency: string;
}

export type OrgValidation =
  | { ok: true; value: ValidCreateOrg }
  | { ok: false; status: number; code: string; message: string };

/** Slugs are URL-safe: lowercase letters, digits, dashes. */
export function normalizeOrgSlug(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, ORG_SLUG_MAX_LEN);
}

export function validateCreateOrg(input: CreateOrgInput): OrgValidation {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    return { ok: false, status: 400, code: "NAME_REQUIRED", message: "The ISP needs a business name." };
  }
  if (name.length > ORG_NAME_MAX_LEN) {
    return { ok: false, status: 400, code: "NAME_TOO_LONG", message: "Business name is too long." };
  }
  const slug = normalizeOrgSlug(input.slug ?? name);
  if (slug.length < 3) {
    return { ok: false, status: 400, code: "BAD_SLUG", message: "Slug must be at least 3 characters (letters, digits, dashes)." };
  }
  const email = typeof input.email === "string" ? input.email.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, code: "BAD_EMAIL", message: "A valid contact email is required." };
  }
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  if (!phone) {
    return { ok: false, status: 400, code: "PHONE_REQUIRED", message: "A contact phone number is required." };
  }
  const currency =
    typeof input.currency === "string" && input.currency.trim() ? input.currency.trim().toUpperCase().slice(0, 10) : "KES";
  return { ok: true, value: { name, slug, email, phone, currency } };
}

export interface UpdateOrgInput {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  currency?: unknown;
  is_active?: unknown;
}

export type UpdateValidation =
  | { ok: true; value: Record<string, string | boolean>; empty: boolean }
  | { ok: false; status: number; code: string; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateUpdateOrg(input: UpdateOrgInput): UpdateValidation {
  const patch: Record<string, string | boolean> = {};
  if (input.name !== undefined) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) return { ok: false, status: 400, code: "BAD_NAME", message: "Business name cannot be empty." };
    patch.name = name;
  }
  if (input.email !== undefined) {
    const email = typeof input.email === "string" ? input.email.trim() : "";
    if (!EMAIL_RE.test(email)) return { ok: false, status: 400, code: "BAD_EMAIL", message: "A valid contact email is required." };
    patch.email = email;
  }
  if (input.phone !== undefined) {
    const phone = typeof input.phone === "string" ? input.phone.trim() : "";
    if (!phone) return { ok: false, status: 400, code: "BAD_PHONE", message: "Contact phone cannot be empty." };
    patch.phone = phone;
  }
  if (input.currency !== undefined) {
    const currency = typeof input.currency === "string" ? input.currency.trim().toUpperCase().slice(0, 10) : "";
    if (!currency) return { ok: false, status: 400, code: "BAD_CURRENCY", message: "Currency cannot be empty." };
    patch.currency = currency;
  }
  if (input.is_active !== undefined) {
    if (typeof input.is_active !== "boolean") {
      return { ok: false, status: 400, code: "BAD_STATUS", message: "is_active must be true or false." };
    }
    patch.is_active = input.is_active;
  }
  return { ok: true, value: patch, empty: Object.keys(patch).length === 0 };
}

export interface IspStatCounts {
  routers: number;
  customers: number;
  users: number;
  hotspotPlans: number;
  pppoePlans: number;
  vouchersAvailable: number;
  vouchersUsed: number;
  revenueCompleted: number;
  portalPublished: boolean;
}

export function emptyStats(): IspStatCounts {
  return {
    routers: 0,
    customers: 0,
    users: 0,
    hotspotPlans: 0,
    pppoePlans: 0,
    vouchersAvailable: 0,
    vouchersUsed: 0,
    revenueCompleted: 0,
    portalPublished: false,
  };
}

export interface StatRowInputs {
  routers: Array<{ organization_id: string }>;
  customers: Array<{ organization_id: string }>;
  plans: Array<{ organization_id: string; service_type: string }>;
  vouchers: Array<{ organization_id: string; status: string }>;
  profiles: Array<{ organization_id: string }>;
  payments: Array<{ organization_id: string; amount: number; status: string }>;
  portalConfigs: Array<{ organization_id: string; status: string }>;
}

/** Rolls raw table rows into per-org stat blocks (single pass each). */
export function aggregateIspStats(rows: StatRowInputs): Record<string, IspStatCounts> {
  const out: Record<string, IspStatCounts> = {};
  const at = (orgId: string): IspStatCounts => (out[orgId] ??= emptyStats());
  for (const r of rows.routers) at(r.organization_id).routers += 1;
  for (const r of rows.customers) at(r.organization_id).customers += 1;
  for (const r of rows.profiles) at(r.organization_id).users += 1;
  for (const r of rows.plans) {
    const s = at(r.organization_id);
    if (r.service_type === "HOTSPOT") s.hotspotPlans += 1;
    else if (r.service_type === "PPPOE") s.pppoePlans += 1;
  }
  for (const r of rows.vouchers) {
    const s = at(r.organization_id);
    if (r.status === "AVAILABLE") s.vouchersAvailable += 1;
    else if (r.status === "USED") s.vouchersUsed += 1;
  }
  for (const r of rows.payments) {
    if (r.status === "COMPLETED") at(r.organization_id).revenueCompleted += Number(r.amount) || 0;
  }
  for (const r of rows.portalConfigs) {
    if (r.status === "PUBLISHED") at(r.organization_id).portalPublished = true;
  }
  return out;
}
