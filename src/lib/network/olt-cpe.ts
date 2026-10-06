// ============================================================================
// QC NETCORE — OLT/ONT FIBER MANAGEMENT, TR-369 CPE & FAIR-USE ENGINE
// ============================================================================

export type OltVendor = "HUAWEI" | "ZTE" | "VSOL" | "NOKIA" | "FIBERHOME" | "MIKROTIK";
export type OntStatus = "ONLINE" | "LOS" | "DYING_GASP" | "OFFLINE" | "UNPROVISIONED";

export interface OltDevice {
  id: string;
  organizationId: string;
  siteId: string;
  siteName: string;
  routerId: string;
  name: string;
  vendor: OltVendor;
  model: string;
  managementIp: string;
  ponType: "GPON" | "EPON" | "XGS-PON";
  totalPonPorts: number;
  activeOntCount: number;
  cpuLoad: number;
  temperatureC: number;
  status: "ONLINE" | "DEGRADED" | "OFFLINE";
  lastPolledAt: string;
}

export interface OntDevice {
  id: string;
  organizationId: string;
  oltId: string;
  oltName: string;
  customerId?: string;
  customerName?: string;
  accountNumber?: string;
  serialNumber: string;
  vendorModel: string;
  ponPortLabel: string;
  rxPowerDbm: number; // Subscriber ONU RX power (dBm)
  txPowerDbm: number; // Subscriber ONU TX power (dBm)
  oltRxPowerDbm: number; // OLT side RX power (dBm)
  temperatureC: number;
  voltageV: number;
  distanceMeters: number;
  serviceVlan: number;
  status: OntStatus;
  firmwareVersion: string;
  wifiSsid?: string;
  connectedClients?: number;
  lastSeenAt: string;
}

export interface OpticalHealthClassification {
  status: "OPTIMAL" | "MARGINAL" | "CRITICAL_LOW" | "OVERDRIVE";
  badgeTone: "success" | "warning" | "danger";
  label: string;
  attenuationLossDb: number;
  recommendation: string;
}

/**
 * Classifies FTTH GPON/XGS-PON optical RX power (dBm) per ITU-T G.984.2 Class B+ / C+ standards.
 * Optimal: -15.0 dBm to -24.5 dBm
 * Marginal: -24.5 dBm to -27.0 dBm
 * Critical LOS risk: < -27.0 dBm
 * Overdrive risk: > -8.0 dBm
 */
export function classifyOpticalPower(
  rxPowerDbm: number,
  oltTxPowerDbm = 4.5
): OpticalHealthClassification {
  const attenuationLossDb = Math.round((oltTxPowerDbm - rxPowerDbm) * 100) / 100;

  if (rxPowerDbm > -8.0) {
    return {
      status: "OVERDRIVE",
      badgeTone: "warning",
      label: `Overdrive (${rxPowerDbm.toFixed(1)} dBm)`,
      attenuationLossDb,
      recommendation: "Insert 5dB optical attenuator pad to prevent receiver saturation.",
    };
  }

  if (rxPowerDbm >= -24.5) {
    return {
      status: "OPTIMAL",
      badgeTone: "success",
      label: `Optimal (${rxPowerDbm.toFixed(1)} dBm)`,
      attenuationLossDb,
      recommendation: "Optical budget within ITU-T G.984 Class B+ specification.",
    };
  }

  if (rxPowerDbm >= -27.0) {
    return {
      status: "MARGINAL",
      badgeTone: "warning",
      label: `Marginal (${rxPowerDbm.toFixed(1)} dBm)`,
      attenuationLossDb,
      recommendation:
        "Clean SC/APC patch cord ferrules at NAP splitter and customer rosette box.",
    };
  }

  return {
    status: "CRITICAL_LOW",
    badgeTone: "danger",
    label: `Critical Attenuation (${rxPowerDbm.toFixed(1)} dBm)`,
    attenuationLossDb,
    recommendation:
      "High macro-bend or splice loss detected. Dispatch fiber technician with OTDR.",
  };
}

/**
 * Evaluates Fair-Use Policy (FUP) quota consumption and off-peak night turbo bursting
 * to produce the authoritative MikroTik / FreeRADIUS `Mikrotik-Rate-Limit` attribute.
 */
