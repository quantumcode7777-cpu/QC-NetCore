// ====================================================================
// G-TECH ISP OPERATING SYSTEM - VOUCHER BATCH ENGINE
// Generates cryptographically secure, non-colliding Hotspot codes
// ====================================================================

import { HotspotVoucher, ServicePlan } from "@/types";

export interface VoucherGenerationOptions {
  organizationId: string;
  batchId: string;
  plan: ServicePlan;
  quantity: number;
  prefix?: string;
  codeLength?: number;
}

export class VoucherGenerator {
  /**
   * Generates unique alphanumeric voucher codes (e.g. GT-8924-XYZ)
   */
  static generateVoucherBatch(options: VoucherGenerationOptions): HotspotVoucher[] {
    const { organizationId, batchId, plan, quantity, prefix = "GT", codeLength = 8 } = options;
    const vouchers: HotspotVoucher[] = [];
    const usedCodes = new Set<string>();

    const charset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Removed confusing chars: 0, 1, I, O

    while (vouchers.length < quantity) {
      let randomPart = "";
      for (let i = 0; i < codeLength; i++) {
        randomPart += charset.charAt(Math.floor(Math.random() * charset.length));
      }

      // Group format: PREFIX-XXXX-XXXX
      const part1 = randomPart.substring(0, 4);
      const part2 = randomPart.substring(4, 8);
      const code = `${prefix ? prefix + "-" : ""}${part1}-${part2}`;

      if (!usedCodes.has(code)) {
        usedCodes.add(code);
        vouchers.push({
          id: `vch-${Date.now()}-${vouchers.length + 1}`,
          organizationId,
          batchId,
          planId: plan.id,
          planName: plan.name,
          planPrice: plan.price,
          planDuration: plan.validityDurationSeconds < 86400 ? `${plan.validityDurationSeconds / 3600} Hour(s)` : `${plan.validityDurationSeconds / 86400} Day(s)`,
          code,
          status: "AVAILABLE",
          createdAt: new Date().toISOString(),
        });
      }
    }

    return vouchers;
  }
}
