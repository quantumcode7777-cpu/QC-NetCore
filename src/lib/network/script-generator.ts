// ====================================================================
// QC NETCORE - ZERO-TOUCH SCRIPT GENERATOR
// Produces idempotent RouterOS .rsc config scripts.
//
// SECURITY: this module must only be executed server-side for production
// routers. Every interpolated value is validated and escaped so that user
// controlled input can never break out of a RouterOS string literal.
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
  /**
   * Optional. When omitted (recommended) RouterOS v7 generates its own
   * WireGuard keypair on the device and the private key never leaves it.
   */
  routerPrivateKey?: string;
  radiusSecret: string;
  radiusAuthPort: number;
  radiusAcctPort: number;
  /** RADIUS server address as seen from the router (tunnel address). */
  radiusServerAddress?: string;
  hotspotDnsName?: string;
  pppoePoolSubnet?: string;
  /** Domain allowed through the hotspot walled garden (captive portal / app host). */
  portalDomain?: string;
  /** When present, the script reports back to the platform to register the router. */
  registration?: { url: string; token: string };
  /** Dedicated least-privilege API account created on the router. */
  apiUser?: { name: string; password: string };
}

const HEX_ESCAPES: Record<string, string> = {
  '\\': '\\5C',
  '"': '\\22',
  $: '\\24',
  '?': '\\3F',
  '[': '\\5B',
  ']': '\\5D',
};

/**
 * Escapes a value for use inside a RouterOS double-quoted string.
 * Rejects control characters outright (newline injection = command injection).
 */
