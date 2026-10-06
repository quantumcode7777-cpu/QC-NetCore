// ============================================================================
// QC NETCORE — PHONE NUMBER VALIDATION, NORMALIZATION & INTERNATIONAL SUPPORT
// ============================================================================
// Supports Kenyan mobile numbers (07xxxxxxxx, 01xxxxxxxx, 2547xxxxxxxx,
// +2547xxxxxxxx) as the primary market while providing a standards-based E.164
// structure (country_code, phone_number, normalized_phone_number) for
// international numbers across supported ISP markets.
// ============================================================================

export interface NormalizedPhoneResult {
  valid: boolean;
  /** Original input string trimmed */
  rawInput: string;
  /** Dialing country code with leading plus, e.g. "+254" */
  countryCode: string;
  /** ISO-3166 alpha-2 country code when recognized, e.g. "KE" */
  isoCountry: string;
  /** National significant number without leading 0 or country code, e.g. "712052104" */
  nationalNumber: string;
  /** Canonical E.164 phone number, e.g. "+254712052104" */
  normalizedPhoneNumber: string;
  /** Numeric MSISDN without '+', e.g. "254712052104" (used by M-Pesa / gateways) */
  msisdn: string;
  /** Human-friendly display format, e.g. "+254 712 052 104" */
  formattedDisplay: string;
  /** Validation error message if valid === false */
  error?: string;
}

interface CountryDialingRule {
  dialCode: string; // digits only, e.g. "254"
  iso: string;
  name: string;
  minNationalLength: number;
  maxNationalLength: number;
}

export const COUNTRY_DIALING_RULES: CountryDialingRule[] = [
  { dialCode: "254", iso: "KE", name: "Kenya", minNationalLength: 9, maxNationalLength: 9 },
  { dialCode: "256", iso: "UG", name: "Uganda", minNationalLength: 9, maxNationalLength: 9 },
  { dialCode: "255", iso: "TZ", name: "Tanzania", minNationalLength: 9, maxNationalLength: 9 },
  { dialCode: "250", iso: "RW", name: "Rwanda", minNationalLength: 9, maxNationalLength: 9 },
  { dialCode: "234", iso: "NG", name: "Nigeria", minNationalLength: 10, maxNationalLength: 10 },
  { dialCode: "233", iso: "GH", name: "Ghana", minNationalLength: 9, maxNationalLength: 9 },
  { dialCode: "27", iso: "ZA", name: "South Africa", minNationalLength: 9, maxNationalLength: 9 },
  { dialCode: "20", iso: "EG", name: "Egypt", minNationalLength: 10, maxNationalLength: 10 },
  { dialCode: "260", iso: "ZM", name: "Zambia", minNationalLength: 9, maxNationalLength: 9 },
  { dialCode: "263", iso: "ZW", name: "Zimbabwe", minNationalLength: 9, maxNationalLength: 9 },
  { dialCode: "265", iso: "MW", name: "Malawi", minNationalLength: 9, maxNationalLength: 9 },
  { dialCode: "243", iso: "CD", name: "DR Congo", minNationalLength: 9, maxNationalLength: 9 },
  { dialCode: "242", iso: "CG", name: "Republic of the Congo", minNationalLength: 9, maxNationalLength: 9 },
  { dialCode: "237", iso: "CM", name: "Cameroon", minNationalLength: 9, maxNationalLength: 9 },
  { dialCode: "225", iso: "CI", name: "Côte d'Ivoire", minNationalLength: 10, maxNationalLength: 10 },
  { dialCode: "221", iso: "SN", name: "Senegal", minNationalLength: 9, maxNationalLength: 9 },
  { dialCode: "229", iso: "BJ", name: "Benin", minNationalLength: 8, maxNationalLength: 10 },
  { dialCode: "226", iso: "BF", name: "Burkina Faso", minNationalLength: 8, maxNationalLength: 8 },
  { dialCode: "232", iso: "SL", name: "Sierra Leone", minNationalLength: 8, maxNationalLength: 8 },
  { dialCode: "91", iso: "IN", name: "India", minNationalLength: 10, maxNationalLength: 10 },
  { dialCode: "92", iso: "PK", name: "Pakistan", minNationalLength: 10, maxNationalLength: 10 },
  { dialCode: "66", iso: "TH", name: "Thailand", minNationalLength: 9, maxNationalLength: 9 },
  { dialCode: "44", iso: "GB", name: "United Kingdom", minNationalLength: 10, maxNationalLength: 10 },
  { dialCode: "1", iso: "US", name: "United States / Canada", minNationalLength: 10, maxNationalLength: 10 },
];

