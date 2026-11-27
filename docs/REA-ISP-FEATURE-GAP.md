# REA feature-gap analysis: Savcon + Tabana → QC NetCore

Generated 2026-11-27 from REA 6.7.0 captures. Scope: **authorized** vendor accounts / public material only. No licensing, payment-enforcement, or tenant-data bypass was attempted.

## 1. Evidence ledger

| Target | What was captured | REA evidence ID |
|---|---|---|
| Savcon public site | Marketing, features, pricing, FAQ (accessible-tree observation) | `ev_f8852c06ee8a57d05be6c8648b812b73b7fc42700b15a03cb844c374a15ffb20` |
| Savcon demo console | Full ISP console navigation + overview dashboard + live KPI text | `ev_bd5155fa0f5f251879acf0174ca6e9e769f455034fa35e2beed9fd5608616f8b` |
| Savcon billing placeholder | "Billing" page (demo explicitly excludes it) | `ev_de3949a9ee43c073245d0f84c3568aad4458cffce8108267f71a1860022e395f` |
| Savcon vouchers | Voucher table, codes, redeem field, generate action | `ev_6dee17ef3b2c7eef7b6d34ce9f7dbac1af3fd00b38ef73e0e12af8eaaee04f2a` |
| Savcon PPPoE users | Client table, statuses, renew/suspend/delete, account prefix | `ev_fc84c4be9b1f9993eeb5487335d4cd4d001c615a4bafc757c306f56dacf4ad83` |
| Savcon JS bundles | Static bundle analysis (`index.js`, `react.js`, `demo.js`) | `ev_bb77d1e1b23724be0263fd29dc441507d8c3558f0d2b142053ff45cd7df458d0` |
| Savcon workspace API | `GET /api/v2/demo/workspace/` fetched live (19,776 B) — not REA-retained Evidence | n/a |
| Tabana public site | Marketing feature categories, FAQ headings | `ev_8212ef429eb86c886cd6b332268406d5c1db1eca8dd15499c39c8264b9c22622` |
| Tabana business view | Redirected to sign-in; login form observed only | `ev_f2b9ab33c2297dfee09bb26a2706ccf8afddd7212b9eba8200e4ad7334b3b91f` |
| Savcon authenticated dashboard | Real ISP workspace "Quantum cod3" at `/dashboard/isp`, passively inspected via user's own browser + CDP; 930 named accessibility nodes | `ev_970fa37d186313da5d3b4c81543b38902dbbfb10b580493b4f74c3f7f6d1b7b2` |
| Savcon login attempts | Cloudflare Turnstile code 600010 blocked REA-launched browsers; credentials were redacted in evidence | `ev_19d243f2925c285271aa54aba8389aa54d0b25310722f156925a296ae24878af`, `ev_0998b85069642cf1594294d126ba888e6914f2d2662dcd6f71fc1b917345baa1`, `ev_c76fbb3d7bf2490a38a2057b325468abd1bf835c5a19da2d1d5fb9630d6e7f98` |
| Savcon Billing page | Subscription invoice, trial status, KES 500 invoice, payment phone, invoice/payment history | `ev_631e0e80d9b0106fbe6aaa3169eb63bbb99a15705048b59aef2ea9321033d326` |
| Savcon Payment Gateway page | Add Gateway flow and empty state | `ev_b7ec43a8fb88658bef3f9265f755faf303d0588e087079c587e9bc1936ac0f65` |
| Savcon Messaging Center | SMS wallet, KES 1/SMS, campaign composer, templates, merge fields, delivery stats | `ev_6a22f6271952f41ff747be3e0b79376fd2552f2ad2129ddb7bb26eb6f70eb753` |
| Savcon TR-069 page | ACS URL/credentials, device projection API, 5-min check-in, firmware | `ev_b3e75013bf0a614d3fb2d2a35898454f9911ac50c9c05787ee5a6e8fe6948b63` |
| Savcon Hotspot Packages page | Pricing, RADIUS access, device scope, vouchers, portal visibility | `ev_39fa55c5e64ad19cf6e4dcab27e24e3b2ec3264fba8b5908341f6087b9c0289b` |
| Savcon PPPoE page | Subscriber KPIs, ARPU, expiry buckets, sync, account prefix, app & SMS | `ev_f584ab27974977702ba11f920cecf1bf6a1caa935ea9678594b2bec9b9185e39` |

