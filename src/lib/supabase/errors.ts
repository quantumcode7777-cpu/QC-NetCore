// ====================================================================
// G-TECH ISP OPERATING SYSTEM
// Centralized Error Handler & Safe Message Classifier
// Converts database, auth, and runtime errors into short, human-readable
// messages. NEVER expose SQL errors, stack traces, env vars, or internals.
// ====================================================================

import type { PostgrestError } from "@supabase/supabase-js";

/**
 * User-facing error messages for common Supabase/PostgreSQL error codes.
 * Technical details are logged server-side only.
 */
const ERROR_MESSAGES: Record<string, string> = {
  // RLS / Auth errors
  PGRST116: "You don't have permission to perform this action.",
  PGRST301: "Your session has expired. Please sign in again.",
  "42501": "You don't have permission to perform this action.",
  "28000": "Your session has expired. Please sign in again.",

  // Constraint violations
  "23505": "A record with this information already exists.",
  "23503": "This action references a record that no longer exists.",
  "23514": "Please check the highlighted fields and try again.",
  "23502": "Please fill in all required fields and try again.",

  // Connection
  PGRST000: "The service is temporarily unavailable. Please try again.",
};

const CONTEXT_CODES: Record<string, string> = {
  "customers.list": "SUBSCRIBERS_LOAD_FAILED",
  "customers.create": "SUBSCRIBER_CREATE_FAILED",
  "customers.update": "SUBSCRIBER_UPDATE_FAILED",
  "plans.list": "PLANS_LOAD_FAILED",
  "routers.list": "ROUTERS_LOAD_FAILED",
  "payments.create": "PAYMENT_SAVE_FAILED",
  "payments.list": "PAYMENTS_LOAD_FAILED",
  "payments.revenueByDay": "REVENUE_LOAD_FAILED",
  "vouchers.generate": "VOUCHERS_GENERATE_FAILED",
  "invoices.list": "INVOICES_LOAD_FAILED",
  "noc.stats": "NOC_LOAD_FAILED",
  "settings.get": "SETTINGS_LOAD_FAILED",
  "settings.getOrganization": "SETTINGS_LOAD_FAILED",
  "settings.update": "SETTINGS_SAVE_FAILED",
  "settings.patch": "SETTINGS_SAVE_FAILED",
  "auth.login": "AUTH_LOGIN_FAILED",
  "auth.logout": "AUTH_LOGOUT_FAILED",
  "auth.profile": "AUTH_PROFILE_FAILED",
};

export interface AppError {
  userMessage: string;
  code: string;
  isRetryable: boolean;
}

/**
 * Converts a Supabase/PostgreSQL or runtime error into a safe AppError.
 * Logs technical details to console (server-side) without exposing them to users.
 */
export function handleSupabaseError(
  error: PostgrestError | Error | unknown,
  context: string
): AppError {
  const safeCode = CONTEXT_CODES[context] ?? "OPERATION_FAILED";

  if (error && typeof error === "object" && "code" in error) {
    const pgError = error as PostgrestError;

    // Log technical details server-side only
    console.error(`[G-Tech ISP] Database error in ${context}:`, {
      code: pgError.code,
      message: pgError.message,
      details: pgError.details,
      hint: pgError.hint,
    });

    const userMessage =
      ERROR_MESSAGES[pgError.code] ?? getContextualMessage(context);

    return {
      userMessage,
      code: safeCode,
      isRetryable: isRetryableCode(pgError.code),
    };
  }

  console.error(`[G-Tech ISP] Error in ${context}:`, error);

  return {
    userMessage: getContextualMessage(context),
    code: safeCode,
    isRetryable: true,
  };
}

/**
 * Returns a short, human-readable error message for a given operation context.
 */
function getContextualMessage(context: string): string {
  const contextMessages: Record<string, string> = {
    "customers.list": "Unable to load subscribers. Please try again.",
    "customers.create":
      "Subscriber could not be created. Please check the details and try again.",
    "customers.update": "Changes could not be saved. Please try again.",
    "plans.list": "Unable to load packages. Please try again.",
    "routers.list": "Unable to load routers. Please try again.",
    "payments.create": "Payment could not be completed. Please try again.",
    "payments.list": "Unable to load payments. Please try again.",
    "payments.revenueByDay": "Unable to load revenue data. Please try again.",
    "vouchers.generate": "Vouchers could not be generated. Please try again.",
    "invoices.list": "Unable to load invoices. Please try again.",
    "noc.stats": "The network service is temporarily unavailable.",
    "settings.get": "Unable to load settings. Please try again.",
    "settings.getOrganization": "Unable to load settings. Please try again.",
    "settings.update": "Changes could not be saved. Please try again.",
    "settings.patch": "Changes could not be saved. Please try again.",
    "auth.login": "Invalid email or password. Please try again.",
    "auth.logout": "Unable to sign out. Please try again.",
    "auth.profile": "Unable to load your profile. Please try again.",
  };

  return (
    contextMessages[context] ?? "Something went wrong. Please try again."
  );
}

/**
 * Classifies authentication errors into safe, user-friendly messages.
 * Never returns raw Supabase/PostgREST or network exception strings.
 */
export function classifyAuthError(
  error: unknown,
  mode: "login" | "register" | "reset" = "login"
): string {
  const rawMessage =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "").toLowerCase()
      : "";

  if (
    rawMessage.includes("invalid login credentials") ||
    rawMessage.includes("invalid_credentials")
  ) {
    return "Invalid email or password. Please check your credentials and try again.";
  }
  if (rawMessage.includes("email not confirmed")) {
    return "Please verify your email address before signing in.";
  }
  if (rawMessage.includes("already") || rawMessage.includes("exists")) {
    return "An account with this email address already exists.";
  }
  if (rawMessage.includes("rate limit") || rawMessage.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (rawMessage.includes("password")) {
    return "Password must be at least 6 characters long.";
  }

  if (mode === "register") {
    return "Account could not be created. Please try again.";
  }
  if (mode === "reset") {
    return "Unable to send password reset instructions. Please try again.";
  }
  return "Sign in failed. Please check your credentials and try again.";
}

/**
 * Ensures any message displayed to the user is free of technical/developer leaks
 * (SQL, PostgREST codes, env vars, stack traces, TypeError, endpoint paths).
 */
export function sanitizeUserMessage(
  candidate: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (typeof candidate !== "string") return fallback;
  const trimmed = candidate.trim();
  if (!trimmed || trimmed.length > 220) return fallback;

  const technicalPattern =
    /(pgrst\d*|postgres|sql|relation\s+"|syntax error|typeerror|referenceerror|econnrefused|enotfound|fetch failed|failed to fetch|dara[j]a_|supabase_|network_gateway|africastalking_|\/api\/v1\/|at\s+\w+\s*\(|undefined is not|cannot read propert)/i;

  if (technicalPattern.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}

function isRetryableCode(code: string): boolean {
  const nonRetryable = new Set([
    "23505",
    "23503",
    "23514",
    "23502",
    "42501",
    "PGRST116",
  ]);
  return !nonRetryable.has(code);
}
