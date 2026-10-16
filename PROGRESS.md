# QC NetCore — Field Session Progress Log

> For the next developer / AI agent. Covers the billing + Supabase + KUTUS
> bring-up session (Oct 12–14, 2026). No secrets in this file — live keys
> live only in Coolify env vars and `supabase/migrations/{coolify.env,mainappcoolify.env}`
> (local-only helper dumps, NEVER commit real values to git).

## 0. Topology (single VPS, Coolify)

- `billing.quantumcode.co.ke` — Next.js app (`QC-NetCore:main`), Nixpacks builder.
- `supabase.quantumcode.co.ke` — self-hosted Supabase (Kong :8000, Auth, PostgREST).
- `194.163.188.247` — VPS public IP; also `RADIUS_SERVER` and WireGuard endpoint `:51820`.
- KUTUS — RB951Ui-2HnD, RouterOS 7.23.6 (long-term). WAN=`ether1` (DHCP `192.168.0.106`
  from upstream LAN router), LAN=`bridge` (`192.168.88.1/24` + `10.20.0.1/24`).

## 1. Provisioning 503 — PGRST301 JWT mismatch (FIXED)

- Symptom: `POST /api/v1/mikrotik-provisioning/bootstrap` → 503
  `"The service is temporarily unavailable"`, logs
  `[Provisioning Bootstrap] Supabase provisioning-token/routers query failure: PGRST301`.
- Root cause: Supabase `SERVICE_PASSWORD_JWT` did not match the signing secret of
  `SERVICE_SUPABASEANON_KEY` / `SERVICE_SUPABASESERVICE_KEY` (stock demo JWTs), and the
  billing app still carried the demo keys while the stack had rotated ones.
  PostgREST (`PGRST_JWT_SECRET`) rejected everything.