Caveats: REA browser scenarios were **controlled replays** in a provider-owned headless Chrome with an empty profile. Demo data mutates on a timer and resets; captures are point-in-time. Network bodies/header values were not retained. Static bundle analysis finds candidate code, not proved runtime reachability. The Savcon demo deliberately hides Billing, Payment Gateway, Messaging, and Customization ("not part of the live demo yet") — their existence is observed in navigation, their internals are **not** observed.

## 2. Observed competitor feature inventory

### Savcon (public + live demo)

**Positioning & commercial model** — observed on marketing page:
- "Every signal. Every shilling. One radius." MikroTik-native hotspot + PPPoE billing, M-Pesa, live NOC, customer apps.
- Claims: <3 s payment-to-online, 99.9% uptime, 24/7 router monitoring, 6 countries.
- Pricing toggles by country: Kenya, Uganda, Tanzania, Rwanda, Burundi, South Sudan (KES/UGX/TZS/RWF/BIF/SSP).
- Standard: **KES 500/mo** — hotspot management, PPPoE client management, MikroTik integration, multi-currency funds collection, captive portal included, analytics & reports, remote access, 99.9% SLA.
- Per-Client: **KES 15 per active PPPoE client** — all Standard features, monthly base fee, automatic reconciliation, priority support.
- 7-day free trial, no card.

**Console navigation** (observed in demo accessibility tree):
- Overview; AI Assistant; Profile; Staff
- Finance: Transactions, Billing, Payment Gateway
- Hotspot: Hotspot Users, Hotspot Packages, Vouchers, TV & MAC Bindings, Roaming Users, Customize Bundle, Loyalty, Support Tickets
- PPPoE: Overview, Users, Packages
- Network: Routers, NOC, Network Map, TR-069 Devices, Sites, Add Router, Access Points
- Captive Portal: Customization
- Communications: Messaging, Portal Messages
- Data: Import Users, Recycle Bin

**Dashboard analytics** (observed): total revenue with % delta, successful transactions count split hotspot/PPPoE, live online clients, active/expiring/stagnant/offline breakdown, today's revenue, revenue-per-router chart with per-router colors, PPPoE distribution by plan (live/expired), hotspot distribution by package, client growth, monthly revenue, daily-users-per-hour, top purchased packages, 7-day hourly concurrency heatmap, router/AP health cards (CPU, memory, clients, uptime, last seen), recent transactions with search/date filter/CSV-PDF download.

**Data model** (observed in live demo workspace JSON — useful shape reference, not code to copy):
- `packages[]`: `id, kind(hotspot|pppoe), name, price, speed, minutes, dataCap`
- `hotspot[]`: `id, mac, ip, voucher, packageId, routerId, startedAt, expiresAt, ended`
- `pppoe[]`: `id, username, name, phone, packageId, routerId, ip, status, expiresAt, createdAt, usageMb`
- `routers[]`: `id, name, site, model, routerOs, ip, cpu, sessions, status, uptimeSeconds`
- `transactions[]`: `id, ref, phone, amount, method, packageId, status, createdAt, settleAt`
- `vouchers[]`: `code, packageId, status, createdAt` — format `WST-XXXX-XXXX`
- `tr069`: `acs{url,username,password,informIntervalSeconds}`, `devices[]`, `firmware[]`, `summary`, `unclaimed[]`
  - Device fields include `dataModel` (`tr098`/`tr181`), `manufacturer`, `modelName`, `serialNumber`, `oui`, `wanStatus`, `rxPowerDbm`/`txPowerDbm`, `faults[]`, `pendingTasks[]`, `actions[]`, and `wifi[]` entries with exact TR-098/TR-181 parameter paths for SSID and pre-shared key.
