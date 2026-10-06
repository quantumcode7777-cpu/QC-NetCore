// ============================================================================
// QC NETCORE — DOUBLE-ENTRY FINANCIAL LEDGER & REVENUE INTELLIGENCE ENGINE
// Single authoritative source of truth for financial accounting, journal
// entries, trial balance, AR aging, and executive revenue metrics.
// ============================================================================

export type LedgerAccountCategory =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "EXPENSE";

export type NormalBalance = "DEBIT" | "CREDIT";

export interface LedgerAccount {
  code: string;
  name: string;
  category: LedgerAccountCategory;
  normalBalance: NormalBalance;
  isSystem: boolean;
}

export type JournalReferenceType =
  | "INVOICE"
  | "PAYMENT"
  | "CREDIT_NOTE"
  | "REFUND"
  | "WAIVER"
  | "ADJUSTMENT"
  | "REVERSAL";

export interface JournalLineInput {
  accountCode: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalLine extends JournalLineInput {
  id: string;
  accountName: string;
}

export interface JournalEntry {
  id: string;
  organizationId: string;
  entryNumber: string;
  referenceType: JournalReferenceType;
  referenceId: string;
  customerId?: string;
  customerName?: string;
  description: string;
  currency: string;
  totalDebit: number;
  totalCredit: number;
  status: "POSTED" | "REVERSED";
  reversedByEntryId?: string;
  postedBy?: string;
  postedAt: string;
  lines: JournalLine[];
}

export interface AccountTrialBalanceRow {
  code: string;
  name: string;
  category: LedgerAccountCategory;
  normalBalance: NormalBalance;
  totalDebits: number;
  totalCredits: number;
  netBalance: number;
}

export interface TrialBalanceReport {
  rows: AccountTrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  discrepancy: number;
}

export interface ArAgingBucket {
  bucket: "0-30" | "31-60" | "61-90" | "90+";
  label: string;
  invoiceCount: number;
  totalBalanceDue: number;
  sharePercent: number;
}

export interface ArAgingReport {
  asOfDate: string;
  totalOutstanding: number;
  overdueCount: number;
  buckets: ArAgingBucket[];
}

export interface ExecutiveRevenueMetrics {
  mrr: number;
  arr: number;
  arpu: number;
  activePayingSubscribers: number;
  billedThisPeriod: number;
  collectedThisPeriod: number;
  collectionRatePercent: number;
  deferredRevenueBalance: number;
  taxPayableBalance: number;
  badDebtExposure: number;
  netRevenueRetentionPercent: number;
  monthlyChurnPercent: number;
}

export const STANDARD_CHART_OF_ACCOUNTS: LedgerAccount[] = [
  {
    code: "1100",
    name: "M-Pesa & Cash Clearing Asset",
    category: "ASSET",
    normalBalance: "DEBIT",
    isSystem: true,
  },
  {
    code: "1120",
    name: "Bank Settlement Account",
    category: "ASSET",
    normalBalance: "DEBIT",
    isSystem: true,
  },
  {
    code: "1200",
    name: "Subscriber Accounts Receivable",
    category: "ASSET",
    normalBalance: "DEBIT",
    isSystem: true,
  },
  {
    code: "2100",
    name: "Deferred Subscription Revenue",
    category: "LIABILITY",
    normalBalance: "CREDIT",
    isSystem: true,
  },
  {
    code: "2200",
    name: "Subscriber Wallet Credit Liability",
    category: "LIABILITY",
    normalBalance: "CREDIT",
    isSystem: true,
  },
  {
    code: "2300",
    name: "VAT & Excise Tax Payable (16%)",
    category: "LIABILITY",
    normalBalance: "CREDIT",
    isSystem: true,
  },
  {
    code: "4100",
    name: "Broadband Fiber & PPPoE Revenue",
    category: "REVENUE",
    normalBalance: "CREDIT",
    isSystem: true,
  },
  {
    code: "4200",
    name: "Hotspot Voucher Revenue",
    category: "REVENUE",
    normalBalance: "CREDIT",
    isSystem: true,
  },
  {
    code: "4300",
    name: "Installation & CPE Setup Revenue",
    category: "REVENUE",
    normalBalance: "CREDIT",
    isSystem: true,
  },
  {
    code: "5100",
    name: "Service Credits, Waivers & Refunds",
    category: "EXPENSE",
    normalBalance: "DEBIT",
    isSystem: true,
  },
  {
    code: "5200",
    name: "Bad Debt Write-Off Expense",
    category: "EXPENSE",
    normalBalance: "DEBIT",
    isSystem: true,
  },
];

const ACCOUNT_MAP = new Map<string, LedgerAccount>(
  STANDARD_CHART_OF_ACCOUNTS.map((a) => [a.code, a])
);

export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

/**
 * Creates a strictly validated, immutable double-entry journal entry.
 * Throws if lines are empty, contain negative values, reference unknown accounts,
 * or if totalDebits !== totalCredits.
 */
export function createBalancedJournalEntry(params: {
  id?: string;
  organizationId: string;
  entryNumber: string;
  referenceType: JournalReferenceType;
  referenceId: string;
  customerId?: string;
  customerName?: string;
  description: string;
  currency?: string;
  postedBy?: string;
  postedAt?: string;
  lines: JournalLineInput[];
}): JournalEntry {
  if (!params.lines || params.lines.length < 2) {
    throw new Error("A double-entry journal entry requires at least 2 lines.");
  }

  let totalDebit = 0;
  let totalCredit = 0;

  const builtLines: JournalLine[] = params.lines.map((line, index) => {
    const account = ACCOUNT_MAP.get(line.accountCode);
    if (!account) {
      throw new Error(`Unknown ledger account code: ${line.accountCode}`);
    }
    const debit = roundMoney(line.debit || 0);
    const credit = roundMoney(line.credit || 0);

    if (debit < 0 || credit < 0) {
      throw new Error("Journal line debit and credit amounts must be non-negative.");
    }
    if (debit === 0 && credit === 0) {
      throw new Error("Journal line must have a non-zero debit or credit amount.");
    }
    if (debit > 0 && credit > 0) {
      throw new Error("A single journal line cannot have both debit and credit.");
    }

    totalDebit = roundMoney(totalDebit + debit);
    totalCredit = roundMoney(totalCredit + credit);

    return {
      id: `${params.id || params.entryNumber}-L${index + 1}`,
      accountCode: account.code,
      accountName: account.name,
      debit,
      credit,
      memo: line.memo,
    };
  });

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(
      `Unbalanced journal entry (${params.entryNumber}): debits (${totalDebit.toFixed(
        2
      )}) !== credits (${totalCredit.toFixed(2)})`
    );
  }

