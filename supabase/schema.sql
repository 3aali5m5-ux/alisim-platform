-- ============================================================
-- alisim Platform | Complete Supabase PostgreSQL Schema
-- Paste & Run ONCE inside Supabase Dashboard -> SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Global App Settings & CMS Config
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'global_config',
  platform_name TEXT NOT NULL DEFAULT 'alisim',
  sms_markup_percent NUMERIC(6,2) NOT NULL DEFAULT 25.00,
  esim_markup_percent NUMERIC(6,2) NOT NULL DEFAULT 20.00,
  usd_to_syp_rate NUMERIC(12,2) NOT NULL DEFAULT 15175.00,
  usd_to_try_rate NUMERIC(10,4) NOT NULL DEFAULT 50.5000,
  usd_to_usdt_rate NUMERIC(10,4) NOT NULL DEFAULT 1.0000,
  rub_to_usd_rate NUMERIC(10,6) NOT NULL DEFAULT 0.010800,
  cms_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. User Wallets & Roles
CREATE TABLE IF NOT EXISTS public.user_wallets (
  user_id TEXT PRIMARY KEY,
  user_name_ar TEXT NOT NULL,
  email_or_phone TEXT,
  balance_usd NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
  total_spent_usd NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
  orders_count INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'USER',
  vip_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. SMS Activations History
CREATE TABLE IF NOT EXISTS public.sms_activations_history (
  id TEXT PRIMARY KEY,
  activation_id TEXT NOT NULL,
  service_code TEXT NOT NULL,
  service_name_ar TEXT NOT NULL,
  country_id TEXT NOT NULL,
  country_name_ar TEXT NOT NULL,
  iso2 TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  base_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0.0000,
  price_usd NUMERIC(10,4) NOT NULL,
  price_syp NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'WAITING_SMS',
  sms_code TEXT,
  full_sms_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 4. eSIM Orders
CREATE TABLE IF NOT EXISTS public.esim_orders (
  id TEXT PRIMARY KEY,
  iccid TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  country_name_ar TEXT NOT NULL,
  iso2 TEXT NOT NULL,
  data_label_ar TEXT NOT NULL,
  validity_days INTEGER NOT NULL,
  network_type TEXT NOT NULL DEFAULT '5G',
  smdp_address TEXT NOT NULL,
  activation_code TEXT NOT NULL,
  lpa_string TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'READY_TO_INSTALL',
  base_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0.0000,
  price_usd NUMERIC(10,4) NOT NULL,
  price_syp NUMERIC(14,2) NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. User Favorites & Live Activity Logs
CREATE TABLE IF NOT EXISTS public.user_favorites (
  user_id TEXT PRIMARY KEY DEFAULT 'default_client',
  pinned_countries JSONB NOT NULL DEFAULT '[]'::jsonb,
  pinned_services JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  details_ar TEXT NOT NULL,
  amount_usd NUMERIC(10,4) DEFAULT 0.0000,
  net_profit_usd NUMERIC(10,4) DEFAULT 0.0000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Pricing Overrides, Payment Gateways, Top-Up Queue & eSIM LPA Inventory
CREATE TABLE IF NOT EXISTS public.pricing_overrides (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('service', 'country')),
  target_code TEXT NOT NULL,
  target_name_ar TEXT NOT NULL,
  custom_markup_percent NUMERIC(6,2),
  fixed_price_usd NUMERIC(10,4),
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  account_address TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  qr_code_text TEXT NOT NULL,
  min_topup_amount NUMERIC(14,2) NOT NULL DEFAULT 1.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  instructions_ar TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.topup_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name_ar TEXT NOT NULL,
  gateway_id TEXT NOT NULL,
  gateway_name_ar TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  amount_original NUMERIC(14,2) NOT NULL,
  currency_original TEXT NOT NULL DEFAULT 'USD',
  equivalent_usd NUMERIC(12,4) NOT NULL,
  equivalent_syp NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.esim_custom_catalog (
  id TEXT PRIMARY KEY,
  country_name_ar TEXT NOT NULL,
  iso2 TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'local',
  data_label_ar TEXT NOT NULL,
  validity_days INTEGER NOT NULL DEFAULT 30,
  network_type TEXT NOT NULL DEFAULT '5G',
  base_cost_usd NUMERIC(10,4) NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.esim_lpa_inventory (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  country_name_ar TEXT NOT NULL,
  iso2 TEXT NOT NULL,
  data_label_ar TEXT NOT NULL,
  smdp_address TEXT NOT NULL,
  activation_code TEXT NOT NULL,
  lpa_string TEXT NOT NULL,
  iccid TEXT NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_order_id TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Triggers & Row Level Security
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_activations_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esim_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esim_custom_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esim_lpa_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow server sync on app_settings" ON public.app_settings;
CREATE POLICY "Allow server sync on app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow server sync on user_wallets" ON public.user_wallets;
CREATE POLICY "Allow server sync on user_wallets" ON public.user_wallets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow server sync on sms_activations_history" ON public.sms_activations_history;
CREATE POLICY "Allow server sync on sms_activations_history" ON public.sms_activations_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow server sync on esim_orders" ON public.esim_orders;
CREATE POLICY "Allow server sync on esim_orders" ON public.esim_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow server sync on user_favorites" ON public.user_favorites;
CREATE POLICY "Allow server sync on user_favorites" ON public.user_favorites FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow server sync on activity_logs" ON public.activity_logs;
CREATE POLICY "Allow server sync on activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow server sync on pricing_overrides" ON public.pricing_overrides;
CREATE POLICY "Allow server sync on pricing_overrides" ON public.pricing_overrides FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow server sync on payment_gateways" ON public.payment_gateways;
CREATE POLICY "Allow server sync on payment_gateways" ON public.payment_gateways FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow server sync on topup_requests" ON public.topup_requests;
CREATE POLICY "Allow server sync on topup_requests" ON public.topup_requests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow server sync on esim_custom_catalog" ON public.esim_custom_catalog;
CREATE POLICY "Allow server sync on esim_custom_catalog" ON public.esim_custom_catalog FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow server sync on esim_lpa_inventory" ON public.esim_lpa_inventory;
CREATE POLICY "Allow server sync on esim_lpa_inventory" ON public.esim_lpa_inventory FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.app_settings (id, platform_name)
VALUES ('global_config', 'alisim')
ON CONFLICT (id) DO NOTHING;
