# QC NetCore — ISP Network & Billing Operating System
> Modern Kenyan ISP / WISP Hotspot & PPPoE Billing & Network Management SaaS

## 🌟 Executive Overview
**QC NetCore** is a carrier-grade, multi-tenant Software-as-a-Service (SaaS) platform architected for Internet Service Providers (ISPs), Wireless ISPs (WISPs), hotspot network operators, and community fiber networks across Kenya and East Africa.

It integrates:
- **MikroTik RouterOS Orchestration** (Zero-touch provisioning, WireGuard tunnels, REST/API commands).
- **FreeRADIUS 3.x AAA Engine** (`radcheck`, `radreply`, `radacct`, RFC 3576 Disconnect-Request & CoA).
- **Safaricom Daraja M-Pesa Billing Automation** (Lipa Na M-Pesa Online STK Push, C2B Paybill 174379, B2C Agent Commissions).
- **Dynamic Hotspot Captive Portal** (Fast package selection, instant self-service M-Pesa checkout, voucher cards).
- **PPPoE Subscriber CRM & Billing** (Simple queues, burst limits, automated suspension and reactivation).
- **Field Operations & Work Orders** (Technician ticket dispatching, optical signal power checks).
- **Real-time NOC Operations Center** (Live interface traffic, CPU/RAM telemetry, active sessions, incident alarms).

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ or 20+ / 24+
- PostgreSQL 15+ (or Supabase instance)
- FreeRADIUS 3.x server (for network AAA)
- WireGuard Gateway (for edge router tunneling)

### 1. Installation
```bash
git clone https://github.com/gtech-isp/gtech-isp-os.git
cd "G Tech ISP"
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env.local` and configure your credentials:
```bash
cp .env.example .env.local
```

### 3. Database Migration
Run the SQL schema in `src/db/migrations/001_initial_schema.sql` on your PostgreSQL database or Supabase project.

### 4. Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser:
- **Admin Dashboard & NOC**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- **Subscribers CRM**: [http://localhost:3000/customers](http://localhost:3000/customers)
- **MikroTik Fleet**: [http://localhost:3000/routers](http://localhost:3000/routers)
- **Hotspot Vouchers**: [http://localhost:3000/vouchers](http://localhost:3000/vouchers)
- **Customer Self-Care Portal**: [http://localhost:3000/portal](http://localhost:3000/portal)
- **Captive Hotspot Portal**: [http://localhost:3000/captive](http://localhost:3000/captive)

### 5. Running Automated Tests
```bash
npm test
```

---

## 📚 Technical Documentation Directory
- [`ARCHITECTURE.md`](file:///c:/xampp/htdocs/G%20Tech%20ISP/docs/ARCHITECTURE.md) - System architecture and planes separation.
- [`DATABASE.md`](file:///c:/xampp/htdocs/G%20Tech%20ISP/docs/DATABASE.md) - PostgreSQL schema, DDL, and FreeRADIUS rlm_sql mapping.
- [`SECURITY.md`](file:///c:/xampp/htdocs/G%20Tech%20ISP/docs/SECURITY.md) - Zero-trust network design, encryption, and RBAC matrix.
- [`NETWORK.md`](file:///c:/xampp/htdocs/G%20Tech%20ISP/docs/NETWORK.md) - MikroTik RouterOS API/REST, FreeRADIUS VSA, and WireGuard.
- [`PAYMENTS.md`](file:///c:/xampp/htdocs/G%20Tech%20ISP/docs/PAYMENTS.md) - Safaricom Daraja STK Push & C2B Paybill automation.
- [`API.md`](file:///c:/xampp/htdocs/G%20Tech%20ISP/docs/API.md) - REST API catalog and webhook endpoints.
- [`DEPLOYMENT.md`](file:///c:/xampp/htdocs/G%20Tech%20ISP/docs/DEPLOYMENT.md) - Production Docker Compose and server topology.
- [`TROUBLESHOOTING.md`](file:///c:/xampp/htdocs/G%20Tech%20ISP/docs/TROUBLESHOOTING.md) - Operational diagnostics & triage procedures.
