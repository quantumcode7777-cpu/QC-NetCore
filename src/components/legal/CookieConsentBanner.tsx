"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, ShieldCheck, X, Check } from "lucide-react";

export const COOKIE_CONSENT_STORAGE_KEY = "qc_netcore_cookie_consent_v1";

interface CookieConsentState {
  acknowledgedAt: string;
  essential: true;
  functionalDemoAndTheme: boolean;
}

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [functionalEnabled, setFunctionalEnabled] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      if (!saved) {
        setIsVisible(true);
      } else {
        const parsed = JSON.parse(saved) as Partial<CookieConsentState>;
        if (typeof parsed.functionalDemoAndTheme === "boolean") {
          setFunctionalEnabled(parsed.functionalDemoAndTheme);
        }
      }
    } catch {
      setIsVisible(true);
    }

    const handleOpenPreferences = () => {
      setShowDetails(true);
      setIsVisible(true);
    };

    window.addEventListener("qc-open-cookie-preferences", handleOpenPreferences);
    return () => {
      window.removeEventListener("qc-open-cookie-preferences", handleOpenPreferences);
    };
  }, []);

  const savePreference = (allowFunctional: boolean) => {
    const payload: CookieConsentState = {
      acknowledgedAt: new Date().toISOString(),
      essential: true,
      functionalDemoAndTheme: allowFunctional,
    };
    try {
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(payload));
      if (!allowFunctional) {
        localStorage.removeItem("qc_netcore_demo_captive_v1");
      }
    } catch {
      // Ignore storage errors in restricted environments
    }
    setFunctionalEnabled(allowFunctional);
    setIsVisible(false);
    setShowDetails(false);
  };

  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie and browser storage notice"
      className="fixed bottom-4 left-4 right-4 z-50 max-w-3xl mx-auto rounded-2xl bg-surface/95 backdrop-blur-md border border-border shadow-2xl p-4 sm:p-5 text-xs text-foreground"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <Cookie className="w-4 h-4" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-foreground">
                Cookie &amp; Local Storage Transparency
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold">
                <ShieldCheck className="w-3 h-3" />
                Zero Ad Trackers
              </span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              QC NetCore uses strictly necessary cookies for authentication (`sb-*-auth-token`) and
              functional browser storage for dark/light theme (`gtech_theme`) and isolated Demo Mode
              testing (`gtech_demo_mode`, `qc_netcore_demo_captive_v1`). Read our{" "}
              <Link href="/legal/cookies" className="text-primary font-semibold hover:underline">
                Cookie Policy
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" className="text-primary font-semibold hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsVisible(false)}
          aria-label="Close cookie notice"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {showDetails && (
        <div className="mt-4 pt-3.5 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-surface-subtle border border-border space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">Strictly Necessary Auth Cookies</span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-primary/15 text-primary">
                Always Active
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Required for Supabase operator session security and Row-Level Security enforcement.
            </p>
          </div>

          <label className="p-3 rounded-xl bg-surface-subtle border border-border space-y-1 cursor-pointer flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-foreground">
                Functional Theme &amp; Demo Sandbox
              </span>
              <input
                type="checkbox"
                checked={functionalEnabled}
                onChange={(e) => setFunctionalEnabled(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4 accent-primary"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Saves your dark/light theme (`gtech_theme`) and interactive Captive Portal demo
              customizations locally in your browser.
            </p>
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          className="px-3.5 py-2 rounded-xl border border-border bg-surface-subtle hover:border-primary/40 text-foreground font-semibold transition-colors cursor-pointer"
        >
          {showDetails ? "Hide Details" : "Storage Details"}
        </button>
        <button
          type="button"
          onClick={() => savePreference(false)}
          className="px-3.5 py-2 rounded-xl border border-border bg-surface hover:bg-surface-subtle text-muted-foreground hover:text-foreground font-semibold transition-colors cursor-pointer"
        >
          Essential Only
        </button>
        <button
          type="button"
          onClick={() => savePreference(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold transition-colors shadow-xs cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Accept All</span>
        </button>
      </div>
    </div>
  );
}
