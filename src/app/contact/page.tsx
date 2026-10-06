"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Headphones,
  Mail,
  MessageCircle,
  Router,
  Send,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { NexaNetLogo } from "@/components/ui/NexaNetLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { LEGAL_CONTACT } from "@/lib/legal/documents";

const INQUIRY_TOPICS = [
  {
    id: "general",
    label: "General & Platform Onboarding",
    desc: "Learn how QC NetCore automates PPPoE, Hotspot, FreeRADIUS, and M-Pesa billing for your ISP.",
    icon: Users,
  },
  {
    id: "support",
    label: "Technical Support & NOC",
    desc: "Assistance with MikroTik RouterOS provisioning, WireGuard tunnels, or M-Pesa Daraja webhooks.",
    icon: Headphones,
  },
  {
    id: "hardware",
    label: "Router Hardware & Pre-Provisioned Shop",
    desc: "Inquire about pre-configured MikroTik routers, access points, and TR-069 CPE deployment.",
    icon: Router,
  },
  {
    id: "affiliates",
    label: "Affiliates, Resellers & Community",
    desc: "Partner with QC NetCore as a regional network integrator, consultant, or community contributor.",
    icon: CheckCircle2,
  },
  {
    id: "legal",
    label: "Legal, Privacy & Data Protection",
    desc: "Contractual inquiries, Data Processing Addendum (DPA) requests, or data subject rights.",
    icon: ShieldCheck,
  },
  {
    id: "security",
    label: "Security & Responsible Disclosure",
    desc: "Coordinated vulnerability reporting and security architecture inquiries.",
    icon: ShieldAlert,
  },
] as const;

export default function ContactPage() {
  const [selectedTopic, setSelectedTopic] = useState<string>("general");
  const [senderName, setSenderName] = useState("");
  const [ispName, setIspName] = useState("");
  const [message, setMessage] = useState("");

  const activeTopicObj =
    INQUIRY_TOPICS.find((t) => t.id === selectedTopic) ?? INQUIRY_TOPICS[0];

  const buildFormattedMessage = () => {
    const parts = [
      `Hello QC NetCore (${activeTopicObj.label}),`,
      senderName.trim() ? `Name: ${senderName.trim()}` : "",
      ispName.trim() ? `ISP / Organization: ${ispName.trim()}` : "",
      message.trim()
        ? `Inquiry: ${message.trim()}`
        : "I would like to learn more about your ISP Network & Billing platform.",
    ].filter(Boolean);
    return parts.join("\n");
  };

  const whatsappDirectHref = `https://wa.me/${
    LEGAL_CONTACT.whatsappDigits
  }?text=${encodeURIComponent(buildFormattedMessage())}`;

  const emailDirectHref = `mailto:${
    LEGAL_CONTACT.email
  }?subject=${encodeURIComponent(
    `[QC NetCore] ${activeTopicObj.label}${ispName.trim() ? ` — ${ispName.trim()}` : ""}`
  )}&body=${encodeURIComponent(buildFormattedMessage())}`;

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
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Contact &amp; Escalation Center</span>
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
              href="/legal"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            >
              <span>Legal Center</span>
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

      {/* MAIN CONTENT */}
      <main className="flex-1 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* HERO */}
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
              <Headphones className="w-3.5 h-3.5" />
              <span>Direct Engineering, Billing &amp; Legal Channels</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-foreground tracking-tight">
              Get in Touch with QC NetCore
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Connect directly with our ISP platform architects, billing support specialists,
              or compliance team via WhatsApp or Email.
            </p>
          </div>

          {/* PRIMARY DIRECT CONTACT CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* WhatsApp Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-emerald-500/30 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Instant WhatsApp Support &amp; Consultation</span>
                </div>
                <h2 className="text-2xl font-extrabold text-foreground">
                  {LEGAL_CONTACT.whatsappLocal}{" "}
                  <span className="text-sm font-semibold text-muted-foreground">
                    ({LEGAL_CONTACT.whatsappInternational})
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Fastest channel for live ISP onboarding demos, MikroTik router provisioning
                  questions, affiliate inquiries, and urgent support escalations.
                </p>
              </div>

              <div>
                <a
                  href={LEGAL_CONTACT.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold transition-colors shadow-xs"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Chat on WhatsApp ({LEGAL_CONTACT.whatsappLocal})</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Email Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-border flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Official Email &amp; Compliance Desk</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-foreground break-all">
                  {LEGAL_CONTACT.email}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Official channel for general inquiries, enterprise billing quotes, legal
                  notices, privacy/data protection requests, and responsible security
                  disclosures.
                </p>
              </div>

              <div>
                <a
                  href={LEGAL_CONTACT.mailtoUrl}
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs sm:text-sm font-bold transition-colors shadow-xs"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send Email to {LEGAL_CONTACT.email}</span>
                </a>
              </div>
            </div>
          </div>

          {/* STRUCTURED INQUIRY COMPOSER & DEPARTMENTS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Department Selector */}
            <div className="lg:col-span-5 space-y-3">
              <h2 className="text-base font-extrabold text-foreground">
                1. Select Inquiry Department
              </h2>
              <div className="space-y-2.5">
                {INQUIRY_TOPICS.map((topic) => {
                  const Icon = topic.icon;
                  const isSelected = selectedTopic === topic.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setSelectedTopic(topic.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                        isSelected
                          ? "bg-primary/10 border-primary text-foreground shadow-2xs"
                          : "bg-surface border-border hover:border-primary/40 text-muted-foreground"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-surface-subtle text-primary border border-border"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs sm:text-sm font-extrabold text-foreground">
                          {topic.label}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {topic.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Direct Message Launcher */}
            <div className="lg:col-span-7 p-6 sm:p-8 rounded-3xl bg-surface border border-border space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-extrabold text-foreground">
                  2. Compose Direct Inquiry — {activeTopicObj.label}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Fill in your details below to launch a pre-formatted message directly via
                  WhatsApp ({LEGAL_CONTACT.whatsappLocal}) or Email ({LEGAL_CONTACT.email}).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="contact-name"
                    className="block text-xs font-bold text-foreground"
                  >
                    Your Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="e.g., Alex Mwangi"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="contact-isp"
                    className="block text-xs font-bold text-foreground"
                  >
                    ISP / Organization Name (Optional)
                  </label>
                  <input
                    id="contact-isp"
                    type="text"
                    value={ispName}
                    onChange={(e) => setIspName(e.target.value)}
                    placeholder="e.g., Skyline Fiber Networks"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="contact-message"
                  className="block text-xs font-bold text-foreground"
                >
                  How can we help you?
                </label>
                <textarea
                  id="contact-message"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your network setup, subscriber count, billing question, or compliance request..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-y"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <a
                  href={whatsappDirectHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send via WhatsApp ({LEGAL_CONTACT.whatsappLocal})</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <a
                  href={emailDirectHref}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>Send via Email ({LEGAL_CONTACT.email})</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
