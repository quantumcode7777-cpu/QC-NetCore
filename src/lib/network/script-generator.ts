// ====================================================================
// G-TECH ISP OPERATING SYSTEM - ZERO-TOUCH SCRIPT GENERATOR
// Produces idempotent, production-ready RouterOS .rsc config scripts
// ====================================================================

export interface ProvisioningConfig {
  routerName: string;
  orgName: string;
  orgSlug: string;
  orgId: string;
  routerOsVersion: 'v7' | 'v6';
  managementTunnelIp: string;
  saasGatewayHost: string;
  saasGatewayPort: number;
  saasPublicKey: string;
  routerPrivateKey: string;
  radiusSecret: string;
  radiusAuthPort: number;
  radiusAcctPort: number;
  hotspotDnsName?: string;
  pppoePoolSubnet?: string;
}

export class RouterScriptGenerator {
  static generateScript(config: ProvisioningConfig): string {
    const isV7 = config.routerOsVersion === 'v7';
    const timestamp = new Date().toISOString();

    if (isV7) {
      return `# ====================================================================
# G-TECH ISP OPERATING SYSTEM - ROUTEROS V7 AUTO-CONFIGURATION
# Router Identity: ${config.routerName}
# Organization: ${config.orgName} (${config.orgId})
# Generated At: ${timestamp}
# ====================================================================

/system identity set name="${config.routerName}"

# 1. SETUP SECURE WIREGUARD MANAGEMENT TUNNEL
/interface wireguard remove [find comment~"G-Tech"]
/interface wireguard add name=wg-gtech listen-port=13231 private-key="${config.routerPrivateKey}" comment="G-Tech SaaS Management Tunnel"
/ip address remove [find comment="G-Tech WG IP"]
/ip address add address=${config.managementTunnelIp}/24 interface=wg-gtech network=10.200.1.0 comment="G-Tech WG IP"
/interface wireguard peers remove [find comment~"G-Tech"]
/interface wireguard peers add interface=wg-gtech public-key="${config.saasPublicKey}" endpoint-address="${config.saasGatewayHost}" endpoint-port=${config.saasGatewayPort} allowed-address=10.200.0.0/16 persistent-keepalive=25s comment="G-Tech SaaS Cloud Gateway"

# 2. CONFIGURE FREERADIUS CLIENT & INCOMING CoA (RFC 3576)
/radius remove [find comment~"G-Tech"]
/radius add service=ppp,hotspot address=10.200.1.1 secret="${config.radiusSecret}" timeout=3000ms authentication-port=${config.radiusAuthPort} accounting-port=${config.radiusAcctPort} comment="G-Tech FreeRADIUS Core"
/radius incoming set accept=yes port=3799

# 3. CONFIGURE PPPoE AAA INTEGRATION & POOLS
/ip pool add name=gtech-pppoe-pool ranges=10.10.0.2-10.10.31.254 comment="G-Tech Dynamic PPPoE Pool"
/ppp aaa set use-radius=yes accounting=yes interim-update=5m
/ppp profile add name="gtech-pppoe-profile" use-ipv6=no use-encryption=yes only-one=yes remote-address=gtech-pppoe-pool comment="G-Tech Standard Profile"
/interface pppoe-server server add service-name="gtech-fiber" interface=ether1 default-profile=gtech-pppoe-profile authentication=pap,chap,mschap2 one-session-per-host=yes disabled=no

# 4. CONFIGURE HOTSPOT ENGINE & WALLED GARDEN FOR M-PESA
/ip hotspot profile add name="gtech-hotspot-profile" hotspot-address=10.10.0.1 dns-name="${config.hotspotDnsName || "wifi.login.local"}" login-by=http-chap,cookie,mac-cookie use-radius=yes radius-accounting=yes radius-interim-update=5m radius-default-domain=""
/ip hotspot walled-garden ip add dst-host="*.safaricom.co.ke" action=accept comment="Allow Safaricom M-Pesa STK push callbacks"
/ip hotspot walled-garden ip add dst-host="*.gtechisp.co.ke" action=accept comment="Allow G-Tech Cloud Portal"
/ip hotspot walled-garden ip add dst-host="*.googleapis.com" action=accept comment="Allow Cloudflare / Google Fonts"

# 5. RESTRICT API & MANAGEMENT PORTS TO SECURE WIREGUARD SUBNET
/ip service set api address=10.200.0.0/16 disabled=no port=8728
/ip service set api-ssl address=10.200.0.0/16 disabled=no port=8729
/ip service set winbox address=10.200.0.0/16,192.168.88.0/24 disabled=no

/log info "G-Tech ISP OS Provisioning Completed Successfully"
`;
    }

    // RouterOS v6 fallback script
    return `# ====================================================================
# G-TECH ISP OPERATING SYSTEM - ROUTEROS V6 AUTO-CONFIGURATION
# Router Identity: ${config.routerName}
# Organization: ${config.orgName} (${config.orgId})
# Generated At: ${timestamp}
# ====================================================================

/system identity set name="${config.routerName}"

# 1. CONFIGURE FREERADIUS CLIENT & INCOMING CoA
/radius remove [find comment~"G-Tech"]
/radius add service=ppp,hotspot address=10.200.1.1 secret="${config.radiusSecret}" timeout=3000ms authentication-port=${config.radiusAuthPort} accounting-port=${config.radiusAcctPort} comment="G-Tech FreeRADIUS"
/radius incoming set accept=yes port=3799

# 2. CONFIGURE PPPoE AAA & POOLS
/ip pool add name=gtech-pppoe-pool ranges=10.10.0.2-10.10.31.254
/ppp aaa set use-radius=yes accounting=yes interim-update=5m
/ppp profile add name="gtech-pppoe-profile" use-ipv6=no use-encryption=yes only-one=yes remote-address=gtech-pppoe-pool
/interface pppoe-server server add service-name="gtech-fiber" interface=ether1 default-profile=gtech-pppoe-profile authentication=pap,chap,mschap2 one-session-per-host=yes disabled=no

# 3. WALLED GARDEN FOR M-PESA PAYMENTS
/ip hotspot walled-garden ip add dst-host="*.safaricom.co.ke" action=accept
/ip hotspot walled-garden ip add dst-host="*.gtechisp.co.ke" action=accept
`;
  }
}