- Example packages: 1 Hour KES 10 (5 Mbps, 60 min), Daily 1GB KES 50 (10 Mbps, 1440 min, 1 GB), Weekly 5GB KES 200 (10 Mbps, 10080 min, 5 GB), Monthly Unlimited KES 800 (8 Mbps, 43200 min); PPPoE 1500/2500/4000/9000 KES.

**Voucher flow** (observed): Generate vouchers button, Portal purchase button, Online now / Ended / Vouchers / Packages tabs, redeem-code textbox + Redeem button, table of code/bundle/price/status/created.

**PPPoE flow** (observed): Add PPPoE, account prefix settings, "App & SMS" settings, MY-WIFI preview, status tabs all/active/suspended/expired, per-client Renew / Suspend / Activate / Delete, expiry shown as relative time.

**Payment claims** (marketing, not demo-verified): STK push, till and paybill reconciliation; Airtel Money, MTN MoMo, Tigo Pesa, HaloPesa.

### Savcon authenticated workspace (observed 2026-11-27)

Captured passively from the user's own signed-in Chrome window (`quantum-cod3.savcon.co.ke/dashboard/isp`). This is a **fresh workspace** with zero revenue and no routers, so data values are placeholders; the navigation and dashboard structure are real.

- Navigation: Overview, AI Assistant, Profile, Staff, **Hotspot** (collapsed group), **PPPoE** (collapsed group), Loyalty, **Tickets AI**, **Messaging** (collapsed group), Transactions, **Billing** (collapsed group), NOC, Sites, Network Map, **Devices** (collapsed group), Captive Portal, Import Users, Recycle Bin, MORE.
- Setup checklist: "Connect your first router", "Create your first plan", "Connect your payment gateway".
- Dashboard sections: Revenue per router (HotSpot + PPPoE), PPPoE Distribution, HotSpot Distribution, HotSpot vs PPPoE Revenue, Data consumption per day (7/14/30/90 d), Top users (HotSpot/PPPoE, 24 h/7 d/30 d), Client Growth, Monthly Revenue, Daily Users / Hour, Top Purchased, **Signal Clock** (day-of-week activity), Routers & Access Points, Recent Transactions with Chart/Table toggle and Download.
- Account state: logged in as `langat_gift`; notification **"SMS credit low"** confirms an SMS wallet/balance model.
- Customer app links: "Open your customers' Hotspot app" (`hotspot.savcon.co.ke/quantum-cod3`) and "PPPoE app (MY-WIFI)" (`mywifi.savcon.co.ke/quantum-cod3`).
- Discovered real routes (from expanded menu accessibility trees):
  - Hotspot: `/dashboard/isp/hotspot/accounts`, `/hotspot/packages`, `/hotspot/vouchers`, `/hotspot/mac-bindings`, `/hotspot/roaming-users`, `/hotspot/customize-bundle`, `/hotspot/support-tickets`
  - Billing: `/dashboard/isp/billing` (Subscription), `/payment-gateway`
  - Messaging: `/dashboard/isp/messaging` (SMS), `/captive-portal/messages`
  - Devices: `/dashboard/isp/routers`, `/routers/tr069`, `/access-points`, `/routers/setup`
  - Other: `/loyalty`, `/sites`, `/network-map`, `/noc`, `/captive-portal`, `/migration`, `/recycle-bin`, `/profile`, `/staff`, `/analytics`, `/transactions`

### Savcon authenticated page details (observed)

