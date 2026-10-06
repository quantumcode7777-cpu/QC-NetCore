"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Wifi,
  Router as RouterIcon,
  Building2,
  ArrowRight,
  Check,
  CreditCard,
  X,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";
import {
  ScrollReveal,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/ScrollReveal";

export function PricingSection() {
  const [salesModalOpen, setSalesModalOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [subscriberScale, setSubscriberScale] = useState("10,000 - 25,000");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSalesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !contactEmail.trim()) return;
    setSubmitted(true);
  };

  const resetSalesModal = () => {
    setSalesModalOpen(false);
    setSubmitted(false);
    setOrgName("");
    setContactEmail("");
    setSubscriberScale("10,000 - 25,000");
    setNotes("");
  };

  return (
    <section
      id="pricing"
      className="py-16 md:py-24 bg-surface border-t border-border scroll-mt-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <ScrollReveal
          variant="fade-up"
          className="text-center max-w-3xl mx-auto space-y-3"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Transparent ISP Pricing</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Simple Pricing That Scales With Your Network
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Align platform costs directly with your active Hotspot and PPPoE operations.
          </p>
        </ScrollReveal>

        {/* 3 Pricing Cards */}
        <StaggerContainer
          staggerMs={90}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch"
        >
          {/* TIER 1: HOTSPOT */}
          <StaggerItem index={0} variant="fade-up" className="flex">
            <div className="w-full p-6 sm:p-8 rounded-3xl bg-surface-subtle border border-border hover:border-primary/40 hover:-translate-y-1 hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-8">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-lg border border-primary/20">
                    Hotspot
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                    <Wifi className="w-5 h-5" />
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed min-h-[40px]">
                  For public WiFi, voucher and captive-portal networks.
                </p>

                <div className="pt-2 border-t border-border">
                  <div className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight">
                    3%
                  </div>
                  <div className="text-xs font-bold text-muted-foreground mt-1.5">
                    of hotspot revenue
                  </div>
                </div>
              </div>

              <Link
                href="/register"
                className="w-full py-3.5 px-5 rounded-xl bg-surface border border-border hover:border-primary/50 hover:bg-surface-elevated hover:-translate-y-0.5 active:scale-[0.98] text-foreground text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2"
              >
                <span>Start free trial</span>
                <ArrowRight className="w-4 h-4 text-primary" />
              </Link>
            </div>
          </StaggerItem>

          {/* TIER 2: PPPoE */}
          <StaggerItem index={1} variant="fade-up" className="flex">
            <div className="w-full p-6 sm:p-8 rounded-3xl bg-surface-subtle border-2 border-primary/50 shadow-xs hover:-translate-y-1 hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-8 relative">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-lg border border-primary/20">
                    PPPoE
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                    <RouterIcon className="w-5 h-5" />
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed min-h-[40px]">
                  For fibre and wireless broadband subscribers on monthly plans.
                </p>

                <div className="pt-2 border-t border-border">
                  <div className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight">
                    $0.25
                  </div>
                  <div className="text-xs font-bold text-muted-foreground mt-1.5">
                    per active user / month
                  </div>
                </div>
              </div>

              <Link
                href="/register"
                className="w-full py-3.5 px-5 rounded-xl bg-primary hover:bg-primary-hover hover:-translate-y-0.5 active:scale-[0.98] text-primary-foreground text-xs sm:text-sm font-bold transition-all duration-200 shadow-xs flex items-center justify-center gap-2"
              >
                <span>Start free trial</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </StaggerItem>

          {/* TIER 3: ENTERPRISE */}
          <StaggerItem index={2} variant="fade-up" className="flex">
            <div className="w-full p-6 sm:p-8 rounded-3xl bg-surface-subtle border border-border hover:border-primary/40 hover:-translate-y-1 hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-8">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-foreground bg-surface px-3 py-1 rounded-lg border border-border">
                    Enterprise
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-surface border border-border text-primary flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed min-h-[40px]">
                  For operators with 10,000+ subscribers, multiple regions or regulatory requirements.
                </p>

                <div className="pt-2 border-t border-border">
                  <div className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight">
                    Custom
                  </div>
                  <div className="text-xs font-bold text-muted-foreground mt-1.5">
                    volume pricing
                  </div>
                </div>

                {/* Enterprise Scope Options (Clearly marked as available on request) */}
                <div className="pt-3 border-t border-border space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Available on request for custom deployments:
                  </div>
                  <ul className="space-y-2 text-xs text-muted-foreground font-semibold">
                    {[
                      "Dedicated infrastructure resources",
                      "Guided onboarding & migration assistance",
                      "Custom integrations, API limits & branding",
                      "Tailored operational & billing arrangements",
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSalesModalOpen(true)}
                className="w-full py-3.5 px-5 rounded-xl bg-surface border border-border hover:border-primary/50 hover:bg-surface-elevated hover:-translate-y-0.5 active:scale-[0.98] text-foreground text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-primary" />
                <span>Talk to sales</span>
              </button>
            </div>
          </StaggerItem>
        </StaggerContainer>
      </div>

      {/* Talk to Sales Modal */}
      {salesModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="enterprise-sales-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-3xl bg-surface border border-border shadow-lg p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3
                  id="enterprise-sales-modal-title"
                  className="text-base font-extrabold text-foreground"
                >
                  Enterprise Deployment Inquiry
                </h3>
                <p className="text-xs text-muted-foreground">
                  Custom volume pricing for 10,000+ subscriber networks
                </p>
              </div>
              <button
                type="button"
                onClick={resetSalesModal}
                aria-label="Close inquiry dialog"
                className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submitted ? (
              <div className="space-y-4 py-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-foreground">
                    Inquiry Recorded for {orgName}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Thank you. You can also create an operator workspace immediately to evaluate QC NetCore while your custom volume request is reviewed.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <Link
                    href="/register"
                    onClick={resetSalesModal}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold text-center"
                  >
                    Create Operator Account
                  </Link>
                  <button
                    type="button"
                    onClick={resetSalesModal}
                    className="py-2.5 px-4 rounded-xl bg-surface-subtle border border-border text-xs font-bold text-foreground cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSalesSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label
                    htmlFor="sales-org-name"
                    className="block text-[11px] font-bold text-muted-foreground uppercase"
                  >
                    ISP / Organization Name
                  </label>
                  <input
                    id="sales-org-name"
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. MetroFiber Networks Ltd"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-border text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="sales-contact-email"
                    className="block text-[11px] font-bold text-muted-foreground uppercase"
                  >
                    Work Email
                  </label>
                  <input
                    id="sales-contact-email"
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="noc@your-isp.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-border text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="sales-sub-scale"
                    className="block text-[11px] font-bold text-muted-foreground uppercase"
                  >
                    Active Subscriber Scale
                  </label>
                  <select
                    id="sales-sub-scale"
                    value={subscriberScale}
                    onChange={(e) => setSubscriberScale(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-border text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="10,000 - 25,000">10,000 – 25,000 subscribers</option>
                    <option value="25,000 - 50,000">25,000 – 50,000 subscribers</option>
                    <option value="50,000+">50,000+ subscribers / Multi-region</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="sales-notes"
                    className="block text-[11px] font-bold text-muted-foreground uppercase"
                  >
                    Deployment Requirements (Optional)
                  </label>
                  <textarea
                    id="sales-notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="POP count, RADIUS topology, or custom billing integration needs..."
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-subtle border border-border text-xs font-semibold text-foreground focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={resetSalesModal}
                    className="px-4 py-2.5 rounded-xl bg-surface-subtle border border-border text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold cursor-pointer"
                  >
                    Submit Inquiry
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
