// ====================================================================
// QC NetCore — Captive Portal Customizer: configuration model
//
// Pure TypeScript (no framework / alias imports) so it can be shared by the
// server routes, the live preview, the public portal AND unit tests.
//
// SECURITY MODEL
//  - Every value is a CONTROLLED value (enum, hex colour, bounded plain text,
//    https URL). There is no free-form HTML / CSS / JS anywhere.
//  - sanitizePortalConfig() is the single gate used by the API before saving.
//  - Asset URLs must live under the tenant's own storage prefix.
// ====================================================================

export const PORTAL_SCHEMA_VERSION = 1 as const;

// ---------- enums ----------

export type TemplateId =
  | "modern"
  | "minimal"
  | "corporate"
  | "cafe"
  | "hotel"
  | "school"
  | "event";

export const LOGO_POSITIONS = ["left", "center", "right", "inside-card"] as const;
export const CARD_POSITIONS = ["left", "center", "right"] as const;
export const BUTTON_STYLES = ["solid", "outline", "soft"] as const;
export const RADIUS_OPTIONS = ["none", "sm", "md", "lg", "xl", "full"] as const;
export const FONT_FAMILIES = ["system", "humanist", "rounded", "serif", "mono"] as const;
export const FONT_SCALES = ["sm", "md", "lg"] as const;
export const BACKGROUND_STYLES = ["solid", "gradient", "image", "pattern"] as const;
export const FORM_LAYOUTS = ["tabs", "stacked"] as const;
export const SPACINGS = ["compact", "comfortable", "spacious"] as const;
export const COLOR_MODES = ["light", "dark", "auto"] as const;
export const PACKAGE_LAYOUTS = ["grid", "list"] as const;
export const TEMPLATE_IDS: TemplateId[] = [
  "modern",
  "minimal",
  "corporate",
  "cafe",
  "hotel",
  "school",
  "event",
];

export type LogoPosition = (typeof LOGO_POSITIONS)[number];
export type CardPosition = (typeof CARD_POSITIONS)[number];
export type ButtonStyle = (typeof BUTTON_STYLES)[number];
export type RadiusOption = (typeof RADIUS_OPTIONS)[number];
export type FontFamilyOption = (typeof FONT_FAMILIES)[number];
export type FontScale = (typeof FONT_SCALES)[number];
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number];
export type FormLayout = (typeof FORM_LAYOUTS)[number];
export type Spacing = (typeof SPACINGS)[number];
export type ColorMode = (typeof COLOR_MODES)[number];
export type PackageLayout = (typeof PACKAGE_LAYOUTS)[number];

// ---------- config shape ----------

export interface PackageOverride {
  featured?: boolean;
  hidden?: boolean;
  cta?: string;
  description?: string;
  badge?: string;
}

export interface PortalMessages {
  loginSuccess: string;
  loginFailure: string;
  sessionExpired: string;
  connectionSuccess: string;
  connectionFailed: string;
  voucherInvalid: string;
  packageExpired: string;
  paymentSuccess: string;
  paymentFailed: string;
}

export interface PortalConfig {
  schemaVersion: typeof PORTAL_SCHEMA_VERSION;
  template: TemplateId;
  branding: {
    businessName: string;
    logoUrl: string;
    faviconUrl: string;
    primaryColor: string;
    accentColor: string;
    backgroundImageUrl: string;
    headline: string;
    welcomeMessage: string;
    footerText: string;
  };
  ui: {
    logoPosition: LogoPosition;
    cardPosition: CardPosition;
    buttonStyle: ButtonStyle;
    radius: RadiusOption;
    fontFamily: FontFamilyOption;
    fontScale: FontScale;
    background: BackgroundStyle;
    formLayout: FormLayout;
    spacing: Spacing;
    colorMode: ColorMode;
  };
  authMethods: {
    voucher: boolean;
    mpesa: boolean;
  };
  packages: {
    layout: PackageLayout;
    showSpeed: boolean;
    showData: boolean;
    showDuration: boolean;
    defaultCta: string;
    overrides: Record<string, PackageOverride>;
  };
  payment: {
    instructions: string;
    confirmation: string;
  };
  content: {
    terms: string;
    privacy: string;
    supportMessage: string;
    phone: string;
    whatsapp: string;
    email: string;
    location: string;
    social: { facebook: string; instagram: string; x: string; website: string };
  };
  messages: PortalMessages;
  promotions: {
    banner: { enabled: boolean; text: string; ctaText: string; ctaUrl: string };
    announcement: { enabled: boolean; text: string };
    featuredOffer: { enabled: boolean; title: string; text: string; ctaText: string; ctaUrl: string };
    adImage: { enabled: boolean; imageUrl: string; linkUrl: string; alt: string };
    sponsored: { enabled: boolean; label: string; text: string; linkUrl: string };
  };
}

// ---------- backend-supported authentication methods ----------

export interface AuthMethodInfo {
  id: string;
  label: string;
  supported: boolean;
  /** Shown to admins when a method is not (yet) available. */
  reason?: string;
}

/**
 * Honest registry of login methods. Only `supported: true` entries can be
 * switched on; the rest are listed so admins know what is coming, but are
 * never rendered on a portal and are rejected by the sanitizer.
 */
