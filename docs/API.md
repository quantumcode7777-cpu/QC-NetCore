# REST API Specification & Endpoint Catalog

All SaaS endpoints follow standard REST principles, JSON payloads, Bearer JWT authorization, and tenant scoping.

## Base URL
- SaaS REST API: `https://api.gtechisp.co.ke/api/v1` or `/api/v1`

---

## 1. Authentication & Tenant Context
- `POST /api/v1/auth/register` - Register new ISP organization & initial owner account.
- `POST /api/v1/auth/login` - Authenticate ISP user / customer, returning session token & user claims.
- `POST /api/v1/auth/logout` - Invalidate session & clear cookies.
- `GET  /api/v1/auth/me` - Retrieve authenticated user profile and active organization context.

---

## 2. Customer Management (CRM)
- `GET    /api/v1/customers` - Paginated subscriber list with query filters (status, site, plan, search).
- `POST   /api/v1/customers` - Create new subscriber with optional auto-generated PPPoE credentials.
- `GET    /api/v1/customers/:id` - Full subscriber profile, active plan, bandwidth stats, payment history.
- `PATCH  /api/v1/customers/:id` - Update subscriber details, physical location, or contact numbers.
- `POST   /api/v1/customers/:id/suspend` - Immediately suspend subscriber access and disconnect active sessions.
- `POST   /api/v1/customers/:id/activate` - Re-enable subscriber access and sync RADIUS credentials.

---

## 3. Plans & Products
- `GET    /api/v1/plans` - List all active service plans (PPPoE + Hotspot).
- `POST   /api/v1/plans` - Create service plan (speed profiles, burst, validity duration, price in KES).
- `PATCH  /api/v1/plans/:id` - Edit plan parameters.
- `DELETE /api/v1/plans/:id` - Archive plan.

---

## 4. MikroTik Routers & Network Orchestration
- `GET    /api/v1/routers` - Fleet overview (status, CPU, memory, uptime, active sessions).
- `POST   /api/v1/routers` - Register new router and generate WireGuard configuration.
- `GET    /api/v1/routers/:id/script` - Download auto-generated RouterOS `.rsc` onboarding script.
- `POST   /api/v1/routers/:id/test-connection` - Perform live latency & RouterOS API handshake test.
- `GET    /api/v1/routers/:id/interfaces` - Fetch live interface traffic and status.
- `GET    /api/v1/routers/:id/sessions` - List live PPPoE and Hotspot sessions on the router.
- `POST   /api/v1/routers/:id/disconnect-session` - Send Disconnect-Message (DM) for a specific user.

---

## 5. Hotspot & Voucher Engine
- `POST   /api/v1/vouchers/batches` - Generate batch of vouchers (e.g. 100 codes of 1-Hour @ KSh 10).
- `GET    /api/v1/vouchers/batches` - List generated voucher batches.
- `GET    /api/v1/vouchers/batches/:id/print` - Format printable voucher cards (PDF/HTML grid / Thermal 58mm/80mm).
- `POST   /api/v1/vouchers/redeem` - Redeem voucher code for Hotspot MAC address.

---

## 6. Payments & Mobile Money (M-Pesa / Airtel)
- `POST   /api/v1/payments/mpesa/stk-push` - Initiate Lipa Na M-Pesa Online STK push prompt.
- `POST   /api/v1/payments/mpesa/callback` - Asynchronous webhook receiver for Daraja STK results.
- `POST   /api/v1/payments/mpesa/c2b-validation` - Daraja C2B validation URL for Paybill/Till transactions.
- `POST   /api/v1/payments/mpesa/c2b-confirmation` - Daraja C2B confirmation URL (triggers account credit).
- `GET    /api/v1/payments` - Paginated financial ledger of all incoming transactions.

---

## 7. Technicians & Work Orders
- `GET    /api/v1/work-orders` - List field installations and maintenance tickets.
- `POST   /api/v1/work-orders` - Create work order and assign to technician.
- `PATCH  /api/v1/work-orders/:id` - Update status (`IN_PROGRESS`, `COMPLETED`), add GPS/photos and router serials.

---

## 8. Telemetry, NOC & Monitoring
- `GET    /api/v1/monitoring/health` - SaaS system status & database connectivity.
- `GET    /api/v1/monitoring/noc` - High-frequency summary of fleet uptime, traffic, alerts, and live sessions.
- `GET    /api/v1/monitoring/traffic-history` - Aggregated bandwidth time-series data.