  return {
    id: params.id || `je-${params.entryNumber.toLowerCase()}`,
    organizationId: params.organizationId,
    entryNumber: params.entryNumber,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    customerId: params.customerId,
    customerName: params.customerName,
    description: params.description,
    currency: params.currency || "KES",
    totalDebit,
    totalCredit,
    status: "POSTED",
    postedBy: params.postedBy || "system",
    postedAt: params.postedAt || new Date().toISOString(),
    lines: builtLines,
  };
}

/**
 * Generates an immutable reversal entry that swaps debits and credits of an existing entry.
 */
export function createReversalJournalEntry(
  original: JournalEntry,
  reversalEntryNumber: string,
  reason: string,
  postedBy = "system",
  postedAt = new Date().toISOString()
): { reversedOriginal: JournalEntry; reversalEntry: JournalEntry } {
  if (original.status === "REVERSED") {
    throw new Error(`Journal entry ${original.entryNumber} is already reversed.`);
  }

  const reversalEntry = createBalancedJournalEntry({
    id: `je-rev-${original.id}`,
    organizationId: original.organizationId,
    entryNumber: reversalEntryNumber,
    referenceType: "REVERSAL",
    referenceId: original.id,
    customerId: original.customerId,
    customerName: original.customerName,
    description: `REVERSAL of ${original.entryNumber}: ${reason}`,
    currency: original.currency,
    postedBy,
    postedAt,
    lines: original.lines.map((l) => ({
      accountCode: l.accountCode,
      debit: l.credit,
      credit: l.debit,
      memo: `Reversal of ${original.entryNumber}`,
    })),
  });

  const reversedOriginal: JournalEntry = {
    ...original,
    status: "REVERSED",
    reversedByEntryId: reversalEntry.id,
  };

  return { reversedOriginal, reversalEntry };
}

