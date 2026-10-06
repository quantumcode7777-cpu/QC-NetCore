# Security Architecture & Hardening Guide

## 1. Threat Model & Security Posture
The QC NetCore Platform controls critical telecommunications hardware, network routing tables, AAA credentials, and direct monetary flows through mobile money gateways (M-Pesa / Airtel).

### 1.1. Core Security Tenets
1. **Zero Trust Network Architecture**:
   - Edge MikroTik routers never expose management ports (`8728`, `8729`, `80`, `22`, `8291`) directly to the public internet.
   - All management telemetry and provisioning flow across an encrypted WireGuard tunnel (`ChaCha20-Poly1305`).
2. **Never Trust the Client**:
   - Role enforcement, plan pricing, voucher redemption, and invoice statuses are checked on the server and guarded by PostgreSQL RLS.
   - Client-side callbacks from payment gateways are strictly treated as speculative notifications until validated by backend cryptographic IPN/webhook signature verification.
3. **Defense in Depth**:
   - Multi-layer defense: Database RLS -> Next.js Middleware & Server Guards -> Network Packet Filtering -> Hardened Linux/FreeRADIUS configs.

---

## 2. Secrets Management & Key Rotation

| Secret Type | Storage Location | Protection Mechanism |
| :--- | :--- | :--- |
| **Database Credentials** | Environment Variable (`DATABASE_URL`) | Encrypted at rest in secret vaults / CI/CD secrets. |
| **Safaricom Daraja Keys** | Per-Tenant Vault (Database `payment_gateways`) | AES-256-GCM encrypted using platform Master Key (`APP_ENCRYPTION_KEY`). |
| **MikroTik Passwords** | Database `routers.password_encrypted` | AES-256-GCM symmetric encryption. Decrypted only inside memory buffer for API command execution. |
| **WireGuard Private Keys** | Control Plane In-Memory / System Keyring | Private keys generated ephemerally; only public keys saved to PostgreSQL. |
| **RADIUS Shared Secrets** | Database `routers.radius_secret_encrypted` | AES-256-GCM encrypted. Synchronized to FreeRADIUS `clients.conf` dynamically. |

---

## 3. Authentication & Authorization (RBAC)

### 3.1. Role Matrix

| Permission Key | SuperAdmin | ISPOwner | Admin | Finance | Tech | Agent | Customer |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `org.manage` | Yes | Yes | No | No | No | No | No |
| `routers.provision` | Yes | Yes | Yes | No | No | No | No |
| `customers.create` | Yes | Yes | Yes | No | Yes | Yes | No |
| `plans.modify` | Yes | Yes | No | No | No | No | No |
| `billing.reconcile`| Yes | Yes | Yes | Yes | No | No | No |
| `vouchers.generate`| Yes | Yes | Yes | No | No | Yes | No |
| `work_orders.update`| Yes | Yes | Yes | No | Yes | No | No |
| `self.view_usage` | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

### 3.2. Session Security
- Signed HTTP-Only, `SameSite=Lax` (or `Strict`), `Secure` cookies for Web UI sessions.
- Short-lived JWT access tokens with cryptographic signatures and automatic background refresh.
- Rate limiting on authentication routes (5 failed attempts per IP per minute -> 15 min exponential backoff).

---

## 4. Payment Gateway Verification (Daraja Webhook Hardening)

1. **IP Whitelisting**:
   - Webhooks for Safaricom Daraja C2B/B2C validate source IP address against official Safaricom IP ranges (`196.201.214.0/24`, `196.201.213.0/24`, etc.).
2. **Idempotency Keys**:
   - Each transaction reference (e.g. `M-Pesa Receipt Number`) is uniquely constrained in `payments(transaction_reference)`.
   - Concurrent duplicate webhook delivery triggers an immediate HTTP 200 with idempotent acknowledgment without double-crediting balances.
3. **Payload Sanitization**:
   - JSON schemas strictly enforce numerical type validation for amount and phone numbers matching regex `^(254)(7|1)[0-9]{8}$`.
