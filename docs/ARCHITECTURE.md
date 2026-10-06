# System Architecture Specification

## 1. Executive Summary & Vision
**QC NetCore** is a production-grade, multi-tenant SaaS platform engineered specifically for Internet Service Providers (ISPs), Wireless ISPs (WISPs), hotspot operators, estate/gated-community network managers, and emerging telcos in Kenya and East Africa.

The platform unifies:
- **Tenant & Customer Management (CRM)**
- **Network Control Plane (MikroTik RouterOS 6 & 7 via REST/API, FreeRADIUS 3.x AAA, WireGuard SDN Tunneling)**
- **Billing & Payment Automation (Safaricom Daraja M-Pesa Express/STK, C2B Paybill/Till, B2C Commission Disbursements, Airtel Money)**
- **Hotspot Subsystem (Dynamic Captive Portal, Speed/Time/Data Plans, Voucher Generation & Printing, Instant Self-Checkout)**
- **PPPoE Subsystem (Bandwidth Queuing/Simple Queues & PCQ, Static/Pool IP Allocation, Automatic Disconnect/CoA upon expiry)**
- **Field & Operations Management (Technician Work Orders, Fiber/Wireless Site Management, Signal & Telemetry Auditing)**
- **Real-time Observability & NOC Dashboard (Latency, Interface Metrics, Live Session Tracking, Network Alerting)**

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|  +---------------------------+  +--------------------------+  +-----------------+  |
|  | Tenant Admin Dashboard    |  | Customer Self-Care Portal|  | Captive Portal  |  |
|  | (Next.js App / PWA)       |  | (Mobile-first PWA)       |  | (Lightweight UI)|  |
|  +-------------+-------------+  +------------+-------------+  +--------+--------+  |
+----------------|-----------------------------|-------------------------|----------+
                 |                             |                         |
                 +-----------------------------+-------------------------+
                                               | (HTTPS / WSS)
                                               v
+-----------------------------------------------------------------------------------+
|                            SAAS CONTROL PLANE (Next.js)                           |
|  +-----------------------------------------------------------------------------+  |
|  | Multi-Tenant API Layer & Next.js Server Components / Route Handlers          |  |
|  | - Auth & RBAC (SuperAdmin, ISPOwner, Admin, Finance, Tech, Agent, Customer) |  |
|  | - Business Domain Services (Customers, Plans, Subscriptions, Vouchers)     |  |
|  | - Financial Engine (Invoicing, M-Pesa STK, C2B IPN Validation, Ledgers)    |  |
|  | - Realtime Dispatcher (SSE / Supabase Realtime Channels)                    |  |
|  +---------------------------------------+-------------------------------------+  |
+------------------------------------------|----------------------------------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
                    v                                             v
+-----------------------------------------+   +-------------------------------------+
|        DATABASE & PERSISTENCE           |   |       NETWORK CONTROL WORKER        |
|  PostgreSQL (Supabase / Managed PG)     |   |       (FastAPI / Async Worker)      |
|  - Multi-tenant Tenant Isolation (RLS)  |   | - MikroTik RouterOS API/REST Client |
|  - Financial Double-entry Ledgers       |   | - WireGuard Peer Management Engine  |
|  - Hotspot Vouchers & Session Records   |   | - Telemetry Poller & NOC Monitor    |
|  - PPPoE Secrets & Radius Mappings      |   | - CoA / Disconnect Session Dispatch |
|  - Immutable Audit & Security Logs      |   +------------------+------------------+
+-------------------+---------------------+                      |
                    ^                                            |
                    | (SQL-IP Pools/Auth/Acct)                   | (Encrypted WG Tunnel)
                    v                                            v
