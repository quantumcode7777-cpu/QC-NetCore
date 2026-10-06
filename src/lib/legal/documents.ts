// ============================================================================
// QC NETCORE — ENTERPRISE LEGAL, COMPLIANCE & FOOTER DATA ARCHITECTURE
// ============================================================================
// Strict non-fabrication guarantee:
// - Uses only verified contact endpoints (WhatsApp 0712052104 / +254712052104,
//   Email quantumcode7777@gmail.com).
// - Reflects the actual technical implementation of QC NetCore (multi-tenant
//   PostgreSQL RLS, MikroTik RouterOS API/WireGuard, FreeRADIUS AAA, M-Pesa
//   Daraja STK Push / C2B transaction metadata, essential localStorage/cookies).
// - Does not fabricate company registration numbers, physical office addresses,
//   regulatory licenses, security certifications, or arbitrary SLA percentages.
// ============================================================================

export const LEGAL_CONTACT = {
  platformName: "QC NetCore",
  fullPlatformTitle: "QC NetCore ISP Network & Billing Operating System",
  email: "quantumcode7777@gmail.com",
  mailtoUrl: "mailto:quantumcode7777@gmail.com",
  whatsappLocal: "0712052104",
  whatsappInternational: "+254 712 052 104",
  whatsappDigits: "254712052104",
  whatsappUrl:
    "https://wa.me/254712052104?text=Hello%20QC%20NetCore%2C%20I%20would%20like%20to%20learn%20more%20about%20your%20ISP%20platform.",
  bookCallWhatsappUrl:
    "https://wa.me/254712052104?text=Hello%20QC%20NetCore%2C%20I%20would%20like%20to%20book%20a%20consultation%20call%20regarding%20your%20ISP%20platform.",
  effectiveDate: "October 1, 2026",
  lastUpdated: "October 2026",
  version: "1.0",
} as const;

export const SUPPORTED_COUNTRIES: readonly string[] = [
  "Benin",
  "Burkina Faso",
  "Cameroon",
  "Côte d’Ivoire",
  "DR Congo",
  "Egypt",
  "Ghana",
  "India",
  "Kenya",
  "Malawi",
  "Nigeria",
  "Pakistan",
  "Republic of the Congo",
  "Rwanda",
  "Senegal",
  "Sierra Leone",
  "South Africa",
  "Tanzania",
  "Thailand",
  "Uganda",
  "Zambia",
  "Zimbabwe",
] as const;

export type LegalDocumentSlug =
  | "terms"
  | "privacy"
  | "cookies"
  | "acceptable-use"
  | "refunds"
  | "payment-terms"
  | "sla"
  | "data-protection"
  | "security"
  | "responsible-disclosure";

export interface LegalSection {
  id: string;
  number: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  callout?: {
    label: string;
    text: string;
  };
}

export interface LegalDocument {
  slug: LegalDocumentSlug;
  shortTitle: string;
  title: string;
  subtitle: string;
  metaDescription: string;
  category: "Governance & Commercial" | "Privacy & Data" | "Network & Operations" | "Security & Trust";
  effectiveDate: string;
  lastUpdated: string;
  version: string;
  summaryPoints: string[];
  sections: LegalSection[];
}

