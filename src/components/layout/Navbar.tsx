"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  Search,
  CornerDownLeft,
  ChevronDown,
  Sun,
  Moon,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ALL_NAV_ITEMS } from "./nav";
import { useAuth } from "@/lib/auth/auth-context";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";
import { AiOperationsCopilotDrawer } from "@/components/copilot/AiOperationsCopilotDrawer";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Administrator",
  isp_owner: "Owner",
  isp_admin: "Administrator",
  finance: "Finance",
  support: "Support",
  technician: "Technician",
  agent: "Agent",
  customer: "Subscriber",
};

function getRoleDisplay(role?: string | null, isDemoMode?: boolean): string {
  if (role && ROLE_LABELS[role]) return ROLE_LABELS[role];
  if (isDemoMode) return "Demo Viewer";
  if (!role) return "Administrator";
  return role.replace(/_/g, " ");
}

function getInitials(name: string): string {
  const parts = name
    .split(/[\s@._-]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "OP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * Preserves the "/" keyboard quick-navigation shortcut as an on-demand modal
 * without occupying visual space in the top header.
 */
function QuickJumpPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  const results = q
    ? ALL_NAV_ITEMS.filter((i) =>
        `${i.label} ${i.keywords ?? ""}`.toLowerCase().includes(q)
      ).slice(0, 8)
    : ALL_NAV_ITEMS.slice(0, 8);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);
      if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        setOpen(true);
        setQuery("");
        setActive(0);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  if (!open) return null;

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Quick page navigation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-popover shadow-[var(--shadow-pop)]">
        <div className="relative border-b border-border">
          <Search
            className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            aria-label="Jump to page"
            placeholder="Type a page name…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                go(results[active].href);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
            }}
            className="h-10 w-full bg-transparent pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              No matching page
            </li>
          )}
          {results.map((r, i) => {
            const Icon = r.icon;
            return (
              <li key={r.href} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onClick={() => go(r.href)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm",
                    i === active
                      ? "bg-surface-elevated text-foreground"
                      : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{r.label}</span>
                  {i === active && (
                    <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Authenticated operator profile button & dropdown menu with integrated
 * Light / Dark theme selector and Logout action.
 */
function UserProfileMenu() {
  const pathname = usePathname();
  const { user, profile, organization, isDemoMode, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.email ? user.email.split("@")[0] : null) ||
    (isDemoMode ? "Demo Operator" : "Operator");

  const displayRole = getRoleDisplay(profile?.role, isDemoMode);
  const initials = getInitials(displayName);
  const subtitle = user?.email || organization?.name || null;

  // Close dropdown on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      setOpen(false);
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${displayName}, ${displayRole}. Account and appearance menu`}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="flex h-10 max-w-[14rem] items-center gap-2.5 rounded-md border border-border bg-surface px-2.5 py-1 text-left transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:max-w-[16rem]"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-elevated text-xs font-semibold text-primary"
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold leading-4 text-foreground">
            {displayName}
          </span>
          <span className="block truncate text-[11px] leading-3.5 text-muted-foreground">
            {displayRole}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account and appearance"
          className="absolute right-0 top-11 z-50 w-60 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-[var(--shadow-pop)]"
        >
          {/* User Identity Header */}
          <div className="border-b border-border px-3.5 py-2.5">
            <div className="truncate text-sm font-semibold text-foreground">
              {displayName}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {displayRole}
            </div>
            {subtitle && (
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {subtitle}
              </div>
            )}
          </div>

          {/* Theme / Appearance Selector */}
          <div className="border-b border-border px-2 py-2" role="group" aria-label="Appearance">
            <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Appearance
            </div>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={theme === "light"}
              onClick={() => setTheme("light")}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-xs transition-colors",
                theme === "light"
                  ? "bg-primary-soft font-medium text-primary"
                  : "text-foreground hover:bg-surface-elevated"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-3.5 w-3.5 items-center justify-center rounded-full border",
                  theme === "light" ? "border-primary" : "border-muted-foreground"
                )}
              >
                {theme === "light" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </span>
              <Sun className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Light</span>
            </button>

            <button
              type="button"
              role="menuitemradio"
              aria-checked={theme === "dark"}
              onClick={() => setTheme("dark")}
              className={cn(
                "mt-0.5 flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-xs transition-colors",
                theme === "dark"
                  ? "bg-primary-soft font-medium text-primary"
                  : "text-foreground hover:bg-surface-elevated"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-3.5 w-3.5 items-center justify-center rounded-full border",
                  theme === "dark" ? "border-primary" : "border-muted-foreground"
                )}
              >
                {theme === "dark" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </span>
              <Moon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Dark</span>
            </button>
          </div>

          {/* Account Actions */}
          <div className="p-1.5">
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-elevated"
            >
              <Settings className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>Settings</span>
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={isSigningOut}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-60"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{isSigningOut ? "Logging out…" : "Logout"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Navbar({ title = "Dashboard" }: { title?: string }) {
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [isCopilotOpen, setCopilotOpen] = useState(false);
  const { isDemoMode } = useAuth();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-surface-elevated md:flex lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">
            {title}
          </h1>
          {isDemoMode && (
            <span className="shrink-0 rounded-md border border-primary/30 bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
              Interactive Demo
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCopilotOpen(true)}
            aria-label="Open AI ISP Operations Copilot"
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-elevated"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span className="hidden sm:inline">AI Copilot</span>
          </button>
          <UserProfileMenu />
        </div>
      </header>

      <QuickJumpPalette />
      <AiOperationsCopilotDrawer
        open={isCopilotOpen}
        onClose={() => setCopilotOpen(false)}
      />

      {/* Tablet drawer (phones use the bottom bar instead; desktop has the persistent sidebar) */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 hidden md:flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative z-10 flex h-full shadow-[var(--shadow-pop)]">
            <Sidebar onClose={() => setDrawerOpen(false)} />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-3 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-elevated"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
