"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { GTechLogo } from "@/components/ui/GTechLogo";
import { ALL_NAV_ITEMS } from "./nav";

const SIDEBAR_STORAGE_KEY = "qc_netcore_sidebar_collapsed";

export function Sidebar({
  className,
  onClose,
}: {
  className?: string;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Only allow collapsing on persistent desktop sidebar (not inside the temporary tablet modal drawer)
  const isCollapsible = !onClose;

  useEffect(() => {
    if (!isCollapsible || typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved === "true") {
        setCollapsed(true);
      }
    } catch {
      // Ignore storage access errors
    }
  }, [isCollapsible]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage access errors
      }
      return next;
    });
  };

  const isCollapsed = isCollapsible && collapsed;

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      onClose?.();
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <aside
      aria-label="Primary"
      className={cn(
        "flex h-full select-none flex-col border-r border-border bg-surface text-foreground transition-[width] duration-200 ease-in-out",
        isCollapsed ? "w-[72px]" : "w-60",
        className
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center justify-between border-b border-border",
          isCollapsed ? "px-2.5 gap-1" : "px-4"
        )}
      >
        <Link
          href="/dashboard"
          onClick={onClose}
          title="QC NetCore Dashboard"
          className="rounded-md min-w-0"
        >
          <GTechLogo
            showText={!isCollapsed}
            size={isCollapsed ? "sm" : "md"}
          />
        </Link>

        {isCollapsible && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground cursor-pointer"
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isCollapsed && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      <nav
        aria-label="Main navigation"
        className={cn(
          "flex-1 overflow-y-auto py-3",
          isCollapsed ? "px-2" : "px-2.5"
        )}
      >
        <ul className="space-y-1">
          {ALL_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  title={isCollapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex h-9 items-center rounded-md text-sm transition-colors",
                    isCollapsed ? "justify-center px-0" : "gap-3 px-3",
                    isActive
                      ? "bg-primary-soft font-medium text-primary"
                      : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <span
                      className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                  )}
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={cn("border-t border-border", isCollapsed ? "p-2" : "p-2.5")}>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isSigningOut}
          aria-label="Log out"
          title={isCollapsed ? "Logout" : undefined}
          className={cn(
            "flex h-9 w-full items-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-60",
            isCollapsed ? "justify-center px-0" : "gap-3 px-3"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!isCollapsed && (
            <span className="truncate">
              {isSigningOut ? "Logging out…" : "Logout"}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