- Fix: single matched set everywhere — Supabase stack env
  (`SERVICE_PASSWORD_JWT`, `SERVICE_SUPABASEANON_KEY`, `SERVICE_SUPABASESERVICE_KEY`)
  identical to billing env (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
  Decode at jwt.io to confirm `role`/`exp` if unsure.
- Coolify quirks learned:
  - `..._ASYMMETRIC` vars are template-managed: "Cannot delete … remove it from the
    Docker Compose file first" → leave empty, don't delete.
  - `NEXT_PUBLIC_*` must be **Available during build** (baked into Next build);
    env changes need redeploy **with rebuild**, not restart.
  - `Interpolate $VARIABLES` is safe (no secret contains `$`).

## 2. Billing rebuild (commits `9314aed`, in repo)

- Symptom: Coolify build failed — Nixpacks used Node 18, but
  `@supabase/*@2.117.2` needs `>=22` and `@tailwindcss/oxide` needs `>=20`;
  plus `Cannot find native binding` (Windows-generated lockfile, linux builder,
  optional deps omitted under `NODE_ENV=production`).
- Fix committed: `package.json` `engines: node 22.x`, `.nvmrc` (`22`),
  `nixpacks.toml` (`NIXPACKS_NODE_VERSION=22`, `NPM_CONFIG_PRODUCTION=false`,
  install `npm ci --include=optional`).

## 3. Sign-in 401 (FIXED — process)

- After key rotation, `/auth/v1/token?grant_type=password` → 401 `{"message":"Unauthorized"}`
  until BOTH sides ran the same set. Order that works:
  1. redeploy/restart Supabase stack (auth+rest+kong), wait healthy;
  2. redeploy billing with build-cache clear, confirm log shows the new commit SHA;
  3. hard refresh + clear site data (old JWTs stay invalid).

## 4. Provisioning script idempotency (commits `3c5c05b`, `a01ac1b`, `5609944`)

Re-imports used to abort partway (token never consumed), each leaving partial state:
- `pppoe-server server add` had no preceding remove → now removes `qc-fiber` first (v6+v7).
- `qc-hotspot-profile` add had no remove → now removes first (v7).
- `/user group remove` ran before `/user remove` → "group has some users" → order swapped.
- **Key rotation trap:** the template removed + re-added the WireGuard interface, so every
  import generated a new router keypair and silently invalidated the VPS peer.
  Now the interface is created once and preserved (`:if find="" do add`); re-imports keep keys.
- Rule: avoid re-imports unless necessary; each one used to rotate keys.

## 5. Router status stuck OFFLINE (commits `d97597f`, `d4258fe` — FIXED, then refined)

- `registerRouter` wrote `status:"OFFLINE"` (while the API replied `"ONLINE"`), and no
  code path ever set it back (`updateTelemetry` has no callers).
- Now: registration writes `ONLINE`; `RoutersService.list()` derives presence from
  `last_seen_at` — seen within 5 min → `ONLINE`, older → `OFFLINE` (stale `ONLINE`
  explicitly ages out so power-off clears the badge after ~5 min, not instantly —
  see heartbeat below for why instant isn't possible yet).

## 6. WireGuard tunnel (VPS `wg0` ↔ KUTUS `wg-qcnetcore`)

- Server keypair generated on VPS; billing `WIREGUARD_SERVER_PUBLIC_KEY` must equal the
  **live** `sudo wg show wg0 public-key` byte-for-byte (photo transcription caused
  multiple silent mismatches: `J1` vs `JI`, truncated keys → `Key is not the correct
  length`). Always copy key text, never retype from photos.
- VPS: `/etc/wireguard/wg0.conf` (`10.200.1.1/16`, `:51820`), peer = router pubkey,
  `AllowedIPs = <tunnel IP>/32`; `ufw allow 51820/udp`; `net.ipv4.ip_forward=1`.
- Router tunnel IP `10.200.1.3/16`; known-keypair procedure used
  (`wg genkey` on VPS → set on router via `/interface wireguard set … private-key=`).
- Debug ladder that worked: `tcpdump -i any udp port 51820` (148B `In` = initiations
  arriving; zero `Out` = VPS rejecting key) + `sudo wg show` (endpoint/handshake/transfer).
- WinBox terminal paste = right-click, not Ctrl+V.
- ⚠️ Handshake/ping `10.200.1.1` had NOT yet succeeded at last check — verify with
  router `/ping 10.200.1.1` + `sudo wg show` (endpoint/handshake/transfer lines).

## 7. Presence heartbeat (commit `153d274` — DEPLOYED CODE, rollout in progress)

Cheapest presence option (one tiny HTTPS POST + one row update per router per 2 min;
no tunnel/poller needed):
- `supabase/migrations/021_router_heartbeat.sql` — **MUST be applied in Supabase SQL
  editor before/while deploying** (adds `heartbeat_token_hash` to
  `router_provisioning_tokens` + `routers`, unique index). Idempotent block is in
  rollout notes; re-runnable safely.
- `POST /api/v1/mikrotik-fleet/heartbeat` (token-auth by hash lookup, no session).
- Generated scripts embed a `qc-heartbeat` `/system script` + 2-min `/system scheduler`
  (v6+v7, idempotent, key-preserving).
- `validateHeartbeatPayload` + `generateHeartbeatToken` in provisioning core.
- Tests: `tests/provisioning.test.mjs` extended (12/12 passing locally via `node --test`).
- Rollout: migrate → redeploy billing (`153d274`) → fresh V7 script → import →
  `/system scheduler print` shows `qc-heartbeat` → manual `/system script run qc-heartbeat`
  moves `Last seen` → power-off flips badge in ~5 min.

## 8. Hotspot on KUTUS (working redirect, stock page)

- Script only creates profile + walled garden; the operator adds the server:
  pool `qc-hotspot-pool` (`10.20.0.0/24`), `10.20.0.1/24` on `bridge`, DHCP,
  `/ip hotspot add … profile=qc-hotspot-profile`, profile `hotspot-address=10.20.0.1`
  (was `10.10.0.1` — must exist on the box).
- Gotcha: `bridge` carries two subnets (192.168.88.x DHCP + 10.20.0.x) — works via
  hotspot client NAT for now; re-IP later, not mid-test.
- Redirect confirmed working (captive prompt, `wifi.login.local`). Stock MikroTik
  `login.html` shown → branded replacement written (see `hotspot/login.html` in repo,
  also operator's `Downloads/login.html`). Keeps CHAP via on-box `/md5.js`
  (do NOT delete it); Account/Voucher/M-Pesa tabs; M-Pesa/package buttons deep-link to
  `/captive?mac=&ip=&plan=&phone=` (walled-garden allowed pre-auth).
- Design-dynamic question: RouterOS only serves local files → local page = re-upload
  per redesign; redirect/iframe-to-portal = instant updates. Stayed local until
  RADIUS + test payment prove out, then convert once.
- Next: logins will time out until **FreeRADIUS** is installed on the VPS
  (`194.163.188.247:1812/1813`, see `docs/FREERADIUS_RLM_SQL.md`). RADIUS address is the
  public IP, so no tunnel dependency. Also move the PPPoE server off `ether1` (WAN)
  onto `bridge`/LAN before real customers.

## 9. Security hygiene (TODO)

- Change `admin` password (brute-force `login failure for user admin` seen in logs).
- Rotate the WireGuard server keypair once flow is proven (private key passed through chat).
- Real Daraja + AfricasTalking keys still placeholders in billing env.

## 10. How to verify current state (5 min)

1. Coolify billing deployment log shows commit `153d274` green.
2. Routers page: KUTUS row fresh `Last seen` (≤2 min if scheduler beats land).
3. Router: `/system scheduler print` (qc-heartbeat), `/interface wireguard peers print detail`
   (`last-handshake` recent), `/ping 10.200.1.1`.
4. VPS: `sudo wg show` (endpoint + handshake + transfer).

## 11. FreeRADIUS bring-up (Phase 1 COMPLETE incl. router proof, Oct 14)

- `sql` module: `driver=rlm_sql_${dialect}`, `dialect=postgresql`
  (package `freeradius-postgresql` 3.2.5 present), `port=5432`, `login=postgres`,
  `password=<SERVICE_PASSWORD_POSTGRES>`, `radius_db=postgres`.
- `server` = Supabase **DB container internal IP**, NOT localhost: the DB port is
  Docker-internal only (`ss` shows nothing on host 5432; localhost and the VPS
  public IP both refused). Resolve via
  `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <db-container>`.
  NOTE: changes on container recreate — durable fix = publish 5432 in Coolify.
- Gotchas: file lines are indented (`sed 's/^server = …/'` matched nothing —
  anchor `[[:space:]]*` and confirm grep prints the lines); `freeradius -Q` is
  invalid → check is `freeradius -C`; `clients.conf`/`sql` need sudo to read.
- `client kutus { 0.0.0.0/0, secret=<RADIUS_SECRET>, require_message_authenticator=no }`;
  ufw `1812/1813/3799-udp` (+ Hetzner Cloud firewall may need the same).
- Breakthrough bug: `radpostauth` table missing → post-auth audit INSERT failed →
  Accepts flipped to Rejects (`relation "radpostauth" does not exist`). Table
  created (also folded into 022).
- Proof: `radtest testuser → Access-Accept`; service enabled; KUTUS `/radius`
  (ppp,hotspot @ VPS public IP) + hotspot profile `use-radius=yes` verified;
  ping 0% loss (~218ms); **live phone login with `testuser` works end-to-end**.
- Open: confirm billing login healthy — its `DATABASE_URL` uses the VPS public IP,
  which refused 5432 from host (may share the unpublished-port root cause).

## 12. Phase 2 — rad sync writers (022, written, NOT yet verified/applied)

- `supabase/migrations/022_radius_sync.sql`: triggers on `hotspot_vouchers` /
  `pppoe_accounts` / `customers` / `subscriptions` / `plans` keep
  radcheck+radreply in lockstep; `source` scoping (PPPOE/VOUCHER/MANUAL);
  `expires_at` wall-clock; RLS locked to `service_role`; idempotent backfill
  preserving MANUAL rows.
- Local Docker Desktop WSL backend is dead → verified on a VPS scratch PG
  instead (`ALL RADIUS SYNC CHECKS PASSED`, Oct 14). The scratch run caught a
  real bug first (`record` loop vars can't cast to rowtype — fixed in `9e0c92d`).
- 022 applied in the SQL editor (Oct 14); `authorize_check_query` carries
  `AND (expires_at IS NULL OR expires_at > now())` (queries live in
  `mods-config/sql/main/postgresql/queries.conf` on 3.2, not `mods-enabled/sql`).
  Gotcha: invisible trailing space after a continuation `\` = `Unterminated
  string` at parse; rewrite such lines with sed and verify with `cat -A`.
  `radtest testuser` still Accepts with the filter live → Phase 2 COMPLETE.

## 13. Phase 3 slice 1 — voucher redeem + auto-login (built, uncommitted, Oct 14)

- `POST /api/v1/captive/redeem` (public, anon): `{ org, code, mac?, phone? }`
  → org by slug, org-scoped voucher lookup, first activation stamps USED +
  paid window (022 triggers write rad rows), re-redeem inside window re-issues
  same credentials, lapsed USED flips to EXPIRED (purges rad rows).
- Pure logic `src/lib/captive/redeem.ts` — `tests/captive-redeem.test.mjs` 6/6;
  full suite 84 pass + 1 skip (radius-sync skips via `docker info` gate now).
- Portal UI: `PortalRenderer` voucher tab calls redeem when live (real org, not
  draft) then bounces to `linklogin?username=&password=`; demo/preview/draft
  paths untouched — draft preview can never burn real vouchers.
- `hotspot/login.html`: `PORTAL_ORG` const (SET per site) + `buy()` passes
  `org` + `linklogin=$(link-login-only)`; auto-login snippet reads the query
  params, skips when an error box shows, CHAP/PAP variants, overlay.
- Live proof needs: org slug, one AVAILABLE voucher on a HOTSPOT plan,
  `PORTAL_ORG` set + login.html re-uploaded, billing rebuilt in Coolify.
- Tenant: org slug `dagi-net-3038` (Dagi Net).
- Backend loop proven live (Oct 14): curl redeem `TEST-1234-ABCD` → USED +
  `expires_at`, 022 trigger wrote the radcheck row with matching expiry.
- Left: `PORTAL_ORG` + login.html re-upload + phone loop (portal → auto-online).
- Open: redeem brute-force rate-limit (TODO); M-Pesa STK slice needs live
  Daraja keys (still placeholders in billing env).
- Phase 2 config still to do on VPS after 022 is applied: `authorize_check_query`
  `AND (expires_at IS NULL OR expires_at > now())` — see `docs/FREERADIUS_RLM_SQL.md`.

## 14. Phone loop + voucher backend (Oct 14, live fixes)

- Plans/org fix: 5 HOTSPOT plans were seeded under QC org (`a0000000…`) so
  `/api/v1/captive/public?org=dagi-net-3038` returned `plans: []`. Reassigned
  all HOTSPOT plans to Dagi Net (`b9d1c320…`); portal now serves all 5 live
  packages. (PPPOE plans stay with QC org; QC org has no portal config.)
- Design is PUBLISHED for Dagi Net; `/captive?org=dagi-net-3038` renders 200.
- `hotspot/login.html`: `PORTAL_ORG="dagi-net-3038"`; **direct-to-portal**
  redirect (3s overlay, skips on `?username=` bounce-back / `?shell=1` / login
  error / empty org; "stay here" escape for account logins); Voucher tab gained
  an "Open Portal" button; M-Pesa tab's fake hardcoded prices removed (portal
  shows live plans). JS syntax verified via node check script.
- Router (KUTUS, WinBox by operator): walled-garden entries added for
  `billing.quantumcode.co.ke`, `*.quantumcode.co.ke`, and `194.163.188.247:443`.
  Confirmed: phone auto-lands on the designed portal (DGX WiFi branding).
- Voucher bug found: dashboard "Generate Batch" only updated browser state —
  nothing was ever written to Supabase, so dashboard codes (e.g. `QCT01`)
  redeemed as "not valid". Fixed with a real backend:
  `src/lib/vouchers/batch.ts` (pure: validation, crypto codes, `tests/…` 6/6),
  `GET /api/v1/vouchers` (org-scoped list + plan join),
  `POST /api/v1/vouchers/batch` (admin auth, plan must be org HOTSPOT+active,
  batch + AVAILABLE vouchers insert, 23505-collision retry with rollback).
  Dashboard page now loads live vouchers and POSTs on generate (demo mode
  keeps in-memory seeds). Full suite: 90 pass + 1 skip.
- `QCT01` inserted manually (Dagi Net, 1-Hour plan, AVAILABLE) so the operator
  can test redemption immediately; `LOOP-TEST-7777` still AVAILABLE.
- Note: `hotspot/login.html` copy also kept at
  `Documents/Q biling system/hotspot/login.html` for WinBox upload.
- Note: phone joined SSID `Tenda_ADB7EO` — verify that Tenda is bridge/AP-only
  (no competing captive portal) in front of KUTUS.

## 15. SaaS owner console (Oct 15–16)

- Accounts: `langatgt7@gmail.com` = existing login `92412bee…` (was briefly
  promoted then reverted — now `isp_owner` of Dagi Net again; note its password
  was overwritten to `Vgtp6I1aRcvEZhGr`, customer must change it).
  `langatgt2@gmail.com` = new super_admin `744c71a0…` on platform org
  (temp password issued, must change). Created via Auth Admin API + profiles row.
- Problem seen: owner login showed the same org dashboard (zeros on platform
  org). Fixed with a real owner console instead of reusing the ISP dashboard.
- `GET/POST /api/v1/admin/isps` + `GET/PATCH /api/v1/admin/isps/[id]`:
  super_admin-only (new `authorizeSuperAdmin`), per-ISP stats rollup
  (routers/customers/plans/vouchers/users/revenue/portal), create (slug
  validation, 409 on taken), suspend/activate (blocks portal+redeem).
  Pure logic `src/lib/admin/isps.ts`, `tests/admin-isps.test.mjs`.
- UI `src/app/admin/isps` (list, onboard modal, detail drawer, share editor);
  `/dashboard` redirects super_admin → `/admin/isps`.
- Nav is role-gated now (`roles` + `hideFor` in `nav.ts`, applied to Sidebar,
  mobile BottomNav with fallback items, quick-jump). super_admin sees ONLY
  ISP Management + Settings (+ ISP Billing below); operators unchanged.
- Build lesson: Coolify `next build` type-checks — `b301c25` failed on a TS
  cast in the ISP detail route (fixed `d4fcbf1`). `node_modules` now installed
  in the clone: run `tsc --noEmit` locally BEFORE every push.
- Full suite at last check: 101 pass + 1 skip.

## 16. ISP revenue-share billing + invoice SMS (Oct 16, `7cafdf1`)

- Model (user chose revenue share): `organizations.revenue_share_pct`
  (default 10) + new `isp_invoices` table — migration
  `supabase/migrations/023_isp_billing.sql` (RUN in SQL editor BEFORE/A.S.A.P.
  after deploy; service_role-only RLS like 022; UNIQUE(org, year, month)).
- Flow: draft invoice (ISP + YYYY-MM + share% + due) → base auto-summed from
  that month's COMPLETED payments → total = base × share. DRAFT create is
  idempotent; finalized periods 409.
- Real SMS: new server-only `src/lib/sms/sender.ts` (Africa's Talking,
  env `AFRICASTALKING_USERNAME/_API_KEY[/_SENDER_ID]`; `sandbox` username =
  test gateway; UNCONFIGURED surfaced honestly in UI). Note: the old
  `src/lib/sms/engine.ts` never actually sends — in-memory/demo only.
- Endpoints (super_admin): `GET/POST /api/v1/admin/billing`,
  `POST /api/v1/admin/billing/[id]/send` (DRAFT→SENT, resend allowed, stamps
  sent_at/sent_to), `PATCH … pay|void` (partial→PAID rollup).
  Pure logic `src/lib/admin/isp-billing.ts` + `tests/admin-isp-billing.test.mjs`.
- UI `src/app/admin/billing` (outstanding/collected/overdue cards, create/pay/
  send/void, SMS status banner). Nav: "ISP Billing" (super_admin only).
- Still needed from operator: run 023 SQL; set AT keys in Coolify + redeploy.
  Live test: draft Dagi Net October invoice → send → record payment.
