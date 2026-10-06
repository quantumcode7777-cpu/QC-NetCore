# Network Architecture & MikroTik Integration

## 1. Edge Router Orchestration (MikroTik RouterOS)

The platform supports both **MikroTik RouterOS v6.49+** (via RouterOS binary API port 8728/8729 TLS) and **RouterOS v7.x** (via REST API / RouterOS API).

```
+---------------------------------------------------------------------------------+
|                              SAAS NETWORK ENGINE                                |
|                                                                                 |
|   +-------------------------------------------------------------------------+   |
|   |                    MikroTikService & Provisioner                        |   |
|   +------------------------------------+------------------------------------+   |
|                                        |                                        |
|                     WireGuard Encrypted Control Plane                           |
|             (Interface: wg-isp-saas | IP: 10.200.X.1/24)                        |
+----------------------------------------|----------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                        EDGE MIKROTIK ROUTER (v6/v7)                             |
|                                                                                 |
|   WireGuard Peer (10.200.X.2) <---+                                             |
|                                   |                                             |
|   +-------------------------------+-----------------------------------------+   |
|   | PPPoE Server (/interface pppoe-server server)                           |   |
|   | - Profile: default-encryption                                           |   |
|   | - RADIUS enabled (/ppp aaa set use-radius=yes)                          |   |
|   +-------------------------------------------------------------------------+   |
|   | Hotspot Server (/ip hotspot)                                            |   |
|   | - Profile: hotspot-profile-radius (login=http-chap,cookie,mac-cookie)   |   |
|   | - Captive Portal walled-garden (Daraja Safaricom API, Portal Assets)     |   |
|   +-------------------------------------------------------------------------+   |
|   | RADIUS Client (/radius)                                                 |   |
|   | - Service: ppp, hotspot                                                 |   |
|   | - Server: 10.200.X.1 (FreeRADIUS on Control Plane)                      |   |
|   | - Secret: <Shared Secret> | Authentication & Accounting port 1812/1813  |   |
|   +-------------------------------------------------------------------------+   |
|   | RADIUS Incoming / CoA (/radius incoming)                                |   |
|   | - Accept CoA/DM: yes | Port: 3799                                       |   |
|   +-------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------+
```

---

## 2. Zero-Touch Onboarding Script Generator

When an ISP administrator registers a new router in QC NetCore, the system generates an idempotent, copy-pasteable RouterOS `.rsc` configuration script tailored to the router's architecture.

### 2.1. Standard RouterOS v7 Auto-Provisioning Script Template

```routeros
# ====================================================================
# G-TECH ISP OPERATING SYSTEM - ROUTEROS V7 AUTO-CONFIGURATION
# Router Identity: {{router_name}}
# Organization: {{org_name}} (UUID: {{org_id}})
# Generated At: {{generated_timestamp}}
# ====================================================================

/system identity set name="{{router_name}}"

# 1. SETUP WIREGUARD SECURE TUNNEL
/interface wireguard add name=wg-gtech listen-port=13231 private-key="{{router_wg_private_key}}" comment="G-Tech SaaS Management Tunnel"
/ip address add address={{router_tunnel_ip}}/24 interface=wg-gtech network=10.200.{{tenant_idx}}.0
/interface wireguard peers add interface=wg-gtech public-key="{{saas_wg_public_key}}" endpoint-address="{{saas_gateway_host}}" endpoint-port=51820 allowed-address=10.200.{{tenant_idx}}.0/24 persistent-keepalive=25s

# 2. CONFIGURE RADIUS CLIENT & INCOMING CoA
/radius remove [find comment="G-Tech RADIUS"]
/radius add service=ppp,hotspot address=10.200.{{tenant_idx}}.1 secret="{{radius_secret}}" timeout=3000ms authentication-port=1812 accounting-port=1813 comment="G-Tech RADIUS"
/radius incoming set accept=yes port=3799

# 3. CONFIGURE PPPoE AAA INTEGRATION
/ppp aaa set use-radius=yes accounting=yes interim-update=5m
/ppp profile add name="gtech-pppoe-profile" use-ipv6=no use-encryption=yes only-one=yes remote-address=pool-pppoe comment="G-Tech Standard PPPoE Profile"

# 4. CONFIGURE HOTSPOT WALLED GARDEN (FOR INSTANT M-PESA PAYMENTS)
/ip hotspot profile add name="gtech-hotspot-profile" hotspot-address=10.10.0.1 dns-name="login.isp.local" login-by=http-chap,cookie,mac-cookie use-radius=yes radius-accounting=yes radius-interim-update=5m
/ip hotspot walled-garden ip add dst-host="*.safaricom.co.ke" action=accept comment="Allow Safaricom M-Pesa callbacks"
/ip hotspot walled-garden ip add dst-host="*.gtechisp.co.ke" action=accept comment="Allow G-Tech SaaS portal"

# 5. CONFIGURE REST / API SECURE SERVICE ACCESS (RESTRICTED TO WIREGUARD)
/ip service set api address=10.200.{{tenant_idx}}.0/24 disabled=no port=8728
/ip service set api-ssl address=10.200.{{tenant_idx}}.0/24 disabled=no port=8729
```

---

## 3. FreeRADIUS AAA & Vendor-Specific Attributes (VSA)

FreeRADIUS translates PostgreSQL subscriber states into standard RFC 2865 & MikroTik Vendor Specific Attributes (Vendor ID: 14988).

### 3.1. Standard MikroTik RADIUS Rate-Limiting Attribute Format
```
Mikrotik-Rate-Limit = "<rx-rate>[k|M]/<tx-rate>[k|M] <rx-burst-rate>[k|M]/<tx-burst-rate>[k|M] <rx-burst-threshold>[k|M]/<tx-burst-threshold>[k|M] <rx-burst-time>/<tx-burst-time> <priority> <rx-min-rate>[k|M]/<tx-min-rate>[k|M]"
```
**Example 10 Mbps Plan (10M Down / 5M Up with 15M Down Burst for 10s)**:
```
Mikrotik-Rate-Limit = "5M/10M 8M/15M 4M/8M 10/10 8 2M/5M"
```

### 3.2. Disconnect-Request (DM) and Change of Authorization (CoA)

When an account is suspended or a payment is verified, the system sends an asynchronous RFC 3576 Disconnect Packet to the router's port 3799 over WireGuard:

```
Packet Type: Disconnect-Request (Code 40)
Attributes:
  - User-Name = "johndoe_pppoe"
  - Framed-IP-Address = 10.10.12.84
  - NAS-IP-Address = 10.200.1.2
```
MikroTik terminates the session immediately; subsequent PPPoE login requests receive `Access-Reject` (or redirect to captive walled-garden) if overdue.