export const LEGAL_DOCUMENTS: Record<LegalDocumentSlug, LegalDocument> = {
  terms: {
    slug: "terms",
    shortTitle: "Terms of Service",
    title: "Terms of Service",
    subtitle:
      "Master terms governing access to and use of the QC NetCore ISP Network & Billing Operating System by Internet Service Providers, network operators, and end-user subscribers.",
    metaDescription:
      "Read the QC NetCore Terms of Service covering multi-tenant ISP billing, MikroTik & FreeRADIUS network management, subscriber obligations, and platform governance.",
    category: "Governance & Commercial",
    effectiveDate: LEGAL_CONTACT.effectiveDate,
    lastUpdated: LEGAL_CONTACT.lastUpdated,
    version: LEGAL_CONTACT.version,
    summaryPoints: [
      "Defines clear operational boundaries between QC NetCore (the software platform provider), onboarded ISP tenants (independent network operators), and end-user internet subscribers.",
      "Requires accurate account registration, strict protection of administrative credentials, and lawful operation of connected MikroTik and RADIUS infrastructure.",
      "Establishes transparent rules for software subscriptions, automated billing records, service suspension, and intellectual property protection.",
    ],
    sections: [
      {
        id: "introduction",
        number: "1",
        title: "Introduction & Acceptance of Terms",
        paragraphs: [
          "Welcome to QC NetCore ('Platform', 'System', 'we', 'us', or 'our'). QC NetCore provides a cloud-hosted, multi-tenant ISP Network & Billing Operating System designed to help Internet Service Providers ('ISP Operators' or 'Tenants'), Wireless ISPs (WISPs), hotspot operators, and campus network administrators manage subscribers, service plans, automated billing, captive portals, FreeRADIUS authentication, and MikroTik router fleets.",
          "By accessing, registering for, configuring, or using the QC NetCore website, operator console, APIs, captive portal interfaces, or customer self-care tools, you agree to be bound by these Terms of Service and all incorporated legal policies. If you are entering into these Terms on behalf of a company, ISP, or legal entity, you represent that you have the authority to bind that entity.",
        ],
      },
      {
        id: "platform-role",
        number: "2",
        title: "Scope of Platform Services & Multi-Tenant Relationship",
        paragraphs: [
          "QC NetCore operates strictly as a B2B2C software-as-a-service (SaaS) management and automation layer. Each onboarded ISP Operator maintains an isolated tenant workspace within the QC NetCore platform.",
          "Important Distinction Between Platform Provider and ISP Tenant: QC NetCore provides the software orchestration engine for billing, RADIUS AAA, and router provisioning. Unless explicitly agreed in a separate written contract, QC NetCore is not the retail Internet Service Provider delivering physical last-mile connectivity to end users. Each ISP Operator is independently responsible for its own retail broadband packages, pricing, physical fiber/wireless infrastructure, local telecommunications licensing, and first-line customer support.",
        ],
        bullets: [
          "Platform Layer (QC NetCore): Multi-tenant web dashboard, PostgreSQL data isolation, FreeRADIUS AAA integration, MikroTik API/script automation, captive portal rendering, and payment webhook reconciliation.",
          "Operator Layer (ISP Tenant): Router hardware ownership, upstream bandwidth procurement, subscriber pricing, M-Pesa Paybill/Till merchant accounts, and subscriber service delivery.",
          "Subscriber Layer (End User): Customers purchasing or authenticating for internet access through an ISP Tenant's captive portal or PPPoE network.",
        ],
      },
      {
        id: "eligibility-accounts",
        number: "3",
        title: "Eligibility, Account Registration & Security Responsibilities",
        paragraphs: [
          "To register an ISP Operator account on QC NetCore, you must be at least eighteen (18) years of age and legally capable of entering into binding commercial contracts. You agree to provide accurate, current, and complete organization and contact information during onboarding and to keep such details updated.",
          "You are solely responsible for maintaining the confidentiality of your operator credentials, Supabase authentication tokens, MikroTik API credentials, RADIUS shared secrets, WireGuard keys, and payment gateway API keys configured within your tenant workspace.",
        ],
        bullets: [
          "Immediately notify QC NetCore at quantumcode7777@gmail.com if you suspect unauthorized access to your operator dashboard or router credentials.",
          "Enforce role-based access control (RBAC) for staff, technicians, and billing administrators within your organization.",
          "Do not share single administrative accounts across multiple unauthorized individuals.",
        ],
      },
      {
        id: "isp-customer-responsibilities",
        number: "4",
        title: "ISP Operator & End-Subscriber Responsibilities",
        paragraphs: [
          "ISP Operators using QC NetCore agree to operate their networks in compliance with applicable national telecommunications regulations, consumer protection laws, and data privacy statutes in the jurisdictions where they deploy service.",
          "ISP Operators must ensure that their captive portal packages, validity periods, bandwidth profiles, and customer support contacts displayed to end subscribers are accurate and non-deceptive.",
        ],
      },
      {
        id: "billing-subscriptions",
        number: "5",
        title: "Platform Subscriptions, Billing & Automated Records",
        paragraphs: [
          "Access to production features of the QC NetCore platform is subject to the commercial pricing plan selected by the ISP Operator (or a custom enterprise agreement). Publicly listed platform tiers and included capacities are displayed on the QC NetCore Pricing section and governed further by our Payment Terms.",
          "While QC NetCore automates M-Pesa STK Push triggers, C2B callback matching, invoice generation, and voucher creation, each ISP Operator remains responsible for verifying its merchant settlement accounts, tax obligations, and accounting reconciliation.",
        ],
      },
      {
        id: "service-provisioning",
        number: "6",
        title: "Network Provisioning, Suspension & Expiration Enforcement",
        paragraphs: [
          "QC NetCore executes automated network control actions—including RADIUS Access-Accept/Access-Reject responses, CoA (Change of Authorization) disconnect packets, IP pool assignments, and MikroTik queue/profile updates—based on the rules and billing states configured by the ISP Operator.",
          "QC NetCore reserves the right to suspend or throttle an ISP Operator's platform workspace if platform subscription invoices remain overdue beyond the applicable grace period, or if a connected router fleet generates abusive traffic, security threats, or denial-of-service conditions against QC NetCore infrastructure.",
        ],
      },
      {
        id: "intellectual-property",
        number: "7",
        title: "Intellectual Property & Tenant Branding",
        paragraphs: [
          "All rights, title, and interest in and to the QC NetCore software, source code, system architecture, database schemas, user interface designs, trademarks, and documentation belong exclusively to QC NetCore and its licensors.",
          "ISP Operators retain full ownership of their custom business names, logos, captive portal branding configurations, and subscriber datasets uploaded into their isolated tenant environment. You grant QC NetCore a limited, non-exclusive license to host, process, and display such assets solely as necessary to provide the Platform services to you and your subscribers.",
        ],
      },
      {
        id: "prohibited-activities",
        number: "8",
        title: "Prohibited Activities",
        paragraphs: [
          "You may not reverse-engineer, decompile, scrape, probe, or attempt to bypass tenant isolation (Row-Level Security) within the QC NetCore platform. Use of the platform is subject at all times to our Acceptable Use Policy.",
        ],
      },
      {
        id: "warranties-liability",
        number: "9",
        title: "Disclaimer of Warranties & Limitation of Liability",
        paragraphs: [
          "THE QC NETCORE PLATFORM IS PROVIDED ON AN 'AS IS' AND 'AS AVAILABLE' BASIS. WHILE WE ENGINEER THE SYSTEM FOR HIGH RELIABILITY AND ACCURATE AUTOMATION, QC NETCORE DOES NOT WARRANT THAT THIRD-PARTY TELECOMMUNICATIONS NETWORKS, MOBILE MONEY GATEWAYS (SUCH AS SAFARICOM M-PESA), UPSTREAM FIBER PROVIDERS, OR LOCAL POWER AND ROUTER HARDWARE WILL OPERATE WITHOUT INTERRUPTION OR ERROR.",
          "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, QC NETCORE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF ISP REVENUE, LOSS OF SUBSCRIBER GOODWILL, OR THIRD-PARTY NETWORK DOWNTIME ARISING OUT OF OR RELATED TO THE USE OR INABILITY TO USE THE PLATFORM.",
        ],
      },
      {
        id: "indemnification-termination",
        number: "10",
        title: "Indemnification, Termination & Governing Law",
        paragraphs: [
          "You agree to indemnify and hold harmless QC NetCore from any third-party claims, regulatory fines, or subscriber disputes arising out of your operation of an ISP network, your retail pricing or refund practices, or your violation of applicable telecommunications or data protection laws.",
          "Either party may terminate an account in accordance with our Refund & Cancellation Policy. Upon termination, ISP Operators may request a structured export of their subscriber and billing records prior to tenant decommissioning.",
          "These Terms are governed by the laws of the Republic of Kenya and applicable international commercial principles, without regard to conflict-of-law rules. Any disputes shall first be addressed through good-faith executive negotiation via quantumcode7777@gmail.com.",
        ],
      },
      {
        id: "contact",
        number: "11",
        title: "Legal & Compliance Contact Information",
        paragraphs: [
          "For all questions, contractual notices, or compliance inquiries regarding these Terms of Service, please contact QC NetCore directly:",
        ],
        bullets: [
          "Email: quantumcode7777@gmail.com",
          "WhatsApp / Direct Line: 0712052104 (+254 712 052 104)",
        ],
      },
    ],
  },

  privacy: {
    slug: "privacy",
    shortTitle: "Privacy Policy",
    title: "Privacy Policy",
    subtitle:
      "How QC NetCore collects, processes, isolates, and protects personal, operational, network, and billing data across our ISP Operating System.",
    metaDescription:
      "Learn how QC NetCore handles operator account data, subscriber network records, MAC/IP session telemetry, and M-Pesa transaction metadata in compliance with data protection standards.",
    category: "Privacy & Data",
    effectiveDate: LEGAL_CONTACT.effectiveDate,
    lastUpdated: LEGAL_CONTACT.lastUpdated,
    version: LEGAL_CONTACT.version,
    summaryPoints: [
      "Transparently distinguishes between data collected for QC NetCore platform administration (Controller) and subscriber data processed on behalf of ISP Tenants (Processor).",
      "Does NOT store customer M-Pesa PINs, full credit card numbers, or raw banking passwords; only transaction references, phone numbers, and payment confirmation metadata are processed.",
      "Zero third-party ad-network tracking or sale of subscriber or ISP operational data.",
    ],
    sections: [
      {
        id: "overview",
        number: "1",
        title: "Overview & Privacy Principles",
        paragraphs: [
          "QC NetCore respects the privacy of ISP Operators, network engineers, and end-user internet subscribers. This Privacy Policy explains what information is collected when you interact with the QC NetCore website, operator console, captive portals, Free Tools, and APIs, how that information is used, and the rights available to data subjects.",
          "Our privacy architecture is built on data minimization, strict multi-tenant Row-Level Security (RLS) isolation, and alignment with the Kenya Data Protection Act, 2019 and internationally recognized privacy principles (including GDPR core safeguards).",
        ],
      },
      {
        id: "categories-of-data",
        number: "2",
        title: "Categories of Information Collected",
        paragraphs: [
          "Depending on whether you are visiting our public website, operating an ISP tenant workspace, or connecting through a hotspot/PPPoE network managed by QC NetCore, the system processes the following categories of data:",
        ],
        bullets: [
          "ISP Operator & Staff Account Data: Full name, business email address, phone/WhatsApp number, organization name, role/permissions, and authentication session identifiers.",
          "Subscriber & Customer CRM Data (Tenant-Scoped): Subscriber name, phone number, email address (optional), installation location/notes, assigned service plan, account status, and expiration timestamps.",
          "Network & Session Telemetry: Device MAC address, assigned local/public IP address, PPPoE username, NAS/MikroTik router identifier, session start/stop times, bandwidth upload/download counters, and voucher codes.",
          "Payment & Billing Metadata: M-Pesa receipt/transaction reference codes (e.g., QK89X...), payer phone number, transaction amount, currency, invoice ID, and timestamp. QC NetCore NEVER collects or stores M-Pesa PINs.",
          "Support & Communication Records: Inquiries submitted via WhatsApp (0712052104), email (quantumcode7777@gmail.com), or support ticket logs.",
        ],
      },
      {
        id: "how-data-is-used",
        number: "3",
        title: "How We Use Information",
        paragraphs: [
          "We process collected data strictly for legitimate operational, contractual, and security purposes:",
        ],
        bullets: [
          "Authenticating ISP administrators and enforcing organization-level Row-Level Security (RLS).",
          "Executing automated RADIUS AAA authentication, bandwidth profile provisioning, and captive portal voucher/package activation.",
          "Reconciling M-Pesa STK Push and C2B Paybill/Till callbacks with subscriber invoices and hotspot sessions.",
          "Generating real-time operational dashboards, network health alerts, and financial audit trails for ISP Operators.",
          "Detecting fraud, unauthorized router API access, brute-force login attempts, and network abuse.",
        ],
      },
      {
        id: "legal-basis",
        number: "4",
        title: "Legal Basis for Processing",
        paragraphs: [
          "Under the Kenya Data Protection Act, 2019 and comparable international frameworks, QC NetCore processes personal data on the following lawful bases:",
        ],
        bullets: [
          "Performance of a Contract: To deliver the SaaS billing and network management services requested by ISP Operators and to fulfill internet access sessions requested by subscribers.",
          "Legitimate Interests: To maintain network security, prevent unauthorized access, troubleshoot MikroTik/RADIUS telemetry, and improve platform stability.",
          "Legal & Regulatory Obligation: To maintain accurate financial transaction logs and respond to lawful regulatory requirements.",
          "Consent: Where users voluntarily initiate communications via WhatsApp or email or configure optional preferences.",
        ],
      },
      {
        id: "sharing-subprocessors",
        number: "5",
        title: "Data Sharing & Infrastructure Subprocessors",
        paragraphs: [
          "QC NetCore does NOT sell, rent, or trade ISP operator lists, subscriber phone numbers, or network usage logs to advertisers or data brokers.",
          "Information is shared only with essential infrastructure components required to run the platform:",
        ],
        bullets: [
          "Cloud Database & Authentication Infrastructure (Supabase / PostgreSQL): For encrypted data storage and session authentication.",
          "Application Hosting & Edge Delivery (Vercel): For secure HTTPS web application delivery.",
          "Connected ISP Payment Gateways (e.g., Safaricom Daraja M-Pesa API): When initiating STK Push payment requests or validating payment callbacks for a specific ISP tenant.",
          "Connected Tenant Network Hardware: Sending RADIUS attributes and RouterOS API commands to the ISP Operator's own MikroTik routers.",
        ],
      },
      {
        id: "retention-rights",
        number: "6",
        title: "Data Retention & Data Subject Rights",
        paragraphs: [
          "Operational and subscriber records are retained for the duration of an ISP Operator's active tenancy, plus any statutory retention period required for financial and tax audit records. Demo Mode configurations stored in your browser's local storage remain only on your local device and can be cleared at any time using the 'Reset Demo' button or browser settings.",
          "Subject to applicable law, individuals have the right to request access to, correction of, deletion of, or restriction of processing of their personal data, as well as data portability. Where QC NetCore acts as a Data Processor on behalf of an ISP Tenant, we will coordinate subscriber privacy requests with the relevant ISP Operator.",
        ],
      },
      {
        id: "privacy-contact",
        number: "7",
        title: "Privacy Inquiries & Contact Channel",
        paragraphs: [
          "To exercise your data protection rights or ask questions about our privacy practices, contact our Privacy & Compliance team:",
        ],
        bullets: [
          "Email: quantumcode7777@gmail.com (Subject: Privacy Request — QC NetCore)",
          "WhatsApp: 0712052104 (+254 712 052 104)",
        ],
      },
    ],
  },

  cookies: {
    slug: "cookies",
    shortTitle: "Cookie Policy",
    title: "Cookie & Local Storage Policy",
    subtitle:
      "Transparent documentation of the essential cookies and browser storage keys used by QC NetCore for authentication, theme preferences, and interactive demo isolation.",
    metaDescription:
      "Review the exact cookies and browser localStorage keys used by QC NetCore. No deceptive tracking or third-party ad cookies.",
    category: "Privacy & Data",
    effectiveDate: LEGAL_CONTACT.effectiveDate,
    lastUpdated: LEGAL_CONTACT.lastUpdated,
    version: LEGAL_CONTACT.version,
    summaryPoints: [
      "QC NetCore uses strictly necessary cookies and localStorage keys for authentication, dark/light theme persistence, and interactive Demo Mode isolation.",
      "We do NOT deploy intrusive third-party behavioural advertising cookies or cross-site tracking pixels.",
      "Documents the exact browser storage keys used in production so operators and auditors can verify them directly in browser DevTools.",
    ],
    sections: [
      {
        id: "what-are-cookies",
        number: "1",
        title: "How QC NetCore Uses Cookies & Browser Storage",
        paragraphs: [
          "Cookies are small text files placed on your device by a web server, while browser `localStorage` allows web applications to store configuration state locally within your browser. QC NetCore uses these mechanisms strictly to keep your operator session authenticated, remember your visual theme preference, and isolate interactive Demo Mode testing from production databases.",
        ],
      },
      {
        id: "exact-storage-keys",
        number: "2",
        title: "Inventory of Cookies & LocalStorage Keys Used",
        paragraphs: [
          "In accordance with engineering transparency, below are the exact cookies and localStorage identifiers utilized by the QC NetCore web application:",
        ],
        bullets: [
          "Supabase Auth Session Cookies (`sb-*-auth-token`): Strictly necessary HTTP/browser cookies used to maintain authenticated ISP operator sessions and enforce Row-Level Security.",
          "Demo Mode Session Cookie (`gtech_demo_mode`): Functional cookie set when you click 'Explore Demo' or visit a `?demo=true` route, allowing you to explore the full operator dashboard with realistic sample telemetry without requiring login.",
          "Theme Preference (`gtech_theme` in localStorage): Stores your chosen interface appearance (`dark` or `light`) so the platform renders without visual flash on page reload.",
          "Isolated Captive Portal Demo State (`qc_netcore_demo_captive_v1` in localStorage): Stores temporary branding and package customizations made inside the interactive Captive Portal Demo Customizer so your browser preview updates live without altering production tenant records.",
          "Cookie Notice Acknowledgment (`qc_netcore_cookie_consent_v1` in localStorage): Remembers your acknowledgment or preference selection on the QC NetCore cookie notice banner.",
        ],
      },
      {
        id: "no-third-party-ad-trackers",
        number: "3",
        title: "Absence of Third-Party Advertising Trackers",
        paragraphs: [
          "QC NetCore does not embed third-party ad-network cookies, retargeting pixels, or cross-site behavioral profiling scripts on the operator console or subscriber captive portals.",
        ],
      },
      {
        id: "managing-cookies",
        number: "4",
        title: "Managing or Clearing Cookies & Local Storage",
        paragraphs: [
          "You can review, reset, or clear your QC NetCore cookie preferences at any time via the Cookie Notice banner or through your browser's privacy settings. Note that blocking strictly necessary authentication cookies (`sb-*-auth-token`) will prevent you from signing into protected operator dashboard routes.",
        ],
      },
    ],
  },

  "acceptable-use": {
    slug: "acceptable-use",
    shortTitle: "Acceptable Use Policy",
    title: "Acceptable Use & Network Usage Policy",
    subtitle:
      "Rules governing lawful, secure, and fair use of the QC NetCore platform, connected MikroTik/RADIUS infrastructure, captive portals, and broadband network services.",
    metaDescription:
      "Read the QC NetCore Acceptable Use and Network Usage Policy covering prohibited cyber activities, fair bandwidth management, captive portal integrity, and voucher security.",
    category: "Network & Operations",
    effectiveDate: LEGAL_CONTACT.effectiveDate,
    lastUpdated: LEGAL_CONTACT.lastUpdated,
    version: LEGAL_CONTACT.version,
    summaryPoints: [
      "Prohibits unauthorized network scanning, DDoS attacks, credential stuffing, voucher brute-forcing, and MAC spoofing.",
      "Forbids deceptive captive portals, phishing pages, or unauthorized payment interception.",
      "Supports lawful ISP traffic engineering, QoS rate-limiting, Fair Usage Policies (FUP), and automated session enforcement.",
    ],
    sections: [
      {
        id: "purpose",
        number: "1",
        title: "Purpose & Scope",
        paragraphs: [
          "This Acceptable Use & Network Usage Policy ('AUP') applies to all ISP Operators, administrators, technicians, and end-user subscribers interacting with the QC NetCore platform or connecting to internet services provisioned through QC NetCore.",
        ],
      },
      {
        id: "prohibited-platform-use",
        number: "2",
        title: "Prohibited Platform & Security Activities",
        paragraphs: [
          "Users and tenants must not use the QC NetCore platform or connected network infrastructure to engage in, foster, or permit any of the following prohibited activities:",
        ],
        bullets: [
          "Unauthorized Intrusion & Scanning: Probing, port-scanning, vulnerability scanning, or attempting to breach multi-tenant database isolation, RouterOS APIs, or FreeRADIUS servers without explicit written authorization.",
          "Denial of Service (DoS/DDoS): Flooding authentication endpoints, STK Push payment triggers, captive portal login forms, or upstream ISP links with automated traffic.",
          "Voucher & Credential Abuse: Using automated scripts to guess hotspot voucher codes, brute-force PPPoE credentials, or spoof authenticated MAC/IP addresses on hotspot bridges.",
          "Phishing & Deceptive Captive Portals: Configuring a tenant captive portal to impersonate third-party financial institutions, government agencies, or unrelated brands to harvest sensitive user credentials.",
          "Malware & Illegal Content: Hosting, transmitting, or distributing command-and-control (C2) malware, ransomware, botnets, or content that violates applicable national laws.",
        ],
      },
      {
        id: "network-usage-qos",
        number: "3",
        title: "Network Usage Policy, Bandwidth Management & Fair Usage",
        paragraphs: [
          "QC NetCore enables ISP Operators to define and enforce deterministic network policies across PPPoE and Hotspot subscribers. Subscribers connecting through an ISP Tenant's network acknowledge and agree that:",
        ],
        bullets: [
          "Throughput & Rate Limits: Upload and download speeds (e.g., 5 Mbps, 10 Mbps, 20 Mbps) represent maximum provisioned MikroTik/RADIUS queue limits ('up to' speeds) and may vary based on wireless signal quality, device capability, and shared backhaul contention.",
          "Session Timeouts & Data Caps: Hotspot vouchers and broadband plans are automatically monitored for elapsed duration, idle timeout, and data volume caps. Upon reaching plan limits or invoice expiration, sessions are automatically terminated via RADIUS/RouterOS.",
          "Device & Concurrent Session Limits: Voucher codes and PPPoE accounts are restricted to the maximum concurrent device count (Simultaneous-Use / Shared-Users) configured for the selected package.",
          "Traffic Shaping & Network Protection: ISP Operators may implement Quality of Service (QoS) prioritization, Burst queues, or Fair Usage Policy (FUP) rules to protect overall network stability against excessive peer-to-peer abuse or broadcast storms.",
        ],
      },
      {
        id: "enforcement",
        number: "4",
        title: "Monitoring, Violation Reporting & Enforcement",
        paragraphs: [
          "QC NetCore and its ISP Operators reserve the right to immediately suspend or terminate any voucher, subscriber session, or tenant workspace that violates this policy or threatens platform stability. Suspected abuse can be reported to quantumcode7777@gmail.com.",
        ],
      },
    ],
  },

  refunds: {
    slug: "refunds",
    shortTitle: "Refund & Cancellation Policy",
    title: "Refund & Cancellation Policy",
    subtitle:
      "Clear governance on SaaS subscription cancellations, duplicate M-Pesa transaction handling, and the distinction between platform fees and tenant ISP subscriber payments.",
    metaDescription:
      "Understand QC NetCore's Refund and Cancellation Policy for ISP software subscriptions and end-user hotspot/PPPoE payments.",
    category: "Governance & Commercial",
    effectiveDate: LEGAL_CONTACT.effectiveDate,
    lastUpdated: LEGAL_CONTACT.lastUpdated,
    version: LEGAL_CONTACT.version,
    summaryPoints: [
      "Clearly separates B2B platform SaaS subscriptions paid to QC NetCore from retail internet payments paid by end-users to independent ISP Operators.",
      "Provides a structured process for resolving duplicate M-Pesa charges, uncredited STK Push callbacks, or failed provisioning.",
      "Allows ISP Operators to cancel recurring platform subscriptions at any time prior to the next billing cycle.",
    ],
    sections: [
      {
        id: "two-tier-distinction",
        number: "1",
        title: "Distinction Between Platform SaaS Fees & Retail ISP Payments",
        paragraphs: [
          "Because QC NetCore is a multi-tenant ISP Operating System, two distinct types of financial transactions occur in relation to the platform:",
        ],
        bullets: [
          "1. Platform SaaS Subscriptions (ISP Operator -> QC NetCore): Fees paid by an ISP Operator to QC NetCore for using our cloud software platform.",
          "2. Retail Internet Service Payments (End Subscriber -> ISP Operator): Payments made by home, business, or hotspot end-users via M-Pesa Paybill/Till to purchase internet access from an independent ISP Operator.",
        ],
      },
      {
        id: "saas-subscription-cancellations",
        number: "2",
        title: "ISP Operator SaaS Subscription Cancellation & Refunds",
        paragraphs: [
          "ISP Operators may evaluate QC NetCore prior to purchase using our interactive Live Demo Mode and Free Tools at zero cost.",
          "You may cancel your QC NetCore platform subscription at any time by contacting our billing support team via email or WhatsApp prior to your next billing renewal date. Upon cancellation, your tenant workspace will remain accessible through the end of the current paid billing period, after which automated billing renewals cease.",
          "Where an ISP Operator experiences a verified duplicate charge on a platform invoice or a critical platform provisioning failure attributable directly to QC NetCore within the first seven (7) days of initial onboarding that cannot be resolved by our engineering team, QC NetCore will issue an equitable credit or refund upon verification of the payment reference.",
        ],
      },
      {
        id: "subscriber-payments",
        number: "3",
        title: "End-User Hotspot & PPPoE Payments (Tenant ISP Policy)",
        paragraphs: [
          "When an end-user purchases a hotspot package (such as Daily Basic, Weekly Plus, or Monthly Pro) or pays a PPPoE invoice, the funds are settled directly to the respective ISP Operator's merchant account (M-Pesa Paybill or BuyGoods Till).",
          "Once a hotspot voucher code or broadband session has been activated and bandwidth has been consumed, the digital service is deemed delivered and is generally non-refundable. However, an end-user is eligible for prompt re-provisioning, voucher replacement, or refund from the respective ISP Operator in the following verified scenarios:",
        ],
        bullets: [
          "Duplicate M-Pesa Deduction: The subscriber was debited twice for the same package due to mobile network latency.",
          "Paid But Unprovisioned Session: M-Pesa confirmed payment deduction, but the captive portal or RADIUS server failed to activate the session or issue a valid voucher.",
          "Prolonged Local Outage: The ISP Operator's local access point or backhaul suffered a verified outage preventing utilization of a newly purchased time-bound package.",
        ],
      },
      {
        id: "dispute-procedure",
        number: "4",
        title: "How to Request a Payment Review or Refund",
        paragraphs: [
          "To request a billing review, reconciliation check, or subscription cancellation, please provide the M-Pesa Transaction Reference Code (e.g., QK...), payer phone number, date/time of payment, and tenant/ISP name to:",
        ],
        bullets: [
          "Email: quantumcode7777@gmail.com",
          "WhatsApp Support: 0712052104 (+254 712 052 104)",
        ],
      },
    ],
  },

  "payment-terms": {
    slug: "payment-terms",
    shortTitle: "Payment Terms",
    title: "Payment & Financial Reconciliation Terms",
    subtitle:
      "Commercial terms governing pricing currencies, M-Pesa STK Push and C2B payment workflows, automated invoice reconciliation, and overdue account handling.",
    metaDescription:
      "Review QC NetCore's Payment Terms covering KES pricing, M-Pesa Daraja STK Push & Paybill callbacks, tax responsibilities, and automated billing states.",
    category: "Governance & Commercial",
    effectiveDate: LEGAL_CONTACT.effectiveDate,
    lastUpdated: LEGAL_CONTACT.lastUpdated,
    version: LEGAL_CONTACT.version,
    summaryPoints: [
      "Supports transparent pricing in Kenyan Shillings (KES) and configured local currencies across supported operator regions.",
      "Details how M-Pesa Express (STK Push) and C2B Paybill/Till webhook callbacks reconcile invoices in real time.",
      "Defines invoice lifecycle states (Pending, Paid, Overdue, Cancelled) and automated suspension/reconnection rules.",
    ],
    sections: [
      {
        id: "pricing-currency",
        number: "1",
        title: "Pricing Structure & Supported Currencies",
        paragraphs: [
          "Platform subscription rates published on the QC NetCore website are stated in Kenyan Shillings (KES) unless a multi-currency quote (such as USD or local operator currency) is specified in an enterprise order form. ISP Operators may configure their own tenant billing currency for subscriber plans and invoices.",
        ],
      },
      {
        id: "mpesa-mobile-money",
        number: "2",
        title: "Mobile Money (M-Pesa STK Push & C2B) Processing",
        paragraphs: [
          "QC NetCore integrates with mobile money payment rails—primarily Safaricom M-Pesa Daraja APIs (Lipa Na M-Pesa Online STK Push and Customer-to-Business Paybill/Till callbacks)—to automate subscriber collections:",
        ],
        bullets: [
          "STK Push Initiation: When a subscriber enters their phone number on the Captive Portal or Customer Portal, QC NetCore dispatches an API request to trigger an M-Pesa prompt on the subscriber's handset.",
          "Asynchronous Callback Verification: Service activation or invoice settlement occurs upon receipt of a cryptographically or structurally verified confirmation callback containing the unique transaction receipt code and amount.",
          "Gateway Latency & Outages: Mobile money confirmation times depend on telecommunications carrier availability. If an M-Pesa callback is delayed by the mobile carrier, ISP administrators can manually verify and reconcile the receipt code within the QC NetCore Billing console.",
        ],
      },
      {
        id: "invoice-lifecycle",
        number: "3",
        title: "Automated Invoicing, Taxes & Overdue Handling",
        paragraphs: [
          "QC NetCore tracks every billing event through deterministic financial states (`pending`, `paid`, `overdue`, and `cancelled`).",
          "Tax Compliance: Unless explicitly stated otherwise on an invoice, fees do not include local Value Added Tax (VAT), digital service taxes, or telecommunications excise duties. Each ISP Operator is solely responsible for assessing, collecting, and remitting applicable taxes to its national revenue authority.",
          "Overdue Accounts: When a subscriber invoice passes its due date without settlement, QC NetCore's automated billing engine may transition the subscriber status to `expired` or `suspended` and instruct FreeRADIUS / MikroTik to restrict access or redirect the subscriber to a payment renewal notice until payment is confirmed.",
        ],
      },
    ],
  },

  sla: {
    slug: "sla",
    shortTitle: "Service Level Agreement",
    title: "Service Level Agreement (SLA) & Operational Support Framework",
    subtitle:
      "Our engineering commitments for platform availability, planned maintenance windows, incident severity classification, and technical support escalation.",
    metaDescription:
      "Read the QC NetCore Service Level Agreement (SLA) covering cloud platform reliability, incident severity levels, maintenance windows, and shared infrastructure responsibilities.",
    category: "Network & Operations",
    effectiveDate: LEGAL_CONTACT.effectiveDate,
    lastUpdated: LEGAL_CONTACT.lastUpdated,
    version: LEGAL_CONTACT.version,
    summaryPoints: [
      "Defines clear incident severity tiers (P1 Critical through P4 Minor) and direct engineering escalation paths.",
      "Establishes a transparent Shared Responsibility Model separating cloud control-plane availability from local ISP power, fiber, and router hardware.",
      "Avoids arbitrary fabricated percentages in favor of verifiable operational architecture and contractual enterprise SLA addenda.",
    ],
    sections: [
      {
        id: "service-scope",
        number: "1",
        title: "Scope of the Service Level Agreement",
        paragraphs: [
          "This Service Level Agreement ('SLA') describes the operational availability architecture, support response framework, and maintenance practices for the QC NetCore cloud platform. Specific numerical uptime credits or bespoke financial remedies may be defined in a mutually executed Enterprise Order Form based on an ISP Operator's deployment tier.",
        ],
      },
      {
        id: "shared-responsibility",
        number: "2",
        title: "Shared Operational Responsibility Model",
        paragraphs: [
          "Reliable ISP operations require coordination across both cloud software and physical field hardware. Availability responsibilities are allocated as follows:",
        ],
        bullets: [
          "QC NetCore Responsibility (Cloud Control Plane): Availability of the web dashboard, tenant PostgreSQL database, Captive Portal web rendering, API webhook ingestion endpoints, and automated provisioning logic.",
          "ISP Operator Responsibility (Field & Edge Infrastructure): Local electrical power/UPS at router sites, physical MikroTik RouterOS devices, last-mile fiber/wireless links, local LAN/VLAN configurations, and upstream internet transit.",
          "Third-Party Dependencies: Mobile money API gateways (e.g., Safaricom Daraja) and national internet exchange/undersea cable routing.",
        ],
      },
      {
        id: "incident-severity",
        number: "3",
        title: "Incident Severity Classification & Escalation",
        paragraphs: [
          "QC NetCore categorizes technical support and operational incidents into four severity tiers:",
        ],
        bullets: [
          "Severity 1 (Critical — Platform-Wide Outage): Complete unavailability of the QC NetCore operator dashboard, captive portal authentication endpoints, or payment webhook processing affecting multiple production tenants. Prioritized for immediate engineering mobilization.",
          "Severity 2 (High — Major Feature Degradation): Core billing reconciliation, RADIUS synchronization, or MikroTik provisioning commands are failing for an active production tenant without a workaround.",
          "Severity 3 (Medium — Partial or Non-Critical Issue): An individual report, analytics widget, or non-critical configuration screen is impaired while core subscriber connectivity and payments continue operating.",
          "Severity 4 (Low — General Inquiry / Configuration Guidance): How-to questions, custom captive portal styling guidance, or feature requests.",
        ],
      },
      {
        id: "maintenance-exclusions",
        number: "4",
        title: "Scheduled Maintenance & SLA Exclusions",
        paragraphs: [
          "QC NetCore performs database migrations, security patching, and zero-downtime edge deployments wherever possible. When maintenance requires a brief service window, we aim to schedule it during low-traffic night hours and notify affected ISP Operators in advance.",
          "Service availability calculations exclude disruptions caused by: (a) failures of the ISP Operator's own MikroTik hardware, power supply, or upstream ISP link; (b) scheduled maintenance windows; (c) third-party mobile money gateway downtime; (d) misconfigurations made by tenant administrators; or (e) force majeure events beyond reasonable engineering control.",
        ],
      },
      {
        id: "support-channels",
        number: "5",
        title: "Technical Support & Incident Escalation Channels",
        paragraphs: [
          "ISP Operators can reach QC NetCore Technical Support and NOC escalation directly via:",
        ],
        bullets: [
          "Direct WhatsApp Escalation: 0712052104 (+254 712 052 104)",
          "Support & Engineering Email: quantumcode7777@gmail.com",
        ],
      },
    ],
  },

  "data-protection": {
    slug: "data-protection",
    shortTitle: "Data Protection",
    title: "Data Processing & Data Protection Addendum (DPA)",
    subtitle:
      "Architectural and legal framework governing Data Controller and Data Processor responsibilities, multi-tenant isolation, and cross-border data safeguards.",
    metaDescription:
      "Review QC NetCore's Data Protection & Data Processing framework aligned with the Kenya Data Protection Act 2019 and GDPR principles.",
    category: "Privacy & Data",
    effectiveDate: LEGAL_CONTACT.effectiveDate,
    lastUpdated: LEGAL_CONTACT.lastUpdated,
    version: LEGAL_CONTACT.version,
    summaryPoints: [
      "Defines the ISP Operator as the Data Controller of its subscriber records and QC NetCore as the Data Processor.",
      "Enforces strict database-level multi-tenant isolation via PostgreSQL Row-Level Security (RLS) keyed by `organization_id`.",
      "Aligns with the Kenya Data Protection Act, 2019 and international data protection standards.",
    ],
    sections: [
      {
        id: "controller-processor-roles",
        number: "1",
        title: "Data Controller & Data Processor Roles",
        paragraphs: [
          "In the context of multi-tenant ISP operations on QC NetCore, data protection roles are structured as follows:",
        ],
        bullets: [
          "ISP Tenant as Data Controller: Each onboarded ISP Operator determines the purposes and means of collecting its end-subscribers' personal data (names, phone numbers, installation addresses, and broadband plans). The ISP Operator is the Data Controller for its subscriber base.",
          "QC NetCore as Data Processor: QC NetCore processes subscriber personal data, session logs, and billing records strictly on behalf of and in accordance with the documented configuration instructions of the respective ISP Operator.",
          "QC NetCore as Data Controller (Operator Accounts): With respect to the account registration and billing details of the ISP Operators themselves, QC NetCore acts as an independent Data Controller.",
        ],
      },
      {
        id: "multi-tenant-isolation",
        number: "2",
        title: "Technical Multi-Tenant Isolation (Row-Level Security)",
        paragraphs: [
          "Every operational table in the QC NetCore PostgreSQL schema (`subscribers`, `service_plans`, `invoices`, `payments`, `routers`, `vouchers`, `active_sessions`, and `network_alerts`) is partitioned by an `organization_id` foreign key and protected by PostgreSQL Row-Level Security (RLS) policies.",
          "This architecture ensures that an authenticated operator belonging to Tenant A is cryptographically and logically prevented from querying, modifying, or exporting subscriber or financial records belonging to Tenant B.",
        ],
      },
      {
        id: "subprocessor-cross-border",
        number: "3",
        title: "Cloud Infrastructure & Cross-Border Processing Safeguards",
        paragraphs: [
          "To provide high-availability cloud hosting and database resilience, tenant data is stored in secure cloud data centers operated by our core infrastructure providers (Supabase / AWS cloud infrastructure and Vercel edge network). All data transmissions between operator browsers, captive portals, and our cloud endpoints are encrypted in transit via HTTPS/TLS.",
        ],
      },
      {
        id: "incident-notification-audit",
        number: "4",
        title: "Data Breach Notification & Return/Deletion of Tenant Data",
        paragraphs: [
          "In the event of a confirmed unauthorized disclosure of tenant personal data within QC NetCore's cloud infrastructure, QC NetCore will notify affected ISP Operators without undue delay, providing relevant technical forensic details to assist the ISP Operator in fulfilling any statutory notification duties under the Kenya Data Protection Act, 2019 or local regulations.",
          "Upon termination of a tenant agreement, the ISP Operator may export its subscriber and invoice records in standard structured formats, after which tenant data is scheduled for secure deletion in accordance with our retention schedule.",
        ],
      },
    ],
  },

  security: {
    slug: "security",
    shortTitle: "Security",
    title: "Platform Security & Trust Architecture",
    subtitle:
      "How QC NetCore secures multi-tenant ISP data, authentication sessions, router provisioning channels, and mobile money payment workflows.",
    metaDescription:
      "Explore QC NetCore's defence-in-depth security controls including Supabase JWT auth, PostgreSQL Row-Level Security, TLS encryption, and payment safety.",
    category: "Security & Trust",
    effectiveDate: LEGAL_CONTACT.effectiveDate,
    lastUpdated: LEGAL_CONTACT.lastUpdated,
    version: LEGAL_CONTACT.version,
    summaryPoints: [
      "Database-enforced Row-Level Security (RLS) isolating every ISP organization's operational and financial records.",
      "Zero storage of sensitive M-Pesa PINs or raw payment card secrets; strict validation of payment callbacks.",
      "Isolated browser-only Demo Mode sandbox preventing public visitors from mutating production tenant databases.",
    ],
    sections: [
      {
        id: "security-architecture",
        number: "1",
        title: "Defence-in-Depth Security Architecture",
        paragraphs: [
          "QC NetCore is engineered as mission-critical infrastructure for Internet Service Providers. Our security posture combines cloud-native authentication, database-level tenant isolation, encrypted transport, and strict separation between public demonstration environments and live production tenants.",
        ],
      },
      {
        id: "access-control-rls",
        number: "2",
        title: "Authentication, RBAC & Multi-Tenant Database Isolation",
        paragraphs: [
          "Access to the QC NetCore operator console is protected by token-based authentication (Supabase Auth with JWT session validation via Next.js Middleware) and Role-Based Access Control (`admin`, `operator`, `technician`, `billing`).",
          "At the persistence layer, PostgreSQL Row-Level Security (RLS) policies verify the user's `organization_id` on every `SELECT`, `INSERT`, `UPDATE`, and `DELETE` operation.",
        ],
      },
      {
        id: "network-router-security",
        number: "3",
        title: "MikroTik, WireGuard & FreeRADIUS Communication Security",
        paragraphs: [
          "Provisioning communications between QC NetCore and tenant MikroTik routers are designed to use encrypted VPN tunnels (such as WireGuard), restricted API service ports, and dedicated least-privilege RouterOS API credentials rather than exposing unencrypted management interfaces to the public internet.",
          "ISP Operators are strongly advised to disable unused RouterOS services (such as public Telnet, FTP, and unencrypted HTTP) and rotate RADIUS shared secrets regularly.",
        ],
      },
      {
        id: "payment-security",
        number: "4",
        title: "Payment & Financial Transaction Security",
        paragraphs: [
          "QC NetCore never prompts for, transmits, or stores customer M-Pesa PINs on our servers. During an M-Pesa STK Push transaction, PIN entry occurs exclusively on the subscriber's own mobile device via Safaricom's SIM Toolkit prompt. QC NetCore records only the resulting transaction reference, amount, payer phone number, and settlement status for accounting and session provisioning.",
        ],
      },
      {
        id: "demo-sandbox-isolation",
        number: "5",
        title: "Interactive Demo Sandbox Isolation",
        paragraphs: [
          "All interactive evaluations performed in Demo Mode (including the Captive Portal Customizer and Free Tools) run in an isolated client-side sandbox backed by browser `localStorage` and read-only demonstration fixtures. Public demo interactions cannot read or modify any live ISP tenant data.",
        ],
      },
    ],
  },

  "responsible-disclosure": {
    slug: "responsible-disclosure",
    shortTitle: "Responsible Disclosure",
    title: "Security Vulnerability & Responsible Disclosure Policy",
    subtitle:
      "Guidelines and safe-harbor principles for security researchers and network engineers reporting potential vulnerabilities to QC NetCore.",
    metaDescription:
      "Report security vulnerabilities to QC NetCore responsibly. Learn about our scope, rules of engagement, and direct security contact channels.",
    category: "Security & Trust",
    effectiveDate: LEGAL_CONTACT.effectiveDate,
    lastUpdated: LEGAL_CONTACT.lastUpdated,
    version: LEGAL_CONTACT.version,
    summaryPoints: [
      "Welcomes good-faith vulnerability reports from security researchers and ISP network engineers.",
      "Provides direct reporting channels via quantumcode7777@gmail.com and WhatsApp 0712052104.",
      "Establishes clear rules of engagement to protect live ISP tenants and subscriber connectivity during security research.",
    ],
    sections: [
      {
        id: "commitment",
        number: "1",
        title: "Our Commitment to Coordinated Vulnerability Disclosure",
        paragraphs: [
          "At QC NetCore, we value the work of independent security researchers, ethical hackers, and network engineers who help keep ISP infrastructure secure. If you discover a potential security vulnerability in the QC NetCore web application, APIs, captive portal engine, or authentication workflows, we encourage you to report it to us responsibly.",
        ],
      },
      {
        id: "how-to-report",
        number: "2",
        title: "How to Submit a Vulnerability Report",
        paragraphs: [
          "Please send a detailed technical report to our Security & Engineering team via one of our verified channels:",
        ],
        bullets: [
          "Security Email: quantumcode7777@gmail.com (Subject line: 'SECURITY DISCLOSURE — QC NetCore')",
          "Urgent Security Escalation (WhatsApp): 0712052104 (+254 712 052 104)",
          "Include: Affected URL/endpoint, step-by-step reproduction instructions, proof-of-concept (PoC) screenshots or HTTP requests, and potential security impact.",
        ],
      },
      {
        id: "rules-of-engagement",
        number: "3",
        title: "Rules of Engagement & Good-Faith Safe Harbor",
        paragraphs: [
          "When conducting security research against QC NetCore, you must adhere to the following rules to qualify as good-faith research:",
        ],
        bullets: [
          "Use Demo Mode or your own test account: Never attempt to access, modify, or exfiltrate data belonging to third-party ISP tenants or live broadband subscribers.",
          "No Service Disruption: Do not perform Denial-of-Service (DoS/DDoS) testing, automated high-volume fuzzing, or spam M-Pesa STK Push endpoints.",
          "No Social Engineering or Physical Testing: Do not phish ISP staff or attempt unauthorized access to physical telecommunications cabinets or routers.",
          "Confidentiality Until Remediation: Allow our engineering team a reasonable timeframe to investigate and deploy a patch before publicly disclosing any details of the finding.",
        ],
      },
      {
        id: "response-process",
        number: "4",
        title: "What You Can Expect From QC NetCore",
        paragraphs: [
          "When you submit a report in accordance with this policy, our engineering team will acknowledge receipt, validate the finding, prioritize remediation based on severity, and notify you once the fix has been deployed to production. We will not pursue legal action against researchers who strictly follow these good-faith guidelines.",
        ],
      },
    ],
  },
};

export const LEGAL_DOCUMENT_LIST: LegalDocument[] = [
  LEGAL_DOCUMENTS.terms,
  LEGAL_DOCUMENTS.privacy,
  LEGAL_DOCUMENTS.cookies,
  LEGAL_DOCUMENTS["acceptable-use"],
  LEGAL_DOCUMENTS.refunds,
  LEGAL_DOCUMENTS["payment-terms"],
  LEGAL_DOCUMENTS.sla,
  LEGAL_DOCUMENTS["data-protection"],
  LEGAL_DOCUMENTS.security,
  LEGAL_DOCUMENTS["responsible-disclosure"],
];

export function getLegalDocument(slug: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS[slug as LegalDocumentSlug];
}
