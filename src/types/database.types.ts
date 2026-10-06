// ====================================================================
// G-TECH ISP OPERATING SYSTEM
// Supabase Database TypeScript Types
// 
// Generated from the database schema to ensure type safety across
// the application. Update by running:
//   npx supabase gen types typescript --project-id YOUR_PROJECT_ID
// 
// Or against local Supabase:
//   npx supabase gen types typescript --local
// 
// DO NOT manually edit types that can be regenerated.
// Hand-maintained helper types are at the bottom of this file.
// ====================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          business_number: string | null
          email: string
          phone: string
          currency: string
          logo_url: string | null
          timezone: string
          billing_cycle_type: 'CALENDAR_MONTH' | 'ANNIVERSARY'
          grace_period_days: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          business_number?: string | null
          email: string
          phone: string
          currency?: string
          logo_url?: string | null
          timezone?: string
          billing_cycle_type?: 'CALENDAR_MONTH' | 'ANNIVERSARY'
          grace_period_days?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          business_number?: string | null
          email?: string
          phone?: string
          currency?: string
          logo_url?: string | null
          timezone?: string
          billing_cycle_type?: 'CALENDAR_MONTH' | 'ANNIVERSARY'
          grace_period_days?: number
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          organization_id: string
          full_name: string
          phone_number: string | null
          avatar_url: string | null
          role: 'super_admin' | 'isp_owner' | 'isp_admin' | 'finance' | 'support' | 'technician' | 'agent' | 'customer'
          is_active: boolean
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          organization_id: string
          full_name: string
          phone_number?: string | null
          avatar_url?: string | null
          role?: 'super_admin' | 'isp_owner' | 'isp_admin' | 'finance' | 'support' | 'technician' | 'agent' | 'customer'
          is_active?: boolean
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string
          phone_number?: string | null
          avatar_url?: string | null
          role?: 'super_admin' | 'isp_owner' | 'isp_admin' | 'finance' | 'support' | 'technician' | 'agent' | 'customer'
          is_active?: boolean
          last_login_at?: string | null
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'profiles_id_fkey'; columns: ['id']; referencedRelation: 'users'; referencedColumns: ['id'] },
          { foreignKeyName: 'profiles_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] }
        ]
      }
      sites: {
        Row: {
          id: string
          organization_id: string
          name: string
          location_description: string | null
          latitude: number | null
          longitude: number | null
          power_backup_type: 'UPS' | 'SOLAR' | 'GENERATOR' | 'GRID' | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          location_description?: string | null
          latitude?: number | null
          longitude?: number | null
          power_backup_type?: 'UPS' | 'SOLAR' | 'GENERATOR' | 'GRID' | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          location_description?: string | null
          latitude?: number | null
          longitude?: number | null
          power_backup_type?: 'UPS' | 'SOLAR' | 'GENERATOR' | 'GRID' | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'sites_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] }
        ]
      }
      routers: {
        Row: {
          id: string
          organization_id: string
          site_id: string | null
          name: string
          management_ip: string
          api_port: number
          api_ssl_port: number
          username: string
          // password_encrypted is NEVER returned to browser clients
          // password_encrypted: string
          routeros_version: string | null
          board_model: string | null
          cpu_load: number
          free_memory_mb: number
          uptime: string | null
          connection_type: 'DIRECT_PUBLIC' | 'WIREGUARD' | 'VPN_SSTP'
          wireguard_public_key: string | null
          wireguard_tunnel_ip: string | null
          status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNREACHABLE'
          last_seen_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          site_id?: string | null
          name: string
          management_ip: string
          api_port?: number
          api_ssl_port?: number
          username: string
          password_encrypted: string
          routeros_version?: string | null
          board_model?: string | null
          cpu_load?: number
          free_memory_mb?: number
          uptime?: string | null
          connection_type?: 'DIRECT_PUBLIC' | 'WIREGUARD' | 'VPN_SSTP'
          wireguard_public_key?: string | null
          wireguard_tunnel_ip?: string | null
          status?: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNREACHABLE'
          last_seen_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          site_id?: string | null
          name?: string
          management_ip?: string
          api_port?: number
          api_ssl_port?: number
          username?: string
          password_encrypted?: string
          routeros_version?: string | null
          board_model?: string | null
          cpu_load?: number
          free_memory_mb?: number
          uptime?: string | null
          connection_type?: 'DIRECT_PUBLIC' | 'WIREGUARD' | 'VPN_SSTP'
          wireguard_public_key?: string | null
          wireguard_tunnel_ip?: string | null
          status?: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNREACHABLE'
          last_seen_at?: string | null
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'routers_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'routers_site_id_fkey'; columns: ['site_id']; referencedRelation: 'sites'; referencedColumns: ['id'] }
        ]
      }
      plans: {
        Row: {
          id: string
          organization_id: string
          name: string
          service_type: 'PPPOE' | 'HOTSPOT'
          download_speed_kbps: number
          upload_speed_kbps: number
          burst_download_kbps: number
          burst_upload_kbps: number
          burst_threshold_kbps: number
          burst_time_seconds: number
          priority: number
          validity_duration_seconds: number
          data_limit_mb: number
          price: number
          currency: string
          simultaneous_sessions: number
          mikrotik_rate_limit: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          service_type: 'PPPOE' | 'HOTSPOT'
          download_speed_kbps: number
          upload_speed_kbps: number
          burst_download_kbps?: number
          burst_upload_kbps?: number
          burst_threshold_kbps?: number
          burst_time_seconds?: number
          priority?: number
          validity_duration_seconds: number
          data_limit_mb?: number
          price: number
          currency?: string
          simultaneous_sessions?: number
          mikrotik_rate_limit: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          service_type?: 'PPPOE' | 'HOTSPOT'
          download_speed_kbps?: number
          upload_speed_kbps?: number
          burst_download_kbps?: number
          burst_upload_kbps?: number
          burst_threshold_kbps?: number
          burst_time_seconds?: number
          priority?: number
          validity_duration_seconds?: number
          data_limit_mb?: number
          price?: number
          currency?: string
          simultaneous_sessions?: number
          mikrotik_rate_limit?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'plans_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] }
        ]
      }
      customers: {
        Row: {
          id: string
          organization_id: string
          auth_user_id: string | null
          account_number: string
          full_name: string
          phone_number: string
          alt_phone_number: string | null
          email: string | null
          national_id: string | null
          physical_address: string | null
          site_id: string | null
          gps_coordinates: string | null
          status: 'LEAD' | 'PENDING_INSTALLATION' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED'
          balance_due: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          auth_user_id?: string | null
          account_number: string
          full_name: string
          phone_number: string
          alt_phone_number?: string | null
          email?: string | null
          national_id?: string | null
          physical_address?: string | null
          site_id?: string | null
          gps_coordinates?: string | null
          status?: 'LEAD' | 'PENDING_INSTALLATION' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED'
          balance_due?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          account_number?: string
          full_name?: string
          phone_number?: string
          alt_phone_number?: string | null
          email?: string | null
          national_id?: string | null
          physical_address?: string | null
          site_id?: string | null
          gps_coordinates?: string | null
          status?: 'LEAD' | 'PENDING_INSTALLATION' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED'
          balance_due?: number
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'customers_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'customers_site_id_fkey'; columns: ['site_id']; referencedRelation: 'sites'; referencedColumns: ['id'] }
        ]
      }
      pppoe_accounts: {
        Row: {
          id: string
          organization_id: string
          customer_id: string
          router_id: string | null
          username: string
          // password_plain intentionally omitted from Row type to prevent
          // accidental browser exposure. Server-side code uses service_role.
          service_plan_id: string
          ip_assignment_type: 'POOL' | 'STATIC'
          static_ip: string | null
          mac_address: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          customer_id: string
          router_id?: string | null
          username: string
          password_plain: string
          service_plan_id: string
          ip_assignment_type?: 'POOL' | 'STATIC'
          static_ip?: string | null
          mac_address?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          router_id?: string | null
          username?: string
          password_plain?: string
          service_plan_id?: string
          ip_assignment_type?: 'POOL' | 'STATIC'
          static_ip?: string | null
          mac_address?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'pppoe_accounts_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'pppoe_accounts_customer_id_fkey'; columns: ['customer_id']; referencedRelation: 'customers'; referencedColumns: ['id'] },
          { foreignKeyName: 'pppoe_accounts_router_id_fkey'; columns: ['router_id']; referencedRelation: 'routers'; referencedColumns: ['id'] },
          { foreignKeyName: 'pppoe_accounts_service_plan_id_fkey'; columns: ['service_plan_id']; referencedRelation: 'plans'; referencedColumns: ['id'] }
        ]
      }
      subscriptions: {
        Row: {
          id: string
          organization_id: string
          customer_id: string
          plan_id: string
          start_time: string
          end_time: string
          grace_end_time: string | null
          status: 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED'
          auto_renew: boolean
          last_renewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          customer_id: string
          plan_id: string
          start_time: string
          end_time: string
          grace_end_time?: string | null
          status?: 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED'
          auto_renew?: boolean
          last_renewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          plan_id?: string
          start_time?: string
          end_time?: string
          grace_end_time?: string | null
          status?: 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED'
          auto_renew?: boolean
          last_renewed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'subscriptions_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'subscriptions_customer_id_fkey'; columns: ['customer_id']; referencedRelation: 'customers'; referencedColumns: ['id'] },
          { foreignKeyName: 'subscriptions_plan_id_fkey'; columns: ['plan_id']; referencedRelation: 'plans'; referencedColumns: ['id'] }
        ]
      }
      voucher_batches: {
        Row: {
          id: string
          organization_id: string
          plan_id: string
          batch_name: string
          quantity: number
          prefix: string | null
          generated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          plan_id: string
          batch_name: string
          quantity: number
          prefix?: string | null
          generated_by?: string | null
          created_at?: string
        }
        Update: {
          batch_name?: string
        }
        Relationships: [
          { foreignKeyName: 'voucher_batches_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'voucher_batches_plan_id_fkey'; columns: ['plan_id']; referencedRelation: 'plans'; referencedColumns: ['id'] }
        ]
      }
      hotspot_vouchers: {
        Row: {
          id: string
          organization_id: string
          batch_id: string | null
          plan_id: string
          code: string
          status: 'AVAILABLE' | 'USED' | 'EXPIRED' | 'DISABLED'
          first_activated_at: string | null
          expires_at: string | null
          used_by_phone: string | null
          used_mac_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          batch_id?: string | null
          plan_id: string
          code: string
          status?: 'AVAILABLE' | 'USED' | 'EXPIRED' | 'DISABLED'
          first_activated_at?: string | null
          expires_at?: string | null
          used_by_phone?: string | null
          used_mac_address?: string | null
          created_at?: string
        }
        Update: {
          status?: 'AVAILABLE' | 'USED' | 'EXPIRED' | 'DISABLED'
          first_activated_at?: string | null
          expires_at?: string | null
          used_by_phone?: string | null
          used_mac_address?: string | null
        }
        Relationships: [
          { foreignKeyName: 'hotspot_vouchers_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'hotspot_vouchers_batch_id_fkey'; columns: ['batch_id']; referencedRelation: 'voucher_batches'; referencedColumns: ['id'] },
          { foreignKeyName: 'hotspot_vouchers_plan_id_fkey'; columns: ['plan_id']; referencedRelation: 'plans'; referencedColumns: ['id'] }
        ]
      }
      invoices: {
        Row: {
          id: string
          organization_id: string
          customer_id: string
          invoice_number: string
          subtotal: number
          tax_amount: number
          total_amount: number
          amount_paid: number
          balance_due: number
          status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID'
          due_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          customer_id: string
          invoice_number: string
          subtotal: number
          tax_amount?: number
          total_amount: number
          amount_paid?: number
          balance_due: number
          status?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID'
          due_date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          amount_paid?: number
          balance_due?: number
          status?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID'
          due_date?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'invoices_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'invoices_customer_id_fkey'; columns: ['customer_id']; referencedRelation: 'customers'; referencedColumns: ['id'] }
        ]
      }
      payments: {
        Row: {
          id: string
          organization_id: string
          customer_id: string | null
          invoice_id: string | null
          payment_method: 'MPESA_EXPRESS' | 'MPESA_C2B' | 'AIRTEL_MONEY' | 'CASH' | 'BANK_TRANSFER'
          amount: number
          currency: string
          transaction_reference: string
          msisdn_phone: string
          sender_name: string | null
          status: 'INITIATED' | 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED'
          raw_payload: Json | null
          processed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          customer_id?: string | null
          invoice_id?: string | null
          payment_method: 'MPESA_EXPRESS' | 'MPESA_C2B' | 'AIRTEL_MONEY' | 'CASH' | 'BANK_TRANSFER'
          amount: number
          currency?: string
          transaction_reference: string
          msisdn_phone: string
          sender_name?: string | null
          status?: 'INITIATED' | 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED'
          raw_payload?: Json | null
          processed_at?: string | null
          created_at?: string
        }
        Update: {
          customer_id?: string | null
          invoice_id?: string | null
          status?: 'INITIATED' | 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED'
          raw_payload?: Json | null
          processed_at?: string | null
        }
        Relationships: [
          { foreignKeyName: 'payments_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'payments_customer_id_fkey'; columns: ['customer_id']; referencedRelation: 'customers'; referencedColumns: ['id'] },
          { foreignKeyName: 'payments_invoice_id_fkey'; columns: ['invoice_id']; referencedRelation: 'invoices'; referencedColumns: ['id'] }
        ]
      }
      work_orders: {
        Row: {
          id: string
          organization_id: string
          ticket_number: string
          customer_id: string | null
          assigned_technician_id: string | null
          title: string
          description: string
          order_type: 'INSTALLATION' | 'REPAIR' | 'SITE_MAINTENANCE' | 'REMOVAL'
          priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
          status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
          scheduled_date: string | null
          completed_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          ticket_number: string
          customer_id?: string | null
          assigned_technician_id?: string | null
          title: string
          description: string
          order_type?: 'INSTALLATION' | 'REPAIR' | 'SITE_MAINTENANCE' | 'REMOVAL'
          priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
          status?: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
          scheduled_date?: string | null
          completed_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          customer_id?: string | null
          assigned_technician_id?: string | null
          title?: string
          description?: string
          order_type?: 'INSTALLATION' | 'REPAIR' | 'SITE_MAINTENANCE' | 'REMOVAL'
          priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
          status?: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
          scheduled_date?: string | null
          completed_at?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'work_orders_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'work_orders_customer_id_fkey'; columns: ['customer_id']; referencedRelation: 'customers'; referencedColumns: ['id'] },
          { foreignKeyName: 'work_orders_assigned_technician_id_fkey'; columns: ['assigned_technician_id']; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ]
      }
      network_alerts: {
        Row: {
          id: string
          organization_id: string
          router_id: string | null
          severity: 'INFO' | 'WARNING' | 'CRITICAL'
          title: string
          message: string
          is_resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          router_id?: string | null
          severity?: 'INFO' | 'WARNING' | 'CRITICAL'
          title: string
          message: string
          is_resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          created_at?: string
        }
        Update: {
          severity?: 'INFO' | 'WARNING' | 'CRITICAL'
          title?: string
          message?: string
          is_resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          { foreignKeyName: 'network_alerts_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] },
          { foreignKeyName: 'network_alerts_router_id_fkey'; columns: ['router_id']; referencedRelation: 'routers'; referencedColumns: ['id'] }
        ]
      }
      audit_log: {
        Row: {
          id: string
          organization_id: string | null
          actor_id: string | null
          actor_email: string | null
          action: string
          resource_type: string | null
          resource_id: string | null
          old_data: Json | null
          new_data: Json | null
          ip_address: string | null
          user_agent: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          actor_id?: string | null
          actor_email?: string | null
          action: string
          resource_type?: string | null
          resource_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: [
          { foreignKeyName: 'audit_log_organization_id_fkey'; columns: ['organization_id']; referencedRelation: 'organizations'; referencedColumns: ['id'] }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      auth_org_id: {
        Args: Record<string, never>
        Returns: string
      }
      auth_role: {
        Args: Record<string, never>
        Returns: string
      }
      is_staff: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// ====================================================================
// HELPER TYPES (hand-maintained)
// ====================================================================

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Convenience row types
export type OrganizationRow = Tables<'organizations'>
export type ProfileRow = Tables<'profiles'>
export type SiteRow = Tables<'sites'>
export type RouterRow = Tables<'routers'>
export type PlanRow = Tables<'plans'>
export type CustomerRow = Tables<'customers'>
export type PppoeAccountRow = Tables<'pppoe_accounts'>
export type SubscriptionRow = Tables<'subscriptions'>
export type VoucherBatchRow = Tables<'voucher_batches'>
export type HotspotVoucherRow = Tables<'hotspot_vouchers'>
export type InvoiceRow = Tables<'invoices'>
export type PaymentRow = Tables<'payments'>
export type WorkOrderRow = Tables<'work_orders'>
export type NetworkAlertRow = Tables<'network_alerts'>
export type AuditLogRow = Tables<'audit_log'>