export function escapeRouterOsString(value: string): string {
  if (typeof value !== 'string') throw new Error('RouterOS value must be a string');
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error('RouterOS value contains control characters');
  }
  return value.replace(/[\\"$?[\]]/g, (c) => HEX_ESCAPES[c]);
}

/** Makes a value safe for a single-line `#` comment. */
export function sanitizeRouterOsComment(value: string): string {
  return String(value).replace(/[^A-Za-z0-9 ._()\-:@/]/g, '').slice(0, 120);
}

const q = (v: string) => `"${escapeRouterOsString(v)}"`;

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const HOSTNAME = /^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;
const WG_KEY = /^[A-Za-z0-9+/]{43}=$/;

function assertConfig(config: ProvisioningConfig): void {
  const fail = (m: string): never => {
    throw new Error(`Invalid provisioning configuration: ${m}`);
  };
  if (!IPV4.test(config.managementTunnelIp)) fail('managementTunnelIp');
  if (!IPV4.test(config.saasGatewayHost) && !HOSTNAME.test(config.saasGatewayHost)) fail('saasGatewayHost');
  if (!Number.isInteger(config.saasGatewayPort) || config.saasGatewayPort < 1 || config.saasGatewayPort > 65535) fail('saasGatewayPort');
  if (!Number.isInteger(config.radiusAuthPort) || config.radiusAuthPort < 1 || config.radiusAuthPort > 65535) fail('radiusAuthPort');
  if (!Number.isInteger(config.radiusAcctPort) || config.radiusAcctPort < 1 || config.radiusAcctPort > 65535) fail('radiusAcctPort');
  if (config.routerOsVersion === 'v7') {
    if (!WG_KEY.test(config.saasPublicKey)) fail('saasPublicKey');
    if (config.routerPrivateKey !== undefined && !WG_KEY.test(config.routerPrivateKey)) fail('routerPrivateKey');
  }
  if (config.radiusServerAddress && !IPV4.test(config.radiusServerAddress)) fail('radiusServerAddress');
  if (config.hotspotDnsName && !HOSTNAME.test(config.hotspotDnsName)) fail('hotspotDnsName');
  if (config.portalDomain && !HOSTNAME.test(config.portalDomain)) fail('portalDomain');
  if (!config.radiusSecret) fail('radiusSecret');
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/.test(config.routerName)) fail('routerName');
  if (config.registration) {
    if (!/^https?:\/\/[^\s"\\$?[\]]+$/.test(config.registration.url)) fail('registration.url');
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(config.registration.token)) fail('registration.token');
  }
  if (config.apiUser) {
    if (!/^[A-Za-z0-9._-]{1,32}$/.test(config.apiUser.name)) fail('apiUser.name');
    if (!config.apiUser.password) fail('apiUser.password');
  }
}

function registrationBlock(config: ProvisioningConfig): string {
  if (!config.registration) return '';
  const { url, token } = config.registration;
  const sendsKey = config.routerOsVersion === 'v7';
  const keyPart = sendsKey
    ? `:local wgKey [/interface wireguard get wg-qcnetcore public-key]\n`
    : '';
  const keyJson = sendsKey ? `\\"publicKey\\":\\"" . $wgKey . "\\",` : '';
  return `
# 6. REGISTER THIS ROUTER WITH QC NETCORE (single-use token, expires)
:delay 10s
${keyPart}:local payload ("{\\"token\\":\\"${token}\\",${keyJson}\\"routerosVersion\\":\\"" . [/system resource get version] . "\\",\\"boardModel\\":\\"" . [/system resource get board-name] . "\\",\\"cpuLoad\\":" . [/system resource get cpu-load] . ",\\"freeMemoryMb\\":" . ([/system resource get free-memory] / 1048576) . ",\\"uptime\\":\\"" . [/system resource get uptime] . "\\"}")
/tool fetch url=${q(url)} http-method=post http-header-field="Content-Type: application/json" http-data=$payload check-certificate=yes output=none
`;
}

export class RouterScriptGenerator {
  static generateScript(config: ProvisioningConfig): string {
    assertConfig(config);
    const isV7 = config.routerOsVersion === 'v7';
    const timestamp = new Date().toISOString();
    const radiusAddr = config.radiusServerAddress || '10.200.1.1';
    const hotspotDns = config.hotspotDnsName || 'wifi.login.local';
    const name = q(config.routerName);
    const header = (ver: string) => `# ====================================================================
# QC NETCORE - ROUTEROS ${ver} AUTO-CONFIGURATION
# Router Identity: ${sanitizeRouterOsComment(config.routerName)}
# Organization: ${sanitizeRouterOsComment(config.orgName)} (${sanitizeRouterOsComment(config.orgId)})
# Generated At: ${timestamp}
# ====================================================================

/system identity set name=${name}
`;

    const apiUser = config.apiUser
      ? `
# API ACCOUNT (least privilege) used by QC NetCore over the management tunnel
/user group remove [find name=qc-netcore-api]
/user group add name=qc-netcore-api policy=read,write,api,test,policy comment="QC NetCore API"
/user remove [find name=${q(config.apiUser.name)}]
/user add name=${q(config.apiUser.name)} group=qc-netcore-api password=${q(config.apiUser.password)} comment="QC NetCore API"
`
      : '';

    const walledGarden = config.portalDomain
      ? `/ip hotspot walled-garden ip add dst-host=${q(`*.${config.portalDomain}`)} action=accept comment="QC NetCore Cloud Portal"\n`
      : '';

    if (isV7) {
      const privateKey = config.routerPrivateKey ? ` private-key=${q(config.routerPrivateKey)}` : '';
      return `${header('V7')}
# 1. SETUP SECURE WIREGUARD MANAGEMENT TUNNEL
/interface wireguard remove [find comment~"G-Tech|QC NetCore"]
/interface wireguard add name=wg-qcnetcore listen-port=13231${privateKey} comment="QC NetCore Management Tunnel"
/ip address remove [find comment~"G-Tech WG IP|QC NetCore WG IP"]
/ip address add address=${config.managementTunnelIp}/16 interface=wg-qcnetcore comment="QC NetCore WG IP"
/interface wireguard peers remove [find comment~"G-Tech|QC NetCore"]
/interface wireguard peers add interface=wg-qcnetcore public-key=${q(config.saasPublicKey)} endpoint-address=${q(config.saasGatewayHost)} endpoint-port=${config.saasGatewayPort} allowed-address=10.200.0.0/16 persistent-keepalive=25s comment="QC NetCore Cloud Gateway"

# 2. CONFIGURE FREERADIUS CLIENT & INCOMING CoA (RFC 3576)
/radius remove [find comment~"G-Tech|QC NetCore"]
/radius add service=ppp,hotspot address=${radiusAddr} secret=${q(config.radiusSecret)} timeout=3000ms authentication-port=${config.radiusAuthPort} accounting-port=${config.radiusAcctPort} comment="QC NetCore FreeRADIUS Core"
/radius incoming set accept=yes port=3799

# 3. CONFIGURE PPPoE AAA INTEGRATION & POOLS
/ip pool remove [find name~"gtech-pppoe-pool|qc-pppoe-pool"]
/ip pool add name=qc-pppoe-pool ranges=10.10.0.2-10.10.31.254 comment="QC NetCore Dynamic PPPoE Pool"
/ppp aaa set use-radius=yes accounting=yes interim-update=5m
/ppp profile remove [find name~"gtech-pppoe-profile|qc-pppoe-profile"]
/ppp profile add name="qc-pppoe-profile" use-ipv6=no use-encryption=yes only-one=yes remote-address=qc-pppoe-pool comment="QC NetCore Standard Profile"
/interface pppoe-server server add service-name="qc-fiber" interface=ether1 default-profile=qc-pppoe-profile authentication=pap,chap,mschap2 one-session-per-host=yes disabled=no

# 4. CONFIGURE HOTSPOT ENGINE & WALLED GARDEN FOR M-PESA
/ip hotspot profile add name="qc-hotspot-profile" hotspot-address=10.10.0.1 dns-name=${q(hotspotDns)} login-by=http-chap,cookie,mac-cookie use-radius=yes radius-accounting=yes radius-interim-update=5m radius-default-domain=""
/ip hotspot walled-garden ip add dst-host="*.safaricom.co.ke" action=accept comment="Allow Safaricom M-Pesa STK push callbacks"
${walledGarden}/ip hotspot walled-garden ip add dst-host="*.googleapis.com" action=accept comment="Allow Google Fonts"
${apiUser}
# 5. RESTRICT API & MANAGEMENT PORTS TO SECURE WIREGUARD SUBNET
/ip service set api address=10.200.0.0/16 disabled=no port=8728
/ip service set api-ssl address=10.200.0.0/16 disabled=no port=8729
/ip service set winbox address=10.200.0.0/16,192.168.88.0/24 disabled=no

/log info "QC NetCore Provisioning Completed Successfully"
${registrationBlock(config)}`;
    }

    // RouterOS v6 fallback script (no native WireGuard)
    return `${header('V6')}
# 1. CONFIGURE FREERADIUS CLIENT & INCOMING CoA
/radius remove [find comment~"G-Tech|QC NetCore"]
/radius add service=ppp,hotspot address=${radiusAddr} secret=${q(config.radiusSecret)} timeout=3000ms authentication-port=${config.radiusAuthPort} accounting-port=${config.radiusAcctPort} comment="QC NetCore FreeRADIUS"
/radius incoming set accept=yes port=3799

# 2. CONFIGURE PPPoE AAA & POOLS
/ip pool remove [find name~"gtech-pppoe-pool|qc-pppoe-pool"]
/ip pool add name=qc-pppoe-pool ranges=10.10.0.2-10.10.31.254
/ppp aaa set use-radius=yes accounting=yes interim-update=5m
/ppp profile remove [find name~"gtech-pppoe-profile|qc-pppoe-profile"]
/ppp profile add name="qc-pppoe-profile" use-ipv6=no use-encryption=yes only-one=yes remote-address=qc-pppoe-pool
/interface pppoe-server server add service-name="qc-fiber" interface=ether1 default-profile=qc-pppoe-profile authentication=pap,chap,mschap2 one-session-per-host=yes disabled=no

# 3. WALLED GARDEN FOR M-PESA PAYMENTS
/ip hotspot walled-garden ip add dst-host="*.safaricom.co.ke" action=accept
${walledGarden}${apiUser}${registrationBlock(config)}`;
  }
}