export const AUTH_METHOD_REGISTRY: AuthMethodInfo[] = [
  { id: "voucher", label: "Voucher code", supported: true },
  { id: "mpesa", label: "M-Pesa (buy a package)", supported: true },
  {
    id: "username_password",
    label: "Username / password",
    supported: false,
    reason: "Hotspot username/password login is not enabled in the QC NetCore backend yet.",
  },
  {
    id: "phone_otp",
    label: "Phone number + OTP",
    supported: false,
    reason: "OTP delivery is not configured in the backend yet.",
  },
  {
    id: "free_access",
    label: "Free access",
    supported: false,
    reason: "Free hotspot access is not available in the backend yet.",
  },
  {
    id: "subscriber",
    label: "Existing subscriber login",
    supported: false,
    reason: "Subscriber sign-in is handled in the Customer Self-Care portal.",
  },
];

// ---------- templates ----------

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export interface PortalTemplate {
  id: TemplateId;
  label: string;
  description: string;
  patch: DeepPartial<Pick<PortalConfig, "branding" | "ui" | "packages">>;
}

export const PORTAL_TEMPLATES: PortalTemplate[] = [
  {
    id: "modern",
    label: "Modern",
    description: "Clean gradient background with a soft floating card.",
    patch: {
      branding: {
        primaryColor: "#1f5fd1",
        accentColor: "#0ea5e9",
        headline: "Connect to Free WiFi",
        welcomeMessage: "Pick a package to pay with M-Pesa, or enter your voucher code.",
      },
      ui: {
        logoPosition: "center", cardPosition: "center", buttonStyle: "solid", radius: "lg",
        fontFamily: "system", fontScale: "md", background: "gradient", formLayout: "tabs",
        spacing: "comfortable", colorMode: "auto",
      },
      packages: { layout: "grid" },
    },
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Quiet, distraction-free white page with a single form.",
    patch: {
      branding: {
        primaryColor: "#111827",
        accentColor: "#6b7280",
        headline: "WiFi Access",
        welcomeMessage: "Sign in to get online.",
      },
      ui: {
        logoPosition: "left", cardPosition: "center", buttonStyle: "solid", radius: "sm",
        fontFamily: "system", fontScale: "md", background: "solid", formLayout: "stacked",
        spacing: "comfortable", colorMode: "light",
      },
      packages: { layout: "list" },
    },
  },
  {
    id: "corporate",
    label: "Corporate",
    description: "Professional navy palette, left-aligned card, structured layout.",
    patch: {
      branding: {
        primaryColor: "#0b3d91",
        accentColor: "#f59e0b",
        headline: "Guest & Customer WiFi",
        welcomeMessage: "Secure, high-speed internet for our guests and customers.",
      },
      ui: {
        logoPosition: "left", cardPosition: "left", buttonStyle: "solid", radius: "md",
        fontFamily: "humanist", fontScale: "md", background: "pattern", formLayout: "tabs",
        spacing: "comfortable", colorMode: "light",
      },
      packages: { layout: "list" },
    },
  },
  {
    id: "cafe",
    label: "Café / Restaurant",
    description: "Warm, friendly colours with rounded buttons.",
    patch: {
      branding: {
        primaryColor: "#b45309",
        accentColor: "#dc2626",
        headline: "Free WiFi with your coffee",
        welcomeMessage: "Enjoy your visit. Grab a package or use the code on your receipt.",
      },
      ui: {
        logoPosition: "center", cardPosition: "center", buttonStyle: "solid", radius: "full",
        fontFamily: "rounded", fontScale: "md", background: "gradient", formLayout: "tabs",
        spacing: "spacious", colorMode: "light",
      },
      packages: { layout: "grid" },
    },
  },
  {
    id: "hotel",
    label: "Hotel",
    description: "Elegant serif typography, dark premium look.",
    patch: {
      branding: {
        primaryColor: "#c9a227",
        accentColor: "#e7d28a",
        headline: "Welcome, dear guest",
        welcomeMessage: "Complimentary and premium WiFi for the duration of your stay.",
      },
      ui: {
        logoPosition: "center", cardPosition: "center", buttonStyle: "solid", radius: "md",
        fontFamily: "serif", fontScale: "md", background: "gradient", formLayout: "stacked",
        spacing: "spacious", colorMode: "dark",
      },
      packages: { layout: "list" },
    },
  },
  {
    id: "school",
    label: "School / Campus",
    description: "Bright, readable and friendly for students and staff.",
    patch: {
      branding: {
        primaryColor: "#15803d",
        accentColor: "#2563eb",
        headline: "Campus WiFi",
        welcomeMessage: "Use your voucher or buy a study package to get connected.",
      },
      ui: {
        logoPosition: "left", cardPosition: "right", buttonStyle: "soft", radius: "lg",
        fontFamily: "humanist", fontScale: "lg", background: "pattern", formLayout: "tabs",
        spacing: "comfortable", colorMode: "light",
      },
      packages: { layout: "grid" },
    },
  },
  {
    id: "event",
    label: "Event / Hotspot",
    description: "Bold, high-energy palette for pop-up events and public hotspots.",
    patch: {
      branding: {
        primaryColor: "#7c3aed",
        accentColor: "#ec4899",
        headline: "Get online at the event",
        welcomeMessage: "Fast WiFi for everyone. Choose how long you need.",
      },
      ui: {
        logoPosition: "center", cardPosition: "center", buttonStyle: "solid", radius: "xl",
        fontFamily: "rounded", fontScale: "lg", background: "gradient", formLayout: "tabs",
        spacing: "comfortable", colorMode: "dark",
      },
      packages: { layout: "grid" },
    },
  },
];

