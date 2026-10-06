// ============================================================================
// QC NETCORE — SOFTWARE-AWARENESS LAYER & SYSTEM CAPABILITY REGISTRY
// ============================================================================
// Machine-readable map of verified QC NetCore modules, features, supported
// actions, required RBAC permissions, and user-friendly explanations.
// ============================================================================

import type { Permission } from "../auth/rbac.ts";

export interface FeatureCapabilityDefinition {
  id: string;
  featureName: string;
  module: string;
  navigationSection: string;
  route: string;
  apiEndpoints: string[];
  description: string;
  whyItExists: string;
  howItWorks: string[];
  availableActions: string[];
  requiredPermissions: Permission[];
  authoritativeDataSources: string[];
  dependencies: string[];
  configurationRequirements: string[];
  keywords: string[];
}

export const SYSTEM_CAPABILITY_REGISTRY: FeatureCapabilityDefinition[] = [
  {
    id: "subscriber-management",
    featureName: "Subscriber and Customer Management",
    module: "Customer Management",
    navigationSection: "Customers and Subscribers section",
    route: "/customers",
    apiEndpoints: ["/api/v1/subscribers-api"],
    description:
      "Customer relationship and subscriber lifecycle management for PPPoE broadband and Hotspot accounts.",
    whyItExists:
      "Centralizes customer contact details, account numbers, installation addresses, POP site assignments, service status, and account balances in one workspace.",
    howItWorks: [
      "Register a subscriber in the Customers section with their full name, phone number, installation address, and assigned POP site.",
      "Each subscriber receives a unique account number used for M-Pesa Paybill payments and PPPoE account matching.",
      "Subscriber status (Active, Suspended, Pending Installation, Expired, or Terminated) controls automated FreeRADIUS and MikroTik network access.",
    ],
    availableActions: [
      "Add a new subscriber profile and assign a service package",
      "View the complete Customer 360 profile, payment history, and connection quality",
      "Search and filter subscribers by status, POP site, name, phone number, or account number",
      "Suspend or reactivate subscriber internet access",
      "Configure PPPoE username, password, and IP address assignment",
    ],
    requiredPermissions: [
      "customers.view",
      "customers.create",
      "customers.update",
      "customers.suspend",
    ],
    authoritativeDataSources: [
      "customers",
      "subscriptions",
      "pppoe_accounts",
      "sites",
    ],
    dependencies: ["Service Plans", "MikroTik Routers"],
    configurationRequirements: [
      "Set up at least one POP site and one service plan before activating PPPoE subscribers.",
    ],
    keywords: [
      "add subscriber",
      "add a subscriber",
      "create customer",
      "new subscriber",
      "suspend subscriber",
      "manage customers",
      "where do i add a subscriber",
      "how do i add a subscriber",
      "how do i suspend a subscriber",
      "subscriber management",
      "customer management",
    ],
  },
  {
    id: "pppoe-billing",
    featureName: "PPPoE Broadband Billing and Provisioning",
    module: "Services and Billing",
    navigationSection: "Service Plans and Billing sections",
    route: "/plans",
    apiEndpoints: [
      "/api/v1/service-plans",
      "/api/v1/subscribers-api",
      "/api/v1/mpesa-callback",
    ],
    description:
      "PPPoE billing allows you to create internet packages, assign them to subscribers, provision their PPPoE accounts, collect payments, and automatically manage their service access.",
    whyItExists:
      "Eliminates manual router queue configuration and spreadsheet tracking by linking subscriber invoices and M-Pesa payments directly to FreeRADIUS and MikroTik routers.",
    howItWorks: [
      "Create service plans with download and upload speeds, optional burst limits, validity duration, and price.",
      "Assign customers to a plan and connect their PPPoE account through your configured MikroTik and FreeRADIUS infrastructure.",
      "When payment is received via M-Pesa STK Push or Paybill, the billing system updates the customer account, records the payment in the ledger, and extends or restores service automatically.",
      "When a subscription expires past the configured grace period with an unpaid balance, the account is suspended and active PPPoE sessions are disconnected automatically.",
    ],
    availableActions: [
      "Create and update PPPoE and Hotspot service plans",
      "Assign speed limits, burst thresholds, and billing validity periods",
      "Provision subscriber PPPoE accounts and static or pool IP addresses",
      "Issue invoices and send M-Pesa STK Push payment prompts",
      "Reset active PPPoE sessions when troubleshooting subscriber links",
    ],
    requiredPermissions: [
      "plans.view",
      "plans.modify",
      "customers.view",
      "billing.view",
    ],
    authoritativeDataSources: [
      "plans",
      "subscriptions",
      "pppoe_accounts",
      "invoices",
      "payments",
    ],
    dependencies: [
      "FreeRADIUS authentication and accounting",
      "MikroTik RouterOS management",
      "M-Pesa payment integration",
    ],
    configurationRequirements: [
      "Create PPPoE plans in the Service Plans section, connect a MikroTik router in the Routers section, and configure M-Pesa Paybill or Till details in Settings.",
    ],
    keywords: [
      "pppoe billing",
      "how does pppoe billing work",
      "can i manage pppoe billing",
      "pppoe",
      "create a package",
      "how do i create a package",
      "service plan",
      "rate limit",
      "packages",
    ],
  },
  {
    id: "hotspot-vouchers-captive",
    featureName: "Hotspot Billing, Vouchers, and Customizable Captive Portal",
    module: "Hotspot and Captive Portal",
    navigationSection: "Captive Portal Settings and Vouchers sections",
    route: "/settings/captive-portal",
    apiEndpoints: [
      "/api/v1/captive/config",
      "/api/v1/captive/assets",
      "/api/v1/captive/public",
      "/api/v1/mpesa-stk-push",
    ],
    description:
      "Customizable multi-tenant Hotspot Captive Portal with instant M-Pesa package checkout and prepaid voucher batch generation.",
    whyItExists:
      "Allows every ISP to brand its own hotspot login page, display internet packages, and authenticate hotspot users through vouchers, M-Pesa payments, or account credentials.",
    howItWorks: [
      "Customize your hotspot portal branding, logo, colors, layout template, welcome message, login options, and displayed packages in the Captive Portal settings section.",
      "Hotspot users connecting to Wi-Fi are presented with your branded captive portal page.",
      "Customers can enter a prepaid voucher code generated in the Vouchers section or select a hotspot package and pay via M-Pesa.",
      "Once payment or voucher verification succeeds, the hotspot session is authorized for the selected package duration and speed limit.",
    ],
    availableActions: [
      "Customize captive portal branding, colors, layout, and featured packages",
      "Preview the captive portal across mobile and desktop layouts",
      "Generate and export prepaid hotspot voucher batches",
      "Track voucher usage, active hotspot sessions, and expiration times",
    ],
    requiredPermissions: [
      "org.manage",
      "vouchers.view",
      "vouchers.generate",
      "plans.view",
    ],
    authoritativeDataSources: [
      "organizations",
      "plans",
      "voucher_batches",
      "hotspot_vouchers",
      "payments",
    ],
    dependencies: ["MikroTik Hotspot configuration", "M-Pesa Express STK Push"],
    configurationRequirements: [
      "Configure portal branding in the Captive Portal settings section and define Hotspot packages in the Service Plans or Vouchers section.",
    ],
    keywords: [
      "captive portal",
      "where do i configure the captive portal",
      "how does the captive portal work",
      "wifi marketing",
      "hotspot voucher",
      "vouchers",
      "hotspot billing",
      "hotspot",
    ],
  },
  {
    id: "payment-reconciliation-ledger",
    featureName: "M-Pesa Payments, Reconciliation, and Financial Ledger",
    module: "Billing and Financial Management",
    navigationSection: "Billing and Finance section",
    route: "/billing",
    apiEndpoints: [
      "/api/v1/payments",
      "/api/v1/payments/revenue",
      "/api/v1/ledger",
      "/api/v1/mpesa-stk-push",
      "/api/v1/mpesa-callback",
    ],
    description:
      "Automated M-Pesa STK Push and Paybill payment collection, invoice reconciliation, unmatched payment resolution, and double-entry financial accounting.",
    whyItExists:
      "Prevents unallocated mobile money payments and duplicate transaction credits while maintaining accurate customer balances, accounts receivable aging, and a balanced financial ledger.",
    howItWorks: [
      "Incoming M-Pesa STK Push and Paybill payments are matched automatically using the customer account number or registered phone number.",
      "Matched payments update the customer invoice, clear overdue balances, post balanced ledger entries, and trigger automatic service renewal.",
      "Unmatched or partial payments are placed in the reconciliation queue in the Billing section so finance staff can review and allocate them safely.",
      "Refunds and credit waivers above policy thresholds use dual approval controls.",
    ],
    availableActions: [
      "View customer invoices, payment history, and overdue balances in the Billing section",
      "Reconcile unmatched M-Pesa payments from the reconciliation queue",
      "Send M-Pesa STK Push payment requests to subscribers",
      "Review double-entry ledger entries, trial balance, and accounts receivable aging",
      "Submit or approve credit adjustments and waivers",
    ],
    requiredPermissions: [
      "billing.view",
      "billing.reconcile",
      "billing.refund",
      "ledger.view",
      "ledger.post",
      "approvals.request",
      "approvals.decide",
    ],
    authoritativeDataSources: [
      "invoices",
      "payments",
      "journal_entries",
      "approval_requests",
    ],
    dependencies: ["M-Pesa integration", "Customer account numbers"],
    configurationRequirements: [
      "Configure your organization currency, billing cycle, and M-Pesa Paybill or Till settings in the Settings section.",
    ],
    keywords: [
      "reconcile",
      "payment reconciliation",
      "where can i reconcile a payment",
      "how does payment reconciliation work",
      "double entry ledger",
      "trial balance",
      "invoices",
      "mpesa",
      "m-pesa",
      "can i use m-pesa",
      "can i use mpesa",
      "paybill",
    ],
  },
  {
    id: "mikrotik-noc-monitoring",
    featureName: "MikroTik Router Fleet and NOC Network Monitoring",
    module: "Network Operations",
    navigationSection: "Routers and Network Monitoring sections",
    route: "/routers",
    apiEndpoints: ["/api/v1/mikrotik-fleet", "/api/v1/monitoring/noc"],
    description:
      "Centralized management and real-time health monitoring for MikroTik routers, FreeRADIUS sessions, optical signal levels, interface traffic, and network alerts.",
    whyItExists:
      "Gives network operators real-time visibility into router health, CPU and memory load, active PPPoE and Hotspot sessions, optical power levels, and affected subscribers during outages.",
    howItWorks: [
      "Add and connect MikroTik routers in the Routers section using WireGuard VPN or management IP connectivity.",
      "Monitor router availability, CPU load, memory usage, uptime, and active subscriber sessions from the Routers and Dashboard sections.",
      "Use the Network Monitoring section to track active network alerts, interface traffic, optical signal alerts, and downstream outage impact across POP sites.",
    ],
    availableActions: [
      "Add, configure, and monitor MikroTik routers in the Routers section",
      "Generate RouterOS and WireGuard provisioning scripts",
      "Inspect router CPU, memory, uptime, and connected PPPoE sessions",
      "Monitor live network alerts, interface throughput, and outage impact in the Network Monitoring section",
    ],
    requiredPermissions: [
      "routers.view",
      "routers.manage",
      "routers.provision",
      "noc.view",
      "olt.manage",
    ],
    authoritativeDataSources: [
      "routers",
      "sites",
      "network_alerts",
      "olts",
      "onts",
      "topology_nodes",
    ],
    dependencies: ["WireGuard VPN or RouterOS management connectivity"],
    configurationRequirements: [
      "Register your POP site and MikroTik router details in the Routers section.",
    ],
    keywords: [
      "connect a mikrotik router",
      "how do i connect a mikrotik router",
      "can i manage mikrotik routers",
      "mikrotik",
      "where can i view router health",
      "where can i see active sessions",
      "noc metric",
      "what does this noc metric mean",
      "router health",
      "monitoring",
      "freeradius",
    ],
  },
  {
    id: "field-operations-inventory",
    featureName: "Field Operations, Work Orders, Support Tickets, and Inventory",
    module: "Field Operations",
    navigationSection: "Technicians and Field Operations section",
    route: "/technicians",
    apiEndpoints: [],
    description:
      "Field technician dispatch, installation and repair work orders, optical signal verification, SLA support tickets, and equipment inventory tracking.",
    whyItExists:
      "Coordinates field technicians with network alerts and new installations while tracking routers, ONTs, and fiber equipment from warehouse stock to customer premises.",
    howItWorks: [
      "Create and assign installation, repair, or maintenance work orders to field technicians in the Technicians section.",
      "Record optical signal measurements and installation sign-off details when completing field jobs.",
      "Track customer support tickets, SLA response timers, and warehouse equipment stock levels in one place.",
    ],
    availableActions: [
      "Create and dispatch technician work orders in the Technicians section",
      "Track support tickets and SLA deadlines",
      "Manage warehouse stock levels and assigned customer equipment",
    ],
    requiredPermissions: [
      "work_orders.view",
      "work_orders.update",
      "inventory.manage",
    ],
    authoritativeDataSources: [
      "work_orders",
      "support_tickets",
      "inventory_items",
      "serialized_assets",
    ],
    dependencies: ["Customer records", "Network alerts"],
    configurationRequirements: [
      "Assign technician roles to field staff in the Settings section.",
    ],
    keywords: [
      "work order",
      "technician",
      "field operations",
      "inventory",
      "tickets",
      "sla",
    ],
  },
  {
    id: "customer-self-care-portal",
    featureName: "Customer Self-Care Portal",
    module: "Customer Experience",
    navigationSection: "Customer Self-Care Portal",
    route: "/portal",
    apiEndpoints: ["/api/v1/mpesa-stk-push"],
    description:
      "Self-service subscriber portal where customers can check their active package, view expiry dates, make M-Pesa renewals, review invoices, and request support.",
    whyItExists:
      "Reduces support calls by allowing subscribers to check their account status, renew subscriptions via M-Pesa, and download invoices at any time.",
    howItWorks: [
      "Subscribers open the Customer Portal to view their current plan, connection status, speed tier, and expiration date.",
      "Customers can initiate an instant M-Pesa STK Push payment to renew their subscription or clear an outstanding balance.",
      "Customers can view past invoices, payment receipts, and submit support requests.",
    ],
    availableActions: [
      "View active internet package, speed, and subscription expiry date",
      "Pay and renew service immediately via M-Pesa",
      "View invoices and payment history",
      "Submit and track support tickets",
    ],
    requiredPermissions: ["portal.access"],
    authoritativeDataSources: ["customers", "subscriptions", "invoices", "payments"],
    dependencies: ["M-Pesa STK Push", "Subscriber account records"],
    configurationRequirements: [
      "Available automatically for registered subscribers.",
    ],
    keywords: [
      "self-care",
      "self care",
      "customer portal",
      "subscriber portal",
      "customer self-care",
    ],
  },
  {
    id: "system-settings-security",
    featureName: "Organization Settings, Role Permissions, and Security Audit",
    module: "Configuration and Security",
    navigationSection: "Settings section",
    route: "/settings",
    apiEndpoints: ["/api/v1/settings"],
    description:
      "Tenant configuration for business profile, billing cycles, grace periods, M-Pesa gateway credentials, role-based access control, and security audit logs.",
    whyItExists:
      "Allows ISP administrators to configure billing rules, manage staff permissions across roles, and audit operational activity.",
    howItWorks: [
      "Configure your ISP business name, support contact details, currency, timezone, billing cycle, and grace period in the Settings section.",
      "Manage account phone numbers and verification settings.",
      "Enforce role-based permissions across Owner, Admin, NOC Engineer, Finance, Support, Technician, and Auditor roles.",
    ],
    availableActions: [
      "Update organization and billing settings in the Settings section",
      "Update and verify account phone numbers",
      "Configure Captive Portal branding and hotspot packages",
      "Review role permissions and security audit logs",
    ],
    requiredPermissions: [
      "org.manage",
      "users.manage",
      "audit.view",
      "soc.view",
    ],
    authoritativeDataSources: [
      "organizations",
      "profiles",
      "audit_log",
      "security_events",
    ],
    dependencies: ["Multi-tenant authentication and role permissions"],
    configurationRequirements: [
      "Requires ISP Owner or Administrator permissions to modify tenant settings.",
    ],
    keywords: [
      "settings",
      "configuration",
      "rbac",
      "permissions",
      "grace period",
      "billing cycle",
    ],
  },
  {
    id: "sms-communications",
    featureName: "SMS Communications and Customer Notifications",
    module: "Communications and Notifications",
    navigationSection: "SMS section",
    route: "/sms",
    apiEndpoints: [
      "/api/v1/sms",
      "/api/v1/sms/webhook",
      "/api/v1/settings/phone",
    ],
    description:
      "Multi-tenant SMS communication workspace for sending individual, targeted, and bulk SMS notifications, managing templates, and tracking delivery status.",
    whyItExists:
      "Enables ISPs to communicate directly with subscribers via SMS for payment confirmations, overdue reminders, expiry alerts, maintenance notices, and service announcements.",
    howItWorks: [
      "Customer phone numbers collected during registration or in subscriber profiles are validated and normalized to international format.",
      "In the SMS section, authorized staff can send individual messages or target groups such as overdue customers, active subscribers, suspended accounts, specific packages, or POP sites.",
      "Dynamic customer variables such as customer name, package name, expiry date, and amount due are filled automatically from live records.",
      "Bulk SMS campaigns display a preview and require explicit operator confirmation before sending.",
    ],
    availableActions: [
      "Send individual or targeted bulk SMS campaigns in the SMS section",
      "Create and manage reusable SMS templates",
      "View SMS delivery history and recipient preferences",
      "Configure Africa's Talking or Twilio SMS provider settings",
    ],
    requiredPermissions: [
      "sms.view",
      "sms.send",
      "sms.send_bulk",
      "sms.manage_templates",
      "sms.manage_provider",
      "sms.view_history",
      "sms.view_usage",
    ],
    authoritativeDataSources: [
      "customers",
      "profiles",
      "sms_messages",
      "sms_campaigns",
      "sms_templates",
      "sms_provider_configs",
    ],
    dependencies: ["SMS gateway provider configuration", "Subscriber phone numbers"],
    configurationRequirements: [
      "Connect an SMS gateway provider in the SMS section under Gateway Settings.",
    ],
    keywords: [
      "how do i send sms",
      "where do i send bulk sms",
      "sms template",
      "configure sms provider",
      "change phone number",
      "sms module",
    ],
  },
];

export function findMatchingCapabilities(
  query: string
): FeatureCapabilityDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return SYSTEM_CAPABILITY_REGISTRY;

  const scored = SYSTEM_CAPABILITY_REGISTRY.map((cap) => {
    let score = 0;
    for (const kw of cap.keywords) {
      if (q.includes(kw)) score += 10;
    }
    if (q.includes(cap.featureName.toLowerCase())) score += 8;
    if (q.includes(cap.module.toLowerCase())) score += 5;
    if (q.includes(cap.route.toLowerCase())) score += 6;

    const tokens = q.split(/\W+/).filter((t) => t.length >= 3);
    const haystack =
      `${cap.featureName} ${cap.module} ${cap.description} ${cap.howItWorks.join(" ")} ${cap.availableActions.join(" ")} ${cap.keywords.join(" ")}`.toLowerCase();
    for (const t of tokens) {
      if (haystack.includes(t)) score += 1;
    }
    return { cap, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.cap);
}