/**
 * Validates and normalizes a phone number into canonical E.164 (`+254712052104`)
 * and structured metadata (`countryCode`, `nationalNumber`, `normalizedPhoneNumber`).
 *
 * Examples for Kenya (default country code `+254`):
 *   "0712052104"    -> "+254712052104"
 *   "+254712052104" -> "+254712052104"
 *   "254712052104"  -> "+254712052104"
 *   "0722 123 456"  -> "+254722123456"
 *   "0110 123 456"  -> "+254110123456"
 */
export function validateAndNormalizePhone(
  input: unknown,
  defaultCountryCode = "+254"
): NormalizedPhoneResult {
  const rawInput = typeof input === "string" ? input.trim() : "";

  const invalid = (error: string): NormalizedPhoneResult => ({
    valid: false,
    rawInput,
    countryCode: defaultCountryCode.startsWith("+")
      ? defaultCountryCode
      : `+${defaultCountryCode}`,
    isoCountry: "KE",
    nationalNumber: "",
    normalizedPhoneNumber: "",
    msisdn: "",
    formattedDisplay: rawInput,
    error,
  });

  if (!rawInput) {
    return invalid("Phone number is required.");
  }

  // Reject alphabetic characters or invalid symbols
  if (/[^0-9+\s()-]/.test(rawInput)) {
    return invalid("Phone number may only contain digits, '+', spaces, or hyphens.");
  }

  // Ensure '+' only appears at index 0 if present
  const plusCount = (rawInput.match(/\+/g) || []).length;
  if (plusCount > 1 || (plusCount === 1 && !rawInput.startsWith("+"))) {
    return invalid("Country code '+' sign must appear only at the beginning of the phone number.");
  }

  const hasLeadingPlus = rawInput.startsWith("+");
  const digitsOnly = rawInput.replace(/[^0-9]/g, "");

  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return invalid("Enter a valid phone number (e.g. 0712052104 or +254712052104).");
  }

  const defaultDialDigits = defaultCountryCode.replace(/[^0-9]/g, "") || "254";

  let dialCode = defaultDialDigits;
  let isoCountry = "KE";
  let nationalNumber = "";

  // Case 1: National Kenyan number starting with 07 or 01 (10 digits: 0712052104)
  if (!hasLeadingPlus && digitsOnly.startsWith("0") && defaultDialDigits === "254") {
    nationalNumber = digitsOnly.slice(1);
    dialCode = "254";
    isoCountry = "KE";
  }
  // Case 2: 9-digit Kenyan subscriber number without leading 0 (e.g. 712052104 or 112052104)
  else if (
    !hasLeadingPlus &&
    digitsOnly.length === 9 &&
    /^[71][0-9]{8}$/.test(digitsOnly) &&
    defaultDialDigits === "254"
  ) {
    nationalNumber = digitsOnly;
    dialCode = "254";
    isoCountry = "KE";
  }
  // Case 3: Starts with 00 international prefix (e.g. 00254712052104)
  else if (!hasLeadingPlus && digitsOnly.startsWith("00") && digitsOnly.length >= 11) {
    const withoutZeroZero = digitsOnly.slice(2);
    const matchedRule = matchCountryRule(withoutZeroZero);
    if (matchedRule) {
      dialCode = matchedRule.dialCode;
      isoCountry = matchedRule.iso;
      nationalNumber = withoutZeroZero.slice(dialCode.length);
    } else {
      return invalid("Unrecognized international country code.");
    }
  }
  // Case 4: International format with '+' or starting with country code digits (e.g. +254712052104 or 254712052104)
  else {
    const matchedRule = matchCountryRule(digitsOnly);
    if (matchedRule) {
      dialCode = matchedRule.dialCode;
      isoCountry = matchedRule.iso;
      nationalNumber = digitsOnly.slice(dialCode.length);
      // Strip accidental trunk '0' after country code (e.g. +2540712052104 -> 712052104)
      if (nationalNumber.startsWith("0") && nationalNumber.length === matchedRule.maxNationalLength + 1) {
        nationalNumber = nationalNumber.slice(1);
      }
    } else if (hasLeadingPlus && digitsOnly.length >= 10 && digitsOnly.length <= 15) {
      // Generic ITU-T E.164 international fallback (3-digit or 2-digit country code)
      dialCode = digitsOnly.slice(0, 3);
      isoCountry = "INTL";
      nationalNumber = digitsOnly.slice(3);
    } else {
      return invalid("Enter a valid Kenyan (07XXXXXXXX / +2547XXXXXXXX) or international (+CountryCode) phone number.");
    }
  }

  // Country-specific validation
  if (dialCode === "254") {
    // Kenyan mobile numbers: 9 national digits starting with 7 (070x-079x) or 1 (010x-011x)
    if (!/^(7[0-9]{8}|1[01][0-9]{7})$/.test(nationalNumber)) {
      return invalid(
        "Enter a valid Kenyan mobile number (e.g. 0712052104, 0722xxxxxx, 0110xxxxxx, or +254712052104)."
      );
    }
  } else {
    const rule = COUNTRY_DIALING_RULES.find((r) => r.dialCode === dialCode);
    if (rule) {
      if (
        nationalNumber.length < rule.minNationalLength ||
        nationalNumber.length > rule.maxNationalLength ||
        nationalNumber.startsWith("0")
      ) {
        return invalid(
          `Enter a valid ${rule.name} phone number (+${rule.dialCode} followed by ${rule.minNationalLength} digits).`
        );
      }
    } else if (nationalNumber.length < 6 || nationalNumber.length > 12) {
      return invalid("Enter a valid international phone number in E.164 format.");
    }
  }

  const msisdn = `${dialCode}${nationalNumber}`;
  const normalizedPhoneNumber = `+${msisdn}`;
  const countryCode = `+${dialCode}`;
  const formattedDisplay = formatNormalizedPhoneDisplay(dialCode, nationalNumber);

  return {
    valid: true,
    rawInput,
    countryCode,
    isoCountry,
    nationalNumber,
    normalizedPhoneNumber,
    msisdn,
    formattedDisplay,
  };
}

