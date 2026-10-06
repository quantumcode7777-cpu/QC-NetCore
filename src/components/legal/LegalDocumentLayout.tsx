"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileText,
  Mail,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { NexaNetLogo } from "@/components/ui/NexaNetLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SiteFooter } from "@/components/layout/SiteFooter";
import {
  LEGAL_CONTACT,
  LEGAL_DOCUMENT_LIST,
  type LegalDocument,
} from "@/lib/legal/documents";

interface LegalDocumentLayoutProps {
  document: LegalDocument;
}

export function LegalDocumentLayout({ document }: LegalDocumentLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* TOP NAVIGATION HEADER */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center">
              <NexaNetLogo variant="horizontal" />
            </Link>
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Legal &amp; Compliance</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to Platform</span>
              <span className="sm:hidden">Home</span>
            </Link>
            <Link
              href="/contact"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            >
              <span>Contact</span>
            </Link>
            <ThemeToggle />
            <Link
              href="/sign-in"
              className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* HORIZONTAL LEGAL DOCUMENT SWITCHER */}
        <div className="border-t border-border/60 bg-surface/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 overflow-x-auto no-scrollbar">
            <nav
              aria-label="Legal policies navigation"
              className="flex items-center gap-1.5 min-w-max"
            >
              <Link
                href="/legal"
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-colors"
              >
                All Policies
              </Link>
              <span className="text-border">•</span>
              {LEGAL_DOCUMENT_LIST.map((item) => {
                const isActive = item.slug === document.slug;
                return (
                  <Link
                    key={item.slug}
                    href={`/legal/${item.slug}`}
                    aria-current={isActive ? "page" : undefined}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-subtle"
                    }`}
                  >
                    {item.shortTitle}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* MAIN DOCUMENT BODY */}
      <main className="flex-1 py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* LEFT SIDEBAR: TABLE OF CONTENTS & METADATA */}
            <aside className="lg:col-span-4 xl:col-span-3 space-y-6">
              <div className="p-5 rounded-2xl bg-surface border border-border space-y-4 lg:sticky lg:top-32">
                <div className="space-y-1">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                    {document.category}
                  </div>
                  <div className="text-sm font-extrabold text-foreground">
                    Document Metadata
                  </div>
                </div>

                <div className="space-y-2 text-xs border-y border-border py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Version</span>
                    <span className="font-bold text-foreground">v{document.version}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span className="font-bold text-foreground">{document.lastUpdated}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Effective Date</span>
                    <span className="font-bold text-foreground">{document.effectiveDate}</span>
                  </div>
                </div>

                {/* Section Jump Links */}
                <div className="space-y-2">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Sections in this Document
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {document.sections.map((sec) => (
                      <li key={sec.id}>
                        <a
                          href={`#${sec.id}`}
                          className="block py-1 px-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-colors truncate"
                        >
                          <span className="font-bold text-primary mr-1.5">{sec.number}.</span>
                          {sec.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Quick Direct Contact Card */}
                <div className="pt-3 border-t border-border space-y-2.5">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-foreground">
                    Compliance &amp; Legal Desk
                  </div>
                  <a
                    href={LEGAL_CONTACT.mailtoUrl}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors break-all"
                  >
                    <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{LEGAL_CONTACT.email}</span>
                  </a>
                  <a
                    href={LEGAL_CONTACT.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-emerald-500 hover:underline font-semibold"
                  >
                    <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>WhatsApp: {LEGAL_CONTACT.whatsappLocal}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </aside>

            {/* RIGHT COLUMN: LEGAL DOCUMENT CONTENT */}
            <article className="lg:col-span-8 xl:col-span-9 space-y-8">
              {/* Document Hero Card */}
              <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-border space-y-5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-bold border border-primary/20">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{document.category}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-subtle text-muted-foreground font-semibold border border-border">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>Last updated: {document.lastUpdated}</span>
                  </span>
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                    {document.title}
                  </h1>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {document.subtitle}
                  </p>
                </div>

                {/* Key Highlights Box */}
                <div className="p-4 sm:p-5 rounded-2xl bg-surface-subtle border border-border space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-primary">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Key Compliance Highlights</span>
                  </div>
                  <ul className="space-y-2 text-xs sm:text-sm text-foreground/90">
                    {document.summaryPoints.map((pt, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Numbered Sections */}
              <div className="space-y-6">
                {document.sections.map((section) => (
                  <section
                    key={section.id}
                    id={section.id}
                    className="scroll-mt-32 p-6 sm:p-8 rounded-2xl bg-surface border border-border space-y-4"
                  >
                    <h2 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight flex items-baseline gap-2.5">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-extrabold">
                        Section {section.number}
                      </span>
                      <span>{section.title}</span>
                    </h2>

                    <div className="space-y-3.5 text-sm text-muted-foreground leading-relaxed">
                      {section.paragraphs.map((paragraph, pIdx) => (
                        <p key={pIdx}>{paragraph}</p>
                      ))}
                    </div>

                    {section.bullets && section.bullets.length > 0 && (
                      <ul className="space-y-2.5 pt-2">
                        {section.bullets.map((bullet, bIdx) => (
                          <li
                            key={bIdx}
                            className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/90 bg-surface-subtle/70 p-3 rounded-xl border border-border/60"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />
                            <span className="leading-relaxed">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>

              {/* Bottom Official Contact & Verification Card */}
              <div className="p-6 sm:p-8 rounded-3xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="space-y-1.5 max-w-xl">
                  <h3 className="text-base sm:text-lg font-extrabold text-foreground">
                    Questions About This Policy or Compliance Verification?
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Reach our legal, privacy, billing, and security engineering desk directly via
                    email or WhatsApp.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={LEGAL_CONTACT.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp {LEGAL_CONTACT.whatsappLocal}</span>
                  </a>
                  <a
                    href={LEGAL_CONTACT.mailtoUrl}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-subtle text-foreground border border-border text-xs font-bold transition-colors"
                  >
                    <Mail className="w-4 h-4 text-primary" />
                    <span>{LEGAL_CONTACT.email}</span>
                  </a>
                </div>
              </div>
            </article>
          </div>
        </div>
      </main>

      {/* COMPREHENSIVE FOOTER */}
      <SiteFooter />
    </div>
  );
}
