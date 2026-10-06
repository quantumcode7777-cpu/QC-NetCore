"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Globe,
  Sliders,
  UserCheck,
  Save,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Sun,
  Moon,
  LogOut,
  KeyRound,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, btnClass } from "@/components/ui/PageHeader";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useAuth } from "@/lib/auth/auth-context";
import { sanitizeUserMessage } from "@/lib/supabase/errors";
import {
  BILLING_CYCLE_TYPES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIMEZONES,
  validateOrganizationSettingsInput,
  type BillingCycleType,
  type OrganizationSettingsInput,
  type SupportedCurrency,
} from "@/lib/settings-validation";
import {
  ALLOWED_PAGE_SIZES,
  usePageSize,
  type PageSizeOption,
} from "@/lib/preferences";
import { cn, formatShortDate } from "@/lib/utils";
import type { OrganizationRow } from "@/types/database.types";
import { AccountPhoneSettingsCard } from "@/components/settings/AccountPhoneSettingsCard";

interface SettingsFormState {
  name: string;
  business_number: string;
  email: string;
  phone: string;
  currency: SupportedCurrency;
  timezone: string;
  billing_cycle_type: BillingCycleType;
  grace_period_days: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Administrator",
  isp_owner: "Owner",
  isp_admin: "Administrator",
  finance: "Finance",
  support: "Support",
  technician: "Technician",
  agent: "Agent",
  customer: "Subscriber",
  demo_viewer: "Demo Viewer",
};

function formatRoleLabel(role?: string | null, isDemo?: boolean): string {
  if (role && ROLE_LABELS[role]) return ROLE_LABELS[role];
  if (isDemo) return "Demo Viewer";
  if (!role) return "Administrator";
  return role.replace(/_/g, " ");
}

function orgToFormState(org: OrganizationRow): SettingsFormState {
  const currencyUpper = (org.currency || "KES").toUpperCase();
  const currency: SupportedCurrency = SUPPORTED_CURRENCIES.includes(
    currencyUpper as SupportedCurrency
  )
    ? (currencyUpper as SupportedCurrency)
    : "KES";

  const billingCycle: BillingCycleType = BILLING_CYCLE_TYPES.includes(
    org.billing_cycle_type as BillingCycleType
  )
    ? (org.billing_cycle_type as BillingCycleType)
    : "ANNIVERSARY";

  return {
    name: org.name ?? "",
    business_number: org.business_number ?? "",
    email: org.email ?? "",
    phone: org.phone ?? "",
    currency,
    timezone: org.timezone || "Africa/Nairobi",
    billing_cycle_type: billingCycle,
    grace_period_days: String(org.grace_period_days ?? 2),
  };
}

const inputClass =
  "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-muted-foreground";

