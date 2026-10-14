# FreeRADIUS rlm_sql — VPS wiring (Phase 1) + auth gating (Phase 2)

No secrets in this file. Live values live only in Coolify env vars and the
Supabase `postgres` login: `SERVICE_PASSWORD_POSTGRES` (= password inside
billing `DATABASE_URL`), `RADIUS_SECRET` (= billing env, = `clients.conf` secret).

## Connection (`/etc/freeradius/3.0/mods-enabled/sql`)

- `driver = "rlm_sql_${dialect}"` with `dialect = "postgresql"`
  (needs the `freeradius-postgresql` package; 3.2.5 on Ubuntu 24.04 here).
- `server` = Supabase **DB container internal IP** — NOT `127.0.0.1`. The DB
  port is Docker-internal only (`ss -ltn` shows nothing on host 5432; neither
  localhost nor the VPS public IP answers). Get it via:
  `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <db-container>`
  NOTE: changes on container recreate — durable fix is publishing 5432 in Coolify.
- `port = 5432`, `login = "postgres"`, `radius_db = "postgres"`.
- Gotchas learned:
  - Connection lines are **indented** — `sed 's/^server = …/'` matches nothing.
    Anchor with `[[:space:]]*` and verify the grep actually prints the lines.
  - `freeradius -Q` is invalid (no such flag) → config check is `freeradius -C`.
  - `clients.conf` / `mods-enabled/sql` need sudo to read.
- Debug: `systemctl stop freeradius && freeradius -X`, test from a 2nd session.

## Client (`clients.conf`) + firewall

- `client kutus { ipaddr = 0.0.0.0/0; secret = <RADIUS_SECRET>;`
  `require_message_authenticator = no; shortname = kutus }`
  (`0.0.0.0/0` for bring-up — tighten once the router's public IP is known.)
- ufw: `1812, 1813, 3799/udp`. Hetzner Cloud firewall may need the same ports.

## Schema (migrations 010 + 022)

- 010: `radcheck` / `radreply` / `radusergroup` / `radgroupreply` / `radacct`.
- 022 adds: `radpostauth` audit table (stock `postauth_query` writes **every**
  Accept/Reject here — a missing table turns Accepts into Rejects, seen live),
  `expires_at` + `source` (`PPPOE` | `VOUCHER` | `MANUAL`) on radcheck/radreply,
  RLS locked to `service_role` (+ `postgres` owner = FreeRADIUS login), and
  triggers on `hotspot_vouchers` / `pppoe_accounts` / `customers` /
  `subscriptions` / `plans` (+ idempotent backfill preserving MANUAL rows).

## Auth gating (Phase 2 config — NOT yet applied on the VPS)

In `authorize_check_query`, append to the WHERE clause:
`AND (expires_at IS NULL OR expires_at > now())`
so expired vouchers / lapsed subscriptions reject with no cron. Until then,
expiry relies on status flips (022 triggers purge rows on change).

## Verify

- Seed: `INSERT INTO radcheck (username, attribute, op, value)`
  `VALUES ('testuser', 'Cleartext-Password', ':=', 'testpass');`
- `radtest testuser testpass 127.0.0.1 0 testing123` → `Access-Accept`.
- Router proof: KUTUS `/radius print` (ppp,hotspot @ VPS IP), hotspot profile
  `use-radius=yes`, phone login with `testuser` → online.