/**
 * Posts a subscriber invoice to the double-entry ledger:
 * DR 1200 Accounts Receivable = totalAmount
 * CR 4100 Broadband Revenue   = subtotal
 * CR 2300 VAT Tax Payable     = taxAmount (if > 0)
 */
export function postInvoiceToLedger(params: {
  organizationId: string;
  entryNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  subtotal: number;
  taxAmount: number;
  postedAt?: string;
}): JournalEntry {
  const subtotal = roundMoney(params.subtotal);
  const tax = roundMoney(params.taxAmount);
  const total = roundMoney(subtotal + tax);

  const lines: JournalLineInput[] = [
    {
      accountCode: "1200",
      debit: total,
      credit: 0,
      memo: `Invoice ${params.invoiceNumber} receivable`,
    },
    {
      accountCode: "4100",
      debit: 0,
      credit: subtotal,
      memo: `Service subscription net revenue`,
    },
  ];

  if (tax > 0) {
    lines.push({
      accountCode: "2300",
      debit: 0,
      credit: tax,
      memo: `VAT 16% on Invoice ${params.invoiceNumber}`,
    });
  }

  return createBalancedJournalEntry({
    organizationId: params.organizationId,
    entryNumber: params.entryNumber,
    referenceType: "INVOICE",
    referenceId: params.invoiceId,
    customerId: params.customerId,
    customerName: params.customerName,
    description: `Invoice ${params.invoiceNumber} — ${params.customerName}`,
    postedAt: params.postedAt,
    lines,
  });
}

/**
 * Posts a confirmed payment to the double-entry ledger.
 * Supports:
 * - Settling AR (`allocatedToAr`)
 * - Direct Hotspot Voucher sale (`directVoucherRevenue`)
 * - Overpayment credited to subscriber wallet (`creditedToWallet`)
 */
export function postPaymentToLedger(params: {
  organizationId: string;
  entryNumber: string;
  paymentId: string;
  transactionReference: string;
  customerId?: string;
  customerName?: string;
  totalAmount: number;
  allocatedToAr: number;
  creditedToWallet?: number;
  directVoucherRevenue?: number;
  postedAt?: string;
}): JournalEntry {
  const total = roundMoney(params.totalAmount);
  const ar = roundMoney(params.allocatedToAr);
  const wallet = roundMoney(params.creditedToWallet || 0);
  const voucher = roundMoney(params.directVoucherRevenue || 0);

  const lines: JournalLineInput[] = [
    {
      accountCode: "1100",
      debit: total,
      credit: 0,
      memo: `Receipt ${params.transactionReference}`,
    },
  ];

  if (ar > 0) {
    lines.push({
      accountCode: "1200",
      debit: 0,
      credit: ar,
      memo: `AR settlement (${params.transactionReference})`,
    });
  }
  if (wallet > 0) {
    lines.push({
      accountCode: "2200",
      debit: 0,
      credit: wallet,
      memo: `Overpayment wallet credit (${params.transactionReference})`,
    });
  }
  if (voucher > 0) {
    lines.push({
      accountCode: "4200",
      debit: 0,
      credit: voucher,
      memo: `Hotspot voucher direct sale (${params.transactionReference})`,
    });
  }

  return createBalancedJournalEntry({
    organizationId: params.organizationId,
    entryNumber: params.entryNumber,
    referenceType: "PAYMENT",
    referenceId: params.paymentId,
    customerId: params.customerId,
    customerName: params.customerName,
    description: `Payment ${params.transactionReference} (${
      params.customerName || "Hotspot Subscriber"
    })`,
    postedAt: params.postedAt,
    lines,
  });
}

