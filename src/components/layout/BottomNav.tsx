"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { Sidebar } from "./Sidebar";
import { PRIMARY_MOBILE_ITEMS, visibleNavItems } from "./nav";

export function BottomNav() {
  const pathname = usePathname();
  const { profile, isDemoMode } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Role-aware: operator shortcuts that are hidden for this role fall back
  // to the first visible entries (e.g. owner gets ISP Management + Settings).
  const visible = visibleNavItems(profile?.role, isDemoMode);
  const preferred = PRIMARY_MOBILE_ITEMS.filter((i) => visible.some((v) => v.href === i.href));
  const mobileItems = (preferred.length > 0 ? preferred : visible).slice(0, 4);

  const isSecondaryActive = !mobileItems.some((i) => i.href === pathname);

  return (
    <>
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true" aria-label="All pages">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="relative z-10 flex h-full max-w-[85vw] shadow-[var(--shadow-pop)]">
            <Sidebar onClose={() => setDrawerOpen(false)} />
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-3 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-elevated"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex h-14 max-w-md items-stretch">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-xs",
                  isActive ? "font-medium text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setDrawerOpen(true)}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-xs",
              isSecondaryActive ? "font-medium text-primary" : "text-muted-foreground"
            )}
            aria-label="More pages"
          >
            <Menu className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
