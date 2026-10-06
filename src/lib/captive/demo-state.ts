// ====================================================================
// QC NetCore — Isolated Demo Captive Portal State Manager
//
// Stores Demo Mode Captive Portal customizations, Demo packages, and
// Demo simulation settings strictly in browser storage so visitors can
// freely customize, preview, publish to Demo, and reset without ever
// mutating production tenant records.
// ====================================================================

import {
  DEFAULT_DEMO_HOTSPOT_PLANS,
  PortalConfig,
  PortalConfigVersion,
  PlanLike,
  getDefaultDemoPortalConfig,
} from "./config";

export const DEMO_CAPTIVE_STORAGE_KEY = "qc_netcore_demo_captive_v1";
export const DEMO_CAPTIVE_EVENT = "qc_netcore_demo_captive_updated";

export interface DemoPortalSettings {
  // Portal Settings
  defaultCurrency: "KES" | "USD" | "UGX" | "TZS";
  sessionTimeoutDisplay: string;
  redirectUrlAfterLogin: string;
  showSupportContact: boolean;
  showTermsAndConditions: boolean;
  showPromotionalBanner: boolean;

  // Demo Login / Access Options
  enableAccountLogin: boolean;
  enableFreeTrial: boolean;
  freeTrialMinutes: number;

  // Payment Simulation Settings
  mpesaExpressEnabled: boolean;
  paybillNumber: string;
  accountReferenceFormat: string;
  voucherRedemptionEnabled: boolean;
  demoAutoApprovePayment: boolean;

  // Notification Preview Settings
  paymentConfirmationMessage: string;
  voucherActivationMessage: string;
  supportBannerMessage: string;
}

export interface DemoCaptiveState {
  draft: PortalConfig;
  published: PortalConfig;
  plans: PlanLike[];
  settings: DemoPortalSettings;
  versions: PortalConfigVersion[];
  updatedAt: string;
}

export const DEFAULT_DEMO_PORTAL_SETTINGS: DemoPortalSettings = {
  defaultCurrency: "KES",
  sessionTimeoutDisplay: "Match Package Validity",
  redirectUrlAfterLogin: "https://g-tech-isp-billing-system.vercel.app/captive",
  showSupportContact: true,
  showTermsAndConditions: true,
  showPromotionalBanner: true,

  enableAccountLogin: false,
  enableFreeTrial: false,
  freeTrialMinutes: 15,

  mpesaExpressEnabled: true,
  paybillNumber: "4108921",
  accountReferenceFormat: "WIFI-AUTO",
  voucherRedemptionEnabled: true,
  demoAutoApprovePayment: true,

  paymentConfirmationMessage:
    "M-Pesa payment verified! Your high-speed WiFi session is now active.",
  voucherActivationMessage:
    "Voucher code accepted! Your device is now connected to high-speed WiFi.",
  supportBannerMessage:
    "Need help connecting? Call or WhatsApp our 24/7 WiFi support desk.",
};

export function createInitialDemoCaptiveState(businessName = "QC NetCore"): DemoCaptiveState {
  const defaultConfig = getDefaultDemoPortalConfig(businessName);
  const now = new Date().toISOString();
  return {
    draft: JSON.parse(JSON.stringify(defaultConfig)),
    published: JSON.parse(JSON.stringify(defaultConfig)),
    plans: JSON.parse(JSON.stringify(DEFAULT_DEMO_HOTSPOT_PLANS)),
    settings: { ...DEFAULT_DEMO_PORTAL_SETTINGS },
    versions: [
      {
        id: "demo-ver-1",
        version: 1,
        status: "PUBLISHED",
        createdAt: now,
        publishedAt: now,
      },
    ],
    updatedAt: now,
  };
}

