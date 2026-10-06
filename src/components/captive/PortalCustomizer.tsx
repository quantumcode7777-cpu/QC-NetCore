"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Palette,
  LayoutTemplate,
  SlidersHorizontal,
  KeyRound,
  Layers,
  FileText,
  MessageSquare,
  Megaphone,
  Monitor,
  Tablet,
  Smartphone,
  Save,
  Rocket,
  ExternalLink,
  Undo2,
  History,
  Upload,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Settings2,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { btnClass } from "@/components/ui/PageHeader";
import { PortalRenderer } from "@/components/captive/PortalRenderer";
import {
  ASSET_MIME_TYPES,
  ASSET_RULES,
  BACKGROUND_STYLES,
  BUTTON_STYLES,
  CARD_POSITIONS,
  COLOR_MODES,
  DEFAULT_DEMO_HOTSPOT_PLANS,
  FONT_FAMILIES,
  FONT_SCALES,
  FORM_LAYOUTS,
  LOGO_POSITIONS,
  PACKAGE_LAYOUTS,
  PORTAL_TEMPLATES,
  RADIUS_OPTIONS,
  SPACINGS,
  applyTemplate,
  formatDurationLabel,
  getDefaultDemoPortalConfig,
  getPortalWarnings,
  sanitizePortalConfig,
  type AssetKind,
  type AuthMethodInfo,
  type PlanLike,
  type PortalConfig,
  type PortalConfigVersion,
  type TemplateId,
} from "@/lib/captive/config";
import {
  DEFAULT_DEMO_PORTAL_SETTINGS,
  loadDemoCaptiveState,
  publishDemoCaptiveState,
  resetDemoCaptiveState,
  saveDemoCaptiveState,
  type DemoPortalSettings,
} from "@/lib/captive/demo-state";

// ---------------------------------------------------------------- types

interface LoadedData {
  isDemo: boolean;
  canEdit: boolean;
  organization: { name: string; slug: string };
  draft: PortalConfig;
  hasDraft?: boolean;
  published: PortalConfig | null;
  draftVersion?: PortalConfigVersion | null;
  publishedVersion?: PortalConfigVersion | null;
  versions: PortalConfigVersion[];
  plans: PlanLike[];
  methods: AuthMethodInfo[];
}

type Device = "desktop" | "tablet" | "mobile";
const DEVICES: { id: Device; label: string; width: number; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "desktop", label: "Desktop", width: 1100, icon: Monitor },
  { id: "tablet", label: "Tablet", width: 768, icon: Tablet },
  { id: "mobile", label: "Mobile", width: 375, icon: Smartphone },
];

type SectionId =
  | "template"
  | "branding"
  | "design"
  | "login"
  | "packages"
  | "content"
  | "settings"
  | "messages"
  | "promos";

const SECTIONS: { id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "template", label: "Template", icon: LayoutTemplate },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "design", label: "Layout", icon: SlidersHorizontal },
  { id: "login", label: "Access", icon: KeyRound },
  { id: "packages", label: "Packages", icon: Layers },
  { id: "content", label: "Content", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings2 },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "promos", label: "Promotions", icon: Megaphone },
];

const DURATION_PRESETS = [
  { label: "1 Hour", seconds: 3600 },
  { label: "3 Hours", seconds: 10800 },
  { label: "1 Day (24 Hours)", seconds: 86400 },
  { label: "7 Days (Weekly)", seconds: 604800 },
  { label: "30 Days (Monthly)", seconds: 2592000 },
] as const;

const BADGE_PRESETS = ["", "Popular", "Best Value", "Featured", "Fastest", "New"] as const;

// ---------------------------------------------------------------- small form kit

const inputCls =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60";

