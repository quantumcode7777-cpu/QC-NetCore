import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  ExternalLink,
  FileText,
  GitCommit,
  GraduationCap,
  Mail,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { NexaNetLogo } from "@/components/ui/NexaNetLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { LEGAL_CONTACT, LEGAL_DOCUMENT_LIST } from "@/lib/legal/documents";

export const metadata: Metadata = {
  title: "Legal, Compliance & Documentation Center | QC NetCore",
  description:
    "Explore QC NetCore's Terms of Service, Privacy Policy, Cookie Policy, Acceptable Use Policy, SLA, Data Protection, Security, and Platform Documentation.",
};

export default function LegalIndexPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center">
              <NexaNetLogo variant="horizontal" />
            </Link>
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Legal, Trust &amp; Documentation</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Platform</span>
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
      </header>

      <main className="flex-1 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          {/* HERO */}
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Enterprise Governance • Updated {LEGAL_CONTACT.lastUpdated}</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-foreground tracking-tight">
              Legal, Privacy &amp; Compliance Center
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Transparent operational policies, multi-tenant data protection commitments,
              mobile money reconciliation terms, and security disclosure guidelines for ISP
              operators and subscribers using QC NetCore.
            </p>
          </div>

          {/* 10 LEGAL DOCUMENTS GRID */}
          <section aria-label="Legal policies" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {LEGAL_DOCUMENT_LIST.map((doc) => (
              <Link
                key={doc.slug}
                href={`/legal/${doc.slug}`}
                className="group p-6 rounded-2xl bg-surface border border-border hover:border-primary/40 transition-all duration-200 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold border border-primary/20">
                      <FileText className="w-3 h-3" />
                      <span>{doc.category}</span>
                    </span>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      v{doc.version} • {doc.lastUpdated}
                    </span>
                  </div>

                  <h2 className="text-lg font-extrabold text-foreground group-hover:text-primary transition-colors">
                    {doc.title}
                  </h2>

                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {doc.subtitle}
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs font-bold text-primary">
                  <span>Read Full Policy ({doc.sections.length} Sections)</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </section>

          {/* PLATFORM DOCUMENTATION, ACADEMY & CHANGELOG ANCHORS */}
          <section
            id="academy"
            className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-border"
          >
            <div className="p-6 rounded-2xl bg-surface border border-border space-y-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-foreground">
                QC NetCore ISP Academy &amp; Guides
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Step-by-step operational playbooks for MikroTik RouterOS v7 WireGuard peering,
                FreeRADIUS SQL provisioning, M-Pesa Daraja webhook setup, and multi-tenant
                Captive Portal branding.
              </p>
              <div className="pt-1">
                <Link
                  href="/dashboard?demo=true"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                >
                  <span>Launch Interactive Operator Walkthrough</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div
              id="updates"
              className="scroll-mt-24 p-6 rounded-2xl bg-surface border border-border space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-foreground">
                Engineering Notes &amp; Architecture Briefs
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Technical deep-dives on zero-touch subscriber provisioning, eliminating manual
                WinBox bottlenecks, and reconciling high-concurrency M-Pesa STK Push callbacks.
              </p>
              <div className="pt-1">
                <Link
                  href="/#architecture"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                >
                  <span>View Technical Network Architecture</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div
              id="changelog"
              className="scroll-mt-24 p-6 rounded-2xl bg-surface border border-border space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                <GitCommit className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-foreground">Platform Changelog</h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                  <Calendar className="w-3 h-3" />
                  {LEGAL_CONTACT.lastUpdated}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Recent releases include multi-tenant Captive Portal live customizer isolation,
                Daily/Weekly/Monthly hotspot tier presets, interactive speedometer Free Tools,
                and Plus Jakarta Sans global typography.
              </p>
              <div className="pt-1">
                <Link
                  href="/captive?demo=true"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                >
                  <span>Preview Latest Captive Portal Engine</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </section>

          {/* DIRECT COMPLIANCE CONTACT BANNER */}
          <section className="p-6 sm:p-8 rounded-3xl bg-surface border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <h2 className="text-lg sm:text-xl font-extrabold text-foreground">
                Direct Legal, Privacy &amp; Compliance Desk
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                For contractual inquiries, data protection requests, billing reconciliation, or
                responsible vulnerability disclosure, contact us directly:
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={LEGAL_CONTACT.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp: {LEGAL_CONTACT.whatsappLocal}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href={LEGAL_CONTACT.mailtoUrl}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-subtle hover:border-primary/40 border border-border text-foreground text-xs font-bold transition-colors"
              >
                <Mail className="w-4 h-4 text-primary" />
                <span>{LEGAL_CONTACT.email}</span>
              </a>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