export function loadDemoCaptiveState(businessName = "QC NetCore"): DemoCaptiveState {
  const fallback = createInitialDemoCaptiveState(businessName);
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(DEMO_CAPTIVE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<DemoCaptiveState>;
    if (!parsed || typeof parsed !== "object" || !parsed.draft || !parsed.published) {
      return fallback;
    }
    const plans =
      Array.isArray(parsed.plans) && parsed.plans.length > 0
        ? parsed.plans
        : fallback.plans;
    return {
      draft: {
        ...fallback.draft,
        ...parsed.draft,
        branding: { ...fallback.draft.branding, ...(parsed.draft.branding ?? {}) },
        ui: { ...fallback.draft.ui, ...(parsed.draft.ui ?? {}) },
        authMethods: { ...fallback.draft.authMethods, ...(parsed.draft.authMethods ?? {}) },
        packages: {
          ...fallback.draft.packages,
          ...(parsed.draft.packages ?? {}),
          overrides: {
            ...fallback.draft.packages.overrides,
            ...(parsed.draft.packages?.overrides ?? {}),
          },
        },
        payment: { ...fallback.draft.payment, ...(parsed.draft.payment ?? {}) },
        content: {
          ...fallback.draft.content,
          ...(parsed.draft.content ?? {}),
          social: {
            ...fallback.draft.content.social,
            ...(parsed.draft.content?.social ?? {}),
          },
        },
        messages: { ...fallback.draft.messages, ...(parsed.draft.messages ?? {}) },
        promotions: {
          ...fallback.draft.promotions,
          ...(parsed.draft.promotions ?? {}),
        },
      },
      published: {
        ...fallback.published,
        ...parsed.published,
        branding: { ...fallback.published.branding, ...(parsed.published.branding ?? {}) },
        ui: { ...fallback.published.ui, ...(parsed.published.ui ?? {}) },
        authMethods: { ...fallback.published.authMethods, ...(parsed.published.authMethods ?? {}) },
        packages: {
          ...fallback.published.packages,
          ...(parsed.published.packages ?? {}),
          overrides: {
            ...fallback.published.packages.overrides,
            ...(parsed.published.packages?.overrides ?? {}),
          },
        },
        payment: { ...fallback.published.payment, ...(parsed.published.payment ?? {}) },
        content: {
          ...fallback.published.content,
          ...(parsed.published.content ?? {}),
          social: {
            ...fallback.published.content.social,
            ...(parsed.published.content?.social ?? {}),
          },
        },
        messages: { ...fallback.published.messages, ...(parsed.published.messages ?? {}) },
        promotions: {
          ...fallback.published.promotions,
          ...(parsed.published.promotions ?? {}),
        },
      },
      plans,
      settings: {
        ...DEFAULT_DEMO_PORTAL_SETTINGS,
        ...(parsed.settings ?? {}),
      },
      versions:
        Array.isArray(parsed.versions) && parsed.versions.length > 0
          ? parsed.versions
          : fallback.versions,
      updatedAt: parsed.updatedAt || fallback.updatedAt,
    };
  } catch {
    return fallback;
  }
}

export function saveDemoCaptiveState(state: DemoCaptiveState): DemoCaptiveState {
  const next: DemoCaptiveState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(DEMO_CAPTIVE_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(DEMO_CAPTIVE_EVENT, { detail: next }));
    } catch {
      // Ignore quota errors in restricted private browsing modes
    }
  }
  return next;
}

export function publishDemoCaptiveState(
  draft: PortalConfig,
  plans: PlanLike[],
  settings: DemoPortalSettings
): DemoCaptiveState {
  const current = loadDemoCaptiveState(draft.branding.businessName || "QC NetCore");
  const now = new Date().toISOString();
  const nextVersionNumber =
    current.versions.reduce((max, v) => Math.max(max, v.version), 0) + 1;

  // Sync settings toggles into published config so PortalRenderer reflects them seamlessly
  const syncedConfig: PortalConfig = {
    ...JSON.parse(JSON.stringify(draft)),
    authMethods: {
      mpesa: settings.mpesaExpressEnabled,
      voucher: settings.voucherRedemptionEnabled || !settings.mpesaExpressEnabled,
    },
    content: {
      ...draft.content,
      supportMessage: settings.supportBannerMessage || draft.content.supportMessage,
    },
    messages: {
      ...draft.messages,
      paymentSuccess: settings.paymentConfirmationMessage || draft.messages.paymentSuccess,
      loginSuccess: settings.voucherActivationMessage || draft.messages.loginSuccess,
    },
    promotions: {
      ...draft.promotions,
      banner: {
        ...draft.promotions.banner,
        enabled: settings.showPromotionalBanner && Boolean(draft.promotions.banner.text),
      },
    },
  };

  const nextVersions: PortalConfigVersion[] = [
    {
      id: `demo-ver-${nextVersionNumber}`,
      version: nextVersionNumber,
      status: "PUBLISHED" as const,
      createdAt: now,
      publishedAt: now,
    },
    ...current.versions.map((v) => ({
      ...v,
      status: "ARCHIVED" as const,
    })),
  ].slice(0, 10);

  return saveDemoCaptiveState({
    draft: syncedConfig,
    published: JSON.parse(JSON.stringify(syncedConfig)),
    plans: plans.map((p) => ({
      ...p,
      currency: settings.defaultCurrency || p.currency || "KES",
    })),
    settings,
    versions: nextVersions,
    updatedAt: now,
  });
}

export function resetDemoCaptiveState(businessName = "QC NetCore"): DemoCaptiveState {
  const fresh = createInitialDemoCaptiveState(businessName);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(DEMO_CAPTIVE_STORAGE_KEY);
      window.localStorage.setItem(DEMO_CAPTIVE_STORAGE_KEY, JSON.stringify(fresh));
      window.dispatchEvent(new CustomEvent(DEMO_CAPTIVE_EVENT, { detail: fresh }));
    } catch {
      // ignore
    }
  }
  return fresh;
}
