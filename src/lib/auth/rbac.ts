import type { UserRole } from "../../types";

export type Permission =
  | "org.manage"
  | "users.manage"
  | "routers.view"
  | "routers.manage"
  | "routers.provision"
  | "customers.view"
  | "customers.create"
  | "customers.update"
  | "customers.suspend"
  | "plans.view"
  | "plans.modify"
  | "billing.view"
  | "billing.reconcile"
  | "billing.refund"
  | "ledger.view"
  | "ledger.post"
  | "approvals.request"
  | "approvals.decide"
  | "vouchers.view"
  | "vouchers.generate"
  | "work_orders.view"
  | "work_orders.update"
  | "noc.view"
  | "olt.manage"
  | "inventory.manage"
  | "gis.manage"
  | "automation.manage"
  | "soc.view"
  | "audit.view"
  | "copilot.use"
  | "portal.access"
  | "sms.view"
  | "sms.send"
  | "sms.send_bulk"
  | "sms.manage_templates"
  | "sms.manage_provider"
  | "sms.view_history"
  | "sms.view_usage";

const ALL_STAFF_PERMISSIONS: Permission[] = [
  "org.manage",
  "users.manage",
  "routers.view",
  "routers.manage",
  "routers.provision",
  "customers.view",
  "customers.create",
  "customers.update",
  "customers.suspend",
  "plans.view",
  "plans.modify",
  "billing.view",
  "billing.reconcile",
  "billing.refund",
  "ledger.view",
  "ledger.post",
  "approvals.request",
  "approvals.decide",
  "vouchers.view",
  "vouchers.generate",
  "work_orders.view",
  "work_orders.update",
  "noc.view",
  "olt.manage",
  "inventory.manage",
  "gis.manage",
  "automation.manage",
  "soc.view",
  "audit.view",
  "copilot.use",
  "portal.access",
  "sms.view",
  "sms.send",
  "sms.send_bulk",
  "sms.manage_templates",
  "sms.manage_provider",
  "sms.view_history",
  "sms.view_usage",
];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: ALL_STAFF_PERMISSIONS,
  isp_owner: ALL_STAFF_PERMISSIONS,
  isp_admin: [
    "users.manage",
    "routers.view",
    "routers.manage",
    "routers.provision",
    "customers.view",
    "customers.create",
    "customers.update",
    "customers.suspend",
    "plans.view",
    "plans.modify",
    "billing.view",
    "billing.reconcile",
    "ledger.view",
    "ledger.post",
    "approvals.request",
    "approvals.decide",
    "vouchers.view",
    "vouchers.generate",
    "work_orders.view",
    "work_orders.update",
    "noc.view",
    "olt.manage",
    "inventory.manage",
    "gis.manage",
    "automation.manage",
    "soc.view",
    "audit.view",
    "copilot.use",
    "sms.view",
    "sms.send",
    "sms.send_bulk",
    "sms.manage_templates",
    "sms.manage_provider",
    "sms.view_history",
    "sms.view_usage",
  ],
  noc_engineer: [
    "routers.view",
    "routers.manage",
    "routers.provision",
    "customers.view",
    "customers.suspend",
    "plans.view",
    "work_orders.view",
    "work_orders.update",
    "noc.view",
    "olt.manage",
    "gis.manage",
    "automation.manage",
    "soc.view",
    "copilot.use",
    "sms.view",
    "sms.send",
    "sms.send_bulk",
    "sms.view_history",
  ],
  finance: [
    "customers.view",
    "billing.view",
    "billing.reconcile",
    "billing.refund",
    "ledger.view",
    "ledger.post",
    "approvals.request",
    "approvals.decide",
    "plans.view",
    "vouchers.view",
    "noc.view",
    "audit.view",
    "copilot.use",
    "sms.view",
    "sms.send",
    "sms.send_bulk",
    "sms.view_history",
    "sms.view_usage",
  ],
  support: [
    "customers.view",
    "customers.create",
    "customers.update",
    "routers.view",
    "plans.view",
    "billing.view",
    "approvals.request",
    "vouchers.view",
    "work_orders.view",
    "work_orders.update",
    "noc.view",
    "copilot.use",
    "sms.view",
    "sms.send",
    "sms.view_history",
  ],
  technician: [
    "customers.view",
    "routers.view",
    "work_orders.view",
    "work_orders.update",
    "noc.view",
    "olt.manage",
    "inventory.manage",
    "gis.manage",
    "copilot.use",
    "sms.view",
  ],
  agent: [
    "customers.view",
    "customers.create",
    "plans.view",
    "vouchers.view",
    "vouchers.generate",
    "billing.view",
    "sms.view",
  ],
  reseller: [
    "customers.view",
    "customers.create",
    "plans.view",
    "vouchers.view",
    "vouchers.generate",
    "billing.view",
    "sms.view",
  ],
  auditor: [
    "routers.view",
    "customers.view",
    "plans.view",
    "billing.view",
    "ledger.view",
    "vouchers.view",
    "work_orders.view",
    "noc.view",
    "soc.view",
    "audit.view",
    "sms.view",
    "sms.view_history",
    "sms.view_usage",
  ],
  customer: [
    "portal.access",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function canManageTenant(role: UserRole): boolean {
  return role === "super_admin" || role === "isp_owner";
}

export function listRolePermissions(role: UserRole): Permission[] {
  return [...(ROLE_PERMISSIONS[role] || [])];
}
