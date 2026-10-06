-- ====================================================================
-- G-TECH ISP OPERATING SYSTEM - DEVELOPMENT SEED DATA
-- Safe development/demo dataset. NO real credentials or PII.
-- Run ONLY in development/staging environments.
-- ====================================================================

-- NOTE: To use seed data with Supabase Auth, first create a user via the
-- Supabase dashboard or CLI, then reference their UUID below.
-- This seed requires a pre-existing auth.users entry.

-- Organization
INSERT INTO organizations (id, name, slug, business_number, email, phone, currency, timezone, billing_cycle_type, grace_period_days)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'G-Tech Fiber & Wireless Networks Ltd',
    'g-tech-kenya',
    'BN-2024-9812',
    'support@gtechisp.co.ke',
    '+254712345678',
    'KES',
    'Africa/Nairobi',
    'ANNIVERSARY',
    2
) ON CONFLICT (slug) DO NOTHING;

-- Sites
INSERT INTO sites (id, organization_id, name, location_description, latitude, longitude, power_backup_type)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Nairobi CBD - Tower POP', 'Kenyatta Avenue, City House 12th Floor', -1.286389, 36.817223, 'GENERATOR'),
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Westlands - Ring Road Core', 'Sarit Centre Wireless Mast #4', -1.2618, 36.8044, 'SOLAR'),
    ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Kilimani - Argwings Kodhek Base', 'Yaya Center Tower B', -1.2952, 36.7865, 'UPS')
ON CONFLICT DO NOTHING;

-- Plans — PPPoE
INSERT INTO plans (id, organization_id, name, service_type, download_speed_kbps, upload_speed_kbps, priority, validity_duration_seconds, data_limit_mb, price, currency, simultaneous_sessions, mikrotik_rate_limit)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Bronze Fiber - 5 Mbps',  'PPPOE', 5120,  2560, 8, 2592000, 0, 1500.00, 'KES', 1, '2560k/5120k'),
    ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Silver Fiber - 10 Mbps', 'PPPOE', 10240, 5120, 7, 2592000, 0, 2500.00, 'KES', 1, '5120k/10240k 7680k/15360k 4096k/8192k 15/15 7 2048k/4096k'),
    ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Gold Fiber - 20 Mbps',   'PPPOE', 20480, 10240, 5, 2592000, 0, 4000.00, 'KES', 1, '10M/20M')
ON CONFLICT DO NOTHING;

-- Plans — Hotspot
INSERT INTO plans (id, organization_id, name, service_type, download_speed_kbps, upload_speed_kbps, priority, validity_duration_seconds, data_limit_mb, price, currency, simultaneous_sessions, mikrotik_rate_limit)
VALUES
    ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Hotspot 1 Hour Express',    'HOTSPOT', 3072, 1536, 8, 3600,    0, 10.00,  'KES', 1, '1536k/3072k'),
    ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Hotspot 3 Hours Special',   'HOTSPOT', 4096, 2048, 8, 10800,   0, 20.00,  'KES', 1, '2048k/4096k'),
    ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Hotspot 24 Hours Unlimited','HOTSPOT', 5120, 2560, 7, 86400,   0, 50.00,  'KES', 1, '2560k/5120k'),
    ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Hotspot 7 Days Weekly',     'HOTSPOT', 6144, 3072, 6, 604800,  0, 250.00, 'KES', 1, '3072k/6144k'),
    ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'Hotspot 30 Days Monthly',   'HOTSPOT', 8192, 4096, 6, 2592000, 0, 700.00, 'KES', 1, '4096k/8192k')
ON CONFLICT DO NOTHING;