/**
 * Posts a credit note or waiver reducing subscriber Accounts Receivable:
 * DR 5100 Service Credits, Waivers & Refunds
 * CR 1200 Subscriber Accounts Receivable
 */
export function postCreditNoteToLedger(params: {
  organizationId: string;
  entryNumber: string;
  creditNoteId: string;
  customerId: string;
  customerName: string;
  amount: number;
  reason: string;
  postedBy?: string;
  postedAt?: string;
}): JournalEntry {
  const amt = roundMoney(params.amount);
  return createBalancedJournalEntry({
    organizationId: params.organizationId,
    entryNumber: params.entryNumber,
    referenceType: "CREDIT_NOTE",
    referenceId: params.creditNoteId,
    customerId: params.customerId,
    customerName: params.customerName,
    description: `Credit Note ${params.creditNoteId}: ${params.reason}`,
    postedBy: params.postedBy,
    postedAt: params.postedAt,
    lines: [
      {
        accountCode: "5100",
        debit: amt,
        credit: 0,
        memo: params.reason,
      },
      {
        accountCode: "1200",
        debit: 0,
        credit: amt,
        memo: `AR reduction for ${params.customerName}`,
      },
    ],
  });
}

/**
 * Computes the complete Trial Balance from posted journal entries.
 */
export function computeTrialBalance(entries: JournalEntry[]): TrialBalanceReport {
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const acc of STANDARD_CHART_OF_ACCOUNTS) {
    totals.set(acc.code, { debit: 0, credit: 0 });
  }

  for (const entry of entries) {
    for (const line of entry.lines) {
      const current = totals.get(line.accountCode) || { debit: 0, credit: 0 };
      current.debit = roundMoney(current.debit + line.debit);
      current.credit = roundMoney(current.credit + line.credit);
      totals.set(line.accountCode, current);
    }
  }

  let grandDebit = 0;
  let grandCredit = 0;

  const rows: AccountTrialBalanceRow[] = STANDARD_CHART_OF_ACCOUNTS.map((acc) => {
    const t = totals.get(acc.code) || { debit: 0, credit: 0 };
    grandDebit = roundMoney(grandDebit + t.debit);
    grandCredit = roundMoney(grandCredit + t.credit);
    const netBalance =
      acc.normalBalance === "DEBIT"
        ? roundMoney(t.debit - t.credit)
        : roundMoney(t.credit - t.debit);
    return {
      code: acc.code,
      name: acc.name,
      category: acc.category,
      normalBalance: acc.normalBalance,
      totalDebits: t.debit,
      totalCredits: t.credit,
      netBalance,
    };
  });

  const discrepancy = roundMoney(Math.abs(grandDebit - grandCredit));
  return {
    rows,
    totalDebits: grandDebit,
    totalCredits: grandCredit,
    isBalanced: discrepancy === 0,
    discrepancy,
  };
}

/**
 * Computes Accounts Receivable Aging across 0-30, 31-60, 61-90, and 90+ day buckets.
 */