function matchCountryRule(digits: string): CountryDialingRule | undefined {
  // Sort by longest dialCode first so 3-digit codes (254) match before 2-digit codes (20/27)
  const sorted = [...COUNTRY_DIALING_RULES].sort(
    (a, b) => b.dialCode.length - a.dialCode.length
  );
  return sorted.find((r) => digits.startsWith(r.dialCode));
}

export function formatNormalizedPhoneDisplay(dialCode: string, nationalNumber: string): string {
  if (dialCode === "254" && nationalNumber.length === 9) {
    return `+254 ${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`;
  }
  if (nationalNumber.length === 9) {
    return `+${dialCode} ${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`;
  }
  if (nationalNumber.length === 10) {
    return `+${dialCode} ${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`;
  }
  return `+${dialCode} ${nationalNumber}`;
}

/**
 * Formats any raw phone string into a readable international display string
 * if valid, or returns the original string safely.
 */
export function formatPhoneForDisplay(phone?: string | null): string {
  if (!phone) return "—";
  const parsed = validateAndNormalizePhone(phone);
  return parsed.valid ? parsed.formattedDisplay : phone;
}

/**
 * Checks whether two phone number strings represent the exact same normalized subscriber number.
 */
export function isSamePhoneNumber(a: string, b: string): boolean {
  const normA = validateAndNormalizePhone(a);
  const normB = validateAndNormalizePhone(b);
  if (!normA.valid || !normB.valid) return false;
  return normA.normalizedPhoneNumber === normB.normalizedPhoneNumber;
}