// ---------- defaults ----------

export const DEFAULT_MESSAGES: PortalMessages = {
  loginSuccess: "You are signed in. Enjoy your WiFi!",
  loginFailure: "We could not sign you in. Please check your details and try again.",
  sessionExpired: "Your session has expired. Please sign in or buy a package to reconnect.",
  connectionSuccess: "Connected! You are now online.",
  connectionFailed: "We could not connect you right now. Please try again or contact support.",
  voucherInvalid: "That voucher code is not valid or has already been used.",
  packageExpired: "Your package has expired. Choose a new package to continue.",
  paymentSuccess: "Payment received! You are now connected.",
  paymentFailed: "Payment was not completed. Please try again.",
};

export function getDefaultPortalConfig(businessName = "QC NetCore"): PortalConfig {
  const modern = PORTAL_TEMPLATES[0].patch;
  return {
    schemaVersion: PORTAL_SCHEMA_VERSION,
    template: "modern",
    branding: {
      businessName,
      logoUrl: "",
      faviconUrl: "",
      primaryColor: modern.branding!.primaryColor!,
      accentColor: modern.branding!.accentColor!,
      backgroundImageUrl: "",
      headline: modern.branding!.headline!,
      welcomeMessage: modern.branding!.welcomeMessage!,
      footerText: "",
    },
    ui: { ...(modern.ui as PortalConfig["ui"]) },
    authMethods: { voucher: true, mpesa: true },
    packages: {
      layout: "grid",
      showSpeed: true,
      showData: true,
      showDuration: true,
      defaultCta: "Connect Now",
      overrides: {},
    },
    payment: {
      instructions: "You will receive an M-Pesa prompt on your phone. Enter your PIN to pay.",
      confirmation: "",
    },
    content: {
      terms: "",
      privacy: "",
      supportMessage: "Need help? Contact us.",
      phone: "",
      whatsapp: "",
      email: "",
      location: "",
      social: { facebook: "", instagram: "", x: "", website: "" },
    },
    messages: { ...DEFAULT_MESSAGES },
    promotions: {
      banner: { enabled: false, text: "", ctaText: "", ctaUrl: "" },
      announcement: { enabled: false, text: "" },
      featuredOffer: { enabled: false, title: "", text: "", ctaText: "", ctaUrl: "" },
      adImage: { enabled: false, imageUrl: "", linkUrl: "", alt: "" },
      sponsored: { enabled: false, label: "Sponsored", text: "", linkUrl: "" },
    },
  };
}

const DEFAULT_TEXTS = new Set(
  PORTAL_TEMPLATES.flatMap((t) => [t.patch.branding?.headline, t.patch.branding?.welcomeMessage]).filter(
    Boolean
  ) as string[]
);

/**
 * Applies a template's look & feel. Business identity (name, logo, contact,
 * messages, package overrides, promotions) is preserved. Headline/welcome copy
 * is only replaced if the admin has not customised it.
 */
export function applyTemplate(config: PortalConfig, id: TemplateId): PortalConfig {
  const tpl = PORTAL_TEMPLATES.find((t) => t.id === id);
  if (!tpl) return config;
  const b = tpl.patch.branding ?? {};
  const keepHeadline = config.branding.headline && !DEFAULT_TEXTS.has(config.branding.headline);
  const keepWelcome = config.branding.welcomeMessage && !DEFAULT_TEXTS.has(config.branding.welcomeMessage);
  return {
    ...config,
    template: id,
    branding: {
      ...config.branding,
      primaryColor: b.primaryColor ?? config.branding.primaryColor,
      accentColor: b.accentColor ?? config.branding.accentColor,
      headline: keepHeadline ? config.branding.headline : b.headline ?? config.branding.headline,
      welcomeMessage: keepWelcome ? config.branding.welcomeMessage : b.welcomeMessage ?? config.branding.welcomeMessage,
    },
    ui: { ...config.ui, ...(tpl.patch.ui as Partial<PortalConfig["ui"]>) },
    packages: { ...config.packages, layout: (tpl.patch.packages?.layout as PackageLayout) ?? config.packages.layout },
  };
}

// ---------- text / URL / colour primitives ----------

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Plain text only: strips control chars, angle brackets and bidi overrides. */
export function cleanText(value: unknown, max: number, multiline = false): string {
  if (typeof value !== "string") return "";
  let v = value.replace(CONTROL_CHARS, "").replace(/[<>\u202A-\u202E\u2066-\u2069]/g, "");
  if (!multiline) v = v.replace(/[\r\n\t]+/g, " ");
  else v = v.replace(/\r\n?/g, "\n");
  return v.trim().slice(0, max);
}

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

