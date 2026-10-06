"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Router as RouterIcon,
  CreditCard,
  Wifi,
  Users,
  Zap,
  ArrowRight,
  Server,
  Layers,
  Activity,
  CheckCircle2,
  Sparkles,
  MapPin,
  Phone,
  Sun,
  Moon,
  LogIn,
  BarChart3,
  Globe,
  ChevronRight,
  X,
  Menu,
  Smartphone,
  Cpu,
  Database,
  Check,
  ChevronDown,
  Gauge,
  Network,
} from "lucide-react";
import { WindowFrame } from "@/components/ui/WindowFrame";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useAuth } from "@/lib/auth/auth-context";
import { NexaNetLogo } from "@/components/ui/NexaNetLogo";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import {
  ScrollReveal,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/ScrollReveal";
import { AnimatedNetworkGlobe } from "@/components/ui/AnimatedNetworkGlobe";
import {
  FreeToolsSection,
  type FreeToolId,
} from "@/components/tools/FreeToolsSection";
import { PricingSection } from "@/components/pricing/PricingSection";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { cn } from "@/lib/utils";

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Connect Network",
    desc: "Link MikroTik routers via WireGuard or direct management IP.",
    icon: RouterIcon,
  },
  {
    step: "02",
    title: "Configure Services",
    desc: "Set up PPPoE and Hotspot bandwidth profiles with burst limits.",
    icon: Layers,
  },
  {
    step: "03",
    title: "Create Packages",
    desc: "Define daily, weekly, or monthly subscription tariffs in KES.",
    icon: CreditCard,
  },
  {
    step: "04",
    title: "Add Subscribers",
    desc: "Register customer profiles, account numbers, and POP sites.",
    icon: Users,
  },
  {
    step: "05",
    title: "Customer Connects",
    desc: "Subscribers connect via PPPoE credentials or Captive Portal.",
    icon: Wifi,
  },
  {
    step: "06",
    title: "Customer Pays",
    desc: "Instant payment via M-Pesa Express STK Push, Paybill, or Till.",
    icon: Smartphone,
  },
  {
    step: "07",
    title: "Account Updated",
    desc: "Ledger records transaction and balance automatically.",
    icon: Database,
  },
  {
    step: "08",
    title: "Service Activated",
    desc: "FreeRADIUS grants network access and updates session limits.",
    icon: Zap,
  },
  {
    step: "09",
    title: "Monitor Network",
    desc: "Real-time telemetry, active session counts, and network alerts.",
    icon: Activity,
  },
  {
    step: "10",
    title: "Analyze Business",
    desc: "Track revenue, churn, package popularity, and ARPU metrics.",
    icon: BarChart3,
  },
] as const;

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [openFreeTool, setOpenFreeTool] = useState<FreeToolId | null>(null);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(0);
  const [hoveredWorkflowStep, setHoveredWorkflowStep] = useState<number | null>(
    null
  );
  const [globeParallaxY, setGlobeParallaxY] = useState<number>(0);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  const workflowSectionRef = useRef<HTMLElement>(null);
  const { theme, toggleTheme } = useTheme();
  const { enterDemoMode, user } = useAuth();

  const openFreeToolPopup = (toolId: FreeToolId) => {
    setOpenFreeTool(toolId);
    setToolsMenuOpen(false);
    setMobileMenuOpen(false);
  };

  // Scroll-driven workflow progression + subtle hero parallax (GPU-safe, passive listener + rAF)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setReducedMotion(true);
      return;
    }

    let rafId: number | null = null;

    const updateOnScroll = () => {
      rafId = null;

      // 1. Subtle desktop hero parallax (capped at 20px, disabled on mobile < 768px)
      if (window.innerWidth >= 768) {
        const nextParallax = Math.min(20, Math.max(0, window.scrollY * 0.05));
        setGlobeParallaxY(nextParallax);
      } else {
        setGlobeParallaxY(0);
      }

      // 2. Scroll-driven workflow step calculation (01 -> 10)
      const sectionEl = workflowSectionRef.current;
      if (!sectionEl) return;

      const rect = sectionEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 800;

      // Progress begins as section top enters the lower 75% of the viewport
      // and completes as the section bottom passes the upper 35% of the viewport
      const startTrigger = viewportHeight * 0.72;
      const endTrigger = viewportHeight * 0.28;
      const totalScrollDistance = Math.max(
        1,
        rect.height + startTrigger - endTrigger
      );
      const scrolled = startTrigger - rect.top;
      const rawProgress = Math.max(
        0,
        Math.min(1, scrolled / totalScrollDistance)
      );

      const stepIndex = Math.min(
        WORKFLOW_STEPS.length - 1,
        Math.floor(rawProgress * WORKFLOW_STEPS.length)
      );
      setActiveWorkflowStep(stepIndex);
    };

    const onScrollOrResize = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(updateOnScroll);
      }
    };

    updateOnScroll();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, []);

  const currentWorkflowStep = hoveredWorkflowStep ?? activeWorkflowStep;
  const workflowProgressPct = Math.round(
    ((currentWorkflowStep + 1) / WORKFLOW_STEPS.length) * 100
  );

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-50 w-full transition-all duration-200 bg-background/80 backdrop-blur-md border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center group">
              <NexaNetLogo variant="horizontal" />
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
              <a
                href="#platform"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Platform
              </a>
              <a
                href="#how-it-works"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                How It Works
              </a>
              <a
                href="#features"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Features
              </a>
              <a
                href="#architecture"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Architecture
              </a>

              {/* Free Tools Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setToolsMenuOpen(true)}
                onMouseLeave={() => setToolsMenuOpen(false)}
              >
                <button
                  type="button"
                  aria-expanded={toolsMenuOpen}
                  aria-haspopup="true"
                  onClick={() => setToolsMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <span>Free Tools</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      toolsMenuOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>

                {toolsMenuOpen && (
                  <div className="absolute left-0 top-full pt-2 w-72 z-50">
                    <div className="p-2 rounded-2xl bg-surface border border-border shadow-lg space-y-1">
                      <button
                        type="button"
                        onClick={() => openFreeToolPopup("speed-test")}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-surface-subtle transition-colors flex items-start gap-3 cursor-pointer"
                      >
                        <Activity className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold text-foreground">
                            Speed Test
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Download, upload, ping and jitter in one run
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => openFreeToolPopup("what-is-my-ip")}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-surface-subtle transition-colors flex items-start gap-3 cursor-pointer"
                      >
                        <Globe className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold text-foreground">
                            What Is My IP
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Your public IP address and who it belongs to
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => openFreeToolPopup("bandwidth-calculator")}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-surface-subtle transition-colors flex items-start gap-3 cursor-pointer"
                      >
                        <Gauge className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold text-foreground">
                            Bandwidth Calculator
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Size an upstream before you buy it
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => openFreeToolPopup("subnet-calculator")}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-surface-subtle transition-colors flex items-start gap-3 cursor-pointer"
                      >
                        <Network className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold text-foreground">
                            Subnet Calculator
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Split an IPv4 block and read off its hosts
                          </div>
                        </div>
                      </button>

                      <div className="pt-1 mt-1 border-t border-border">
                        <Link
                          href="/dashboard?demo=true"
                          onClick={() => {
                            setToolsMenuOpen(false);
                            enterDemoMode();
                          }}
                          className="w-full text-left p-2.5 rounded-xl hover:bg-surface-subtle transition-colors flex items-start gap-3"
                        >
                          <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-bold text-foreground">
                              Live Demo
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              The operator app, already filled with data
                            </div>
                          </div>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <a
                href="#pricing"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Pricing
              </a>

              <a
                href="#comparison"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Why QC NetCore
              </a>
            </nav>

            {/* Right Header Controls */}
            <div className="flex items-center space-x-2.5">
              <button
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface border border-border text-foreground flex items-center justify-center hover:bg-surface-elevated hover:border-primary/50 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 shadow-xs"
              >
                {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-primary" />}
              </button>

              <Link
                href="/dashboard?demo=true"
                onClick={enterDemoMode}
                className="hidden sm:inline-flex items-center px-4 py-2 text-xs font-bold text-primary-foreground bg-primary rounded-xl hover:bg-primary-hover hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 shadow-xs"
              >
                <span>Explore Demo</span>
              </Link>

              {user ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-4 py-2 text-xs font-bold text-primary-foreground bg-primary rounded-xl hover:bg-primary-hover hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 shadow-xs"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Link>
              ) : (
                <Link
                  href="/sign-in"
                  className="inline-flex items-center px-4 py-2 text-xs font-bold text-primary-foreground bg-primary rounded-xl hover:bg-primary-hover hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 shadow-xs"
                >
                  <LogIn className="w-3.5 h-3.5 mr-1.5" />
                  <span>Sign In</span>
                </Link>
              )}

              {/* Mobile Menu Trigger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden w-9 h-9 rounded-xl bg-surface border border-border text-foreground flex items-center justify-center hover:bg-surface-elevated transition-colors"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-border bg-surface px-4 py-4 space-y-3">
            <a
              href="#platform"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-semibold text-foreground py-2 border-b border-border-subtle"
            >
              Platform Overview
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-semibold text-foreground py-2 border-b border-border-subtle"
            >
              How QC NetCore Works
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-semibold text-foreground py-2 border-b border-border-subtle"
            >
              Core Capabilities
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-semibold text-foreground py-2 border-b border-border-subtle"
            >
              Technical Architecture
            </a>
            <a
              href="#free-tools"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-semibold text-foreground py-2 border-b border-border-subtle"
            >
              Free Tools (Speed Test, IP, Bandwidth, Subnet)
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-semibold text-foreground py-2 border-b border-border-subtle"
            >
              Pricing
            </a>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/dashboard?demo=true"
                onClick={() => {
                  enterDemoMode();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-center px-4 py-2.5 text-xs font-bold text-primary-foreground bg-primary rounded-xl hover:bg-primary-hover transition-colors shadow-xs"
              >
                Explore Demo
              </Link>
              <Link
                href="/sign-in"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center px-4 py-2.5 text-xs font-bold text-primary-foreground bg-primary rounded-xl"
              >
                Get Started →
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section
        id="platform"
        className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden"
      >
        {/* Ambient Left Network Globe Visualization (Desktop & Tablet) with Subtle Scroll Parallax */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none hidden md:block absolute inset-x-0 top-6 lg:top-8 z-0 max-w-[1600px] mx-auto h-[420px]"
        >
          <div
            style={
              reducedMotion
                ? undefined
                : {
                    transform: `translate3d(0, ${globeParallaxY}px, 0)`,
                  }
            }
            className="absolute top-2 md:-left-14 lg:-left-6 xl:left-2 2xl:left-8 md:opacity-75 lg:opacity-90 xl:opacity-100 transition-[opacity,transform] duration-300 ease-out will-change-transform"
          >
            <AnimatedNetworkGlobe
              side="left"
              className="md:w-52 md:h-52 lg:w-72 lg:h-72 xl:w-[340px] xl:h-[340px] 2xl:w-[380px] 2xl:h-[380px]"
            />
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            {/* Value Tag (0ms entrance) */}
            <ScrollReveal immediate delay={0} variant="fade-up">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface border border-border shadow-xs text-xs font-bold text-foreground">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Your ISP. One Operating Platform.</span>
                <span className="text-muted-foreground">|</span>
                <span className="text-primary">PPPoE • Hotspot • M-Pesa • MikroTik</span>
              </div>
            </ScrollReveal>

            {/* Main Headline (100ms entrance) */}
            <ScrollReveal immediate delay={100} variant="fade-up">
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                Run Your ISP From <br className="hidden sm:inline" />
                <span className="text-primary">One Powerful Platform</span>
              </h1>
            </ScrollReveal>

            {/* Supporting Copy (200ms entrance) */}
            <ScrollReveal immediate delay={200} variant="fade-up">
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                QC NetCore brings subscriber management, PPPoE, hotspot billing,
                MikroTik fleet management, RADIUS accounting, M-Pesa payments, and live network operations
                together in one unified platform.
              </p>
            </ScrollReveal>

            {/* CTAs (300ms entrance) */}
            <ScrollReveal immediate delay={300} variant="fade-up">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <Link
                  href="/sign-in"
                  className="w-full sm:w-auto px-8 py-3.5 text-sm font-bold text-primary-foreground bg-primary rounded-xl hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all duration-200 shadow-xs flex items-center justify-center gap-2"
                >
                  <span>Get Started Now</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/dashboard?demo=true"
                  onClick={enterDemoMode}
                  className="w-full sm:w-auto px-8 py-3.5 text-sm font-bold text-primary-foreground bg-primary rounded-xl hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all duration-200 shadow-xs flex items-center justify-center"
                >
                  <span>Explore Demo</span>
                </Link>
              </div>
            </ScrollReveal>

            {/* Key Assurance Indicators (400ms entrance + subtle floating on desktop) */}
            <ScrollReveal immediate delay={400} variant="fade-up">
              <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground font-semibold">
                <div className="qc-float-slow flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>MikroTik RouterOS v7 &amp; v6</span>
                </div>
                <div className="qc-float-slow-delay-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Safaricom M-Pesa Express &amp; Paybill</span>
                </div>
                <div className="qc-float-slow-delay-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>FreeRADIUS Dual Authentication</span>
                </div>
              </div>
            </ScrollReveal>

            {/* Compact Mobile Network Visualization */}
            <div
              aria-hidden="true"
              className="pointer-events-none select-none flex md:hidden items-center justify-center pt-2"
            >
              <AnimatedNetworkGlobe side="left" size="sm" className="w-36 h-36 sm:w-44 sm:h-44 opacity-90" />
            </div>
          </div>

          {/* Hero Visual Mockup — Metric & Radar Cards Staggered Reveal */}
          <ScrollReveal
            delay={120}
            variant="fade-up"
            className="mt-12 md:mt-16 max-w-5xl mx-auto"
          >
            <WindowFrame urlPreview="g-tech-isp-billing-system.vercel.app/noc-live">
              <StaggerContainer
                staggerMs={80}
                className="p-4 sm:p-6 bg-surface space-y-6"
              >
                {/* Stats Bar (Cards 1–4 stagger: 0ms, 80ms, 160ms, 240ms) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StaggerItem index={0} variant="metric-card">
                    <div className="h-full p-3.5 rounded-xl bg-surface-subtle border border-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xs transition-all duration-200">
                      <div className="text-[11px] font-bold text-muted-foreground uppercase">Active Subscribers</div>
                      <div className="text-xl sm:text-2xl font-extrabold text-foreground mt-1">
                        <AnimatedNumber value={1428} formatCommas={true} />
                      </div>
                      <div className="text-[10px] font-bold text-emerald-500 mt-0.5">↑ 12% this month</div>
                    </div>
                  </StaggerItem>
                  <StaggerItem index={1} variant="metric-card">
                    <div className="h-full p-3.5 rounded-xl bg-surface-subtle border border-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xs transition-all duration-200">
                      <div className="text-[11px] font-bold text-muted-foreground uppercase">Monthly Revenue</div>
                      <div className="text-xl sm:text-2xl font-extrabold text-foreground mt-1">
                        <AnimatedNumber value={2.45} prefix="KES " suffix="M" decimals={2} />
                      </div>
                      <div className="text-[10px] font-bold text-emerald-500 mt-0.5">M-Pesa STK Verified</div>
                    </div>
                  </StaggerItem>
                  <StaggerItem index={2} variant="metric-card">
                    <div className="h-full p-3.5 rounded-xl bg-surface-subtle border border-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xs transition-all duration-200">
                      <div className="text-[11px] font-bold text-muted-foreground uppercase">Active PPPoE Sessions</div>
                      <div className="text-xl sm:text-2xl font-extrabold text-foreground mt-1">
                        <AnimatedNumber value={1180} formatCommas={true} />
                      </div>
                      <div className="text-[10px] font-bold text-primary mt-0.5">FreeRADIUS Sync</div>
                    </div>
                  </StaggerItem>
                  <StaggerItem index={3} variant="metric-card">
                    <div className="h-full p-3.5 rounded-xl bg-surface-subtle border border-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xs transition-all duration-200">
                      <div className="text-[11px] font-bold text-muted-foreground uppercase">MikroTik Fleet</div>
                      <div className="text-xl sm:text-2xl font-extrabold text-foreground mt-1">
                        <AnimatedNumber value={14} suffix=" Routers" />
                      </div>
                      <div className="text-[10px] font-bold text-emerald-500 mt-0.5">● 100% Online</div>
                    </div>
                  </StaggerItem>
                </div>

                {/* Workflow Radar Row (Card 5 stagger: 320ms) */}
                <StaggerItem index={4} variant="metric-card">
                  <div className="p-4 rounded-xl bg-surface-subtle border border-border flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-semibold hover:border-primary/30 transition-colors duration-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold">
                        01
                      </div>
                      <div>
                        <div className="font-bold text-foreground">Subscriber Renewal Triggered</div>
                        <div className="text-muted-foreground text-[11px]">Account ACC-78912 • M-Pesa KES 2,500</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
                      <span>STK Push Received</span>
                      <ChevronRight className="w-4 h-4" />
                      <span>FreeRADIUS Updated</span>
                      <ChevronRight className="w-4 h-4" />
                      <span>Speed Profile 10Mbps Unlocked</span>
                    </div>
                  </div>
                </StaggerItem>
              </StaggerContainer>
            </WindowFrame>
          </ScrollReveal>
        </div>
      </section>

      {/* "HOW QC NETCORE WORKS" SECTION — SCROLL-DRIVEN WORKFLOW */}
      <section
        id="how-it-works"
        ref={workflowSectionRef}
        className="py-16 md:py-24 bg-surface border-y border-border"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal
            variant="fade-up"
            className="text-center max-w-3xl mx-auto space-y-3 mb-10"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
              <Layers className="w-3.5 h-3.5" />
              <span>Complete ISP Workflow</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              How QC NetCore Powers Your ISP Business
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              From physical network integration to automated M-Pesa payment collection and customer service renewal,
              QC NetCore connects every operational stage.
            </p>
          </ScrollReveal>

          {/* Integrated Scroll Progress Indicator (01 ━━ 02 ━━ ... ━━ 10) */}
          <ScrollReveal variant="fade-up" delay={80} className="mb-8">
            <div className="rounded-2xl bg-surface-subtle border border-border px-4 py-3.5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    CURRENT STEP {WORKFLOW_STEPS[currentWorkflowStep].step}
                  </span>
                  <span className="font-bold text-foreground">
                    {WORKFLOW_STEPS[currentWorkflowStep].title}
                  </span>
                  <span className="hidden sm:inline text-muted-foreground">
                    — {WORKFLOW_STEPS[currentWorkflowStep].desc}
                  </span>
                </div>
                <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                  Stage {currentWorkflowStep + 1} of {WORKFLOW_STEPS.length} ({workflowProgressPct}%)
                </span>
              </div>

              {/* Continuous Progress Bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-subtle">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                  style={{ width: `${workflowProgressPct}%` }}
                />
              </div>

              {/* Step Node Markers 01 .. 10 */}
              <div className="mt-2.5 grid grid-cols-5 sm:grid-cols-10 gap-1">
                {WORKFLOW_STEPS.map((item, idx) => {
                  const isActive = idx === currentWorkflowStep;
                  const isCompleted = idx < currentWorkflowStep;
                  return (
                    <button
                      key={item.step}
                      type="button"
                      onClick={() => setActiveWorkflowStep(idx)}
                      onMouseEnter={() => setHoveredWorkflowStep(idx)}
                      onMouseLeave={() => setHoveredWorkflowStep(null)}
                      className={cn(
                        "flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-mono font-bold transition-all duration-200 cursor-pointer",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : isCompleted
                          ? "bg-primary/10 text-primary hover:bg-primary/15"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface"
                      )}
                    >
                      <span>{item.step}</span>
                      <span className="hidden xl:inline text-[10px] font-sans font-semibold truncate max-w-[4.2rem]">
                        {item.title.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </ScrollReveal>

          {/* 10 Step Visual Grid with Scroll-Driven Active Transitions */}
          <StaggerContainer
            staggerMs={60}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
          >
            {WORKFLOW_STEPS.map((item, idx) => {
              const Icon = item.icon;
              const isActive = !reducedMotion && idx === currentWorkflowStep;
              const isPast = !reducedMotion && idx < currentWorkflowStep;

              return (
                <StaggerItem key={item.step} index={idx} variant="fade-up">
                  <div
                    onMouseEnter={() => setHoveredWorkflowStep(idx)}
                    onMouseLeave={() => setHoveredWorkflowStep(null)}
                    onClick={() => setActiveWorkflowStep(idx)}
                    className={cn(
                      "h-full p-5 rounded-2xl border transition-[opacity,transform,border-color,box-shadow,background-color] duration-300 ease-out flex flex-col justify-between cursor-pointer",
                      reducedMotion
                        ? "bg-surface-subtle border-border hover:border-primary/40"
                        : isActive
                        ? "opacity-100 scale-[1.015] -translate-y-0.5 bg-surface border-primary shadow-md ring-1 ring-primary/20"
                        : isPast
                        ? "opacity-85 scale-[0.99] bg-surface-subtle border-primary/30 hover:opacity-100 hover:scale-100"
                        : "opacity-60 scale-[0.975] bg-surface-subtle border-border hover:opacity-95 hover:scale-100 hover:border-primary/40"
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "text-xs font-black px-2.5 py-1 rounded-lg border transition-colors duration-200",
                            isActive
                              ? "bg-primary text-primary-foreground border-primary"
                              : "text-primary bg-primary/10 border-primary/20"
                          )}
                        >
                          {item.step}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isActive && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              Active
                            </span>
                          )}
                          <Icon
                            className={cn(
                              "w-5 h-5 transition-colors duration-200",
                              isActive
                                ? "text-primary"
                                : "text-muted-foreground"
                            )}
                          />
                        </div>
                      </div>
                      <h3 className="font-bold text-sm text-foreground">
                        {item.title}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>
      </section>

      {/* TECHNICAL ARCHITECTURE SECTION */}
      <section id="architecture" className="py-16 md:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal
            variant="fade-up"
            className="text-center max-w-3xl mx-auto space-y-3 mb-12"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
              <Cpu className="w-3.5 h-3.5" />
              <span>Technical Network Architecture</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Bridging Network Operations &amp; Commercial Billing
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              QC NetCore operates between your network infrastructure and commercial payment systems,
              ensuring zero manual provisioning bottlenecks.
            </p>
          </ScrollReveal>

          {/* Flow Diagram Box with Progressive Reveal & Animated Connection Lines */}
          <ScrollReveal
            variant="scale"
            delay={80}
            className="p-6 sm:p-8 rounded-3xl bg-surface border border-border max-w-4xl mx-auto space-y-4 shadow-xs"
          >
            <StaggerContainer
              staggerMs={100}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center"
            >
              <StaggerItem index={0} variant="metric-card">
                <div className="h-full p-4 rounded-xl bg-surface-subtle border border-border hover:-translate-y-0.5 hover:border-primary/40 transition-all duration-200">
                  <Server className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="font-extrabold text-sm text-foreground">MikroTik Fleet</div>
                  <div className="text-[11px] text-muted-foreground mt-1">RouterOS API &amp; WireGuard Tunnel</div>
                </div>
              </StaggerItem>
              <StaggerItem index={1} variant="metric-card">
                <div className="h-full p-4 rounded-xl bg-surface-subtle border border-border hover:-translate-y-0.5 hover:border-primary/40 transition-all duration-200">
                  <Database className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="font-extrabold text-sm text-foreground">FreeRADIUS Engine</div>
                  <div className="text-[11px] text-muted-foreground mt-1">AAA Authentication &amp; Accounting</div>
                </div>
              </StaggerItem>
              <StaggerItem index={2} variant="metric-card">
                <div className="h-full p-4 rounded-xl bg-surface-subtle border border-border hover:-translate-y-0.5 hover:border-primary/40 transition-all duration-200">
                  <CreditCard className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="font-extrabold text-sm text-foreground">M-Pesa Integration</div>
                  <div className="text-[11px] text-muted-foreground mt-1">Express STK &amp; Paybill C2B</div>
                </div>
              </StaggerItem>
            </StaggerContainer>

            {/* Subtle Progressive Connection Lines */}
            <ScrollReveal
              variant="fade"
              delay={240}
              aria-hidden="true"
              className="hidden md:block py-1"
            >
              <svg
                viewBox="0 0 600 36"
                className="w-full h-9 text-primary/50 overflow-visible"
                 fill="none"
              >
                <path
                  d="M100,2 L100,18 L300,18 L300,34"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  className="qc-arch-connector-flow"
                />
                <path
                  d="M300,2 L300,34"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  className="qc-arch-connector-flow"
                />
                <path
                  d="M500,2 L500,18 L300,18 L300,34"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  className="qc-arch-connector-flow"
                />
                <circle cx="100" cy="4" r="2.5" className="fill-primary" />
                <circle cx="300" cy="4" r="2.5" className="fill-primary" />
                <circle cx="500" cy="4" r="2.5" className="fill-primary" />
                <circle cx="300" cy="33" r="3" className="fill-primary" />
              </svg>
            </ScrollReveal>

            <ScrollReveal variant="fade-up" delay={300}>
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 text-center space-y-2 hover:border-primary/40 transition-colors duration-200">
                <div className="text-xs font-extrabold uppercase tracking-wider text-primary">
                  QC NetCore Operating System Core
                </div>
                <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
                  Subscribers • PPPoE &amp; Hotspot Plans • Invoices &amp; Ledger • Captive Portal • SMS Communications • Field Work Orders • Live NOC Telemetry • AI ISP Copilot
                </p>
              </div>
            </ScrollReveal>
          </ScrollReveal>
        </div>
      </section>

      {/* CORE PLATFORM CAPABILITIES */}
      <section id="features" className="py-16 md:py-24 bg-surface border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal
            variant="fade-up"
            className="text-center max-w-3xl mx-auto space-y-3 mb-14"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
              <Zap className="w-3.5 h-3.5" />
              <span>Core Platform Modules</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Everything Needed to Run a Broadband ISP
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Every module is built directly into QC NetCore so your network, billing, customer communications, and field teams work from one system.
            </p>
          </ScrollReveal>

          <StaggerContainer
            staggerMs={65}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {[
              {
                title: "Network Operations & Monitoring",
                desc: "MikroTik router fleet management, FreeRADIUS authentication, active PPPoE and Hotspot session monitoring, router health telemetry, WireGuard connectivity, and live outage alerts.",
                icon: RouterIcon,
              },
              {
                title: "Billing & M-Pesa Payments",
                desc: "Automated M-Pesa STK Push checkout, Paybill C2B payment reconciliation, recurring invoices, grace-period handling, automatic suspension and reconnection, and financial ledger tracking.",
                icon: CreditCard,
              },
              {
                title: "Subscriber Management",
                desc: "Unified customer CRM for PPPoE and Hotspot accounts with verified phone numbers, installation addresses, POP site assignment, service status tracking, and full account history.",
                icon: Users,
              },
              {
                title: "PPPoE Broadband Management",
                desc: "Configure residential and business broadband plans with download and upload speed limits, burst thresholds, static or pool IP assignment, and automated router provisioning.",
                icon: Network,
              },
              {
                title: "Hotspot & Customizable Captive Portal",
                desc: "Multi-tenant branded captive portal with custom logo, colors, package cards, instant M-Pesa STK Push checkout, prepaid voucher batch generation, and time or data caps.",
                icon: Wifi,
              },
              {
                title: "Customer Self-Care Portal",
                desc: "Dedicated subscriber portal where customers check their active package and expiry date, renew service via M-Pesa, view invoices and receipts, and submit support requests.",
                icon: Smartphone,
              },
              {
                title: "Field Operations & Inventory",
                desc: "Manage technician installation and repair work orders, fiber ONT optical signal checks, SLA support tickets, and network equipment and CPE inventory.",
                icon: MapPin,
              },
              {
                title: "SMS Customer Communications",
                desc: "Send individual, filtered, or bulk SMS notifications to subscribers using their registered phone numbers for payment reminders, expiry notices, and outage updates.",
                icon: Phone,
              },
              {
                title: "Business Analytics & AI ISP Copilot",
                desc: "Track live revenue, MRR, ARPU, package performance, and churn alongside a built-in AI ISP Copilot that answers operational questions about subscribers, billing, and routers.",
                icon: Sparkles,
              },
            ].map((card, idx) => {
              const Icon = card.icon;
              return (
                <StaggerItem key={idx} index={idx} variant="metric-card">
                  <div className="h-full p-6 rounded-2xl bg-surface-subtle border border-border hover:border-primary/40 hover:-translate-y-1 hover:shadow-md transition-all duration-200 space-y-3 group">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-extrabold text-base text-foreground">{card.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{card.desc}</p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>
      </section>

      {/* TRADITIONAL VS QC NETCORE COMPARISON */}
      <section id="comparison" className="py-16 md:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal
            variant="fade-up"
            className="text-center max-w-3xl mx-auto space-y-3 mb-14"
          >
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              One Unified Platform Instead of Multiple Disconnected Tools
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Stop juggling Excel spreadsheets, WinBox, manual M-Pesa statements, and WhatsApp customer chats.
            </p>
          </ScrollReveal>

          <StaggerContainer
            staggerMs={110}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto"
          >
            {/* Traditional */}
            <StaggerItem index={0} variant="fade-up">
              <div className="h-full p-6 sm:p-8 rounded-3xl bg-surface border border-red-500/20 hover:-translate-y-0.5 transition-all duration-200 space-y-4">
                <div className="text-xs font-extrabold uppercase tracking-wider text-red-500">
                  Traditional Fragmented Workflow
                </div>
                <ul className="space-y-3 text-xs text-muted-foreground font-semibold">
                  <li className="flex items-center gap-2 text-red-400">
                    <X className="w-4 h-4 shrink-0" />
                    <span>Manual WinBox static IP &amp; profile assignments</span>
                  </li>
                  <li className="flex items-center gap-2 text-red-400">
                    <X className="w-4 h-4 shrink-0" />
                    <span>Checking M-Pesa SMS statements manually on phone</span>
                  </li>
                  <li className="flex items-center gap-2 text-red-400">
                    <X className="w-4 h-4 shrink-0" />
                    <span>Excel spreadsheets for customer balance tracking</span>
                  </li>
                  <li className="flex items-center gap-2 text-red-400">
                    <X className="w-4 h-4 shrink-0" />
                    <span>Forgotten expirations leading to unpaid internet usage</span>
                  </li>
                </ul>
              </div>
            </StaggerItem>

            {/* QC NetCore */}
            <StaggerItem index={1} variant="fade-up">
              <div className="h-full p-6 sm:p-8 rounded-3xl bg-surface border border-emerald-500/30 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 space-y-4 shadow-xs">
                <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-500">
                  QC NetCore Unified Operating System
                </div>
                <ul className="space-y-3 text-xs text-foreground font-semibold">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Automated FreeRADIUS &amp; MikroTik provisioning</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Real-time M-Pesa STK Push &amp; Paybill callbacks</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Centralized PostgreSQL multi-tenant database</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Instant automated suspension &amp; service renewal</span>
                  </li>
                </ul>
              </div>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* FREE TOOLS SECTION */}
      <FreeToolsSection
        openTool={openFreeTool}
        onOpenToolChange={setOpenFreeTool}
        onEnterDemo={enterDemoMode}
      />

      {/* PRICING SECTION */}
      <PricingSection />

      {/* FINAL CTA SECTION */}
      <section className="py-16 md:py-24 bg-surface border-t border-border">
        <ScrollReveal
          variant="cta"
          duration={700}
          className="max-w-4xl mx-auto px-4 text-center space-y-6"
        >
          <h2 className="text-3xl sm:text-5xl font-extrabold text-foreground tracking-tight">
            Ready to Simplify Your ISP Operations?
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Connect your network, manage subscribers, automate M-Pesa billing, and give your customers a better way to manage their internet service.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/sign-in"
              className="w-full sm:w-auto px-8 py-3.5 text-sm font-bold text-primary-foreground bg-primary rounded-xl hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all duration-200 shadow-xs flex items-center justify-center gap-2"
            >
              <span>Get Started Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard?demo=true"
              onClick={enterDemoMode}
              className="w-full sm:w-auto px-8 py-3.5 text-sm font-bold text-primary-foreground bg-primary rounded-xl hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all duration-200 shadow-xs flex items-center justify-center"
            >
              <span>Explore Demo</span>
            </Link>
          </div>
        </ScrollReveal>
      </section>

      {/* COMPREHENSIVE FOOTER */}
      <SiteFooter onEnterDemo={enterDemoMode} />
    </div>
  );
}
