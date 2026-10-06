# Payment Gateway Architecture & Mobile Money Automation

## 1. Supported Payment Channels

| Provider | Mechanism | Transaction Type | Integration Style |
| :--- | :--- | :--- | :--- |
| **Safaricom M-Pesa** | Lipa Na M-Pesa Online (Express) | STK Push | Real-time asynchronous polling + Callback webhook |
| **Safaricom M-Pesa** | Customer to Business (C2B) | Paybill & Buy Goods Till | Instant Payment Notification (IPN) Validation & Confirmation URLs |
| **Safaricom M-Pesa** | Business to Customer (B2C) | Salary / Commissions | Asynchronous Payouts to Resellers & Technicians |
| **Airtel Money** | Push & Collections | STK Push & Webhook | REST v2 Webhook API |
| **Cash / Bank** | Manual Ledger Entry | Cash / Bank Slip | Admin / Agent Audited Double-Entry |

---

## 2. End-to-End Payment & Reconnection Lifecycle

```
+-----------------------------------------------------------------------------------+
|                        1. SUBSCRIBER PAYMENT INITIATION                           |
|   Subscriber triggers M-Pesa STK push via Captive Portal or Customer Care Portal   |
|   (Amount: KSh 1,500 | Phone: 254712345678 | Plan: 10 Mbps Monthly)               |
+----------------------------------------+------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                           2. DARAJA STK DISPATCH                                  |
|   Next.js API signs OAuth token & issues `mpesa/stkpush/v1/processrequest`         |
|   Database registers `payments` record (status: `INITIATED`, ref: `ws_CO_...`)    |
+----------------------------------------+------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                           3. SAFARICOM STK PROMPT                                 |
|   Subscriber inputs M-Pesa PIN on handset -> Transaction processed by Safaricom  |
+----------------------------------------+------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                       4. DARAJA ASYNCHRONOUS CALLBACK                             |
|   Safaricom posts JSON webhook to `/api/v1/payments/mpesa/callback`               |
+----------------------------------------+------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                  5. IDEMPOTENT PARSING & LEDGER RECONCILIATION                    |
|   - Verify ResultCode (0 = Success)                                               |
|   - Extract MpesaReceiptNumber (e.g. `RKF9283KDJ`)                                |
|   - Atomic SQL Transaction: update payment -> mark invoice PAID -> extend sub     |
+----------------------------------------+------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                    6. INSTANT NETWORK RESTORATION / RADIUS UNBLOCK                |
|   - FreeRADIUS `radcheck` updated to allow authentication                         |
|   - Dispatch RADIUS CoA / Disconnect-Request to MikroTik to clear expired session|
|   - Dispatch SMS Notification: "Payment of KSh 1,500 received. Internet restored"|
+-----------------------------------------------------------------------------------+
```

---

## 3. M-Pesa Daraja Configuration & Credential Encryption

Tenant-specific Daraja credentials are saved in `payment_gateways` encrypted with AES-256-GCM:

```typescript
interface MpesaDarajaConfig {
  shortcode: string;           // Paybill or Till number (e.g. 174379)
  passkey: string;             // Lipa Na M-Pesa Online passkey
  consumerKey: string;         // Daraja Consumer Key
  consumerSecret: string;      // Daraja Consumer Secret
  initiatorUsername?: string;  // For B2C disbursements
  securityCredential?: string; // Encrypted certificate for B2C
  type: 'PAYBILL' | 'TILL';
  environment: 'SANDBOX' | 'PRODUCTION';
}
```

---

## 4. Idempotency & Concurrency Guarantees

1. **Unique Index on Transaction Reference**:
   `payments(transaction_reference)` enforces uniqueness. Any duplicate callback will encounter a constraint conflict, cleanly handled without duplicate credit.
2. **PostgreSQL Row-Locking**:
   ```sql
   SELECT * FROM subscriptions WHERE customer_id = $1 FOR UPDATE;
   ```
   Ensures that simultaneous renewals do not create overlapping or corrupted validity dates.
3. **Receipt Validation**:
   Validation endpoint responds with `{"ResultCode": 0, "ResultDesc": "Accepted"}` only when the account number or phone number maps to a valid customer/voucher.