- **Billing** (`/dashboard/isp/billing`): "Invoice history, payment status, and payment method", currency KES, account status `trial`, Amount Due KES 500, open invoice `INV-20261126-1485E55D`, due date, phone-number field for payment, "Pay KES 500" action, Invoices table (ID/Amount/Status/Due Date/Paid At), Payment Transactions section. This is the *platform subscription* billing of the vendor, directly analogous to QC NetCore's owner billing.
- **Payment Gateway** (`/dashboard/isp/payment-gateway`): "Configure how your hotspot collects payments"; Add Gateway / Add Payment Gateway actions; empty state tells the operator customers cannot pay until a gateway exists.
- **Messaging Center** (`/dashboard/isp/messaging`): tenant-scoped SMS campaigns; wallet balance, low-balance top-up, sent today, success rate, month spend; Compose/Templates/History/Settings; recipient groups Individual numbers / Bulk Hotspot / Bulk PPPoE; system templates (Hotspot connection, Hotspot maintenance, PPPoE expiry notice, PPPoE renewal); merge fields `{{username}}`, `{{package_name}}`, `{{expiry_date}}`; KES 1/SMS; duplicate numbers removed; queued delivery worker with updates in History.
- **TR-069** (`/dashboard/isp/routers/tr069`): "Manage your customers' ONUs and routers remotely: signal, WiFi, PPPoE login, reboot and firmware." Per-account ACS URL ending in an account code, ACS username/password, copy buttons, and instructions to set CWMP on each ONU; devices appear within a minute and are then set to check in every 5 minutes; each device links to the PPPoE client whose username it dials. KPIs: devices, online, linked to clients, weak signal; search by serial/model/client/username/IP; firmware management. The error text exposed the internal query shape: `GET /devices/?query={}&projection=_id,_deviceId,_lastInform,_lastBoot,_registered,...` on `127.0.0.1:7557` — consistent with a GenieACS-style CWMP server and TR-098/TR-181 parameter projections.
- **Hotspot Packages**: "One-page control for pricing, RADIUS access, device scope, vouchers, and captive portal visibility"; KPIs packages, portal visible, multi-device, device scoped; filter by MikroTik router, access point, or tenant-wide.
- **PPPoE**: "Subscribers, plans, routers, renewals and live connection state"; subscribers/active/online/offline/expiring-in-3-days/expired/never-activated, revenue this month, ARPU, package distribution, router table, recently expired, Add PPPoE, Account prefix, App & SMS, Sync all users.

### Tabana (public only — authenticated view pending)

- Positioning: "Billing and Automation for Wireless ISPs and Fiber ISPs" — sales, billing, due-date reminders, monitoring, tickets, reporting, customer self-service.
- Compatible with **RADIUS, SNMP, API, TR-069, SSH** equipment (hardware-agnostic).
- Product areas: Bandwidth Management (devices/plans/pre-paid), Billing (discounts/packages/MPESA), Device Management (monitor devices/logs/TR-069), Integrated Helpdesk (create tickets/feedback/IVR), WiFi Hotspot (voucher/social/paid), Customer Management (log usage/device inventory).
- Business view at `/business/view/1758643031` requires sign-in; login form uses invisible reCAPTCHA v3.

## 3. QC NetCore current state (pushed HEAD `975ebea`)

Already present:
- Owner console: `/admin/isps`, `/admin/billing`, `/settings`, plus `/admin/isps/[id]` workspace with customers, invoices, stats, integrations.
- Platform ISP billing: hotspot %×revenue, PPPoE active×$0.25×FX, custom manual KES; invoice SMS via Africa's Talking.
- RADIUS + FreeRADIUS SQL sync and expiry filtering.
- Captive portal designer + publish, `/captive?org=slug`, voucher batch API + redeem endpoint.
- M-Pesa STK push and callback endpoints (live keys still blocked).
- Monitoring/NOC, payments/revenue, SMS, technicians, AI copilot, MikroTik provisioning/fleet heartbeat.

