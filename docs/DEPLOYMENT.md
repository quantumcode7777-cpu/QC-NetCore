# Production Deployment & Infrastructure Guide

## 1. Production Topology

```
                                  [ Internet / Subscribers / Admins ]
                                                   |
                                                   v
                                          [ Cloudflare CDN / WAF ]
                                                   |
                                                   v
                         +---------------------------------------------------+
                         |      NEXT.JS SAAS APPLICATION (Vercel / VPS)     |
                         |  - SSL Termination, Edge SSR, API Route Handlers  |
                         +-------------------------+-------------------------+
                                                   |
                                                   v
                         +---------------------------------------------------+
                         |         MANAGED POSTGRESQL (Supabase / AWS RDS)   |
                         |  - Primary DB with RLS & High Availability         |
                         +-------------------------+-------------------------+
                                                   |
                                                   v (Internal VPC / Private IP)
                         +---------------------------------------------------+
                         |     DEDICATED NETWORK INFRASTRUCTURE (Linux VPS)  |
                         |  - FreeRADIUS 3.x (rlm_sql auth/acct daemon)      |
                         |  - WireGuard Gateway (Host: 51820 UDP)            |
                         |  - Network Telemetry & CoA Worker (FastAPI/Node)  |
                         +-------------------------+-------------------------+
                                                   |
                                                   | (WireGuard Overlay Network)
                                                   v
                         +---------------------------------------------------+
                         |            EDGE MIKROTIK ROUTERS (ISPs)           |
                         |  - MikroTik CCR2004, RB5009, hEX, CHR Virtual     |
                         +---------------------------------------------------+
```

---

## 2. Dockerized FreeRADIUS + WireGuard Production Stack

The network services run in Docker on an Ubuntu 22.04/24.04 LTS server:

```yaml
version: '3.8'

services:
  freeradius:
    image: freeradius/freeradius-server:latest
    container_name: gtech_freeradius
    restart: unless-stopped
    ports:
      - "1812:1812/udp" # RADIUS Authentication
      - "1813:1813/udp" # RADIUS Accounting
      - "3799:3799/udp" # RADIUS CoA / Disconnect
    environment:
      - DATABASE_URL=postgresql://radius_user:secret_pass@db-host:5432/gtech_isp
    volumes:
      - ./freeradius/mods-available/sql:/etc/raddb/mods-available/sql
      - ./freeradius/sites-available/default:/etc/raddb/sites-available/default
      - ./freeradius/clients.conf:/etc/raddb/clients.conf

  wireguard-gateway:
    image: linuxserver/wireguard:latest
    container_name: gtech_wireguard
    restart: unless-stopped
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Africa/Nairobi
      - SERVERURL=vpn.gtechisp.co.ke
      - SERVERPORT=51820
      - PEERS=500
      - PEERDNS=1.1.1.1
      - INTERNAL_SUBNET=10.200.0.0/16
      - ALLOWEDIPS=10.200.0.0/16
    ports:
      - "51820:51820/udp"
    volumes:
      - ./wireguard/config:/config
      - /lib/modules:/lib/modules
    sysctls:
      - net.ipv4.conf.all.src_valid_mark=1
      - net.ipv4.ip_forward=1
```

---

## 3. Environment Variable Configuration (`.env.example`)

```bash
# APPLICATION
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.gtechisp.co.ke
APP_ENCRYPTION_KEY=super_secret_32_byte_hex_key_for_aes_gcm

# DATABASE (PostgreSQL / Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# NETWORK CONTROL GATEWAY
NETWORK_GATEWAY_URL=http://network-core.gtechisp.internal:8000
NETWORK_GATEWAY_SECRET=secret_internal_jwt_key
WIREGUARD_PUBLIC_ENDPOINT=vpn.gtechisp.co.ke:51820
WIREGUARD_SERVER_PUBLIC_KEY=aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890=

# SAFARICOM DARAJA M-PESA (Default sandbox for onboarding)
DARAJA_ENVIRONMENT=sandbox
DARAJA_CONSUMER_KEY=YOUR_CONSUMER_KEY
DARAJA_CONSUMER_SECRET=YOUR_CONSUMER_SECRET
DARAJA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
DARAJA_SHORTCODE=174379

# SMS GATEWAY (AfricasTalking / Advanta)
SMS_PROVIDER=africastalking
AFRICASTALKING_USERNAME=sandbox
AFRICASTALKING_API_KEY=YOUR_API_KEY
AFRICASTALKING_SENDER_ID=GTECH_ISP
```
