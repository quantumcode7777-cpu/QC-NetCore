"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Mail,
  MessageCircle,
  ShieldCheck,
  ExternalLink,
  Cookie,
} from "lucide-react";
import { NexaNetLogo } from "@/components/ui/NexaNetLogo";
import {
  LEGAL_CONTACT,
  LEGAL_DOCUMENT_LIST,
} from "@/lib/legal/documents";

interface FooterLinkItem {
  label: string;
  href: string;
  external?: boolean;
  onClick?: () => void;
}

interface FooterColumn {
  id: string;
  title: string;
  links: FooterLinkItem[];
}

interface SiteFooterProps {
  onEnterDemo?: () => void;
}

export function SiteFooter({ onEnterDemo }: SiteFooterProps) {
  const [openMobileColumns, setOpenMobileColumns] = useState<Record<string, boolean>>({
    platform: true,
    "network-billing": false,
    services: false,
    resources: false,
    company: false,
    social: false,
  });

  const toggleMobileColumn = (id: string) => {
    setOpenMobileColumns((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const openCookiePreferences = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("qc-open-cookie-preferences"));
    }
  };

  const columns: FooterColumn[] = [
    {
      id: "platform",
      title: "Platform",
      links: [
        { label: "Features", href: "/#features" },
        { label: "Solutions", href: "/#how-it-works" },
        { label: "Pricing", href: "/#pricing" },
        { label: "Integrations", href: "/#architecture" },
        { label: "Capacity", href: "/#free-tools" },
      ],
    },
    {
      id: "network-billing",
      title: "Network & Billing",
      links: [
        { label: "PPPoE Billing", href: "/plans?demo=true", onClick: onEnterDemo },
        { label: "Hotspot Billing", href: "/vouchers?demo=true", onClick: onEnterDemo },
        { label: "Payment Reconciliation", href: "/billing?demo=true", onClick: onEnterDemo },
        { label: "MikroTik Provisioning", href: "/routers?demo=true", onClick: onEnterDemo },
        { label: "TR-069 Device Management", href: "/routers?demo=true", onClick: onEnterDemo },
      ],
    },
    {
      id: "services",
      title: "Services",
      links: [
        { label: "Access", href: "/captive?demo=true", onClick: onEnterDemo },
        {
          label: "WiFi Marketing",
          href: "/settings/captive-portal?demo=true",
          onClick: onEnterDemo,
        },
        { label: "Academy", href: "/legal#academy" },
        { label: "Shop", href: "/contact?topic=hardware" },
      ],
    },
    {
      id: "resources",
      title: "Resources",
      links: [
        { label: "Documentation", href: "/legal" },
        { label: "Blog", href: "/legal#updates" },
        { label: "Changelog", href: "/legal#changelog" },
        { label: "Live Demo", href: "/dashboard?demo=true", onClick: onEnterDemo },
      ],
    },
    {
      id: "company",
      title: "Company",
      links: [
        { label: "Contact", href: "/contact" },
        { label: "Affiliates", href: "/contact?topic=affiliates" },
        {
          label: "Book a Call",
          href: LEGAL_CONTACT.bookCallWhatsappUrl,
          external: true,
        },
        { label: "Sign In", href: "/sign-in" },
      ],
    },
    {
      id: "social",
      title: "Social / Community",
      links: [
        {
          label: "WhatsApp",
          href: LEGAL_CONTACT.whatsappUrl,
          external: true,
        },
        { label: "LinkedIn", href: "/contact?topic=community&channel=linkedin" },
        { label: "Instagram", href: "/contact?topic=community&channel=instagram" },
        { label: "YouTube", href: "/contact?topic=community&channel=youtube" },
        { label: "TikTok", href: "/contact?topic=community&channel=tiktok" },
        { label: "Facebook", href: "/contact?topic=community&channel=facebook" },
      ],
    },
  ];

  return (
    <footer
      aria-label="Site footer"
      className="bg-background border-t border-border text-muted-foreground"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10 space-y-10">
        {/* TOP BRANDING & DIRECT CONTACT STRIP */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-8 border-b border-border">
          <div className="space-y-2.5 max-w-xl">
            <Link href="/" className="inline-flex items-center">
              <NexaNetLogo variant="horizontal" />
            </Link>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Enterprise Multi-Tenant ISP Network &amp; Billing Operating System. Unified
              MikroTik RouterOS orchestration, FreeRADIUS AAA, customizable Hotspot Captive
              Portals, and automated M-Pesa payment reconciliation.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <a
              href={LEGAL_CONTACT.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/15 transition-colors text-xs font-bold"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>WhatsApp: {LEGAL_CONTACT.whatsappLocal}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-75" />
            </a>

            <a
              href={LEGAL_CONTACT.mailtoUrl}
              className="inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-surface border border-border hover:border-primary/40 text-foreground transition-colors text-xs font-bold"
            >
              <Mail className="w-4 h-4 text-primary shrink-0" />
              <span>{LEGAL_CONTACT.email}</span>
            </a>
          </div>
        </div>

        {/* 6-COLUMN NAVIGATION GRID (COLLAPSIBLE ON MOBILE, MULTI-COLUMN ON TABLET/DESKTOP) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-8">
          {columns.map((column) => {
            const isOpenOnMobile = !!openMobileColumns[column.id];
            return (
              <div
                key={column.id}
                className="border-b border-border/60 sm:border-none py-2.5 sm:py-0"
              >
                {/* Mobile Accordion Trigger */}
                <button
                  type="button"
                  onClick={() => toggleMobileColumn(column.id)}
                  aria-expanded={isOpenOnMobile}
                  className="w-full flex items-center justify-between sm:hidden text-left py-1.5 text-xs font-extrabold uppercase tracking-wider text-foreground"
                >
                  <span>{column.title}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                      isOpenOnMobile ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>

                {/* Desktop/Tablet Column Heading */}
                <h3 className="hidden sm:block text-xs font-extrabold uppercase tracking-wider text-foreground mb-3.5">
                  {column.title}
                </h3>

                {/* Links List */}
                <ul
                  className={`${
                    isOpenOnMobile ? "block mt-2 pb-2" : "hidden"
                  } sm:block space-y-2.5 text-xs`}
                >
                  {column.links.map((item) => (
                    <li key={item.label}>
                      {item.external ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors py-0.5 font-medium"
                        >
                          <span>{item.label}</span>
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={item.onClick}
                          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors py-0.5 font-medium"
                        >
                          <span>{item.label}</span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* LEGAL & COMPLIANCE LINKS BAR */}
        <div className="pt-2 border-t border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-foreground">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <span>Legal, Privacy &amp; Compliance Center</span>
            </div>
            <Link
              href="/legal"
              className="text-xs font-bold text-primary hover:underline"
            >
              View All Legal &amp; Compliance Documentation &rarr;
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            {LEGAL_DOCUMENT_LIST.map((doc) => (
              <Link
                key={doc.slug}
                href={`/legal/${doc.slug}`}
                className="text-muted-foreground hover:text-foreground transition-colors font-medium py-0.5"
              >
                {doc.shortTitle}
              </Link>
            ))}
            <button
              type="button"
              onClick={openCookiePreferences}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-medium py-0.5 cursor-pointer"
            >
              <Cookie className="w-3.5 h-3.5 text-primary" />
              <span>Cookie Preferences</span>
            </button>
          </div>
        </div>

        {/* COPYRIGHT & VERIFIED COMPLIANCE FOOTER BAR */}
        <div className="pt-6 border-t border-border/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>
            &copy; {new Date().getFullYear()} {LEGAL_CONTACT.platformName}. All rights
            reserved. ISP Network &amp; Billing Operating System.
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>
              Legal &amp; Support:{" "}
              <a
                href={LEGAL_CONTACT.mailtoUrl}
                className="text-foreground hover:text-primary font-semibold transition-colors"
              >
                {LEGAL_CONTACT.email}
              </a>
            </span>
            <span className="hidden sm:inline text-border">•</span>
            <span>
              WhatsApp:{" "}
              <a
                href={LEGAL_CONTACT.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-primary font-semibold transition-colors"
              >
                {LEGAL_CONTACT.whatsappLocal}
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
