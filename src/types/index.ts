// ====================================================================
// G-TECH ISP OPERATING SYSTEM - SHARED DOMAIN TYPES
// ====================================================================

export type UserRole =
  | 'super_admin'
  | 'isp_owner'
  | 'isp_admin'
  | 'noc_engineer'
  | 'finance'
  | 'support'
  | 'technician'
  | 'agent'
  | 'auditor'
  | 'reseller'
  | 'customer';

export interface User {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  businessNumber?: string;
  email: string;
  phone: string;
  currency: string;
  logoUrl?: string;
  timezone: string;
  billingCycleType: 'CALENDAR_MONTH' | 'ANNIVERSARY';
  gracePeriodDays: number;
  isActive: boolean;
  createdAt: string;
}

export interface Site {
  id: string;
  organizationId: string;
  name: string;
  locationDescription?: string;
  latitude?: number;
  longitude?: number;
  powerBackupType?: 'UPS' | 'SOLAR' | 'GENERATOR' | 'GRID';
  routerCount?: number;
  customerCount?: number;
  createdAt: string;
}

export type RouterStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNREACHABLE';

export interface Router {
  id: string;
  organizationId: string;
  siteId?: string;
  siteName?: string;
  name: string;
  managementIp: string;
  apiPort: number;
  apiSslPort: number;
  username: string;
  routerosVersion: string;
  boardModel: string;
  cpuLoad: number;
  freeMemoryMb: number;
  uptime: string;
  connectionType: 'DIRECT_PUBLIC' | 'WIREGUARD' | 'VPN_SSTP';
  wireguardPublicKey?: string;
  wireguardTunnelIp?: string;
  status: RouterStatus;
  lastSeenAt: string;
  activeSessions?: number;
  createdAt: string;
}

export type ServiceType = 'PPPOE' | 'HOTSPOT';

export interface ServicePlan {
  id: string;
  organizationId: string;
  name: string;
  serviceType: ServiceType;
  downloadSpeedKbps: number;
  uploadSpeedKbps: number;
  burstDownloadKbps?: number;
  burstUploadKbps?: number;
  burstThresholdKbps?: number;
  burstTimeSeconds?: number;
  priority: number;
  validityDurationSeconds: number; // e.g. 3600 (1hr), 86400 (1d), 2592000 (30d)
  dataLimitMb: number; // 0 = Unlimited
  price: number;
  currency: string;
  simultaneousSessions: number;
  mikrotikRateLimit: string;
  isActive: boolean;
  subscriberCount?: number;
  createdAt: string;
}

export type CustomerStatus = 'LEAD' | 'PENDING_INSTALLATION' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';

export interface Customer {
  id: string;
  organizationId: string;
  userId?: string;
  accountNumber: string; // e.g. "GT-8921"
  fullName: string;
  phoneNumber: string;
  altPhoneNumber?: string;
  email?: string;
  nationalId?: string;
  physicalAddress?: string;
  siteId?: string;
  siteName?: string;
  gpsCoordinates?: string;
  status: CustomerStatus;
  currentPlan?: ServicePlan;
  pppoeAccount?: PppoeAccount;
  subscription?: Subscription;
  balanceDue: number;
  createdAt: string;
}

export interface PppoeAccount {
  id: string;
  organizationId: string;
  customerId: string;
  routerId?: string;
  username: string;
  passwordPlain: string;
  servicePlanId: string;
  ipAssignmentType: 'POOL' | 'STATIC';
  staticIp?: string;
  macAddress?: string;
  isActive: boolean;
  isOnline?: boolean;
  currentIp?: string;
  uptime?: string;
  bytesIn?: number;
  bytesOut?: number;
}

export type SubscriptionStatus = 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';

export interface Subscription {
  id: string;
  organizationId: string;
  customerId: string;
  planId: string;
  planName?: string;
  startTime: string;
  endTime: string;
  graceEndTime?: string;
  status: SubscriptionStatus;
  autoRenew: boolean;
  lastRenewedAt?: string;
  createdAt: string;
}

export type VoucherStatus = 'AVAILABLE' | 'USED' | 'EXPIRED' | 'DISABLED';

export interface VoucherBatch {
  id: string;
  organizationId: string;
  planId: string;
  planName?: string;
  batchName: string;
  quantity: number;
  prefix?: string;
  generatedByName?: string;
  createdAt: string;
}

export interface HotspotVoucher {
  id: string;
  organizationId: string;
  batchId: string;
  planId: string;
  planName?: string;
  planPrice?: number;
  planDuration?: string;
  code: string;
  status: VoucherStatus;
  firstActivatedAt?: string;
  expiresAt?: string;
  usedByPhone?: string;
  usedMacAddress?: string;
  createdAt: string;
}

export type PaymentMethod = 'MPESA_EXPRESS' | 'MPESA_C2B' | 'AIRTEL_MONEY' | 'CASH' | 'BANK_TRANSFER';
export type PaymentStatus = 'INITIATED' | 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export interface Payment {
  id: string;
  organizationId: string;
  customerId?: string;
  customerName?: string;
  accountNumber?: string;
  invoiceId?: string;
  paymentMethod: PaymentMethod;
  amount: number;
  currency: string;
  transactionReference: string; // e.g. "RKF9283KDJ"
  msisdnPhone: string;
  senderName?: string;
  status: PaymentStatus;
  processedAt?: string;
  createdAt: string;
}

export type InvoiceStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';

export interface Invoice {
  id: string;
  organizationId: string;
  customerId: string;
  customerName?: string;
  invoiceNumber: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  dueDate: string;
  createdAt: string;
}

export type WorkOrderStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface WorkOrder {
  id: string;
  organizationId: string;
  ticketNumber: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  title: string;
  description: string;
  orderType: 'INSTALLATION' | 'REPAIR' | 'SITE_MAINTENANCE' | 'REMOVAL';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  status: WorkOrderStatus;
  scheduledDate?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface NetworkAlert {
  id: string;
  organizationId: string;
  routerId?: string;
  routerName?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  isResolved: boolean;
  createdAt: string;
}

export interface NOCStats {
  totalSubscribers: number;
  activeSubscribers: number;
  onlinePppoe: number;
  onlineHotspot: number;
  /** false when no live-session source is connected (counts above are then not real). Undefined = demo/seed data. */
  sessionsAvailable?: boolean;
  expiringIn24h: number;
  suspendedCount: number;
  totalRouters: number;
  onlineRouters: number;
  currentBandwidthMbps: {
    download: number;
    upload: number;
  };
  revenueToday: number;
  revenueThisMonth: number;
  recentAlerts: NetworkAlert[];
}