export default function SettingsPage() {
  const {
    user,
    profile,
    isDemoMode,
    isLoading: authLoading,
    refreshAuth,
    exitDemoMode,
    signOut,
  } = useAuth();
  const { theme, setTheme } = useTheme();
  const [pageSize, setPageSize] = usePageSize();

  const [savedOrg, setSavedOrg] = useState<OrganizationRow | null>(null);
  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [role, setRole] = useState<string>("operator");
  const [canEdit, setCanEdit] = useState<boolean>(false);
  const [isDemoResponse, setIsDemoResponse] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof OrganizationSettingsInput | "general", string>>
  >({});
  const [banner, setBanner] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);

  const loadSettings = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/v1/settings", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.success || !json.data?.organization) {
        setLoadError(
          sanitizeUserMessage(
            json?.message || json?.error,
            "Unable to load settings. Please try again."
          )
        );
        return;
      }
      const org: OrganizationRow = json.data.organization;
      setSavedOrg(org);
      setForm(orgToFormState(org));
      setRole(json.data.role || "operator");
      setCanEdit(Boolean(json.data.canEdit));
      setIsDemoResponse(Boolean(json.data.isDemo));
      setFieldErrors({});
    } catch (err) {
      console.error("[Settings] load failed:", err);
      setLoadError("Unable to load settings. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    setIsLoading(true);
    loadSettings();
  }, [authLoading, isDemoMode, loadSettings]);

  const baselineForm = useMemo(
    () => (savedOrg ? orgToFormState(savedOrg) : null),
    [savedOrg]
  );

  const isDirty = useMemo(() => {
    if (!form || !baselineForm) return false;
    return (
      form.name.trim() !== baselineForm.name.trim() ||
      form.business_number.trim() !== baselineForm.business_number.trim() ||
      form.email.trim() !== baselineForm.email.trim() ||
      form.phone.trim() !== baselineForm.phone.trim() ||
      form.currency !== baselineForm.currency ||
      form.timezone !== baselineForm.timezone ||
      form.billing_cycle_type !== baselineForm.billing_cycle_type ||
      form.grace_period_days.trim() !== baselineForm.grace_period_days.trim()
    );
  }, [form, baselineForm]);

  const hasSensitiveBillingChange = useMemo(() => {
    if (!form || !baselineForm) return false;
    return (
      form.currency !== baselineForm.currency ||
      form.billing_cycle_type !== baselineForm.billing_cycle_type ||
      form.grace_period_days.trim() !== baselineForm.grace_period_days.trim()
    );
  }, [form, baselineForm]);

  // Warn before closing tab with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const updateField = <K extends keyof SettingsFormState>(
    key: K,
    value: SettingsFormState[K]
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined, general: undefined }));
    setBanner(null);
  };

  const handleDiscard = () => {
    if (!savedOrg) return;
    setForm(orgToFormState(savedOrg));
    setFieldErrors({});
    setBanner(null);
  };

  const buildValidatedPayload = (): OrganizationSettingsInput | null => {
    if (!form) return null;
    const check = validateOrganizationSettingsInput({
      name: form.name,
      business_number: form.business_number.trim() || null,
      email: form.email,
      phone: form.phone,
      currency: form.currency,
      timezone: form.timezone,
      billing_cycle_type: form.billing_cycle_type,
      grace_period_days: Number(form.grace_period_days),
    });
    if (!check.valid || !check.data) {
      setFieldErrors(check.errors);
      setBanner({
        tone: "error",
        text: "Please check the highlighted fields and try again.",
      });
      return null;
    }
    setFieldErrors({});
    return check.data;
  };

  const executeSave = async () => {
    const payload = buildValidatedPayload();
    if (!payload) return;

    setConfirmModalOpen(false);
    setIsSaving(true);
    setBanner(null);

    try {
      const res = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json?.success || !json.data) {
        if (json?.fieldErrors) {
          setFieldErrors(json.fieldErrors);
        }
        setBanner({
          tone: "error",
          text: sanitizeUserMessage(
            json?.message || json?.error,
            "Changes could not be saved. Please try again."
          ),
        });
        return;
      }

      const updated: OrganizationRow = json.data;
      setSavedOrg(updated);
      setForm(orgToFormState(updated));
      setBanner({
        tone: "success",
        text: "Your changes have been saved.",
      });
      await refreshAuth();
    } catch (err) {
      console.error("[Settings] save failed:", err);
      setBanner({
        tone: "error",
        text: "Changes could not be saved. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || isSaving || !isDirty) return;
    const payload = buildValidatedPayload();
    if (!payload) return;

    if (hasSensitiveBillingChange) {
      setConfirmModalOpen(true);
      return;
    }
    await executeSave();
  };

  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.email ? user.email.split("@")[0] : null) ||
    (isDemoResponse ? "Demo Operator" : "Administrator");

  const displayRole = formatRoleLabel(profile?.role || role, isDemoResponse);

  const header = (
    <PageHeader
      title="Settings"
      description="Manage your organization profile, billing rules, workspace preferences, and account."
      actions={
        <button
          type="button"
          onClick={loadSettings}
          disabled={isLoading || isSaving}
          className={btnClass("secondary")}
        >
          <RefreshCw
            className={cn("h-4 w-4", isLoading && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </button>
      }
    />
  );

  if (isLoading || !form || !savedOrg) {
    return (
      <AppShell title="Settings">
        {header}
        {loadError ? (
          <ErrorState
            title="Unable to load settings"
            detail={loadError}
            onRetry={loadSettings}
          />
        ) : (
          <div role="status" aria-label="Loading settings" className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings">
      {header}

      {/* Demo or Read-Only Permission Notice */}
      {isDemoResponse ? (
        <div
          role="region"
          aria-label="Demo mode notice"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary-soft/50 px-4 py-3 text-sm"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div>
              <div className="font-semibold text-foreground">
                Interactive Demo Mode
              </div>
              <p className="text-xs text-muted-foreground">
                Workspace preferences apply immediately in your browser. Sign in to manage live organization settings.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={exitDemoMode}
            className={btnClass("secondary")}
          >
            Sign in to live account
          </button>
        </div>
      ) : !canEdit ? (
        <div
          role="region"
          aria-label="Permission notice"
          className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-3 text-xs text-muted-foreground"
        >
          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            Your role (<strong className="font-medium text-foreground">{displayRole}</strong>) has view-only access to organization settings. Only organization owners and administrators can modify these settings.
          </span>
        </div>
      ) : null}

      {banner && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
            banner.tone === "success"
              ? "border-success/30 bg-success-soft text-success"
              : "border-danger/30 bg-danger-soft text-danger"
          )}
        >
          {banner.tone === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Columns: Organization & Billing Settings */}
        <div className="space-y-6 lg:col-span-2">
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* Section 1: Organization Profile */}
            <section className="rounded-lg border border-border bg-surface shadow-xs">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      Organization profile
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Business details displayed across your console, invoices, and subscriber communications.
                    </p>
                  </div>
                </div>
                {isDirty && canEdit && (
                  <span className="rounded-md border border-warning/30 bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
                    Unsaved changes
                  </span>
                )}
              </header>

              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="org-name"
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    ISP business name
                  </label>
                  <input
                    id="org-name"
                    type="text"
                    disabled={!canEdit || isSaving}
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    className={inputClass}
                    required
                  />
                  {fieldErrors.name && (
                    <p className="mt-1 text-xs text-danger">{fieldErrors.name}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="org-slug"
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    Workspace identifier
                  </label>
                  <input
                    id="org-slug"
                    type="text"
                    disabled
                    value={savedOrg.slug}
                    className={cn(inputClass, "font-mono")}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Assigned when your organization was registered.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="org-email"
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    Support email
                  </label>
                  <input
                    id="org-email"
                    type="email"
                    disabled={!canEdit || isSaving}
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className={inputClass}
                    required
                  />
                  {fieldErrors.email && (
                    <p className="mt-1 text-xs text-danger">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="org-phone"
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    Support phone
                  </label>
                  <input
                    id="org-phone"
                    type="tel"
                    disabled={!canEdit || isSaving}
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className={inputClass}
                    required
                  />
                  {fieldErrors.phone && (
                    <p className="mt-1 text-xs text-danger">{fieldErrors.phone}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="org-business-number"
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    Paybill / business registration number
                  </label>
                  <input
                    id="org-business-number"
                    type="text"
                    disabled={!canEdit || isSaving}
                    value={form.business_number}
                    onChange={(e) => updateField("business_number", e.target.value)}
                    placeholder="e.g. 4084200"
                    className={cn(inputClass, "font-mono")}
                  />
                  {fieldErrors.business_number ? (
                    <p className="mt-1 text-xs text-danger">
                      {fieldErrors.business_number}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Shown on subscriber payment instructions and billing receipts.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Section 2: Regional & Billing Parameters */}
            <section className="rounded-lg border border-border bg-surface shadow-xs">
              <header className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Regional &amp; billing policy
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Default currency, timezone, and subscription renewal rules for your organization.
                  </p>
                </div>
              </header>

              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="org-currency"
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    Default currency
                  </label>
                  <select
                    id="org-currency"
                    disabled={!canEdit || isSaving}
                    value={form.currency}
                    onChange={(e) =>
                      updateField("currency", e.target.value as SupportedCurrency)
                    }
                    className={inputClass}
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.currency && (
                    <p className="mt-1 text-xs text-danger">{fieldErrors.currency}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="org-timezone"
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    Operating timezone
                  </label>
                  <select
                    id="org-timezone"
                    disabled={!canEdit || isSaving}
                    value={form.timezone}
                    onChange={(e) => updateField("timezone", e.target.value)}
                    className={inputClass}
                  >
                    {SUPPORTED_TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.timezone && (
                    <p className="mt-1 text-xs text-danger">{fieldErrors.timezone}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="org-billing-cycle"
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    Billing cycle mode
                  </label>
                  <select
                    id="org-billing-cycle"
                    disabled={!canEdit || isSaving}
                    value={form.billing_cycle_type}
                    onChange={(e) =>
                      updateField(
                        "billing_cycle_type",
                        e.target.value as BillingCycleType
                      )
                    }
                    className={inputClass}
                  >
                    <option value="ANNIVERSARY">
                      Anniversary (renews from activation date)
                    </option>
                    <option value="CALENDAR_MONTH">
                      Calendar month (resets on the 1st)
                    </option>
                  </select>
                  {fieldErrors.billing_cycle_type && (
                    <p className="mt-1 text-xs text-danger">
                      {fieldErrors.billing_cycle_type}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="org-grace-days"
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    Grace period (days, 0–30)
                  </label>
                  <input
                    id="org-grace-days"
                    type="number"
                    min={0}
                    max={30}
                    step={1}
                    disabled={!canEdit || isSaving}
                    value={form.grace_period_days}
                    onChange={(e) =>
                      updateField("grace_period_days", e.target.value)
                    }
                    className={cn(inputClass, "tabular")}
                  />
                  {fieldErrors.grace_period_days && (
                    <p className="mt-1 text-xs text-danger">
                      {fieldErrors.grace_period_days}
                    </p>
                  )}
                </div>
              </div>

              {/* Form Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                <div className="text-xs text-muted-foreground">
                  Last updated: {formatShortDate(savedOrg.updated_at)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDiscard}
                    disabled={!isDirty || isSaving}
                    className={btnClass("secondary")}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={!canEdit || !isDirty || isSaving}
                    className={btnClass("primary")}
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    {isSaving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            </section>
          </form>
        </div>

        {/* Right Column: Workspace Preferences + Account & Session */}
        <div className="space-y-6">
          {/* Section 3: Operator Workspace Preferences */}
          <section className="rounded-lg border border-border bg-surface shadow-xs">
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Sliders className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Workspace preferences
                </h2>
                <p className="text-xs text-muted-foreground">
                  Display and table settings applied immediately on this device.
                </p>
              </div>
            </header>

            <div className="space-y-4 p-4">
              <div>
                <div className="mb-1.5 text-xs font-medium text-foreground">
                  Appearance
                </div>
                <div
                  role="group"
                  aria-label="Appearance"
                  className="grid grid-cols-2 gap-2"
                >
                  <button
                    type="button"
                    aria-pressed={theme === "light"}
                    onClick={() => setTheme("light")}
                    className={cn(
                      "flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors",
                      theme === "light"
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-surface text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Sun className="h-4 w-4" aria-hidden="true" />
                    Light
                  </button>
                  <button
                    type="button"
                    aria-pressed={theme === "dark"}
                    onClick={() => setTheme("dark")}
                    className={cn(
                      "flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors",
                      theme === "dark"
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-surface text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Moon className="h-4 w-4" aria-hidden="true" />
                    Dark
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="pref-page-size"
                  className="mb-1.5 block text-xs font-medium text-foreground"
                >
                  Default table rows per page
                </label>
                <select
                  id="pref-page-size"
                  value={pageSize}
                  onChange={(e) =>
                    setPageSize(Number(e.target.value) as PageSizeOption)
                  }
                  className={inputClass}
                >
                  {ALLOWED_PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size} rows per page
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Used for{" "}
                  <Link href="/customers" className="text-primary hover:underline">
                    Subscribers
                  </Link>{" "}
                  and{" "}
                  <Link href="/billing" className="text-primary hover:underline">
                    Payments
                  </Link>{" "}
                  tables.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Account & Session */}
          <section className="rounded-lg border border-border bg-surface shadow-xs">
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              <UserCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Account &amp; session
                </h2>
                <p className="text-xs text-muted-foreground">
                  Signed-in operator identity and security actions.
                </p>
              </div>
            </header>

            <div className="space-y-3 p-4 text-xs">
              <div className="rounded-md border border-border bg-surface-subtle p-3 space-y-1">
                <div className="text-sm font-semibold text-foreground">
                  {displayName}
                </div>
                <div className="text-muted-foreground">{displayRole}</div>
                {user?.email && (
                  <div className="truncate text-muted-foreground">{user.email}</div>
                )}
              </div>

              <AccountPhoneSettingsCard />

              <div className="flex flex-col gap-2 pt-1">
                {!isDemoResponse && (
                  <Link
                    href="/forgot-password"
                    className={cn(btnClass("secondary"), "w-full justify-center")}
                  >
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                    Reset password
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => signOut()}
                  className={cn(btnClass("secondary"), "w-full justify-center text-danger hover:bg-danger-soft")}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Confirmation Modal for Currency / Billing Policy Changes */}
      {confirmModalOpen && baselineForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-billing-title"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-pop)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
                <h3
                  id="confirm-billing-title"
                  className="text-sm font-semibold text-foreground"
                >
                  Confirm billing policy change
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                aria-label="Close confirmation dialog"
                className="rounded-md p-1 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              You are updating your organization&apos;s billing policy. Please review the changes before saving:
            </p>

            <ul className="mt-3 space-y-1.5 rounded-md border border-border bg-surface-subtle p-3 text-xs">
              {form.currency !== baselineForm.currency && (
                <li>
                  Currency:{" "}
                  <strong className="font-mono text-foreground">
                    {baselineForm.currency}
                  </strong>{" "}
                  →{" "}
                  <strong className="font-mono text-primary">
                    {form.currency}
                  </strong>
                </li>
              )}
              {form.billing_cycle_type !== baselineForm.billing_cycle_type && (
                <li>
                  Billing cycle:{" "}
                  <strong className="font-mono text-foreground">
                    {baselineForm.billing_cycle_type}
                  </strong>{" "}
                  →{" "}
                  <strong className="font-mono text-primary">
                    {form.billing_cycle_type}
                  </strong>
                </li>
              )}
              {form.grace_period_days.trim() !==
                baselineForm.grace_period_days.trim() && (
                <li>
                  Grace period:{" "}
                  <strong className="font-mono text-foreground">
                    {baselineForm.grace_period_days} days
                  </strong>{" "}
                  →{" "}
                  <strong className="font-mono text-primary">
                    {form.grace_period_days} days
                  </strong>
                </li>
              )}
            </ul>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className={btnClass("secondary")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeSave}
                disabled={isSaving}
                className={btnClass("primary")}
              >
                {isSaving ? "Saving…" : "Confirm & save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