/** https only; rejects credentials in URL, javascript:, data:, etc. */
export function isSafeHttpsUrl(v: unknown, max = 500): v is string {
  if (typeof v !== "string" || v.length === 0 || v.length > max) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export function isValidPhone(v: string): boolean {
  return /^\+?[0-9][0-9 ()-]{6,19}$/.test(v);
}

export function isValidEmail(v: string): boolean {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(v) && v.length <= 254;
}

// ---------- colour maths & accessibility ----------

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white — whichever reads best on `bg`. */
export function readableOn(bg: string): string {
  return contrastRatio(bg, "#ffffff") >= contrastRatio(bg, "#111111") ? "#ffffff" : "#111111";
}

export function mixColors(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Nudges `fg` toward white/black until it reaches `min` contrast on `bg`. */
export function ensureContrast(fg: string, bg: string, min: number): string {
  if (contrastRatio(fg, bg) >= min) return fg;
  const target = relativeLuminance(bg) > 0.4 ? "#000000" : "#ffffff";
  for (let i = 1; i <= 20; i++) {
    const c = mixColors(fg, target, i / 20);
    if (contrastRatio(c, bg) >= min) return c;
  }
  return target;
}

export interface PortalPalette {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  primaryText: string;
  /** Primary adjusted so it is readable as text/outline on the surface. */
  primaryOnSurface: string;
  accent: string;
  accentText: string;
  success: string;
  danger: string;
}

export function resolvePalette(config: PortalConfig, prefersDark = false): PortalPalette {
  const mode = config.ui.colorMode;
  const dark = mode === "dark" || (mode === "auto" && prefersDark);
  const base = dark
    ? { bg: "#0e1217", surface: "#171d25", surfaceAlt: "#1f2731", text: "#e7eaef", muted: "#a3aebd", border: "#2c3644", success: "#4ade80", danger: "#f87171" }
    : { bg: "#f4f6f8", surface: "#ffffff", surfaceAlt: "#eef1f4", text: "#131820", muted: "#566171", border: "#dde2e8", success: "#15803d", danger: "#b42318" };
  const primary = isHexColor(config.branding.primaryColor) ? config.branding.primaryColor : "#1f5fd1";
  const accent = isHexColor(config.branding.accentColor) ? config.branding.accentColor : primary;
  return {
    dark,
    ...base,
    primary,
    primaryText: readableOn(primary),
    primaryOnSurface: ensureContrast(primary, base.surface, 4.5),
    accent,
    accentText: readableOn(accent),
  };
}

export interface RadiusScale {
  card: number;
  control: number;
  button: number;
}

export const RADIUS_SCALE: Record<RadiusOption, RadiusScale> = {
  none: { card: 0, control: 0, button: 0 },
  sm: { card: 6, control: 6, button: 6 },
  md: { card: 12, control: 10, button: 10 },
  lg: { card: 18, control: 12, button: 12 },
  xl: { card: 24, control: 16, button: 16 },
  full: { card: 24, control: 14, button: 9999 },
};

export const FONT_STACKS: Record<FontFamilyOption, string> = {
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  humanist: 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif',
  rounded: 'ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, Nunito, "Segoe UI", system-ui, sans-serif',
  serif: 'Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, Cambria, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
};

export const FONT_SCALE_FACTOR: Record<FontScale, number> = { sm: 0.92, md: 1, lg: 1.12 };
export const SPACING_PX: Record<Spacing, number> = { compact: 12, comfortable: 20, spacious: 28 };

export interface PortalWarning {
  field: string;
  message: string;
}

/** Non-blocking accessibility / usability advice shown in the customizer. */
export function getPortalWarnings(config: PortalConfig): PortalWarning[] {
  const out: PortalWarning[] = [];
  const pal = resolvePalette(config, false);
  const palDark = resolvePalette(config, true);
  const check = (p: PortalPalette, label: string) => {
    const ratio = contrastRatio(config.branding.primaryColor, p.surface);
    if (ratio < 3) {
      out.push({
        field: "branding.primaryColor",
        message: `Primary colour has low contrast on the ${label} card (${ratio.toFixed(1)}:1). We will auto-adjust text/outline colours, but a darker or lighter brand colour is recommended.`,
      });
    }
  };
  check(pal, "light");
  if (config.ui.colorMode !== "light") check(palDark, "dark");
  if (contrastRatio(pal.primary, pal.primaryText) < 4.5) {
    out.push({ field: "branding.primaryColor", message: "Button text on the primary colour is hard to read." });
  }
  if (config.ui.background === "image" && !config.branding.backgroundImageUrl) {
    out.push({ field: "branding.backgroundImageUrl", message: "Background style is 'image' but no image is uploaded; a gradient will be used instead." });
  }
  if (!config.branding.logoUrl) {
    out.push({ field: "branding.logoUrl", message: "No logo uploaded — the business name will be shown instead." });
  }
  if (config.ui.fontFamily === "mono" && config.ui.fontScale === "sm") {
    out.push({ field: "ui.fontScale", message: "Small monospace text can be hard to read on phones." });
  }
  if (config.promotions.adImage.enabled && !config.promotions.adImage.alt) {
    out.push({ field: "promotions.adImage.alt", message: "Add alternative text for the advertisement image (accessibility)." });
  }
  return out;
}

// ---------- tenant / asset helpers ----------

export const PORTAL_ASSET_BUCKET = "portal-assets";
export const ASSET_KINDS = ["logo", "favicon", "background", "promo"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_RULES: Record<AssetKind, { maxBytes: number }> = {
  logo: { maxBytes: 512 * 1024 },
  favicon: { maxBytes: 128 * 1024 },
  background: { maxBytes: 1536 * 1024 },
  promo: { maxBytes: 1024 * 1024 },
};

/** SVG is deliberately NOT allowed (script-capable). */
export const ASSET_MIME_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

/** Verifies file bytes match the claimed mime type (don't trust the header alone). */
export function detectImageType(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.length >= 4 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return "image/x-icon";
  return null;
}

export function buildAssetPrefix(supabaseUrl: string, orgId: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${PORTAL_ASSET_BUCKET}/${orgId}/`;
}

/** True only if `url` is inside THIS tenant's asset folder (no traversal). */
export function isOrgAssetUrl(url: string, prefix: string): boolean {
  if (!isSafeHttpsUrl(url as unknown, 600) && !url.startsWith("http://localhost")) return false;
  if (!url.startsWith(prefix)) return false;
  const rest = url.slice(prefix.length);
  return rest.length > 0 && !rest.includes("..") && !rest.includes("//") && !rest.includes("%2e") && !rest.includes("%2E") && !rest.includes("\\");
}

export interface TenantKey {
  type: "slug" | "domain";
  value: string;
}

const PLATFORM_HOST_SUFFIXES = [".vercel.app", ".localhost"];

/**
 * Decides how a captive-portal request maps to a tenant.
 * 1. explicit ?org=<slug> (what the MikroTik hotspot login.html redirect uses)
 * 2. otherwise a custom domain from the Host header (future: wifi.exampleisp.co.ke)
 * Platform hosts never act as tenant domains.
 */
export function resolveTenantKey(opts: { org?: string | null; host?: string | null; platformHosts?: string[] }): TenantKey | null {
  const org = (opts.org ?? "").trim().toLowerCase();
  if (org) return /^[a-z0-9][a-z0-9-]{0,99}$/.test(org) ? { type: "slug", value: org } : null;
  const host = (opts.host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
  if (!host || !/^[a-z0-9.-]{3,253}$/.test(host)) return null;
  const platform = new Set([...(opts.platformHosts ?? []), "localhost", "127.0.0.1"].map((h) => h.toLowerCase()));
  if (platform.has(host) || PLATFORM_HOST_SUFFIXES.some((s) => host.endsWith(s))) return null;
  return { type: "domain", value: host };
}

// ---------- sanitizer / validator ----------

export interface SanitizeOptions {
  /** Return true if the asset URL belongs to the calling tenant. */
  isAllowedAssetUrl: (url: string) => boolean;
  /** Plan ids that belong to the calling tenant (overrides for others are dropped). */
  validPlanIds?: Set<string>;
  /** Fallback business name. */
  businessNameFallback?: string;
}

export interface SanitizeResult {
  config: PortalConfig;
  errors: Record<string, string>;
  warnings: PortalWarning[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T, path: string, errors: Record<string, string>): T {
  if (v === undefined) return fallback;
  if (typeof v === "string" && (allowed as readonly string[]).includes(v)) return v as T;
  errors[path] = `Choose one of: ${allowed.join(", ")}.`;
  return fallback;
}

function pickBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function sanitizePortalConfig(input: unknown, opts: SanitizeOptions): SanitizeResult {
  const errors: Record<string, string> = {};
  const def = getDefaultPortalConfig(opts.businessNameFallback);
  const src = isObj(input) ? input : {};
  if (!isObj(input)) errors["config"] = "Invalid configuration payload.";

  const text = (v: unknown, path: string, fallback: string, max: number, multiline = false, required = false): string => {
    if (v === undefined) return fallback;
    if (typeof v !== "string") {
      errors[path] = "Must be text.";
      return fallback;
    }
    if (v.length > max * 2) {
      errors[path] = `Too long (max ${max} characters).`;
      return fallback;
    }
    const cleaned = cleanText(v, max, multiline);
    if (required && !cleaned) {
      errors[path] = "This field is required.";
      return fallback;
    }
    if (cleaned.length < v.trim().length && v.trim().length > max) {
      errors[path] = `Too long (max ${max} characters).`;
    }
    return cleaned;
  };

  const color = (v: unknown, path: string, fallback: string): string => {
    if (v === undefined) return fallback;
    if (isHexColor(v)) return v.toLowerCase();
    errors[path] = "Use a hex colour like #1f5fd1.";
    return fallback;
  };

  const link = (v: unknown, path: string, fallback = ""): string => {
    if (v === undefined || v === "") return v === "" ? "" : fallback;
    if (isSafeHttpsUrl(v)) return v;
    errors[path] = "Enter a valid https:// link.";
    return fallback;
  };

  const asset = (v: unknown, path: string): string => {
    if (v === undefined || v === "" || v === null) return "";
    if (typeof v === "string" && opts.isAllowedAssetUrl(v)) return v;
    errors[path] = "Image must be uploaded through the portal designer.";
    return "";
  };

  const b = isObj(src.branding) ? src.branding : {};
  const u = isObj(src.ui) ? src.ui : {};
  const am = isObj(src.authMethods) ? src.authMethods : {};
  const pk = isObj(src.packages) ? src.packages : {};
  const pay = isObj(src.payment) ? src.payment : {};
  const ct = isObj(src.content) ? src.content : {};
  const soc = isObj(ct.social) ? ct.social : {};
  const ms = isObj(src.messages) ? src.messages : {};
  const pr = isObj(src.promotions) ? src.promotions : {};

  const cfg: PortalConfig = {
    schemaVersion: PORTAL_SCHEMA_VERSION,
    template: pickEnum(src.template, TEMPLATE_IDS, def.template, "template", errors),
    branding: {
      businessName: text(b.businessName, "branding.businessName", def.branding.businessName, 80, false, true),
      logoUrl: asset(b.logoUrl, "branding.logoUrl"),
      faviconUrl: asset(b.faviconUrl, "branding.faviconUrl"),
      primaryColor: color(b.primaryColor, "branding.primaryColor", def.branding.primaryColor),
      accentColor: color(b.accentColor, "branding.accentColor", def.branding.accentColor),
      backgroundImageUrl: asset(b.backgroundImageUrl, "branding.backgroundImageUrl"),
      headline: text(b.headline, "branding.headline", def.branding.headline, 80),
      welcomeMessage: text(b.welcomeMessage, "branding.welcomeMessage", def.branding.welcomeMessage, 240, true),
      footerText: text(b.footerText, "branding.footerText", def.branding.footerText, 160),
    },
    ui: {
      logoPosition: pickEnum(u.logoPosition, LOGO_POSITIONS, def.ui.logoPosition, "ui.logoPosition", errors),
      cardPosition: pickEnum(u.cardPosition, CARD_POSITIONS, def.ui.cardPosition, "ui.cardPosition", errors),
      buttonStyle: pickEnum(u.buttonStyle, BUTTON_STYLES, def.ui.buttonStyle, "ui.buttonStyle", errors),
      radius: pickEnum(u.radius, RADIUS_OPTIONS, def.ui.radius, "ui.radius", errors),
      fontFamily: pickEnum(u.fontFamily, FONT_FAMILIES, def.ui.fontFamily, "ui.fontFamily", errors),
      fontScale: pickEnum(u.fontScale, FONT_SCALES, def.ui.fontScale, "ui.fontScale", errors),
      background: pickEnum(u.background, BACKGROUND_STYLES, def.ui.background, "ui.background", errors),
      formLayout: pickEnum(u.formLayout, FORM_LAYOUTS, def.ui.formLayout, "ui.formLayout", errors),
      spacing: pickEnum(u.spacing, SPACINGS, def.ui.spacing, "ui.spacing", errors),
      colorMode: pickEnum(u.colorMode, COLOR_MODES, def.ui.colorMode, "ui.colorMode", errors),
    },
    authMethods: {
      voucher: pickBool(am.voucher, def.authMethods.voucher),
      mpesa: pickBool(am.mpesa, def.authMethods.mpesa),
    },
    packages: {
      layout: pickEnum(pk.layout, PACKAGE_LAYOUTS, def.packages.layout, "packages.layout", errors),
      showSpeed: pickBool(pk.showSpeed, true),
      showData: pickBool(pk.showData, true),
      showDuration: pickBool(pk.showDuration, true),
      defaultCta: text(pk.defaultCta, "packages.defaultCta", def.packages.defaultCta, 30, false, true),
      overrides: {},
    },
    payment: {
      instructions: text(pay.instructions, "payment.instructions", def.payment.instructions, 280, true),
      confirmation: text(pay.confirmation, "payment.confirmation", def.payment.confirmation, 280, true),
    },
    content: {
      terms: text(ct.terms, "content.terms", def.content.terms, 4000, true),
      privacy: text(ct.privacy, "content.privacy", def.content.privacy, 4000, true),
      supportMessage: text(ct.supportMessage, "content.supportMessage", def.content.supportMessage, 200),
      phone: text(ct.phone, "content.phone", "", 20),
      whatsapp: text(ct.whatsapp, "content.whatsapp", "", 20),
      email: text(ct.email, "content.email", "", 254),
      location: text(ct.location, "content.location", "", 160),
      social: {
        facebook: link(soc.facebook, "content.social.facebook"),
        instagram: link(soc.instagram, "content.social.instagram"),
        x: link(soc.x, "content.social.x"),
        website: link(soc.website, "content.social.website"),
      },
    },
    messages: { ...DEFAULT_MESSAGES },
    promotions: JSON.parse(JSON.stringify(def.promotions)),
  };

  // contact validation
  if (cfg.content.phone && !isValidPhone(cfg.content.phone)) {
    errors["content.phone"] = "Enter a valid phone number, e.g. +254712345678.";
    cfg.content.phone = "";
  }
  if (cfg.content.whatsapp && !isValidPhone(cfg.content.whatsapp)) {
    errors["content.whatsapp"] = "Enter a valid WhatsApp number, e.g. +254712345678.";
    cfg.content.whatsapp = "";
  }
  if (cfg.content.email && !isValidEmail(cfg.content.email)) {
    errors["content.email"] = "Enter a valid email address.";
    cfg.content.email = "";
  }

  // messages (each must be non-empty plain text)
  (Object.keys(DEFAULT_MESSAGES) as (keyof PortalMessages)[]).forEach((k) => {
    cfg.messages[k] = text(ms[k], `messages.${k}`, DEFAULT_MESSAGES[k], 200, false, true);
  });

  // auth methods: only backend-supported ones, at least one on.
  if (!cfg.authMethods.voucher && !cfg.authMethods.mpesa) {
    errors["authMethods"] = "Enable at least one login method.";
    cfg.authMethods = { ...def.authMethods };
  }
  for (const key of Object.keys(am)) {
    if (key !== "voucher" && key !== "mpesa") {
      errors[`authMethods.${key}`] = "This login method is not supported by the backend.";
    }
  }

  // package overrides (only for the tenant's own plans)
  if (isObj(pk.overrides)) {
    let count = 0;
    for (const [planId, raw] of Object.entries(pk.overrides)) {
      if (++count > 50) break;
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(planId) || !isObj(raw)) continue;
      if (opts.validPlanIds && !opts.validPlanIds.has(planId)) continue;
      const ov: PackageOverride = {};
      if (typeof raw.featured === "boolean") ov.featured = raw.featured;
      if (typeof raw.hidden === "boolean") ov.hidden = raw.hidden;
      if (typeof raw.cta === "string") ov.cta = cleanText(raw.cta, 30);
      if (typeof raw.description === "string") ov.description = cleanText(raw.description, 120);
      if (typeof raw.badge === "string") ov.badge = cleanText(raw.badge, 24);
      cfg.packages.overrides[planId] = ov;
    }
  }

  // promotions
  const banner = isObj(pr.banner) ? pr.banner : {};
  const ann = isObj(pr.announcement) ? pr.announcement : {};
  const fo = isObj(pr.featuredOffer) ? pr.featuredOffer : {};
  const ad = isObj(pr.adImage) ? pr.adImage : {};
  const sp = isObj(pr.sponsored) ? pr.sponsored : {};
  const P = cfg.promotions;
  P.banner = {
    enabled: pickBool(banner.enabled, false),
    text: text(banner.text, "promotions.banner.text", "", 160),
    ctaText: text(banner.ctaText, "promotions.banner.ctaText", "", 30),
    ctaUrl: link(banner.ctaUrl, "promotions.banner.ctaUrl"),
  };
  P.announcement = {
    enabled: pickBool(ann.enabled, false),
    text: text(ann.text, "promotions.announcement.text", "", 240, true),
  };
  P.featuredOffer = {
    enabled: pickBool(fo.enabled, false),
    title: text(fo.title, "promotions.featuredOffer.title", "", 60),
    text: text(fo.text, "promotions.featuredOffer.text", "", 160),
    ctaText: text(fo.ctaText, "promotions.featuredOffer.ctaText", "", 30),
    ctaUrl: link(fo.ctaUrl, "promotions.featuredOffer.ctaUrl"),
  };
  P.adImage = {
    enabled: pickBool(ad.enabled, false),
    imageUrl: asset(ad.imageUrl, "promotions.adImage.imageUrl"),
    linkUrl: link(ad.linkUrl, "promotions.adImage.linkUrl"),
    alt: text(ad.alt, "promotions.adImage.alt", "", 120),
  };
  P.sponsored = {
    enabled: pickBool(sp.enabled, false),
    label: text(sp.label, "promotions.sponsored.label", "Sponsored", 30),
    text: text(sp.text, "promotions.sponsored.text", "", 160),
    linkUrl: link(sp.linkUrl, "promotions.sponsored.linkUrl"),
  };

  // an enabled promo must have content to show
  if (P.banner.enabled && !P.banner.text) errors["promotions.banner.text"] = "Add banner text or switch it off.";
  if (P.announcement.enabled && !P.announcement.text) errors["promotions.announcement.text"] = "Add announcement text or switch it off.";
  if (P.featuredOffer.enabled && !P.featuredOffer.title) errors["promotions.featuredOffer.title"] = "Add an offer title or switch it off.";
  if (P.adImage.enabled && !P.adImage.imageUrl) errors["promotions.adImage.imageUrl"] = "Upload an image or switch it off.";
  if (P.sponsored.enabled && !P.sponsored.text) errors["promotions.sponsored.text"] = "Add sponsored text or switch it off.";

  return { config: cfg, errors, warnings: getPortalWarnings(cfg) };
}

// ---------- package presentation (reuses existing plan data) ----------

export interface PlanLike {
  id: string;
  name: string;
  price: number;
  currency?: string;
  downloadSpeedKbps: number;
  validityDurationSeconds: number;
  dataLimitMb: number;
}

export interface PresentedPackage {
  id: string;
  name: string;
  price: number;
  currency: string;
  speedLabel: string;
  durationLabel: string;
  dataLabel: string;
  description: string;
  featured: boolean;
  badge?: string;
  cta: string;
}

export const DEFAULT_DEMO_HOTSPOT_PLANS: PlanLike[] = [
  {
    id: "plan-hs-24h",
    name: "Hotspot Daily Basic",
    price: 50,
    currency: "KES",
    downloadSpeedKbps: 5120,
    validityDurationSeconds: 86400,
    dataLimitMb: 0,
  },
  {
    id: "plan-hs-7d",
    name: "Hotspot Weekly Plus",
    price: 250,
    currency: "KES",
    downloadSpeedKbps: 10240,
    validityDurationSeconds: 604800,
    dataLimitMb: 0,
  },
  {
    id: "plan-hs-30d",
    name: "Hotspot Monthly Pro",
    price: 800,
    currency: "KES",
    downloadSpeedKbps: 20480,
    validityDurationSeconds: 2592000,
    dataLimitMb: 0,
  },
  {
    id: "plan-hs-1h",
    name: "Hotspot 1 Hour Express",
    price: 10,
    currency: "KES",
    downloadSpeedKbps: 3072,
    validityDurationSeconds: 3600,
    dataLimitMb: 0,
  },
  {
    id: "plan-hs-3h",
    name: "Hotspot 3 Hours Special",
    price: 20,
    currency: "KES",
    downloadSpeedKbps: 4096,
    validityDurationSeconds: 10800,
    dataLimitMb: 0,
  },
];

export function getDefaultDemoPortalConfig(businessName = "QC NetCore"): PortalConfig {
  const base = getDefaultPortalConfig(businessName);
  return {
    ...base,
    branding: {
      ...base.branding,
      businessName,
      headline: "Connect to High-Speed WiFi",
      welcomeMessage: "Choose a package to pay instantly with M-Pesa, or enter your voucher code.",
      footerText: "Powered by QC NetCore • 24/7 Customer Support",
    },
    packages: {
      ...base.packages,
      layout: "grid",
      defaultCta: "Select Package",
      overrides: {
        "plan-hs-24h": {
          featured: false,
          description: "Everyday browsing, social media & messaging",
          cta: "Select Daily",
        },
        "plan-hs-7d": {
          featured: true,
          badge: "Popular",
          description: "HD streaming, video calls & remote work",
          cta: "Select Weekly",
        },
        "plan-hs-30d": {
          featured: false,
          badge: "Best Value",
          description: "High-speed multi-device access all month",
          cta: "Select Monthly",
        },
        "plan-hs-1h": {
          featured: false,
          description: "Quick 1-hour pass for instant access",
          cta: "Quick Pass",
        },
        "plan-hs-3h": {
          featured: false,
          hidden: true,
          description: "3-hour pass for study and meetings",
          cta: "Select 3 Hours",
        },
      },
    },
    content: {
      ...base.content,
      supportMessage: "Need help connecting? Contact 24/7 WiFi Support.",
      phone: "+254712345678",
      whatsapp: "+254712345678",
      email: "support@nexanet.co.ke",
      location: "Nairobi Metro Hotspot Network",
      terms:
        "Packages activate immediately upon M-Pesa confirmation or voucher validation. Fair usage policy applies for uninterrupted network quality.",
      privacy:
        "Your phone number and device MAC address are used solely for M-Pesa payment verification and FreeRADIUS session provisioning.",
    },
    promotions: {
      ...base.promotions,
      banner: {
        enabled: true,
        text: "Instant M-Pesa STK activation — connect in under 5 seconds",
        ctaText: "",
        ctaUrl: "",
      },
    },
  };
}

export function formatDurationLabel(seconds: number): string {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} Min`;
  if (seconds < 86400) {
    const h = Math.round(seconds / 3600);
    return `${h} Hour${h > 1 ? "s" : ""}`;
  }
  const d = Math.round(seconds / 86400);
  return `${d} Day${d > 1 ? "s" : ""}`;
}

export function formatSpeedLabel(kbps: number): string {
  const mbps = kbps / 1024;
  return `${Number.isInteger(mbps) ? mbps : mbps.toFixed(1)} Mbps`;
}

export function formatDataLabel(mb: number): string {
  if (!mb) return "Unlimited";
  return mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB` : `${mb} MB`;
}

/** Applies the ISP's presentation overrides on top of existing plan records. */
export function presentPackages(plans: PlanLike[], cfg: PortalConfig): PresentedPackage[] {
  return plans
    .filter((p) => !cfg.packages.overrides[p.id]?.hidden)
    .map((p) => {
      const ov = cfg.packages.overrides[p.id] ?? {};
      const badge = ov.badge || (ov.featured ? "Popular" : undefined);
      return {
        id: p.id,
        name: p.name.replace(/^Hotspot\s+/i, ""),
        price: p.price,
        currency: p.currency || "KES",
        speedLabel: formatSpeedLabel(p.downloadSpeedKbps),
        durationLabel: formatDurationLabel(p.validityDurationSeconds),
        dataLabel: formatDataLabel(p.dataLimitMb),
        description: ov.description ?? "",
        featured: Boolean(ov.featured),
        ...(badge ? { badge } : {}),
        cta: ov.cta || cfg.packages.defaultCta,
      };
    })
    .sort((a, b) => Number(b.featured) - Number(a.featured));
}

// ---------- lifecycle types shared by API + UI ----------

export type PortalConfigStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface PortalConfigVersion {
  id: string;
  version: number;
  status: PortalConfigStatus;
  createdAt: string;
  publishedAt: string | null;
}
