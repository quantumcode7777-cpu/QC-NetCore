// ====================================================================
// G-TECH ISP OPERATING SYSTEM - FREERADIUS VSA & SQL MAPPER
// Generates MikroTik Vendor-Specific Attributes & FreeRADIUS rlm_sql entries
// ====================================================================

import { ServicePlan, PppoeAccount } from "@/types";

export interface RadCheckRecord {
  username: string;
  attribute: string;
  op: string;
  value: string;
}

export interface RadReplyRecord {
  username: string;
  attribute: string;
  op: string;
  value: string;
}

export class RadiusService {
  /**
   * Generates FreeRADIUS `radcheck` and `radreply` records for a PPPoE subscriber
   */
  static generatePppoeRadiusRecords(
    account: PppoeAccount,
    plan: ServicePlan,
    isActive: boolean
  ): { check: RadCheckRecord[]; reply: RadReplyRecord[] } {
    const check: RadCheckRecord[] = [
      {
        username: account.username,
        attribute: "Cleartext-Password",
        op: ":=",
        value: account.passwordPlain,
      },
    ];

    if (account.macAddress) {
      check.push({
        username: account.username,
        attribute: "Calling-Station-Id",
        op: "==",
        value: account.macAddress,
      });
    }

    const reply: RadReplyRecord[] = [];

    if (!isActive) {
      // Account is suspended: Assign to isolation pool / address list
      reply.push({
        username: account.username,
        attribute: "Mikrotik-Address-List",
        op: "=",
        value: "SUSPENDED_USERS",
      });
      reply.push({
        username: account.username,
        attribute: "Mikrotik-Rate-Limit",
        op: "=",
        value: "64k/64k",
      });
      return { check, reply };
    }

    // Active Account Attributes
    reply.push({
      username: account.username,
      attribute: "Mikrotik-Rate-Limit",
      op: "=",
      value: plan.mikrotikRateLimit,
    });

    if (account.ipAssignmentType === "STATIC" && account.staticIp) {
      reply.push({
        username: account.username,
        attribute: "Framed-IP-Address",
        op: "=",
        value: account.staticIp,
      });
    }

    reply.push({
      username: account.username,
      attribute: "Port-Limit",
      op: "=",
      value: String(plan.simultaneousSessions || 1),
    });

    return { check, reply };
  }

  /**
   * Generates FreeRADIUS attributes for a Hotspot Voucher
   */
  static generateVoucherRadiusRecords(
    voucherCode: string,
    plan: ServicePlan,
    validitySeconds: number
  ): { check: RadCheckRecord[]; reply: RadReplyRecord[] } {
    const check: RadCheckRecord[] = [
      {
        username: voucherCode,
        attribute: "Cleartext-Password",
        op: ":=",
        value: voucherCode,
      },
    ];

    const reply: RadReplyRecord[] = [
      {
        username: voucherCode,
        attribute: "Mikrotik-Rate-Limit",
        op: "=",
        value: plan.mikrotikRateLimit,
      },
      {
        username: voucherCode,
        attribute: "Session-Timeout",
        op: "=",
        value: String(validitySeconds),
      },
      {
        username: voucherCode,
        attribute: "Port-Limit",
        op: "=",
        value: "1",
      },
    ];

    return { check, reply };
  }
}
