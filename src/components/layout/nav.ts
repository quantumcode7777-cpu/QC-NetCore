import {
  LayoutDashboard,
  Users,
  Router as RouterIcon,
  Layers,
  CreditCard,
  Ticket,
  Wrench,
  Activity,
  UserCheck,
  Wifi,
  Settings,
  Paintbrush,
  MessageSquare,
} from "lucide-react";

/**
 * Navigation map. Every entry points at a route that exists in src/app.
 * Do not add items for pages that are not built yet.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Extra search terms for quick-jump */
  keywords?: string;
}
export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: "home operations" }],
  },
  {
    id: "customers",
    label: "Customers",
    items: [
      { href: "/customers", label: "Subscribers", icon: Users, keywords: "customers pppoe accounts" },
      { href: "/technicians", label: "Field Operations", icon: Wrench, keywords: "technicians work orders installs" },
      { href: "/sms", label: "SMS", icon: MessageSquare, keywords: "sms communications bulk messages templates notifications phone" },
    ],
  },
  {
    id: "network",
    label: "Network",
    items: [
      { href: "/routers", label: "Routers", icon: RouterIcon, keywords: "mikrotik fleet wireguard" },
      { href: "/monitoring", label: "Monitoring", icon: Activity, keywords: "telemetry alerts noc" },
      { href: "/vouchers", label: "Hotspot Vouchers", icon: Ticket, keywords: "hotspot voucher codes" },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    items: [
      { href: "/plans", label: "Packages", icon: Layers, keywords: "plans service speed price" },
      { href: "/billing", label: "Payments", icon: CreditCard, keywords: "billing mpesa invoices transactions" },
    ],
  },
  {
    id: "portals",
    label: "Portals",
    items: [
      { href: "/portal", label: "Customer Self-Care", icon: UserCheck, keywords: "portal" },
      { href: "/captive", label: "Captive Portal", icon: Wifi, keywords: "hotspot login" },
      { href: "/settings/captive-portal", label: "Portal Designer", icon: Paintbrush, keywords: "captive portal branding template customize hotspot login page" },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    items: [{ href: "/settings", label: "Settings", icon: Settings, keywords: "configuration organization" }],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Bottom bar on phones: the four things operators reach for most. */
export const PRIMARY_MOBILE_ITEMS: NavItem[] = [
  ALL_NAV_ITEMS.find((i) => i.href === "/dashboard")!,
  ALL_NAV_ITEMS.find((i) => i.href === "/customers")!,
  ALL_NAV_ITEMS.find((i) => i.href === "/billing")!,
  ALL_NAV_ITEMS.find((i) => i.href === "/routers")!,
];
