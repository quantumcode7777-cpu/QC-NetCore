// ====================================================================
// QC NetCore — Hotspot voucher batch creation (pure logic).
// Thinly wrapped by POST /api/v1/vouchers/batch. Tested by
// tests/voucher-batch.test.mjs. No server imports — safe for client code.
// ====================================================================

import { randomInt } from "node:crypto";

/** Ambiguous glyphs (0/1/I/O) excluded so printed codes can't be misread. */
export const VOUCHER_CODE_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const VOUCHER_CODE_RANDOM_LENGTH = 8;
export const VOUCHER_BATCH_MIN_QTY = 1;
export const VOUCHER_BATCH_MAX_QTY = 500;
export const VOUCHER_PREFIX_MAX_LEN = 6;

export interface BatchRequestInput {
  planId?: unknown;
  quantity?: unknown;
  prefix?: unknown;
}

export interface ValidBatchRequest {
  planId: string;
  quantity: number;
  /** Normalized (UPPERCASE alphanumerics, max 6 chars) — "" means no prefix. */
  prefix: string;
}

export type BatchValidation =
  | { ok: true; value: ValidBatchRequest }
  | { ok: false; status: number; code: string; message: string };

export function normalizeBatchPrefix(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, VOUCHER_PREFIX_MAX_LEN);
}

export function validateBatchRequest(input: BatchRequestInput): BatchValidation {
  const planId = typeof input.planId === "string" ? input.planId.trim() : "";
  if (!planId) {
    return { ok: false, status: 400, code: "PLAN_REQUIRED", message: "Choose a hotspot package for this batch." };
  }
  const quantity =
    typeof input.quantity === "number" ? input.quantity : Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < VOUCHER_BATCH_MIN_QTY || quantity > VOUCHER_BATCH_MAX_QTY) {
    return {
      ok: false,
      status: 400,
      code: "BAD_QUANTITY",
      message: `Quantity must be a whole number between ${VOUCHER_BATCH_MIN_QTY} and ${VOUCHER_BATCH_MAX_QTY}.`,
    };
  }
  return { ok: true, value: { planId, quantity, prefix: normalizeBatchPrefix(input.prefix) } };
}

export function formatPlanDuration(validityDurationSeconds: number): string {
  if (!Number.isFinite(validityDurationSeconds) || validityDurationSeconds <= 0) return "";
  if (validityDurationSeconds < 86400) {
    const h = validityDurationSeconds / 3600;
    return `${Number.isInteger(h) ? h : h.toFixed(1)} Hour(s)`;
  }
  const d = validityDurationSeconds / 86400;
  return `${Number.isInteger(d) ? d : d.toFixed(1)} Day(s)`;
}

/** Printable code shape: PREFIX-XXXX-XXXX (or XXXX-XXXX with no prefix). */
export function buildVoucherCode(prefix: string, randomPart: string): string {
  const p1 = randomPart.substring(0, 4);
  const p2 = randomPart.substring(4, 8);
  return prefix ? `${prefix}-${p1}-${p2}` : `${p1}-${p2}`;
}

export type RandInt = (max: number) => number;

const defaultRand: RandInt = (max) => randomInt(max);

export function randomCodePart(rand: RandInt = defaultRand): string {
  let out = "";
  for (let i = 0; i < VOUCHER_CODE_RANDOM_LENGTH; i++) {
    out += VOUCHER_CODE_CHARSET[rand(VOUCHER_CODE_CHARSET.length)];
  }
  return out;
}

/**
 * Generates `count` unique codes, skipping anything already in `taken`
 * (in-batch set + caller-supplied existing codes). `rand` is injectable
 * for deterministic tests. Throws VOCHER_CODE_EXHAUSTED if the namespace
 * is saturated (practically unreachable: 32^8 combinations).
 */
export function generateBatchCodes(
  prefix: string,
  count: number,
  taken: Set<string> = new Set(),
  rand: RandInt = defaultRand
): string[] {
  const codes: string[] = [];
  const seen = new Set(taken);
  let guard = 0;
  while (codes.length < count) {
    if (++guard > count * 50 + 100) throw new Error("VOUCHER_CODE_EXHAUSTED");
    const code = buildVoucherCode(prefix, randomCodePart(rand));
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes;
}
