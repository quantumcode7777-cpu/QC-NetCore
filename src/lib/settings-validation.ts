// ====================================================================
// G-TECH ISP OPERATING SYSTEM
// Organization Settings Validation
// Shared between client forms, API route handlers, and unit tests.
// ====================================================================

export const SUPPORTED_CURRENCIES = ["KES", "UGX", "TZS", "USD"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const SUPPORTED_TIMEZONES = [
  "Africa/Nairobi",
  "Africa/Kampala",
  "Africa/Dar_es_Salaam",
  "Africa/Kigali",
  "Africa/Johannesburg",
  "UTC",
] as const;

export const BILLING_CYCLE_TYPES = ["ANNIVERSARY", "CALENDAR_MONTH"] as const;
export type BillingCycleType = (typeof BILLING_CYCLE_TYPES)[number];

export interface OrganizationSettingsInput {
  name: string;
  business_number: string | null;
  email: string;
  phone: string;
  currency: SupportedCurrency;
  timezone: string;
  billing_cycle_type: BillingCycleType;
  grace_period_days: number;
}

export interface ValidationResult {
  valid: boolean;
  data?: OrganizationSettingsInput;
  errors: Partial<Record<keyof OrganizationSettingsInput | "general", string>>;
}

const ALLOWED_KEYS = new Set([
  "name",
  "business_number",
  "email",
  "phone",
  "currency",
  "timezone",
  "billing_cycle_type",
  "grace_period_days",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s()-]{6,28}$/;

function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 50) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function validateOrganizationSettingsInput(
  raw: unknown
): ValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      valid: false,
      errors: { general: "Request body must be a JSON object." },
    };
  }

  const record = raw as Record<string, unknown>;
  const errors: ValidationResult["errors"] = {};

  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key)) {
      return {
        valid: false,
        errors: { general: `Unsupported setting field: "${key}".` },
      };
    }
  }

  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (name.length < 2 || name.length > 120) {
    errors.name = "Business name must be between 2 and 120 characters.";
  }

  let businessNumber: string | null = null;
  if (
    record.business_number !== undefined &&
    record.business_number !== null &&
    String(record.business_number).trim() !== ""
  ) {
    const bn = String(record.business_number).trim();
    if (bn.length > 50) {
      errors.business_number = "Business or Paybill number must be 50 characters or fewer.";
    } else {
      businessNumber = bn;
    }
  }

  const email = typeof record.email === "string" ? record.email.trim() : "";
  if (!email || email.length > 255 || !EMAIL_RE.test(email)) {
    errors.email = "Enter a valid support email address.";
  }

  const phone = typeof record.phone === "string" ? record.phone.trim() : "";
  if (!phone || !PHONE_RE.test(phone)) {
    errors.phone = "Enter a valid support phone number (7–29 digits).";
  }

  const currencyRaw =
    typeof record.currency === "string" ? record.currency.trim().toUpperCase() : "";
  if (!SUPPORTED_CURRENCIES.includes(currencyRaw as SupportedCurrency)) {
    errors.currency = `Currency must be one of: ${SUPPORTED_CURRENCIES.join(", ")}.`;
  }

  const timezone =
    typeof record.timezone === "string" ? record.timezone.trim() : "";
  if (!isValidTimeZone(timezone)) {
    errors.timezone = "Select a valid IANA timezone (e.g. Africa/Nairobi).";
  }

  const billingCycleRaw =
    typeof record.billing_cycle_type === "string"
      ? record.billing_cycle_type.trim().toUpperCase()
      : "";
  if (!BILLING_CYCLE_TYPES.includes(billingCycleRaw as BillingCycleType)) {
    errors.billing_cycle_type =
      "Billing cycle must be ANNIVERSARY or CALENDAR_MONTH.";
  }

  const graceRaw = Number(record.grace_period_days);
  if (!Number.isInteger(graceRaw) || graceRaw < 0 || graceRaw > 30) {
    errors.grace_period_days =
      "Grace period must be a whole number between 0 and 30 days.";
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    data: {
      name,
      business_number: businessNumber,
      email,
      phone,
      currency: currencyRaw as SupportedCurrency,
      timezone,
      billing_cycle_type: billingCycleRaw as BillingCycleType,
      grace_period_days: graceRaw,
    },
  };
}