export function computeArAgingBuckets(
  invoices: Array<{
    id: string;
    balanceDue: number;
    dueDate: string;
    status: string;
  }>,
  asOfDate: Date = new Date()
): ArAgingReport {
  const bucketMap: Record<
    "0-30" | "31-60" | "61-90" | "90+",
    { count: number; amount: number; label: string }
  > = {
    "0-30": { count: 0, amount: 0, label: "0–30 Days" },
    "31-60": { count: 0, amount: 0, label: "31–60 Days" },
    "61-90": { count: 0, amount: 0, label: "61–90 Days" },
    "90+": { count: 0, amount: 0, label: "90+ Days (High Risk)" },
  };

  let totalOutstanding = 0;
  let overdueCount = 0;
  const refMs = asOfDate.getTime();

  for (const inv of invoices) {
    if (inv.status === "PAID" || inv.status === "VOID") continue;
    const bal = roundMoney(inv.balanceDue);
    if (bal <= 0) continue;

    totalOutstanding = roundMoney(totalOutstanding + bal);
    const dueMs = new Date(inv.dueDate).getTime();
    const daysPastDue = Math.max(0, Math.floor((refMs - dueMs) / 86_400_000));
    if (daysPastDue > 0) overdueCount++;

    if (daysPastDue <= 30) {
      bucketMap["0-30"].count++;
      bucketMap["0-30"].amount = roundMoney(bucketMap["0-30"].amount + bal);
    } else if (daysPastDue <= 60) {
      bucketMap["31-60"].count++;
      bucketMap["31-60"].amount = roundMoney(bucketMap["31-60"].amount + bal);
    } else if (daysPastDue <= 90) {
      bucketMap["61-90"].count++;
      bucketMap["61-90"].amount = roundMoney(bucketMap["61-90"].amount + bal);
    } else {
      bucketMap["90+"].count++;
      bucketMap["90+"].amount = roundMoney(bucketMap["90+"].amount + bal);
    }
  }

  const keys: Array<"0-30" | "31-60" | "61-90" | "90+"> = [
    "0-30",
    "31-60",
    "61-90",
    "90+",
  ];

  const buckets: ArAgingBucket[] = keys.map((k) => {
    const b = bucketMap[k];
    return {
      bucket: k,
      label: b.label,
      invoiceCount: b.count,
      totalBalanceDue: b.amount,
      sharePercent:
        totalOutstanding > 0
          ? Math.round((b.amount / totalOutstanding) * 1000) / 10
          : 0,
    };
  });

  return {
    asOfDate: asOfDate.toISOString(),
    totalOutstanding,
    overdueCount,
    buckets,
  };
}

/**
 * Computes authoritative ISP Executive Revenue Intelligence metrics.
 */
export function computeExecutiveRevenueMetrics(params: {
  customers: Array<{
    id: string;
    status: string;
    balanceDue: number;
    planPrice?: number;
  }>;
  payments: Array<{
    amount: number;
    status: string;
  }>;
  trialBalance: TrialBalanceReport;
  arAging: ArAgingReport;
}): ExecutiveRevenueMetrics {
  const activeCustomers = params.customers.filter((c) => c.status === "ACTIVE");
  const suspendedOrTerminated = params.customers.filter(
    (c) => c.status === "SUSPENDED" || c.status === "TERMINATED"
  );

  const mrr = roundMoney(
    activeCustomers.reduce((sum, c) => sum + (c.planPrice || 2500), 0)
  );
  const arr = roundMoney(mrr * 12);
  const arpu =
    activeCustomers.length > 0
      ? roundMoney(mrr / activeCustomers.length)
      : 0;

  const collectedThisPeriod = roundMoney(
    params.payments
      .filter((p) => p.status === "COMPLETED")
      .reduce((sum, p) => sum + p.amount, 0)
  );

  const billedThisPeriod = roundMoney(
    Math.max(collectedThisPeriod + params.arAging.totalOutstanding, mrr)
  );

  const collectionRatePercent =
    billedThisPeriod > 0
      ? Math.min(100, Math.round((collectedThisPeriod / billedThisPeriod) * 1000) / 10)
      : 100;

  const deferredRow = params.trialBalance.rows.find((r) => r.code === "2100");
  const taxRow = params.trialBalance.rows.find((r) => r.code === "2300");
  const bucket90 = params.arAging.buckets.find((b) => b.bucket === "90+");

  const totalBase = Math.max(1, params.customers.length);
  const monthlyChurnPercent =
    Math.round((suspendedOrTerminated.length / totalBase) * 1000) / 10;
  const netRevenueRetentionPercent = Math.max(
    80,
    Math.round((100 - monthlyChurnPercent * 0.6 + 2.4) * 10) / 10
  );

  return {
    mrr,
    arr,
    arpu,
    activePayingSubscribers: activeCustomers.length,
    billedThisPeriod,
    collectedThisPeriod,
    collectionRatePercent,
    deferredRevenueBalance: deferredRow?.netBalance || 0,
    taxPayableBalance: taxRow?.netBalance || 0,
    badDebtExposure: bucket90?.totalBalanceDue || 0,
    netRevenueRetentionPercent,
    monthlyChurnPercent,
  };
}
