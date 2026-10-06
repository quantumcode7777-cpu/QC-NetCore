// ====================================================================
// G-TECH ISP OPERATING SYSTEM
// Payments Service — Data Access Layer
// Supports Real Multi-Tenant Payment Ledgers & Demo Payment Transactions
// ====================================================================

import type { Payment } from "@/types";
import { SEED_PAYMENTS } from "@/lib/db/mock-db";
import { handleSupabaseError } from "@/lib/supabase/errors";
import {
  aggregateRevenueByDay,
  type RevenuePeriod,
  type RevenueSeries,
} from "@/lib/revenue";
import type { ServiceResult } from "./customers.service";

const SUPABASE_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://[PROJECT_REF].supabase.co"
);

export class PaymentsService {
  private static async checkIsDemo(explicitDemo?: boolean): Promise<boolean> {
    if (explicitDemo !== undefined) return explicitDemo;
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      return cookieStore.get("gtech_demo_mode")?.value === "true";
    } catch {
      return false;
    }
  }

  static async list(options: { customerId?: string; limit?: number; isDemo?: boolean } = {}): Promise<ServiceResult<Payment[]>> {
    const isDemo = await this.checkIsDemo(options.isDemo);

    if (isDemo) {
      let data = [...SEED_PAYMENTS];
      if (options.customerId) {
        data = data.filter((p) => p.customerId === options.customerId);
      }
      return { data, error: null, count: data.length };
    }

    if (!SUPABASE_READY) {
      return { data: [], error: null, count: 0 };
    }

    try {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let orgId: string | undefined;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .maybeSingle();
        orgId = profile?.organization_id ?? undefined;
      }

      let query = supabase
        .from("payments")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(options.limit ?? 100);

      if (orgId) {
        query = query.eq("organization_id", orgId);
      }
      if (options.customerId) {
        query = query.eq("customer_id", options.customerId);
      }

      const { data, error, count } = await query;

      if (error) {
        const appError = handleSupabaseError(error, "payments.list");
        return { data: null, error: appError.userMessage };
      }

      const payments: Payment[] = (data ?? []).map(mapPaymentRow);
      return { data: payments, error: null, count: count ?? payments.length };
    } catch (err) {
      const appError = handleSupabaseError(err, "payments.list");
      return { data: null, error: appError.userMessage };
    }
  }

  static async revenueByDay(options: { days?: RevenuePeriod; isDemo?: boolean } = {}): Promise<ServiceResult<RevenueSeries>> {
    const days: RevenuePeriod = options.days === 30 ? 30 : 7;
    const isDemo = await this.checkIsDemo(options.isDemo);

    if (isDemo) {
      return {
        data: aggregateRevenueByDay(SEED_PAYMENTS, days),
        error: null,
      };
    }

    if (!SUPABASE_READY) {
      return {
        data: aggregateRevenueByDay([], days),
        error: null,
      };
    }

    try {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let orgId: string | undefined;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .maybeSingle();
        orgId = profile?.organization_id ?? undefined;
      }

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (days + 2));

      let query = supabase
        .from("payments")
        .select("amount, status, processed_at, created_at")
        .eq("status", "COMPLETED")
        .gte("created_at", cutoff.toISOString())
        .order("created_at", { ascending: true });

      if (orgId) {
        query = query.eq("organization_id", orgId);
      }

      const { data, error } = await query;

      if (error) {
        const appError = handleSupabaseError(error, "payments.revenueByDay");
        return { data: null, error: appError.userMessage };
      }

      const rows = (data ?? []).map((r) => ({
        amount: Number(r.amount),
        status: r.status as string,
        processedAt: (r.processed_at as string | null) ?? undefined,
        createdAt: r.created_at as string,
      }));

      return {
        data: aggregateRevenueByDay(rows, days),
        error: null,
      };
    } catch (err) {
      const appError = handleSupabaseError(err, "payments.revenueByDay");
      return { data: null, error: appError.userMessage };
    }
  }

  static async recordMpesaPayment(payload: {
    organizationId: string;
    customerId?: string;
    invoiceId?: string;
    amount: number;
    transactionReference: string;
    msisdnPhone: string;
    senderName?: string;
    paymentMethod: Payment["paymentMethod"];
    rawPayload: unknown;
  }): Promise<ServiceResult<Payment>> {
    if (!SUPABASE_READY) {
      const mockPayment: Payment = {
        id: `pay-${Date.now()}`,
        organizationId: payload.organizationId,
        customerId: payload.customerId,
        invoiceId: payload.invoiceId,
        paymentMethod: payload.paymentMethod,
        amount: payload.amount,
        currency: "KES",
        transactionReference: payload.transactionReference,
        msisdnPhone: payload.msisdnPhone,
        senderName: payload.senderName,
        status: "COMPLETED",
        processedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      return { data: mockPayment, error: null };
    }

    try {
      const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
      const supabase = createSupabaseServiceClient();

      const { data, error } = await supabase
        .from("payments")
        .insert({
          organization_id: payload.organizationId,
          customer_id: payload.customerId ?? null,
          invoice_id: payload.invoiceId ?? null,
          payment_method: payload.paymentMethod,
          amount: payload.amount,
          currency: "KES",
          transaction_reference: payload.transactionReference,
          msisdn_phone: payload.msisdnPhone,
          sender_name: payload.senderName ?? null,
          status: "COMPLETED",
          raw_payload: (payload.rawPayload as unknown) as import("@/types/database.types").Json,
          processed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        // 23505 = unique_violation on transaction_reference: this is a replayed
        // or retried callback. Return the original record; do not double-count.
        if ((error as { code?: string }).code === "23505") {
          const { data: existing } = await supabase
            .from("payments")
            .select()
            .eq("transaction_reference", payload.transactionReference)
            .maybeSingle();
          if (existing) {
            return { data: mapPaymentRow(existing), error: null };
          }
        }
        const appError = handleSupabaseError(error, "payments.create");
        return { data: null, error: appError.userMessage };
      }

      return { data: mapPaymentRow(data), error: null };
    } catch (err) {
      const appError = handleSupabaseError(err, "payments.create");
      return { data: null, error: appError.userMessage };
    }
  }
}

function mapPaymentRow(row: Record<string, unknown>): Payment {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    customerId: row.customer_id as string | undefined,
    customerName: row.customer_name as string | undefined,
    accountNumber: row.account_number as string | undefined,
    invoiceId: row.invoice_id as string | undefined,
    paymentMethod: row.payment_method as Payment["paymentMethod"],
    amount: Number(row.amount),
    currency: row.currency as string,
    transactionReference: row.transaction_reference as string,
    msisdnPhone: row.msisdn_phone as string,
    senderName: row.sender_name as string | undefined,
    status: row.status as Payment["status"],
    processedAt: row.processed_at as string | undefined,
    createdAt: row.created_at as string,
  };
}
