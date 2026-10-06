# Troubleshooting & Incident Response Playbook

## 1. M-Pesa Payment Issues

### Symptom: Subscriber paid via M-Pesa STK push but account was not unblocked
1. **Check Daraja Webhook Delivery**:
   Inspect incoming logs at `/api/v1/payments/mpesa/callback`. Ensure Safaricom responded with `ResultCode = 0`.
2. **Verify Account Reference**:
   Confirm the `accountReference` matched an active customer account number (`GT-XXXX`) or voucher format.
3. **Inspect FreeRADIUS `radcheck`**:
   Check if the record exists and `Cleartext-Password` matches the subscriber's credentials.
4. **Trigger Manual Reconnection**:
   In the Admin Dashboard -> [Billing](file:///c:/xampp/htdocs/G%20Tech%20ISP/src/app/billing/page.tsx), locate the transaction and click "Reconcile & Unblock".

---

## 2. MikroTik Router & WireGuard Connectivity

### Symptom: Router shows "OFFLINE" in Dashboard
1. **Check WireGuard Peer Handshake**:
   On the MikroTik router, run:
   ```routeros
   /interface wireguard print
   /interface wireguard peers print
   ```
   Verify `last-handshake` is under 60 seconds.
2. **Verify Outbound UDP Port 51820**:
   Ensure upstream ISP/firewall is not filtering UDP port 51820 traffic.
3. **Verify Keepalive**:
   Ensure `persistent-keepalive=25s` is configured on the router peer.

---

## 3. FreeRADIUS AAA Session Issues

### Symptom: PPPoE subscriber receives "Access-Reject" (Wrong password or disabled)
1. **Inspect FreeRADIUS Debug Log**:
   ```bash
   freeradius -X
   ```
2. **Check PostgreSQL `radcheck` and `radusergroup`**:
   ```sql
   SELECT * FROM radcheck WHERE username = 'gt_subscriber_user';
   ```
3. **Check Disconnect-Message (CoA)**:
   Ensure port 3799 is open on the MikroTik router (`/radius incoming print`).
