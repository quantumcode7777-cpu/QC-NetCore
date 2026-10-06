# Engineering Roadmap & Implementation Plan

## Phase 1: Discovery & Specification [Completed]
- [x] Analyze Kenyan ISP / WISP operational model (M-Pesa STK, C2B Paybills, Voucher printing, Hotspot Captive Portals, PPPoE Queues, MikroTik RouterOS API, FreeRADIUS AAA).
- [x] Author comprehensive architecture specifications: `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`, `NETWORK.md`, `PAYMENTS.md`, `API.md`, `DEPLOYMENT.md`.

---

## Phase 2: Core Platform Foundation & Multi-Tenancy [Active]
- [ ] Initialize Next.js 15+ App Router, TypeScript, Tailwind CSS, Lucide Icons, and accessible UI component architecture.
- [ ] Implement Database Client & PostgreSQL Migration scripts with Row-Level Security (RLS) and FreeRADIUS `rlm_sql` tables.
- [ ] Implement Authentication & RBAC Engine (SuperAdmin, ISPOwner, Admin, Finance, Tech, Agent, Customer).
- [ ] Build global application context, toast notifications, navigation sidebar, and responsive mobile-first shell.

---

## Phase 3: Core ISP & Subscriber Management (CRM + Plans + Invoicing)
- [ ] Build Internet Plans Management (PPPoE & Hotspot speed tiers, burst rates, price in KES, RADIUS rate-limit strings).
- [ ] Build Subscriber Management (PPPoE credentials, Customer profile, MAC bindings, Static IP / Pool assignments).
- [ ] Build Invoicing & Automated Billing Cycle Engine (Grace period, suspension states, renewal triggers).

---

## Phase 4: Network Control Plane & MikroTik RouterOS Engine
- [ ] Build MikroTik RouterOS Service Client (API/REST commands, health metrics, interfaces, traffic counters).
- [ ] Build Zero-Touch RouterOS Auto-Configuration Script Generator (`.rsc` format with WireGuard, RADIUS, and Hotspot rules).
- [ ] Build FreeRADIUS sync service (Synchronizing `radcheck`, `radreply`, `radusergroup`, and processing `radacct`).
- [ ] Build Real-Time Disconnect & CoA Dispatcher (Immediate session kill upon expiry or suspension).

---

## Phase 5: Payment Automation (M-Pesa Daraja + Airtel)
- [ ] Build Daraja STK Push integration with real-time checkout modal.
- [ ] Build Daraja C2B Paybill/Till IPN webhook handler with idempotency and double-credit protection.
- [ ] Build Instant Auto-Reconnection pipeline (Payment verified -> radcheck unblocked -> CoA sent -> SMS sent).

---

## Phase 6: Hotspot & Voucher System
- [ ] Build High-Performance Voucher Batch Generator (alphanumeric secure random codes with custom prefix & validity).
- [ ] Build Print Engine with multiple export formats (A4 Grid cards, 58mm/80mm POS Thermal receipt format).
- [ ] Build Lightweight, responsive Captive Portal with instant self-service M-Pesa checkout.

---

## Phase 7: NOC Monitoring, Field Operations & Customer Portal
- [ ] Build Real-Time NOC Dashboard with live traffic charts, router CPU/RAM gauges, and network incident alerts.
- [ ] Build Technician Field Operations module (Mobile-first work order tracking, GPS coordinates, installation status).
- [ ] Build Customer Self-Care Portal (Usage history, bill downloads, one-click M-Pesa renewal, support tickets).
- [ ] Configure PWA manifest, service workers, and offline fallback capabilities.
