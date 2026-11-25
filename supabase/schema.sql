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

-- ============================================================
-- 8. ShamCash MacroDroid Webhook Receiver (Incoming Transfers Pool + Atomic Auto-Claim)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shamcash_incoming_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL,
  normalized_tx_id TEXT NOT NULL UNIQUE,
  amount NUMERIC(14,4) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'SYP', 'TRY')),
  equivalent_usd NUMERIC(12,4) NOT NULL CHECK (equivalent_usd > 0),
  raw_text TEXT,
  source_app TEXT,
  status TEXT NOT NULL DEFAULT 'UNCLAIMED' CHECK (status IN ('UNCLAIMED', 'CLAIMED', 'REJECTED')),
  matched_topup_id TEXT REFERENCES public.topup_requests(id) ON DELETE SET NULL,
  claimed_by_user_id TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shamcash_transfers_status_received
  ON public.shamcash_incoming_transfers (status, received_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_topup_requests_unique_active_ref
  ON public.topup_requests (UPPER(TRIM(reference_id)))
  WHERE status IN ('PENDING', 'APPROVED');

ALTER TABLE public.shamcash_incoming_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny public access to shamcash_incoming_transfers" ON public.shamcash_incoming_transfers;
CREATE POLICY "Deny public access to shamcash_incoming_transfers"
  ON public.shamcash_incoming_transfers
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.normalize_shamcash_tx_id(p_raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT REGEXP_REPLACE(UPPER(TRIM(COALESCE(p_raw, ''))), '[^A-Z0-9_-]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.process_shamcash_webhook(
  p_transaction_id TEXT,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'USD',
  p_raw_text TEXT DEFAULT NULL,
  p_source_app TEXT DEFAULT 'MacroDroid'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_tx TEXT;
  v_currency TEXT;
  v_usd_to_syp NUMERIC := 15175.00;
  v_usd_to_try NUMERIC := 50.50;
  v_eq_usd NUMERIC(12,4);
  v_transfer_id UUID;
  v_topup RECORD;
  v_tolerance NUMERIC;
  v_new_balance NUMERIC(12,4);
BEGIN
  v_norm_tx := public.normalize_shamcash_tx_id(p_transaction_id);
  v_currency := UPPER(TRIM(COALESCE(p_currency, 'USD')));

  IF LENGTH(v_norm_tx) < 4 OR LENGTH(v_norm_tx) > 64 THEN
    RETURN jsonb_build_object('ok', false, 'outcome', 'INVALID_TRANSACTION_ID');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 100000000 THEN
    RETURN jsonb_build_object('ok', false, 'outcome', 'INVALID_AMOUNT');
  END IF;

  IF v_currency NOT IN ('USD', 'SYP', 'TRY') THEN
    v_currency := 'USD';
  END IF;

  SELECT
    COALESCE(NULLIF(usd_to_syp_rate, 0), 15175.00),
    COALESCE(NULLIF(usd_to_try_rate, 0), 50.50)
  INTO v_usd_to_syp, v_usd_to_try
  FROM public.app_settings
  WHERE id = 'global_config'
  LIMIT 1;

  IF v_currency = 'SYP' THEN
    v_eq_usd := ROUND((p_amount / v_usd_to_syp)::numeric, 4);
  ELSIF v_currency = 'TRY' THEN
    v_eq_usd := ROUND((p_amount / v_usd_to_try)::numeric, 4);
  ELSE
    v_eq_usd := ROUND(p_amount::numeric, 4);
  END IF;

  IF v_eq_usd <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'outcome', 'INVALID_EQUIVALENT_USD');
  END IF;

  INSERT INTO public.shamcash_incoming_transfers (
    transaction_id, normalized_tx_id, amount, currency, equivalent_usd, raw_text, source_app, status
  )
  VALUES (
    TRIM(p_transaction_id), v_norm_tx, p_amount, v_currency, v_eq_usd,
    LEFT(COALESCE(p_raw_text, ''), 2000), LEFT(COALESCE(p_source_app, 'MacroDroid'), 120), 'UNCLAIMED'
  )
  ON CONFLICT (normalized_tx_id) DO NOTHING
  RETURNING id INTO v_transfer_id;

  IF v_transfer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'outcome', 'DUPLICATE', 'transaction_id', v_norm_tx);
  END IF;

  SELECT * INTO v_topup
  FROM public.topup_requests
  WHERE status = 'PENDING'
    AND public.normalize_shamcash_tx_id(reference_id) = v_norm_tx
    AND (LOWER(gateway_id) LIKE '%sham%' OR LOWER(gateway_name_ar) LIKE '%sham%' OR gateway_name_ar LIKE '%شام%')
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    v_tolerance := GREATEST(0.05, v_eq_usd * 0.02);
    IF (
         UPPER(TRIM(COALESCE(v_topup.currency_original, ''))) = v_currency
         AND ABS(COALESCE(v_topup.amount_original, 0) - p_amount) <= GREATEST(0.01, p_amount * 0.01)
       )
       OR ABS(COALESCE(v_topup.equivalent_usd, 0) - v_eq_usd) <= v_tolerance
    THEN
      UPDATE public.topup_requests
      SET status = 'APPROVED', equivalent_usd = v_eq_usd, equivalent_syp = ROUND(v_eq_usd * v_usd_to_syp), processed_at = NOW()
      WHERE id = v_topup.id;

      UPDATE public.shamcash_incoming_transfers
      SET status = 'CLAIMED', matched_topup_id = v_topup.id, claimed_by_user_id = v_topup.user_id, claimed_at = NOW()
      WHERE id = v_transfer_id;

      INSERT INTO public.user_wallets (user_id, user_name_ar, balance_usd, updated_at)
      VALUES (v_topup.user_id, COALESCE(v_topup.user_name_ar, 'عميل المنصة'), v_eq_usd, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET balance_usd = ROUND((public.user_wallets.balance_usd + EXCLUDED.balance_usd)::numeric, 4), updated_at = NOW()
      RETURNING balance_usd INTO v_new_balance;

      INSERT INTO public.activity_logs (id, event_type, title_ar, details_ar, amount_usd, net_profit_usd)
      VALUES (
        'act-sc-' || REPLACE(v_transfer_id::text, '-', ''), 'TOPUP_AUTO_APPROVED',
        'شحن تلقائي فوري عبر شام كاش',
        'مطابقة تلقائية للحوالة #' || v_norm_tx || ' بقيمة ' || p_amount || ' ' || v_currency || ' ($' || ROUND(v_eq_usd, 2) || ')',
        v_eq_usd, 0
      );

      RETURN jsonb_build_object(
        'ok', true, 'outcome', 'MATCHED_AND_CREDITED', 'transfer_id', v_transfer_id,
        'transaction_id', v_norm_tx, 'equivalent_usd', v_eq_usd, 'topup_id', v_topup.id,
        'user_id', v_topup.user_id, 'new_balance_usd', v_new_balance
      );
    ELSE
      RETURN jsonb_build_object(
        'ok', true, 'outcome', 'SAVED_UNCLAIMED_AMOUNT_MISMATCH', 'transfer_id', v_transfer_id,
        'transaction_id', v_norm_tx, 'incoming_usd', v_eq_usd, 'requested_usd', v_topup.equivalent_usd
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'outcome', 'SAVED_UNCLAIMED', 'transfer_id', v_transfer_id,
    'transaction_id', v_norm_tx, 'amount', p_amount, 'currency', v_currency, 'equivalent_usd', v_eq_usd
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_shamcash_topup(
  p_topup_id TEXT, p_user_id TEXT, p_reference_id TEXT, p_requested_usd NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_tx TEXT;
  v_transfer RECORD;
  v_usd_to_syp NUMERIC := 15175.00;
  v_tolerance NUMERIC;
  v_new_balance NUMERIC(12,4);
BEGIN
  v_norm_tx := public.normalize_shamcash_tx_id(p_reference_id);
  IF LENGTH(v_norm_tx) < 4 THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'INVALID_REFERENCE');
  END IF;

  SELECT * INTO v_transfer
  FROM public.shamcash_incoming_transfers
  WHERE normalized_tx_id = v_norm_tx
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'NOT_FOUND_YET');
  END IF;

  IF v_transfer.status <> 'UNCLAIMED' THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'ALREADY_CLAIMED');
  END IF;

  IF p_requested_usd IS NOT NULL AND p_requested_usd > 0 THEN
    v_tolerance := GREATEST(0.05, v_transfer.equivalent_usd * 0.02);
    IF ABS(p_requested_usd - v_transfer.equivalent_usd) > v_tolerance THEN
      RETURN jsonb_build_object('claimed', false, 'reason', 'AMOUNT_MISMATCH', 'verified_usd', v_transfer.equivalent_usd);
    END IF;
  END IF;

  SELECT COALESCE(NULLIF(usd_to_syp_rate, 0), 15175.00) INTO v_usd_to_syp
  FROM public.app_settings WHERE id = 'global_config' LIMIT 1;

  UPDATE public.shamcash_incoming_transfers
  SET status = 'CLAIMED', matched_topup_id = p_topup_id, claimed_by_user_id = p_user_id, claimed_at = NOW()
  WHERE id = v_transfer.id;

  UPDATE public.topup_requests
  SET status = 'APPROVED', equivalent_usd = v_transfer.equivalent_usd, equivalent_syp = ROUND(v_transfer.equivalent_usd * v_usd_to_syp), processed_at = NOW()
  WHERE id = p_topup_id AND status = 'PENDING';

  INSERT INTO public.user_wallets (user_id, user_name_ar, balance_usd, updated_at)
  VALUES (p_user_id, p_user_id, v_transfer.equivalent_usd, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET balance_usd = ROUND((public.user_wallets.balance_usd + EXCLUDED.balance_usd)::numeric, 4), updated_at = NOW()
  RETURNING balance_usd INTO v_new_balance;

  RETURN jsonb_build_object(
    'claimed', true, 'transaction_id', v_norm_tx, 'equivalent_usd', v_transfer.equivalent_usd, 'new_balance_usd', v_new_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_auto_claim_shamcash_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'PENDING'
     AND (LOWER(NEW.gateway_id) LIKE '%sham%' OR LOWER(NEW.gateway_name_ar) LIKE '%sham%' OR NEW.gateway_name_ar LIKE '%شام%')
  THEN
    PERFORM public.claim_shamcash_topup(NEW.id, NEW.user_id, NEW.reference_id, NEW.equivalent_usd);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_claim_shamcash_on_topup_insert ON public.topup_requests;
CREATE TRIGGER trg_auto_claim_shamcash_on_topup_insert
AFTER INSERT ON public.topup_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_claim_shamcash_fn();

REVOKE ALL ON FUNCTION public.process_shamcash_webhook(TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_shamcash_webhook(TEXT, NUMERIC, TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.claim_shamcash_topup(TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_shamcash_topup(TEXT, TEXT, TEXT, NUMERIC) TO service_role;

