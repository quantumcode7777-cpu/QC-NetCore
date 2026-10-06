"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wifi, Sliders, RotateCcw, Sparkles } from "lucide-react";
import { PortalRenderer } from "@/components/captive/PortalRenderer";
import {
  DEFAULT_DEMO_HOTSPOT_PLANS,
  getDefaultDemoPortalConfig,
  type PlanLike,
  type PortalConfig,
} from "@/lib/captive/config";
import {
  DEMO_CAPTIVE_EVENT,
  loadDemoCaptiveState,
  resetDemoCaptiveState,
  type DemoPortalSettings,
} from "@/lib/captive/demo-state";

interface PortalPayload {
  config: PortalConfig;
  plans: PlanLike[];
  methods: string[];
  organizationName: string;
  isDraftPreview: boolean;
  isDemo: boolean;
  demoSettings?: DemoPortalSettings;
}

/**
 * Public hotspot captive portal.
 *   /captive?org=<slug>                → that ISP's PUBLISHED design
 *   /captive?org=<slug>&preview=draft  → the signed-in admin's own DRAFT ("Test" step)
 *   /captive (or ?demo=true)           → Interactive QC NetCore Captive Portal Demo
 */
export default function CaptivePortalPage() {
  const [data, setData] = useState<PortalPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState(false);

  const applyLocalDemoState = useCallback((wantsDraft: boolean, orgNameFallback = "QC NetCore") => {
    const demoState = loadDemoCaptiveState(orgNameFallback);
    setData({
      config: wantsDraft ? demoState.draft : demoState.published,
      plans: demoState.plans.length > 0 ? demoState.plans : DEFAULT_DEMO_HOTSPOT_PLANS,
      methods: ["voucher", "mpesa"],
      organizationName: (wantsDraft ? demoState.draft : demoState.published).branding.businessName || orgNameFallback,
      isDraftPreview: wantsDraft,
      isDemo: true,
      demoSettings: demoState.settings,
    });
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams(window.location.search);
    const org = params.get("org");
    const wantsDraft = params.get("preview") === "draft";
    const explicitDemo = params.get("demo") === "true" || !org || org === "nexanet-technologies";

    (async () => {
      try {
        if (wantsDraft) {
          const res = await fetch("/api/v1/captive/config", { signal: ctrl.signal, cache: "no-store" });
          const json = await res.json();
          if (json?.success) {
            if (json.data.isDemo) {
              applyLocalDemoState(true, json.data.organization?.name);
              return;
            }
            setData({
              config: json.data.draft ?? getDefaultDemoPortalConfig(json.data.organization?.name),
              plans: json.data.plans?.length ? json.data.plans : DEFAULT_DEMO_HOTSPOT_PLANS,
              methods: ["voucher", "mpesa"],
              organizationName: json.data.organization?.name ?? "",
              isDraftPreview: true,
              isDemo: Boolean(json.data.isDemo),
            });
            return;
          }
          applyLocalDemoState(true);
          return;
        }

        const res = await fetch(`/api/v1/captive/public${org ? `?org=${encodeURIComponent(org)}` : "?demo=true"}`, {
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!json?.success) {
          if (explicitDemo) {
            applyLocalDemoState(false);
            return;
          }
          setError(json?.message ?? "This WiFi portal is unavailable.");
          return;
        }
        if (json.data.isDemo || explicitDemo) {
          applyLocalDemoState(false, json.data.organization?.name || "QC NetCore");
          return;
        }
        setData({
          config: json.data.config,
          plans: json.data.plans,
          methods: json.data.methods,
          organizationName: json.data.organization?.name ?? "",
          isDraftPreview: false,
          isDemo: false,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          if (explicitDemo) {
            applyLocalDemoState(wantsDraft);
          } else {
            setError("The WiFi portal could not be loaded. Please try again.");
          }
        }
      }
    })();

    const onSync = () => {
      if (explicitDemo) applyLocalDemoState(wantsDraft);
    };
    window.addEventListener(DEMO_CAPTIVE_EVENT, onSync);
    window.addEventListener("storage", onSync);
    return () => {
      ctrl.abort();
      window.removeEventListener(DEMO_CAPTIVE_EVENT, onSync);
      window.removeEventListener("storage", onSync);
    };
  }, [applyLocalDemoState]);

  // Tab title + favicon from the ISP's own branding.
  useEffect(() => {
    if (!data) return;
    const prevTitle = document.title;
    document.title = `${data.config.branding.businessName} — WiFi`;
    let link: HTMLLinkElement | null = null;
    let prevHref: string | null = null;
    if (data.config.branding.faviconUrl) {
      link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      prevHref = link.href;
      link.href = data.config.branding.faviconUrl;
    }
    return () => {
      document.title = prevTitle;
      if (link && prevHref) link.href = prevHref;
    };
  }, [data]);

  const handleResetDemo = () => {
    const fresh = resetDemoCaptiveState("QC NetCore");
    setData((prev) =>
      prev
        ? {
            ...prev,
            config: prev.isDraftPreview ? fresh.draft : fresh.published,
            plans: fresh.plans,
            demoSettings: fresh.settings,
          }
        : null
    );
    setResetNotice(true);
    setTimeout(() => setResetNotice(false), 2500);
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div role="alert" className="max-w-sm space-y-3 text-center">
          <Wifi className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-lg font-semibold">WiFi portal unavailable</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Loading WiFi portal">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {data.isDemo && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-bold text-primary">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Captive Portal Demo
            </span>
            <span className="text-muted-foreground">
              {resetNotice
                ? "Demo restored to default packages & branding."
                : data.isDraftPreview
                  ? "Previewing unsaved draft changes."
                  : "Select a package or customize branding, packages & payment flow."}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDemo}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-surface-elevated"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reset Demo
            </button>
            <Link
              href="/settings/captive-portal"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
              Customize Demo Portal
            </Link>
          </div>
        </div>
      )}
      {!data.isDemo && data.isDraftPreview && (
        <div role="status" className="bg-warning-soft px-4 py-2 text-center text-xs font-semibold text-warning">
          Draft preview — this design is not live yet. Publish it from Settings → Captive Portal Designer.
        </div>
      )}
      <PortalRenderer
        config={data.config}
        plans={data.plans}
        supportedMethods={data.methods}
        demoSettings={data.demoSettings}
        isDemo={data.isDemo}
        mode="live"
        className="flex-1"
      />
    </div>
  );
}