Not present in source (searched `src/**/*.ts(x)`):
- TR-069/CWMP ACS (only marketing copy mentions it), device/firmware inventory, CPE fault tracking.
- Multi-country/multi-currency pricing switcher.
- Loyalty, roaming users, TV & MAC bindings, bundle customization, network map, sites/access-point inventory.
- Voucher agent sales channel, recycle bin, import users UI.
- Revenue-per-router chart, hourly concurrency heatmap, top-purchased ranking.
- Customer self-service app beyond the hosted captive portal.
- Dedicated Payment Gateway and Messaging campaign pages.

## 4. Gap matrix → prioritized backlog

| # | Capability | Evidence | QC status | Priority | Slice / acceptance criteria |
|---|---|---|---|---|---|
| 1 | **TR-069/CWMP device management** | Savcon nav + full demo data model + authenticated ACS page exposing GenieACS-style `/devices/` query on port 7557; Tabana lists TR-069 | Absent | P0 | Self-host GenieACS-compatible CWMP server; per-ISP ACS URL with account code, 5-min Inform interval; device inventory (serial/OUI/model, weak signal), wifi SSID/PSK read+push, faults/pending tasks, firmware list, unclaimed devices, PPPoE-client linking by dialed username. Start read-only; push actions behind explicit confirmation. |
| 2 | **Revenue-per-router + concurrency analytics** | Savcon overview charts, Signal Clock, data-consumption ranges | Partial — Nov 27 analytics slice shipped (see §8) | P0 | DONE: revenue split (HotSpot/PPPoE/unattributed), ARPU, revenue per router, top users by collections, 7/14/30/90 d selectors and honest empty states. REMAINING: hourly concurrency heatmap and live daily usage need accounting/session snapshot writers; day-of-week Signal Clock needs multi-day history. |
| 3 | **Customer self-service "my account"** | Savcon MY-WIFI + hotspot customer app; Tabana customer self-service | Portal only | P0 | Phone-based login, show active bundle/expiry, buy again, payment history. Build on existing captive session + M-Pesa callback. |
| 4 | **Automated suspend/restore on billing state** | Savcon PPPoE claims; Tabana due-date reminders | Partial (RADIUS expiry only) | P0 | Invoice due → suspend RADIUS secret; paid → restore. Idempotent reconciliation job + audit log. |
| 5 | **Multi-country currency pricing** | Savcon country switcher; East Africa focus | KES/FX only | P1 | Country selector with currency + FX source; owner pricing rules per ISP country; keep hotspot % and PPPoE $0.25×FX as platform defaults. |
| 6 | **Support tickets / helpdesk** | Savcon Support Tickets; Tabana Integrated Helpdesk + IVR | `tickets` strings exist but no dedicated page | P1 | Ticket list/create/reply, attach subscriber, SLA state, link from ISP workspace. |
| 7 | **Messaging campaigns & templates** | Savcon Messaging Center (authenticated): wallet, KES 1/SMS, recipient groups, system templates, merge fields, queued delivery | SMS sender + `/sms` page, no campaigns | P1 | Campaign composer with recipient groups (individual / bulk hotspot / bulk PPPoE), template library with `{{username}}`, `{{package_name}}`, `{{expiry_date}}`, duplicate-number removal, cost estimate, wallet/top-up, queue worker + History delivery reports. |
| 8 | **Network map + sites/AP inventory** | Savcon Network Map, Sites, Access Points | Routers page only | P2 | Site hierarchy, AP records, simple topology view from existing router data. |
| 9 | **Roaming users / TV & MAC bindings / bundle customization / loyalty** | Savcon hotspot nav | Absent | P2 | Add as hotspot sub-resources after #3; low cost once subscriber model is stable. |
| 10 | **Voucher agents + import/recycle bin** | Savcon vouchers/agents, Data nav | Batch API exists, no agent channel | P2 | Agent assignment, commission view, CSV import, soft-delete restore. |
| 11 | **Payment Gateway page (till/paybill reconciliation)** | Savcon Payment Gateway; Tabana MPESA | STK/callback only | P2 | Till/paybill reconciliation queue and unmatched-payment inbox; needs Daraja credentials (#blocked). |
| 12 | **Staff / role management** | Savcon Staff | Basic profiles only | P2 | ISP-scoped staff roles with owner audit trail. |

Suggested delivery order: **2 (partial, shipped) → 1 → 3 → 4**, then re-run REA on authenticated Tabana to refine 5–12 before committing effort.

## 5. Observed vs inferred

- **Observed**: all navigation labels, dashboard text, table columns/rows, pricing numbers, data-model field names, voucher formats, billing placeholder messages, login redirect and reCAPTCHA script.
- **Inferred**: that demo data-model fields match production schemas; that vendor marketing claims are fully implemented; that hidden demo pages mirror the visible design language. Marketing claims (payment methods, SLA, setup speed) are **vendor statements**, not independently verified behavior.
- **Not attempted**: bypass of reCAPTCHA, licensing, payment enforcement, or access to any tenant the user does not administer.

## 6. Pending Tabana authenticated capture

REA login scenario is prepared at `C:\Users\DGX\AppData\Local\Temp\opencode\rea-tabana\scenario-login.json`. It references two environment variables (`TABANA_USER`, `TABANA_PASS`) declared as REA secrets; values are never embedded in the scenario, chat, or evidence.

To run: create `C:\Users\DGX\AppData\Local\Temp\opencode\rea-tabana\creds.ps1` containing only:

```powershell
$env:TABANA_USER = 'your-account-or-email'
$env:TABANA_PASS = 'your-password'
```

Then tell the agent to run it; the same PowerShell process will dot-source the file, execute the scenario, and delete the file afterwards. If reCAPTCHA v3 blocks automation, fall back to user-performed login via CDP connect mode.

## 7. Credential handling

Vendor credentials were supplied in chat during this session. REA redacted them in all captured evidence (`[REDACTED:savcon_user]` / `[REDACTED:savcon_pass]`), and no secret values were written to the report. The temporary profile copy at `C:\Users\DGX\AppData\Local\Temp\opencode\rea-chrome-profile-copy` contains browser cookies and must be deleted when the investigation ends. Rotate the shared password after the session.

## 8. Implemented slice — analytics dashboard (2026-11-27)

Backlog item #2 was chosen for the first implementation pass. It is shipped in
the live Git clone at `C:\Users\DGX\AppData\Local\Temp\opencode\qc-current`
(base `975ebea`), with a copy of this report in `docs/REA-ISP-FEATURE-GAP.md`.

What is real now:
- `GET /api/v1/analytics/dashboard` returns session-scoped, org-filtered raw
  rows (payments, subscriptions, plans, activated vouchers, PPPoE accounts,
  routers, customers). RLS is unchanged; partial query failures become
  warnings rather than invented zeros.
- Pure helpers in `src/lib/analytics.ts` attribute each completed payment by
  subscription overlap → `plans.service_type` (HOTSPOT wins ties), add
  activated voucher face value to HotSpot revenue, keep unattributed payments
  visible, compute ARPU, group revenue by router via
  `pppoe_accounts.router_id`, and rank customers by collections.
- `/dashboard` renders an `AnalyticsOverview`: revenue mix + ARPU, revenue per
  router, top users with service filters, data-consumption range buttons, and
  Signal Clock. Period toggle stays in sync with the existing revenue chart.

What is deliberately honest:
- QC NetCore has no accounting or session snapshot tables. "Data consumption
  per day" and "Signal Clock" therefore show explicit empty states until
  snapshot history exists; no fake hourly/heatmap data is generated.
- Live PPPoE rows have no byte or online-state columns. Those table counters
  can only be populated from demo seed data and are labelled as such.
- Router revenue is an attribution: payments have no `router_id`, so customer
  → PPPoE account → router is the available join. Customers with no router
  mapping remain in an "Unattributed" row.

Verification: `tests/dashboard-analytics.test.mjs` (8 cases),
`npm test` = 113 pass + 1 skip, `tsc --noEmit` clean, and
`npm run build` clean including the new API route.