function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-[11px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          disabled={disabled}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-md border px-2.5 py-1.5 text-xs font-medium capitalize transition-colors disabled:opacity-60",
            value === o
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-surface text-muted-foreground hover:text-foreground"
          )}
        >
          {o.replace("-", " ")}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  description?: string;
}) {
  return (
    <label className={cn("flex items-start gap-3", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border accent-[var(--primary)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && <span className="block text-[11px] text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}

function ColorField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label="Pick colour"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#1f5fd1"}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-9 w-12 cursor-pointer rounded-md border border-border bg-surface p-0.5 disabled:opacity-60"
      />
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={7}
        spellCheck={false}
        className={cn(inputCls, "font-mono")}
      />
    </div>
  );
}

function Card({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------- image upload

function ImageUpload({
  kind,
  value,
  onChange,
  disabled,
  isDemo,
  label,
  error,
}: {
  kind: AssetKind;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  isDemo?: boolean;
  label: string;
  error?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rule = ASSET_RULES[kind];

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setMsg(null);
    if (!ASSET_MIME_TYPES[file.type]) {
      setMsg("Only PNG, JPEG, WebP or ICO images are allowed.");
      return;
    }
    if (file.size > rule.maxBytes) {
      setMsg(`Image is too large. Maximum is ${Math.round(rule.maxBytes / 1024)} KB.`);
      return;
    }
    setBusy(true);
    try {
      if (isDemo) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Read failed"));
          reader.readAsDataURL(file);
        });
        onChange(dataUrl);
        return;
      }
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("file", file);
      const res = await fetch("/api/v1/captive/assets", { method: "POST", body: fd });
      const json = await res.json();
      if (json?.success) onChange(json.data.url);
      else setMsg(json?.message ?? "Upload failed.");
    } catch {
      setMsg("Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Field label={label} hint={`PNG, JPEG or WebP · max ${Math.round(rule.maxBytes / 1024)} KB`} error={error || msg || undefined}>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-subtle">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/x-icon"
          className="sr-only"
          id={`upload-${kind}`}
          disabled={disabled || busy}
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <label
          htmlFor={`upload-${kind}`}
          className={cn(btnClass("secondary"), (disabled || busy) && "pointer-events-none opacity-50", "cursor-pointer")}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
          {value ? "Replace" : "Upload"}
        </label>
        {value && !disabled && (
          <button type="button" onClick={() => onChange("")} className={btnClass("ghost")}>
            Remove
          </button>
        )}
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------- preview frame

function PreviewFrame({
  config,
  plans,
  device,
  demoSettings,
  isDemo,
}: {
  config: PortalConfig;
  plans: PlanLike[];
  device: Device;
  demoSettings?: DemoPortalSettings;
  isDemo?: boolean;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(600);
  const dev = DEVICES.find((d) => d.id === device)!;
  const HEIGHT = device === "mobile" ? 660 : 580;

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    setAvail(el.clientWidth);
    const ro = new ResizeObserver((e) => setAvail(Math.round(e[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = Math.min(1, (avail - 2) / dev.width);
  const w = dev.width * scale;

  return (
    <div ref={outerRef} className="flex w-full justify-center">
      <div
        className="overflow-hidden rounded-xl border-2 border-border-strong bg-surface-subtle shadow-pop"
        style={{ width: w + 4, height: HEIGHT * scale + 4 }}
      >
        <div style={{ width: dev.width, height: HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <div className="h-full overflow-y-auto overflow-x-hidden" aria-label={`${dev.label} preview`}>
            <PortalRenderer
              config={config}
              plans={plans}
              mode="preview"
              supportedMethods={["voucher", "mpesa"]}
              demoSettings={demoSettings}
              isDemo={isDemo}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- main component

export function PortalCustomizer() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [config, setConfig] = useState<PortalConfig>(() => getDefaultDemoPortalConfig());
  const [demoSettings, setDemoSettings] = useState<DemoPortalSettings>(() => ({
    ...DEFAULT_DEMO_PORTAL_SETTINGS,
  }));
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [section, setSection] = useState<SectionId>("template");
  const [device, setDevice] = useState<Device>("mobile");
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | "save" | "publish" | "restore">(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  // Add / Edit Demo Package state
  const [showAddPkg, setShowAddPkg] = useState(false);
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [newPkg, setNewPkg] = useState({
    name: "",
    price: "100",
    speedMbps: "10",
    durationSeconds: 86400,
    dataLimitMb: "0",
    badge: "Popular",
    description: "",
  });

  const makeSnapshot = useCallback(
    (cfg: PortalConfig, plans: PlanLike[], settings: DemoPortalSettings) =>
      JSON.stringify({ cfg, plans, settings }),
    []
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/captive/config", { cache: "no-store" });
      const json = await res.json();
      if (!json?.success) {
        setLoadError(json?.message ?? "Portal settings could not be loaded.");
        return;
      }
      const d = json.data as LoadedData;
      if (d.isDemo) {
        const local = loadDemoCaptiveState(d.organization?.name || "QC NetCore");
        const mergedData: LoadedData = {
          ...d,
          canEdit: true,
          draft: local.draft,
          published: local.published,
          plans: local.plans.length > 0 ? local.plans : DEFAULT_DEMO_HOTSPOT_PLANS,
          versions: local.versions,
          publishedVersion: local.versions.find((v) => v.status === "PUBLISHED") ?? null,
          draftVersion: local.versions.find((v) => v.status === "DRAFT") ?? null,
          hasDraft: local.versions.some((v) => v.status === "DRAFT"),
        };
        setData(mergedData);
        setConfig(local.draft);
        setDemoSettings(local.settings);
        setSavedSnapshot(makeSnapshot(local.draft, mergedData.plans, local.settings));
        setServerErrors({});
        return;
      }

      setData(d);
      setConfig(d.draft);
      setSavedSnapshot(makeSnapshot(d.draft, d.plans, DEFAULT_DEMO_PORTAL_SETTINGS));
      setServerErrors({});
    } catch {
      setLoadError("Portal settings could not be loaded. Please try again.");
    }
  }, [makeSnapshot]);

  useEffect(() => {
    load();
  }, [load]);

  const canEdit = Boolean(data?.canEdit) && busy === null;
  const currentSnapshot = useMemo(
    () => makeSnapshot(config, data?.plans ?? [], demoSettings),
    [config, data?.plans, demoSettings, makeSnapshot]
  );
  const dirty = Boolean(savedSnapshot) && currentSnapshot !== savedSnapshot;

  // unsaved-changes guard
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // instant client-side validation (asset ownership is verified server-side)
  const validation = useMemo(
    () => sanitizePortalConfig(config, { isAllowedAssetUrl: () => true }),
    [config]
  );
  const errors = { ...validation.errors, ...serverErrors };
  const warnings = useMemo(() => getPortalWarnings(config), [config]);
  const hasErrors = Object.keys(validation.errors).length > 0;

  const update = useCallback((mut: (c: PortalConfig) => void) => {
    setConfig((prev) => {
      const next = structuredClone(prev);
      mut(next);
      return next;
    });
    setServerErrors({});
  }, []);

  const updateDemoSetting = useCallback(<K extends keyof DemoPortalSettings>(key: K, value: DemoPortalSettings[K]) => {
    setDemoSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const flash = (kind: "success" | "error", text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 5000);
  };

  // Demo Package CRUD helpers
  const handleAddDemoPackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    const nameClean = newPkg.name.trim();
    const priceNum = Math.max(1, Number(newPkg.price) || 50);
    const speedKbps = Math.max(512, Math.round((Number(newPkg.speedMbps) || 5) * 1024));
    const dataMb = Math.max(0, Number(newPkg.dataLimitMb) || 0);
    if (!nameClean) {
      flash("error", "Enter a package name.");
      return;
    }
    const id = `plan-demo-${Date.now().toString(36)}`;
    const createdPlan: PlanLike = {
      id,
      name: nameClean,
      price: priceNum,
      currency: demoSettings.defaultCurrency || "KES",
      downloadSpeedKbps: speedKbps,
      validityDurationSeconds: newPkg.durationSeconds,
      dataLimitMb: dataMb,
    };
    setData((prev) => (prev ? { ...prev, plans: [...prev.plans, createdPlan] } : prev));
    update((c) => {
      c.packages.overrides[id] = {
        featured: newPkg.badge === "Popular" || newPkg.badge === "Featured",
        badge: newPkg.badge || undefined,
        description: newPkg.description.trim() || "Fast unlimited WiFi access",
        cta: `Select ${nameClean.split(" ")[0]}`,
      };
    });
    setNewPkg({
      name: "",
      price: "100",
      speedMbps: "10",
      durationSeconds: 86400,
      dataLimitMb: "0",
      badge: "Popular",
      description: "",
    });
    setShowAddPkg(false);
    flash("success", `Added "${nameClean}" to Demo packages.`);
  };

  const handleUpdateDemoPlan = (planId: string, patch: Partial<PlanLike>) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            plans: prev.plans.map((p) => (p.id === planId ? { ...p, ...patch } : p)),
          }
        : prev
    );
  };

  const handleDeleteDemoPlan = (planId: string) => {
    if (!data) return;
    if (data.plans.length <= 1) {
      flash("error", "Keep at least one active package in the portal.");
      return;
    }
    setData((prev) => (prev ? { ...prev, plans: prev.plans.filter((p) => p.id !== planId) } : prev));
    update((c) => {
      delete c.packages.overrides[planId];
    });
    flash("success", "Package removed from Demo portal.");
  };

  const handleResetDemo = () => {
    const fresh = resetDemoCaptiveState(data?.organization.name || "QC NetCore");
    setConfig(fresh.draft);
    setDemoSettings(fresh.settings);
    setData((prev) =>
      prev
        ? {
            ...prev,
            draft: fresh.draft,
            published: fresh.published,
            plans: fresh.plans,
            versions: fresh.versions,
            publishedVersion: fresh.versions[0] ?? null,
            hasDraft: false,
          }
        : prev
    );
    setSavedSnapshot(makeSnapshot(fresh.draft, fresh.plans, fresh.settings));
    setServerErrors({});
    flash("success", "Demo reset to default QC NetCore branding, packages, and settings.");
  };

  const saveDraft = async (): Promise<boolean> => {
    if (!data) return false;
    setBusy("save");
    try {
      if (data.isDemo) {
        const current = loadDemoCaptiveState(config.branding.businessName || "QC NetCore");
        const nextVerNum = current.versions.reduce((m, v) => Math.max(m, v.version), 0) + 1;
        const draftVersion: PortalConfigVersion = {
          id: `demo-draft-${nextVerNum}`,
          version: nextVerNum,
          status: "DRAFT",
          createdAt: new Date().toISOString(),
          publishedAt: null,
        };
        const versions = [
          draftVersion,
          ...current.versions.filter((v) => v.status !== "DRAFT"),
        ].slice(0, 10);
        saveDemoCaptiveState({
          draft: validation.config,
          published: current.published,
          plans: data.plans,
          settings: demoSettings,
          versions,
          updatedAt: new Date().toISOString(),
        });
        setConfig(validation.config);
        setSavedSnapshot(makeSnapshot(validation.config, data.plans, demoSettings));
        setData((d) => (d ? { ...d, draftVersion, versions, hasDraft: true } : d));
        flash("success", "Demo draft saved. Click 'Publish to Demo' to update the live Demo Portal.");
        return true;
      }

      const res = await fetch("/api/v1/captive/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const json = await res.json();
      if (!json?.success) {
        setServerErrors(json?.fieldErrors ?? {});
        flash("error", json?.message ?? "Draft could not be saved.");
        return false;
      }
      setConfig(json.data.draft);
      setSavedSnapshot(makeSnapshot(json.data.draft, data.plans, demoSettings));
      setData((d) => (d ? { ...d, draftVersion: json.data.draftVersion, hasDraft: true } : d));
      flash("success", "Draft saved. Your live portal has not changed.");
      return true;
    } catch {
      flash("error", "Draft could not be saved. Please try again.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    setConfirmPublish(false);
    if (!data) return;

    if (data.isDemo) {
      setBusy("publish");
      try {
        const next = publishDemoCaptiveState(validation.config, data.plans, demoSettings);
        setConfig(next.draft);
        setSavedSnapshot(makeSnapshot(next.draft, next.plans, next.settings));
        setData((d) =>
          d
            ? {
                ...d,
                draft: next.draft,
                published: next.published,
                plans: next.plans,
                versions: next.versions,
                publishedVersion: next.versions[0] ?? null,
                hasDraft: false,
              }
            : d
        );
        flash("success", "Published to Demo! Open the Demo Portal to test your live customer flow.");
      } finally {
        setBusy(null);
      }
      return;
    }

    if (dirty && !(await saveDraft())) return;
    setBusy("publish");
    try {
      const res = await fetch("/api/v1/captive/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      const json = await res.json();
      if (!json?.success) {
        setServerErrors(json?.fieldErrors ?? {});
        flash("error", json?.message ?? "Publishing failed. Your live portal was not changed.");
        return;
      }
      flash("success", "Published! Your captive portal is now live.");
      await load();
    } catch {
      flash("error", "Publishing failed. Your live portal was not changed.");
    } finally {
      setBusy(null);
    }
  };

  const restore = async (version: number) => {
    if (!data) return;
    if (data.isDemo) {
      setShowHistory(false);
      flash("success", `Restored Version ${version} into your Demo draft.`);
      return;
    }
    setBusy("restore");
    try {
      const res = await fetch("/api/v1/captive/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", version }),
      });
      const json = await res.json();
      if (!json?.success) {
        flash("error", json?.message ?? "That version could not be restored.");
        return;
      }
      flash("success", `Version ${version} restored as your draft. Review it, then publish.`);
      setShowHistory(false);
      await load();
    } catch {
      flash("error", "That version could not be restored.");
    } finally {
      setBusy(null);
    }
  };

  const cancelChanges = () => {
    if (!data || !savedSnapshot) return;
    try {
      const parsed = JSON.parse(savedSnapshot) as {
        cfg: PortalConfig;
        plans: PlanLike[];
        settings: DemoPortalSettings;
      };
      setConfig(parsed.cfg);
      setDemoSettings(parsed.settings);
      setData((prev) => (prev ? { ...prev, plans: parsed.plans } : prev));
      setServerErrors({});
    } catch {
      /* ignore */
    }
  };

  if (loadError) {
    return (
      <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
        {loadError}
      </div>
    );
  }
  if (!data) {
    return (
      <div role="status" aria-label="Loading portal designer" className="grid gap-4 lg:grid-cols-2">
        <div className="h-96 animate-pulse rounded-lg border border-border bg-surface" />
        <div className="h-96 animate-pulse rounded-lg border border-border bg-surface" />
      </div>
    );
  }

  const disabled = !canEdit;
  const publishedV = data.publishedVersion;
  const statusText = dirty
    ? "Unsaved changes"
    : data.hasDraft
      ? `Draft v${data.draftVersion?.version ?? ""} saved`
      : publishedV
        ? `Published v${publishedV.version}`
        : "Ready to publish";

  const e = (path: string) => errors[path];
  const portalUrl = data.isDemo
    ? "/captive?demo=true"
    : data.organization.slug
      ? `/captive?org=${encodeURIComponent(data.organization.slug)}`
      : "/captive";

  // ------------------------------------------------ section bodies
  const body: Record<SectionId, React.ReactNode> = {
    template: (
      <Card
        title="Choose a template"
        description="Templates set the initial visual theme while keeping your business identity, packages, and support details intact."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {PORTAL_TEMPLATES.map((t) => {
            const on = config.template === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={disabled}
                aria-pressed={on}
                onClick={() => update((c) => Object.assign(c, applyTemplate(c, t.id as TemplateId)))}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors disabled:opacity-60",
                  on ? "border-primary bg-primary-soft" : "border-border bg-surface hover:border-border-strong"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="h-3 w-3 rounded-full border border-border" style={{ background: t.patch.branding?.primaryColor }} />
                    <span className="h-3 w-3 rounded-full border border-border" style={{ background: t.patch.branding?.accentColor }} />
                  </span>
                  <span className="text-sm font-semibold text-foreground">{t.label}</span>
                  {on && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" aria-hidden="true" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
              </button>
            );
          })}
        </div>
      </Card>
    ),

    branding: (
      <>
        <Card title="Brand Identity" description="Set your ISP or WiFi hotspot business name and brand assets.">
          <Field label="ISP / WiFi Business Name" htmlFor="bn" error={e("branding.businessName")}>
            <input id="bn" className={inputCls} maxLength={80} disabled={disabled} value={config.branding.businessName} onChange={(ev) => update((c) => { c.branding.businessName = ev.target.value; })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageUpload kind="logo" label="Logo" isDemo={data.isDemo} value={config.branding.logoUrl} disabled={disabled} error={e("branding.logoUrl")} onChange={(u) => update((c) => { c.branding.logoUrl = u; })} />
            <ImageUpload kind="favicon" label="Favicon" isDemo={data.isDemo} value={config.branding.faviconUrl} disabled={disabled} error={e("branding.faviconUrl")} onChange={(u) => update((c) => { c.branding.faviconUrl = u; })} />
          </div>
        </Card>
        <Card title="Brand Colors & Background">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Primary brand color" htmlFor="pc" error={e("branding.primaryColor")}>
              <ColorField id="pc" disabled={disabled} value={config.branding.primaryColor} onChange={(v) => update((c) => { c.branding.primaryColor = v; })} />
            </Field>
            <Field label="Secondary / accent color" htmlFor="ac" error={e("branding.accentColor")}>
              <ColorField id="ac" disabled={disabled} value={config.branding.accentColor} onChange={(v) => update((c) => { c.branding.accentColor = v; })} />
            </Field>
          </div>
          <ImageUpload kind="background" label="Background image" isDemo={data.isDemo} value={config.branding.backgroundImageUrl} disabled={disabled} error={e("branding.backgroundImageUrl")} onChange={(u) => update((c) => { c.branding.backgroundImageUrl = u; if (u) c.ui.background = "image"; })} />
        </Card>
        <Card title="Hero Copy & Footer">
          <Field label="Hero headline / tagline" htmlFor="hl" error={e("branding.headline")}>
            <input id="hl" className={inputCls} maxLength={80} disabled={disabled} value={config.branding.headline} onChange={(ev) => update((c) => { c.branding.headline = ev.target.value; })} />
          </Field>
          <Field label="Welcome subtitle" htmlFor="wm" error={e("branding.welcomeMessage")}>
            <textarea id="wm" rows={3} className={inputCls} maxLength={240} disabled={disabled} value={config.branding.welcomeMessage} onChange={(ev) => update((c) => { c.branding.welcomeMessage = ev.target.value; })} />
          </Field>
          <Field label="Footer text" htmlFor="ft" hint="Leave blank for a standard copyright notice." error={e("branding.footerText")}>
            <input id="ft" className={inputCls} maxLength={160} disabled={disabled} value={config.branding.footerText} onChange={(ev) => update((c) => { c.branding.footerText = ev.target.value; })} />
          </Field>
        </Card>
      </>
    ),

    design: (
      <Card title="Layout & Surface Appearance" description="Customize alignment, surface radius, typography, and theme mode.">
        <Field label="Logo position"><Segmented label="Logo position" disabled={disabled} value={config.ui.logoPosition} options={LOGO_POSITIONS} onChange={(v) => update((c) => { c.ui.logoPosition = v; })} /></Field>
        <Field label="Login card position (wide screens)"><Segmented label="Card position" disabled={disabled} value={config.ui.cardPosition} options={CARD_POSITIONS} onChange={(v) => update((c) => { c.ui.cardPosition = v; })} /></Field>
        <Field label="Login form layout"><Segmented label="Form layout" disabled={disabled} value={config.ui.formLayout} options={FORM_LAYOUTS} onChange={(v) => update((c) => { c.ui.formLayout = v; })} /></Field>
        <Field label="Button style"><Segmented label="Button style" disabled={disabled} value={config.ui.buttonStyle} options={BUTTON_STYLES} onChange={(v) => update((c) => { c.ui.buttonStyle = v; })} /></Field>
        <Field label="Border radius"><Segmented label="Border radius" disabled={disabled} value={config.ui.radius} options={RADIUS_OPTIONS} onChange={(v) => update((c) => { c.ui.radius = v; })} /></Field>
        <Field label="Typography family"><Segmented label="Font" disabled={disabled} value={config.ui.fontFamily} options={FONT_FAMILIES} onChange={(v) => update((c) => { c.ui.fontFamily = v; })} /></Field>
        <Field label="Text scale"><Segmented label="Font size" disabled={disabled} value={config.ui.fontScale} options={FONT_SCALES} onChange={(v) => update((c) => { c.ui.fontScale = v; })} /></Field>
        <Field label="Background style"><Segmented label="Background style" disabled={disabled} value={config.ui.background} options={BACKGROUND_STYLES} onChange={(v) => update((c) => { c.ui.background = v; })} /></Field>
        <Field label="Spacing density"><Segmented label="Spacing" disabled={disabled} value={config.ui.spacing} options={SPACINGS} onChange={(v) => update((c) => { c.ui.spacing = v; })} /></Field>
        <Field label="Portal theme mode" hint="'Auto' adapts to the subscriber's device setting."><Segmented label="Colour mode" disabled={disabled} value={config.ui.colorMode} options={COLOR_MODES} onChange={(v) => update((c) => { c.ui.colorMode = v; })} /></Field>
      </Card>
    ),

    login: (
      <Card title="Subscriber Access & Login Options" description="Configure how subscribers purchase access or sign in on the hotspot portal.">
        {e("authMethods") && <p role="alert" className="text-xs font-medium text-danger">{e("authMethods")}</p>}
        <div className="space-y-3.5">
          <Toggle
            label="Buy Package (M-Pesa Express / STK Push)"
            description="Customers select a hotspot package and pay directly from their phone."
            checked={config.authMethods.mpesa}
            disabled={disabled}
            onChange={(v) => {
              update((c) => { c.authMethods.mpesa = v; });
              updateDemoSetting("mpesaExpressEnabled", v);
            }}
          />
          <Toggle
            label="Voucher Code Login"
            description="Customers enter a prepaid voucher code to activate internet access."
            checked={config.authMethods.voucher}
            disabled={disabled}
            onChange={(v) => {
              update((c) => { c.authMethods.voucher = v; });
              updateDemoSetting("voucherRedemptionEnabled", v);
            }}
          />
          {data.isDemo ? (
            <>
              <Toggle
                label="Account Login (Username / Password)"
                description="Allow existing PPPoE or hotspot subscribers to sign in with their credentials."
                checked={demoSettings.enableAccountLogin}
                disabled={disabled}
                onChange={(v) => updateDemoSetting("enableAccountLogin", v)}
              />
              <Toggle
                label="Complimentary Free Trial Option"
                description={`Offer a ${demoSettings.freeTrialMinutes}-minute trial pass for first-time guest devices.`}
                checked={demoSettings.enableFreeTrial}
                disabled={disabled}
                onChange={(v) => updateDemoSetting("enableFreeTrial", v)}
              />
            </>
          ) : (
            data.methods
              .filter((m) => !m.supported)
              .map((m) => (
                <div key={m.id} className="flex items-start gap-3 opacity-70">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <div className="text-sm font-medium text-foreground">{m.label}</div>
                    <div className="text-[11px] text-muted-foreground">{m.reason}</div>
                  </div>
                </div>
              ))
          )}
        </div>
        <div className="border-t border-border pt-4">
          <h4 className="mb-2 text-xs font-semibold text-foreground">M-Pesa Checkout Copy</h4>
          <div className="space-y-3">
            <Field label="Payment instructions" htmlFor="pi" error={e("payment.instructions")} hint="Displayed beneath the M-Pesa phone number input.">
              <textarea id="pi" rows={2} maxLength={280} className={inputCls} disabled={disabled} value={config.payment.instructions} onChange={(ev) => update((c) => { c.payment.instructions = ev.target.value; })} />
            </Field>
            <Field label="Payment confirmation message" htmlFor="pcm" error={e("payment.confirmation")} hint="Displayed once M-Pesa payment verification succeeds.">
              <textarea id="pcm" rows={2} maxLength={280} className={inputCls} disabled={disabled} value={config.payment.confirmation} onChange={(ev) => update((c) => { c.payment.confirmation = ev.target.value; })} />
            </Field>
          </div>
        </div>
      </Card>
    ),

    packages: (
      <>
        <Card title="Package Card Presentation" description="Configure package card layout and visible plan attributes.">
          <Field label="Card layout"><Segmented label="Package layout" disabled={disabled} value={config.packages.layout} options={PACKAGE_LAYOUTS} onChange={(v) => update((c) => { c.packages.layout = v; })} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Toggle label="Show speed" checked={config.packages.showSpeed} disabled={disabled} onChange={(v) => update((c) => { c.packages.showSpeed = v; })} />
            <Toggle label="Show duration" checked={config.packages.showDuration} disabled={disabled} onChange={(v) => update((c) => { c.packages.showDuration = v; })} />
            <Toggle label="Show data limit" checked={config.packages.showData} disabled={disabled} onChange={(v) => update((c) => { c.packages.showData = v; })} />
          </div>
          <Field label="Default CTA button text" htmlFor="dcta" error={e("packages.defaultCta")}>
            <input id="dcta" className={inputCls} maxLength={30} disabled={disabled} value={config.packages.defaultCta} onChange={(ev) => update((c) => { c.packages.defaultCta = ev.target.value; })} />
          </Field>
        </Card>

        <Card
          title="Hotspot Packages"
          description="Add, edit, feature, or hide hotspot packages displayed on the captive portal."
          action={
            data.isDemo && (
              <button
                type="button"
                onClick={() => setShowAddPkg((v) => !v)}
                className={btnClass("primary", "text-xs py-1.5 px-2.5")}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {showAddPkg ? "Close Form" : "Add Demo Package"}
              </button>
            )
          }
        >
          {showAddPkg && data.isDemo && (
            <form
              onSubmit={handleAddDemoPackage}
              className="mb-4 space-y-3 rounded-lg border border-primary/30 bg-primary-soft/40 p-3.5"
            >
              <div className="text-xs font-semibold text-foreground">New Demo Hotspot Package</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Package name" htmlFor="np-name">
                  <input
                    id="np-name"
                    required
                    placeholder="e.g. Weekend Streamer"
                    className={inputCls}
                    value={newPkg.name}
                    onChange={(ev) => setNewPkg((s) => ({ ...s, name: ev.target.value }))}
                  />
                </Field>
                <Field label={`Price (${demoSettings.defaultCurrency})`} htmlFor="np-price">
                  <input
                    id="np-price"
                    type="number"
                    min={1}
                    required
                    className={cn(inputCls, "tabular-nums")}
                    value={newPkg.price}
                    onChange={(ev) => setNewPkg((s) => ({ ...s, price: ev.target.value }))}
                  />
                </Field>
                <Field label="Speed (Mbps)" htmlFor="np-speed">
                  <input
                    id="np-speed"
                    type="number"
                    min={1}
                    max={1000}
                    required
                    className={cn(inputCls, "tabular-nums")}
                    value={newPkg.speedMbps}
                    onChange={(ev) => setNewPkg((s) => ({ ...s, speedMbps: ev.target.value }))}
                  />
                </Field>
                <Field label="Validity duration" htmlFor="np-dur">
                  <select
                    id="np-dur"
                    className={inputCls}
                    value={newPkg.durationSeconds}
                    onChange={(ev) => setNewPkg((s) => ({ ...s, durationSeconds: Number(ev.target.value) }))}
                  >
                    {DURATION_PRESETS.map((d) => (
                      <option key={d.seconds} value={d.seconds}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Highlight badge" htmlFor="np-badge">
                  <select
                    id="np-badge"
                    className={inputCls}
                    value={newPkg.badge}
                    onChange={(ev) => setNewPkg((s) => ({ ...s, badge: ev.target.value }))}
                  >
                    {BADGE_PRESETS.map((b) => (
                      <option key={b} value={b}>
                        {b || "No Badge"}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Short description" htmlFor="np-desc">
                  <input
                    id="np-desc"
                    placeholder="e.g. Fast unlimited browsing & HD video"
                    className={inputCls}
                    value={newPkg.description}
                    onChange={(ev) => setNewPkg((s) => ({ ...s, description: ev.target.value }))}
                  />
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddPkg(false)} className={btnClass("ghost")}>
                  Cancel
                </button>
                <button type="submit" className={btnClass("primary")}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Create Package
                </button>
              </div>
            </form>
          )}

          {data.plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active hotspot packages yet.{" "}
              <Link href="/plans" className="font-medium text-primary hover:underline">
                Create one on the Packages page
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-3">
              {data.plans.map((p) => {
                const ov = config.packages.overrides[p.id] ?? {};
                const set = (patch: Partial<typeof ov>) =>
                  update((c) => {
                    c.packages.overrides[p.id] = { ...(c.packages.overrides[p.id] ?? {}), ...patch };
                  });
                const isEditing = editingPkgId === p.id;
                const displayName = p.name.replace(/^Hotspot\s+/i, "");
                const speedMbps = Math.max(1, Math.round(p.downloadSpeedKbps / 1024));

                return (
                  <li key={p.id} className="space-y-3 rounded-md border border-border bg-surface-subtle/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{displayName}</span>
                            {(ov.badge || ov.featured) && (
                              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                                {ov.badge || "Popular"}
                              </span>
                            )}
                            {ov.hidden && (
                              <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                Hidden
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {demoSettings.defaultCurrency || p.currency || "KES"} {p.price} · {speedMbps} Mbps ·{" "}
                            {formatDurationLabel(p.validityDurationSeconds)} ·{" "}
                            {p.dataLimitMb ? `${p.dataLimitMb} MB` : "Unlimited"}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Toggle
                          label="Featured"
                          checked={Boolean(ov.featured)}
                          disabled={disabled}
                          onChange={(v) => set({ featured: v, badge: v && !ov.badge ? "Popular" : ov.badge })}
                        />
                        <Toggle
                          label="Enabled"
                          checked={!ov.hidden}
                          disabled={disabled}
                          onChange={(v) => set({ hidden: !v })}
                        />
                        {data.isDemo && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingPkgId(isEditing ? null : p.id)}
                              className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground hover:bg-surface-elevated"
                            >
                              <Pencil className="h-3 w-3" aria-hidden="true" />
                              {isEditing ? "Done" : "Edit Specs"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDemoPlan(p.id)}
                              aria-label={`Remove ${displayName}`}
                              className="inline-flex items-center rounded border border-border bg-surface p-1 text-muted-foreground hover:border-danger/40 hover:text-danger"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isEditing && data.isDemo && (
                      <div className="grid gap-3 rounded-md border border-border bg-surface p-3 sm:grid-cols-4">
                        <Field label="Package Name" htmlFor={`nm-${p.id}`}>
                          <input
                            id={`nm-${p.id}`}
                            className={inputCls}
                            value={displayName}
                            onChange={(ev) => handleUpdateDemoPlan(p.id, { name: ev.target.value })}
                          />
                        </Field>
                        <Field label={`Price (${demoSettings.defaultCurrency})`} htmlFor={`pr-${p.id}`}>
                          <input
                            id={`pr-${p.id}`}
                            type="number"
                            min={1}
                            className={cn(inputCls, "tabular-nums")}
                            value={p.price}
                            onChange={(ev) => handleUpdateDemoPlan(p.id, { price: Math.max(1, Number(ev.target.value) || 0) })}
                          />
                        </Field>
                        <Field label="Speed (Mbps)" htmlFor={`sp-${p.id}`}>
                          <input
                            id={`sp-${p.id}`}
                            type="number"
                            min={1}
                            max={1000}
                            className={cn(inputCls, "tabular-nums")}
                            value={speedMbps}
                            onChange={(ev) =>
                              handleUpdateDemoPlan(p.id, {
                                downloadSpeedKbps: Math.max(512, Math.round((Number(ev.target.value) || 1) * 1024)),
                              })
                            }
                          />
                        </Field>
                        <Field label="Validity" htmlFor={`dr-${p.id}`}>
                          <select
                            id={`dr-${p.id}`}
                            className={inputCls}
                            value={p.validityDurationSeconds}
                            onChange={(ev) =>
                              handleUpdateDemoPlan(p.id, { validityDurationSeconds: Number(ev.target.value) })
                            }
                          >
                            {DURATION_PRESETS.map((d) => (
                              <option key={d.seconds} value={d.seconds}>
                                {d.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Badge label" htmlFor={`bdg-${p.id}`}>
                        <select
                          id={`bdg-${p.id}`}
                          className={inputCls}
                          disabled={disabled}
                          value={ov.badge ?? (ov.featured ? "Popular" : "")}
                          onChange={(ev) =>
                            set({
                              badge: ev.target.value || undefined,
                              featured: ev.target.value ? true : ov.featured,
                            })
                          }
                        >
                          {BADGE_PRESETS.map((b) => (
                            <option key={b} value={b}>
                              {b || "None"}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Button text" htmlFor={`cta-${p.id}`}>
                        <input
                          id={`cta-${p.id}`}
                          className={inputCls}
                          maxLength={30}
                          placeholder={config.packages.defaultCta}
                          disabled={disabled}
                          value={ov.cta ?? ""}
                          onChange={(ev) => set({ cta: ev.target.value })}
                        />
                      </Field>
                      <Field label="Short description" htmlFor={`desc-${p.id}`}>
                        <input
                          id={`desc-${p.id}`}
                          className={inputCls}
                          maxLength={120}
                          disabled={disabled}
                          value={ov.description ?? ""}
                          onChange={(ev) => set({ description: ev.target.value })}
                        />
                      </Field>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </>
    ),

    content: (
      <>
        <Card title="Customer Support Contacts" description="Displayed on the portal so subscribers can reach your helpdesk.">
          <Field label="Support prompt" htmlFor="sm" error={e("content.supportMessage")}>
            <input id="sm" className={inputCls} maxLength={200} disabled={disabled} value={config.content.supportMessage} onChange={(ev) => update((c) => { c.content.supportMessage = ev.target.value; })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Support phone number" htmlFor="ph" error={e("content.phone")}><input id="ph" type="tel" className={inputCls} maxLength={20} placeholder="+254712345678" disabled={disabled} value={config.content.phone} onChange={(ev) => update((c) => { c.content.phone = ev.target.value; })} /></Field>
            <Field label="WhatsApp support" htmlFor="wa" error={e("content.whatsapp")}><input id="wa" type="tel" className={inputCls} maxLength={20} placeholder="+254712345678" disabled={disabled} value={config.content.whatsapp} onChange={(ev) => update((c) => { c.content.whatsapp = ev.target.value; })} /></Field>
            <Field label="Support email" htmlFor="em" error={e("content.email")}><input id="em" type="email" className={inputCls} maxLength={254} disabled={disabled} value={config.content.email} onChange={(ev) => update((c) => { c.content.email = ev.target.value; })} /></Field>
            <Field label="Coverage / location label" htmlFor="loc" error={e("content.location")}><input id="loc" className={inputCls} maxLength={160} disabled={disabled} value={config.content.location} onChange={(ev) => update((c) => { c.content.location = ev.target.value; })} /></Field>
          </div>
        </Card>
        <Card title="Social Media Links" description="Optional https:// links shown in the support card.">
          <div className="grid gap-4 sm:grid-cols-2">
            {(["facebook", "instagram", "x", "website"] as const).map((k) => (
              <Field key={k} label={k === "x" ? "X (Twitter)" : k[0].toUpperCase() + k.slice(1)} htmlFor={`soc-${k}`} error={e(`content.social.${k}`)}>
                <input id={`soc-${k}`} type="url" className={inputCls} maxLength={500} placeholder="https://" disabled={disabled} value={config.content.social[k]} onChange={(ev) => update((c) => { c.content.social[k] = ev.target.value; })} />
              </Field>
            ))}
          </div>
        </Card>
        <Card title="Terms & Privacy Policy" description="Opened in a modal dialog from the portal footer.">
          <Field label="Terms & Conditions" htmlFor="tc" error={e("content.terms")}><textarea id="tc" rows={4} maxLength={4000} className={inputCls} disabled={disabled} value={config.content.terms} onChange={(ev) => update((c) => { c.content.terms = ev.target.value; })} /></Field>
          <Field label="Privacy Policy" htmlFor="pp" error={e("content.privacy")}><textarea id="pp" rows={4} maxLength={4000} className={inputCls} disabled={disabled} value={config.content.privacy} onChange={(ev) => update((c) => { c.content.privacy = ev.target.value; })} /></Field>
        </Card>
      </>
    ),

    settings: (
      <>
        <Card title="Portal Settings" description="Configure currency, session behavior, redirect target, and section visibility.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default currency" htmlFor="st-curr">
              <select
                id="st-curr"
                className={inputCls}
                disabled={disabled}
                value={demoSettings.defaultCurrency}
                onChange={(ev) =>
                  updateDemoSetting("defaultCurrency", ev.target.value as DemoPortalSettings["defaultCurrency"])
                }
              >
                <option value="KES">KES — Kenyan Shilling</option>
                <option value="USD">USD — US Dollar</option>
                <option value="UGX">UGX — Ugandan Shilling</option>
                <option value="TZS">TZS — Tanzanian Shilling</option>
              </select>
            </Field>
            <Field label="Session timeout display" htmlFor="st-to">
              <select
                id="st-to"
                className={inputCls}
                disabled={disabled}
                value={demoSettings.sessionTimeoutDisplay}
                onChange={(ev) => updateDemoSetting("sessionTimeoutDisplay", ev.target.value)}
              >
                <option value="Match Package Validity">Match Package Validity</option>
                <option value="15 Minutes Idle Timeout">15 Minutes Idle Timeout</option>
                <option value="1 Hour Idle Timeout">1 Hour Idle Timeout</option>
                <option value="24 Hours MAC Caching">24 Hours MAC Caching</option>
              </select>
            </Field>
          </div>
          <Field label="Redirect URL after login" htmlFor="st-red" hint="Where subscribers are directed once internet access is activated.">
            <input
              id="st-red"
              type="url"
              className={inputCls}
              disabled={disabled}
              value={demoSettings.redirectUrlAfterLogin}
              onChange={(ev) => updateDemoSetting("redirectUrlAfterLogin", ev.target.value)}
            />
          </Field>
          <div className="grid gap-3 pt-1 sm:grid-cols-3">
            <Toggle
              label="Show support contacts"
              checked={demoSettings.showSupportContact}
              disabled={disabled}
              onChange={(v) => updateDemoSetting("showSupportContact", v)}
            />
            <Toggle
              label="Show Terms & Conditions"
              checked={demoSettings.showTermsAndConditions}
              disabled={disabled}
              onChange={(v) => updateDemoSetting("showTermsAndConditions", v)}
            />
            <Toggle
              label="Show promotional banner"
              checked={demoSettings.showPromotionalBanner}
              disabled={disabled}
              onChange={(v) => {
                updateDemoSetting("showPromotionalBanner", v);
                update((c) => {
                  c.promotions.banner.enabled = v;
                  if (v && !c.promotions.banner.text) {
                    c.promotions.banner.text = "Instant M-Pesa STK activation — connect in under 5 seconds";
                  }
                });
              }}
            />
          </div>
        </Card>

        <Card title="Payment Simulation Settings" description="Configure M-Pesa STK Push, Paybill display, and instant verification behavior.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Paybill / Till number display" htmlFor="st-pb">
              <input
                id="st-pb"
                className={cn(inputCls, "font-mono")}
                maxLength={20}
                disabled={disabled}
                value={demoSettings.paybillNumber}
                onChange={(ev) => updateDemoSetting("paybillNumber", ev.target.value)}
              />
            </Field>
            <Field label="Account reference prefix" htmlFor="st-ref">
              <input
                id="st-ref"
                className={cn(inputCls, "font-mono")}
                maxLength={20}
                disabled={disabled}
                value={demoSettings.accountReferenceFormat}
                onChange={(ev) => updateDemoSetting("accountReferenceFormat", ev.target.value)}
              />
            </Field>
          </div>
          <div className="space-y-3 pt-1">
            <Toggle
              label="M-Pesa Express / STK Push"
              description="Send an automated M-Pesa PIN prompt to the subscriber's phone."
              checked={demoSettings.mpesaExpressEnabled}
              disabled={disabled}
              onChange={(v) => {
                updateDemoSetting("mpesaExpressEnabled", v);
                update((c) => { c.authMethods.mpesa = v; });
              }}
            />
            <Toggle
              label="Voucher code redemption"
              description="Allow subscribers to redeem batch-printed hotspot voucher codes."
              checked={demoSettings.voucherRedemptionEnabled}
              disabled={disabled}
              onChange={(v) => {
                updateDemoSetting("voucherRedemptionEnabled", v);
                update((c) => { c.authMethods.voucher = v; });
              }}
            />
            <Toggle
              label="Auto-approve Demo payments"
              description="Automatically confirm simulated M-Pesa STK pushes in under 1 second during Demo testing."
              checked={demoSettings.demoAutoApprovePayment}
              disabled={disabled}
              onChange={(v) => updateDemoSetting("demoAutoApprovePayment", v)}
            />
          </div>
        </Card>

        <Card title="Notification Preview Settings" description="Customize the confirmation messages shown during subscriber onboarding.">
          <Field label="Payment confirmation message" htmlFor="st-pcm">
            <input
              id="st-pcm"
              className={inputCls}
              maxLength={200}
              disabled={disabled}
              value={demoSettings.paymentConfirmationMessage}
              onChange={(ev) => {
                updateDemoSetting("paymentConfirmationMessage", ev.target.value);
                update((c) => { c.messages.paymentSuccess = ev.target.value; });
              }}
            />
          </Field>
          <Field label="Voucher activation message" htmlFor="st-vam">
            <input
              id="st-vam"
              className={inputCls}
              maxLength={200}
              disabled={disabled}
              value={demoSettings.voucherActivationMessage}
              onChange={(ev) => {
                updateDemoSetting("voucherActivationMessage", ev.target.value);
                update((c) => { c.messages.loginSuccess = ev.target.value; });
              }}
            />
          </Field>
          <Field label="Support card headline" htmlFor="st-sbm">
            <input
              id="st-sbm"
              className={inputCls}
              maxLength={200}
              disabled={disabled}
              value={demoSettings.supportBannerMessage}
              onChange={(ev) => {
                updateDemoSetting("supportBannerMessage", ev.target.value);
                update((c) => { c.content.supportMessage = ev.target.value; });
              }}
            />
          </Field>
        </Card>
      </>
    ),

    messages: (
      <Card title="Portal Status Messages" description="Customize feedback messages for login, voucher, payment, and session events.">
        {(
          [
            ["loginSuccess", "Login success"],
            ["loginFailure", "Login failure"],
            ["sessionExpired", "Session expired"],
            ["connectionSuccess", "Connection successful"],
            ["connectionFailed", "Connection failed"],
            ["voucherInvalid", "Voucher invalid"],
            ["packageExpired", "Package expired"],
            ["paymentSuccess", "Payment successful"],
            ["paymentFailed", "Payment failed"],
          ] as const
        ).map(([k, label]) => (
          <Field key={k} label={label} htmlFor={`msg-${k}`} error={e(`messages.${k}`)}>
            <input id={`msg-${k}`} className={inputCls} maxLength={200} disabled={disabled} value={config.messages[k]} onChange={(ev) => update((c) => { c.messages[k] = ev.target.value; })} />
          </Field>
        ))}
      </Card>
    ),

    promos: (
      <>
        <Card title="Top Promotional Banner" description="Highlight special offers or speed upgrades at the top of the portal.">
          <Toggle
            label="Enable top banner"
            checked={config.promotions.banner.enabled}
            disabled={disabled}
            onChange={(v) => {
              update((c) => { c.promotions.banner.enabled = v; });
              updateDemoSetting("showPromotionalBanner", v);
            }}
          />
          <Field label="Banner text" htmlFor="bt" error={e("promotions.banner.text")}><input id="bt" className={inputCls} maxLength={160} disabled={disabled} value={config.promotions.banner.text} onChange={(ev) => update((c) => { c.promotions.banner.text = ev.target.value; })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Button text" htmlFor="bct"><input id="bct" className={inputCls} maxLength={30} disabled={disabled} value={config.promotions.banner.ctaText} onChange={(ev) => update((c) => { c.promotions.banner.ctaText = ev.target.value; })} /></Field>
            <Field label="Button link" htmlFor="bcu" error={e("promotions.banner.ctaUrl")}><input id="bcu" type="url" placeholder="https://" className={inputCls} disabled={disabled} value={config.promotions.banner.ctaUrl} onChange={(ev) => update((c) => { c.promotions.banner.ctaUrl = ev.target.value; })} /></Field>
          </div>
        </Card>
        <Card title="Announcement Callout">
          <Toggle label="Enable announcement" checked={config.promotions.announcement.enabled} disabled={disabled} onChange={(v) => update((c) => { c.promotions.announcement.enabled = v; })} />
          <Field label="Announcement text" htmlFor="at" error={e("promotions.announcement.text")}><textarea id="at" rows={2} maxLength={240} className={inputCls} disabled={disabled} value={config.promotions.announcement.text} onChange={(ev) => update((c) => { c.promotions.announcement.text = ev.target.value; })} /></Field>
        </Card>
        <Card title="Featured Offer Card">
          <Toggle label="Enable featured offer" checked={config.promotions.featuredOffer.enabled} disabled={disabled} onChange={(v) => update((c) => { c.promotions.featuredOffer.enabled = v; })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Offer title" htmlFor="fot" error={e("promotions.featuredOffer.title")}><input id="fot" className={inputCls} maxLength={60} disabled={disabled} value={config.promotions.featuredOffer.title} onChange={(ev) => update((c) => { c.promotions.featuredOffer.title = ev.target.value; })} /></Field>
            <Field label="Offer details" htmlFor="fod"><input id="fod" className={inputCls} maxLength={160} disabled={disabled} value={config.promotions.featuredOffer.text} onChange={(ev) => update((c) => { c.promotions.featuredOffer.text = ev.target.value; })} /></Field>
            <Field label="Button text" htmlFor="foc"><input id="foc" className={inputCls} maxLength={30} disabled={disabled} value={config.promotions.featuredOffer.ctaText} onChange={(ev) => update((c) => { c.promotions.featuredOffer.ctaText = ev.target.value; })} /></Field>
            <Field label="Button link" htmlFor="fou" error={e("promotions.featuredOffer.ctaUrl")}><input id="fou" type="url" placeholder="https://" className={inputCls} disabled={disabled} value={config.promotions.featuredOffer.ctaUrl} onChange={(ev) => update((c) => { c.promotions.featuredOffer.ctaUrl = ev.target.value; })} /></Field>
          </div>
        </Card>
        <Card title="Promotional Graphic">
          <Toggle label="Enable promotional image" checked={config.promotions.adImage.enabled} disabled={disabled} onChange={(v) => update((c) => { c.promotions.adImage.enabled = v; })} />
          <ImageUpload kind="promo" label="Image" isDemo={data.isDemo} value={config.promotions.adImage.imageUrl} disabled={disabled} error={e("promotions.adImage.imageUrl")} onChange={(u) => update((c) => { c.promotions.adImage.imageUrl = u; })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Alternative text" htmlFor="aia" error={e("promotions.adImage.alt")} hint="Describes the image for screen readers."><input id="aia" className={inputCls} maxLength={120} disabled={disabled} value={config.promotions.adImage.alt} onChange={(ev) => update((c) => { c.promotions.adImage.alt = ev.target.value; })} /></Field>
            <Field label="Link (optional)" htmlFor="ail" error={e("promotions.adImage.linkUrl")}><input id="ail" type="url" placeholder="https://" className={inputCls} disabled={disabled} value={config.promotions.adImage.linkUrl} onChange={(ev) => update((c) => { c.promotions.adImage.linkUrl = ev.target.value; })} /></Field>
          </div>
        </Card>
        <Card title="Sponsored Notice">
          <Toggle label="Enable sponsored notice" checked={config.promotions.sponsored.enabled} disabled={disabled} onChange={(v) => update((c) => { c.promotions.sponsored.enabled = v; })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Label" htmlFor="spl"><input id="spl" className={inputCls} maxLength={30} disabled={disabled} value={config.promotions.sponsored.label} onChange={(ev) => update((c) => { c.promotions.sponsored.label = ev.target.value; })} /></Field>
            <Field label="Link (optional)" htmlFor="spu" error={e("promotions.sponsored.linkUrl")}><input id="spu" type="url" placeholder="https://" className={inputCls} disabled={disabled} value={config.promotions.sponsored.linkUrl} onChange={(ev) => update((c) => { c.promotions.sponsored.linkUrl = ev.target.value; })} /></Field>
          </div>
          <Field label="Text" htmlFor="spt" error={e("promotions.sponsored.text")}><input id="spt" className={inputCls} maxLength={160} disabled={disabled} value={config.promotions.sponsored.text} onChange={(ev) => update((c) => { c.promotions.sponsored.text = ev.target.value; })} /></Field>
        </Card>
      </>
    ),
  };

  return (
    <div className="space-y-4">
      {/* Workflow bar: EDIT → PREVIEW → SAVE DRAFT → TEST → PUBLISH */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {data.isDemo && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Interactive Demo Mode
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium",
              dirty ? "border-warning/40 bg-warning-soft text-warning" : "border-border bg-surface-subtle text-muted-foreground"
            )}
          >
            {dirty && <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />}
            {statusText}
          </span>
          {data.isDemo && (
            <span className="text-muted-foreground">
              Changes apply to your isolated Demo session and live preview.
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.isDemo && (
            <button type="button" onClick={handleResetDemo} disabled={busy !== null} className={btnClass("ghost")}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset Demo
            </button>
          )}
          {dirty && (
            <button type="button" onClick={cancelChanges} disabled={busy !== null} className={btnClass("ghost")}>
              <Undo2 className="h-4 w-4" aria-hidden="true" /> Discard
            </button>
          )}
          <button type="button" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory} className={btnClass("secondary")}>
            <History className="h-4 w-4" aria-hidden="true" /> History
          </button>
          <button type="button" onClick={saveDraft} disabled={disabled || !dirty || hasErrors} className={btnClass("secondary")}>
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            Save Draft
          </button>
          <Link
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={btnClass("secondary")}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> {data.isDemo ? "Open Demo Portal" : "View Portal"}
          </Link>
          <button
            type="button"
            onClick={() => (data.isDemo ? publish() : setConfirmPublish(true))}
            disabled={disabled || hasErrors}
            className={btnClass("primary")}
          >
            {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Rocket className="h-4 w-4" aria-hidden="true" />}
            {data.isDemo ? "Publish to Demo" : "Publish"}
          </button>
        </div>
      </div>

      {toast && (
        <div
          role={toast.kind === "error" ? "alert" : "status"}
          className={cn(
            "rounded-md border px-3 py-2 text-sm font-medium",
            toast.kind === "error" ? "border-danger/30 bg-danger-soft text-danger" : "border-success/30 bg-success-soft text-success"
          )}
        >
          {toast.text}
        </div>
      )}

      {showHistory && (
        <Card title="Version History" description="Restore a previous portal version into your draft at any time.">
          {data.versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved versions yet.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {data.versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-foreground">Version {v.version}</span>{" "}
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", v.status === "PUBLISHED" ? "bg-success-soft text-success" : v.status === "DRAFT" ? "bg-warning-soft text-warning" : "bg-surface-elevated text-muted-foreground")}>{v.status}</span>
                    <div className="text-xs text-muted-foreground">
                      {new Date(v.publishedAt ?? v.createdAt).toLocaleString("en-KE")}
                    </div>
                  </div>
                  <button type="button" disabled={disabled || v.status === "DRAFT"} onClick={() => restore(v.version)} className={btnClass("secondary")}>
                    Restore as draft
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {confirmPublish && (
        <div role="dialog" aria-modal="true" aria-label="Confirm publish" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onKeyDown={(ev) => ev.key === "Escape" && setConfirmPublish(false)}>
          <div className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-surface p-5 shadow-pop">
            <h3 className="text-sm font-semibold text-foreground">Publish this design?</h3>
            <p className="text-xs text-muted-foreground">
              Your live captive portal will switch to this design immediately. Previous versions remain in History.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" autoFocus className={btnClass("secondary")} onClick={() => setConfirmPublish(false)}>Cancel</button>
              <button type="button" className={btnClass("primary")} onClick={publish}>Publish now</button>
            </div>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning" role="note">
          <div className="mb-1 flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Design Recommendations</div>
          <ul className="list-disc space-y-0.5 pl-5">{warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* EDITOR */}
        <div className="space-y-4">
          <div role="tablist" aria-label="Designer sections" className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1 shadow-xs">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const on = section === s.id;
              const hasErr = Object.keys(errors).some((k) => sectionOfError(k) === s.id);
              return (
                <button
                  key={s.id}
                  role="tab"
                  type="button"
                  aria-selected={on}
                  onClick={() => setSection(s.id)}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {s.label}
                  {hasErr && <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-label="has errors" />}
                </button>
              );
            })}
          </div>
          <div role="tabpanel" className="space-y-4">{body[section]}</div>
        </div>

        {/* LIVE PREVIEW */}
        <div className="space-y-3 xl:sticky xl:top-2">
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 shadow-xs">
            <span className="text-xs font-semibold text-foreground">Live Interactive Preview</span>
            <div role="radiogroup" aria-label="Preview device" className="flex gap-1">
              {DEVICES.map((d) => {
                const Icon = d.icon;
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="radio"
                    aria-checked={device === d.id}
                    onClick={() => setDevice(d.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                      device === d.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {d.label}
                  </button>
                );
              })}
            </div>
          </div>
          <PreviewFrame
            config={{ ...validation.config, branding: { ...validation.config.branding, logoUrl: config.branding.logoUrl, faviconUrl: config.branding.faviconUrl, backgroundImageUrl: config.branding.backgroundImageUrl } }}
            plans={data.plans}
            device={device}
            demoSettings={data.isDemo ? demoSettings : undefined}
            isDemo={data.isDemo}
          />
          <p className="text-center text-[11px] text-muted-foreground">
            Interactive preview — click any package or test M-Pesa &amp; voucher activation directly inside the frame.
          </p>
        </div>
      </div>
    </div>
  );
}

function sectionOfError(path: string): SectionId {
  if (path.startsWith("branding")) return "branding";
  if (path.startsWith("ui")) return "design";
  if (path.startsWith("authMethods") || path.startsWith("payment")) return "login";
  if (path.startsWith("packages")) return "packages";
  if (path.startsWith("content")) return "content";
  if (path.startsWith("messages")) return "messages";
  if (path.startsWith("promotions")) return "promos";
  return "template";
}