export function evaluateFairUsePolicy(params: {
  baseDownloadKbps: number;
  baseUploadKbps: number;
  consumedGbThisMonth: number;
  softCapGb: number;
  throttledDownloadKbps: number;
  throttledUploadKbps: number;
  nightTurboMultiplier?: number;
  currentHourLocal?: number; // 0..23
  nightStartHour?: number; // default 23
  nightEndHour?: number; // default 6
}): {
  state: "NORMAL" | "NIGHT_TURBO" | "FUP_THROTTLED";
  effectiveDownloadKbps: number;
  effectiveUploadKbps: number;
  mikrotikRateLimit: string;
  usagePercent: number;
} {
  const usagePercent =
    params.softCapGb > 0
      ? Math.round((params.consumedGbThisMonth / params.softCapGb) * 1000) / 10
      : 0;

  if (params.softCapGb > 0 && params.consumedGbThisMonth >= params.softCapGb) {
    const dl = params.throttledDownloadKbps;
    const ul = params.throttledUploadKbps;
    return {
      state: "FUP_THROTTLED",
      effectiveDownloadKbps: dl,
      effectiveUploadKbps: ul,
      mikrotikRateLimit: `${ul}k/${dl}k`,
      usagePercent,
    };
  }

  const hr = params.currentHourLocal ?? 14;
  const start = params.nightStartHour ?? 23;
  const end = params.nightEndHour ?? 6;
  const isNightWindow = start > end ? hr >= start || hr < end : hr >= start && hr < end;
  const mult = params.nightTurboMultiplier ?? 1.5;

  if (isNightWindow && mult > 1) {
    const dl = Math.round(params.baseDownloadKbps * mult);
    const ul = Math.round(params.baseUploadKbps * mult);
    return {
      state: "NIGHT_TURBO",
      effectiveDownloadKbps: dl,
      effectiveUploadKbps: ul,
      mikrotikRateLimit: `${ul}k/${dl}k`,
      usagePercent,
    };
  }

  return {
    state: "NORMAL",
    effectiveDownloadKbps: params.baseDownloadKbps,
    effectiveUploadKbps: params.baseUploadKbps,
    mikrotikRateLimit: `${params.baseUploadKbps}k/${params.baseDownloadKbps}k`,
    usagePercent,
  };
}

/**
 * Generates RFC 5176 FreeRADIUS Change-of-Authorization (CoA) / Disconnect packet
 * representation and RouterOS CLI equivalent for live subscriber session control.
 */
export function buildSubscriberControlCommand(params: {
  action: "DISCONNECT_SESSION" | "COA_RATE_LIMIT" | "REBOOT_ONT" | "PROVISION_ONT_VLAN";
  username: string;
  nasIpAddress: string;
  framedIpAddress?: string;
  rateLimit?: string;
  ontSerial?: string;
  ponPortLabel?: string;
  vlanId?: number;
}): {
  protocol: "RADIUS_RFC5176" | "OLT_OMCI_CLI";
  summary: string;
  commandPayload: string;
} {
  switch (params.action) {
    case "DISCONNECT_SESSION":
      return {
        protocol: "RADIUS_RFC5176",
        summary: `Disconnect active PPPoE/Hotspot session for ${params.username} on NAS ${params.nasIpAddress}`,
        commandPayload: `echo "User-Name='${params.username}'${
          params.framedIpAddress ? `,Framed-IP-Address=${params.framedIpAddress}` : ""
        }" | radclient -x ${params.nasIpAddress}:3799 disconnect $RADIUS_SECRET`,
      };
    case "COA_RATE_LIMIT":
      return {
        protocol: "RADIUS_RFC5176",
        summary: `Live CoA rate-limit update (${params.rateLimit || "10M/20M"}) for ${params.username}`,
        commandPayload: `echo "User-Name='${params.username}',Mikrotik-Rate-Limit='${
          params.rateLimit || "5120k/10240k"
        }'" | radclient -x ${params.nasIpAddress}:3799 coa $RADIUS_SECRET`,
      };
    case "REBOOT_ONT":
      return {
        protocol: "OLT_OMCI_CLI",
        summary: `Remote OMCI reboot for ONT ${params.ontSerial || "UNKNOWN"} (${
          params.ponPortLabel || "GPON 0/1/0"
        })`,
        commandPayload: `interface gpon ${
          params.ponPortLabel?.split(":")[0]?.replace("GPON ", "") || "0/1"
        }\nont reset 0 ${params.ponPortLabel?.split(":")[1] || "1"}`,
      };
    case "PROVISION_ONT_VLAN":
      return {
        protocol: "OLT_OMCI_CLI",
        summary: `Bind ONT ${params.ontSerial || "UNKNOWN"} to Service VLAN ${
          params.vlanId || 210
        }`,
        commandPayload: `ont add 0 sn-auth ${params.ontSerial || "HWTC0000"} omci ont-lineprofile-id 10 ont-srvprofile-id 10\nservice-port vlan ${
          params.vlanId || 210
        } gpon ${params.ponPortLabel || "0/1/0"} ont 1 gemport 1 multi-service user-vlan ${
          params.vlanId || 210
        }`,
      };
  }
}