+-----------------------------------------+   +-------------------------------------+
|         AAA LAYER (FreeRADIUS 3.x)      |   |        EDGE ROUTING LAYER           |
|  - rlm_sql auth against PostgreSQL      |   |  MikroTik Cloud Core / hEX / CHR    |
|  - rlm_sql accounting aggregation       |   |  - PPPoE Server / Radius Client     |
|  - Dynamic Rate-Limiting & Expiry VSA   |<--+  - Hotspot Captive Portal Engine    |
|  - Disconnect-Request / CoA Generator   |   |  - WireGuard Client Peer to SaaS    |
+-----------------------------------------+   +-------------------------------------+
```

---

## 2. Architectural Planes Separation

To guarantee resilience, high transaction throughput, and absolute isolation between web requests and network socket I/O, the platform decouples into four distinct operational planes:

### 2.1. SaaS Control Plane (Web & Application Layer)
- **Framework**: Next.js 15+ (App Router), React 19, TypeScript (Strict).
- **Styling & UI**: Tailwind CSS, Lucide Icons, Shadcn UI component design tokens.
- **Responsibilities**:
  - Tenant provisioning, subscription lifecycles, role-based access control.
  - CRUD operations on inventory, plans, sites, technicians, and vouchers.
  - Payment orchestration (initiating Daraja STK Push, handling asynchronous C2B/B2C callbacks).
  - Serving the customer self-service portal, captive portal, and operator dashboard.
  - Fast edge rendering and mobile-first PWA caching for offline technician workflows.

### 2.2. Network Control Plane (Orchestration & Telemetry)
- **Engine**: Dedicated Async Network Service (FastAPI / Node Network Engine).
- **Communication Protocol**: RouterOS API (v6 port 8728/8729 TLS, v7 HTTPS REST / API) and WireGuard Site-to-Site Encrypted Tunnels.
- **Responsibilities**:
  - Dynamic provisioning of PPPoE Profiles, Hotspot User Profiles, Address Pools, Firewall Address Lists, and Mangle Queues.
  - Non-blocking router health monitoring (CPU, RAM, Voltage, Temperature, Active Leases, Traffic rates).
  - Out-of-band Router Provisioning via zero-touch auto-generated RouterOS `.rsc` configuration scripts.
  - RADIUS Change of Authorization (CoA) and Disconnect-Message (DM) triggers on account suspension or speed change.

### 2.3. AAA Layer (Authentication, Authorization, Accounting)
- **Engine**: FreeRADIUS 3.2+ coupled directly with PostgreSQL via `rlm_sql`.
- **Responsibilities**:
  - Sub-millisecond PAP/CHAP authentication for PPPoE and Hotspot sessions.
  - Rate-limit injection using `Mikrotik-Rate-Limit` vendor-specific attributes (VSA) (e.g., `10M/10M 0/0 0/0 0/0 8 5M/5M`).
  - Strict accounting session tracking (`Acct-Status-Type`: Start, Interim-Update, Stop) with octet counting for quota enforcement.
  - Simultaneous-Use restriction enforcement preventing concurrent credential sharing.

### 2.4. Financial & Payment Plane
- **Engine**: Event-driven Webhook Processing Pipeline with PostgreSQL Transactions.
- **Responsibilities**:
  - Daraja STK Push (Lipa Na M-Pesa Online).
  - Daraja C2B (Customer to Business via Paybill / Till Number IPN URL).
  - Daraja B2C for automated agent commissions and technician disbursements.
  - Idempotent transaction processing with SHA-256 HMAC payload verification.
  - Automatic invoice generation, ledger balance reconciliation, and instant unblocking trigger.

---

## 3. High-Level Directory & Project Layout

```
G-Tech-ISP/
├── .github/                      # CI/CD Workflows & automated lint/testing
├── docs/                         # Comprehensive Architectural Blueprints
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── SECURITY.md
│   ├── API.md
│   ├── NETWORK.md
│   ├── PAYMENTS.md
│   ├── DEPLOYMENT.md
│   └── ROADMAP.md
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # Login, Register, Password Reset
│   │   ├── (dashboard)/          # Multi-tenant Operator Management Console
│   │   │   ├── dashboard/        # Executive NOC and Financial overview
│   │   │   ├── customers/        # Subscriber CRM (PPPoE + Hotspot)
│   │   │   ├── routers/          # MikroTik Fleet & WireGuard Tunnels
│   │   │   ├── plans/            # Speed & Quota Tier Management
│   │   │   ├── billing/          # Invoices, M-Pesa Logs, Ledgers
│   │   │   ├── vouchers/         # Batch Generator, Printing Engine
│   │   │   ├── technicians/      # Work Orders & Field Deployments
│   │   │   ├── monitoring/       # Live Traffic, Telemetry & Alerts
│   │   │   └── settings/         # Organization Settings, M-Pesa Keys, SMS Gateways
│   │   ├── (portal)/             # Customer Self-Care Portal
│   │   ├── (captive)/            # Ultra-lightweight Hotspot Login Portal
│   │   └── api/                  # REST API & Webhook Endpoints
│   │       ├── v1/
│   │       │   ├── auth/
│   │       │   ├── customers/
│   │       │   ├── routers/
│   │       │   ├── plans/
│   │       │   ├── pppoe/
│   │       │   ├── hotspot/
│   │       │   ├── vouchers/
│   │       │   ├── billing/
│   │       │   ├── payments/
│   │       │   │   ├── mpesa/
│   │       │   │   └── airtel/
│   │       │   ├── network/
│   │       │   ├── technicians/
│   │       │   └── webhooks/
│   ├── components/               # Accessible Reusable UI Elements (Shadcn/Tailwind)
│   │   ├── ui/                   # Base primitives (Button, Modal, Input, Table)
│   │   ├── dashboard/            # Metric cards, Charts, Live Bandwidth Graph
│   │   ├── network/              # Router terminal, Interface tree, WireGuard status
│   │   ├── billing/              # M-Pesa STK modal, Invoice PDF viewer
│   │   └── vouchers/             # Print grid layout & Thermal paper format
│   ├── lib/                      # Core Business Logic & Infrastructure Abstractions
│   │   ├── db/                   # Supabase / Prisma / Drizzle Client & RLS helpers
│   │   ├── auth/                 # Session tokens, RBAC permissions, Tenant context
│   │   ├── network/              # MikroTik RouterOS API Client & Parser
│   │   ├── radius/               # FreeRADIUS Dictionary & VSA generators
│   │   ├── payments/             # M-Pesa Daraja Provider & Airtel Money abstraction
│   │   ├── notifications/        # SMS (AfricasTalking, Advanta) & WhatsApp Gateways
│   │   ├── wireguard/            # Keypair generator & Config synthesizers
│   │   └── utils/                # Formatters (KSh currency, bytes, MAC address)
│   ├── types/                    # Shared TypeScript Domain Definitions
│   └── workers/                  # Background Schedulers & Telemetry Pollers
├── docker/                       # Docker Compose for FreeRADIUS, WireGuard & PostgreSQL
├── public/                       # Static assets, PWA Manifest, Icons, Sound FX
└── tests/                        # Unit, Integration, and Mock Network Tests
```

---

## 4. Multi-Tenant Isolation Strategy

1. **Logical Separation via PostgreSQL Row-Level Security (RLS)**:
   Every relational table (apart from system global parameters) possesses an indexed `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`.
2. **Context-Aware Database Sessions**:
   Every database query executed through server components or route handlers injects the active tenant context via `auth.uid()` and custom claims, ensuring that even in the case of application-level SQL bugs, tenant data boundary traversal is strictly blocked at the database engine level.
3. **Dedicated Network Namespaces**:
   Each tenant's MikroTik routers and WireGuard peers reside in dedicated IP subnets within the overlay network (`10.200.{tenant_idx}.0/24`), guaranteeing no IP conflict or route collision across distinct ISPs.

---

## 5. Technology Stack Rationale

| Layer | Chosen Technology | Architectural Justification |
| :--- | :--- | :--- |
| **Frontend & SaaS API** | Next.js 15+ / React 19 / TypeScript | Unified full-stack developer velocity, React Server Components for instantaneous initial page loads without client overhead, and zero-bundle server logic for sensitive operations. |
| **Styling & PWA** | Tailwind CSS + Next-PWA | Fast styling, zero runtime CSS overhead, accessible responsive layouts optimized for low-spec Android devices common in Kenyan field operations. |
| **Database** | PostgreSQL 16+ (Supabase / RDS) | ACID-compliant financial transactions, native JSONB support, powerful Row-Level Security (RLS), and native FreeRADIUS `rlm_sql` compatibility. |
| **Network Core** | MikroTik RouterOS 6.49+ & 7.x | Dominant hardware standard across East African WISPs due to unmatched cost-to-performance ratio and extensive API/RADIUS capabilities. |
| **AAA Server** | FreeRADIUS 3.2.x | High-performance, carrier-grade authentication engine handling thousands of concurrent PPPoE/Hotspot sessions with zero latency overhead. |
| **VPN Overlay** | WireGuard | Modern, state-of-the-art cryptography, extremely lightweight CPU footprint on MikroTik routers, eliminating the requirement for public static IPs on edge routers. |
| **Mobile Money** | Safaricom Daraja 3.0 API | Dominant payment medium in Kenya (>95% market share), handling instant STK push and C2B Paybill reconciliations. |
