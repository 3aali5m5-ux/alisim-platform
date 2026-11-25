-- ============================================================================
-- ShamCash MacroDroid Webhook Receiver — Table, Indexes, RLS & Atomic RPCs
-- Run in Supabase Dashboard -> SQL Editor (idempotent / safe to re-run)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Incoming ShamCash Transfers Pool (strict UNIQUE on normalized transaction_id)
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

-- Prevent duplicate active/approved references across topup_requests
CREATE UNIQUE INDEX IF NOT EXISTS idx_topup_requests_unique_active_ref
  ON public.topup_requests (UPPER(TRIM(reference_id)))
  WHERE status IN ('PENDING', 'APPROVED');

-- Lock down RLS: ONLY service_role (Edge Function / Backend) may read or write incoming transfers
ALTER TABLE public.shamcash_incoming_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny public access to shamcash_incoming_transfers" ON public.shamcash_incoming_transfers;
CREATE POLICY "Deny public access to shamcash_incoming_transfers"
  ON public.shamcash_incoming_transfers
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 2. Helper: Normalize ShamCash transaction IDs consistently
CREATE OR REPLACE FUNCTION public.normalize_shamcash_tx_id(p_raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT REGEXP_REPLACE(UPPER(TRIM(COALESCE(p_raw, ''))), '[^A-Z0-9_-]', '', 'g');
$$;

-- 3. Atomic Webhook Processor RPC (called exclusively by shamcash-webhook Edge Function via service_role)
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

  -- Load live conversion rates from app_settings
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

  -- Atomic duplicate guard via UNIQUE(normalized_tx_id)
  INSERT INTO public.shamcash_incoming_transfers (
    transaction_id,
    normalized_tx_id,
    amount,
    currency,
    equivalent_usd,
    raw_text,
    source_app,
    status
  )
  VALUES (
    TRIM(p_transaction_id),
    v_norm_tx,
    p_amount,
    v_currency,
    v_eq_usd,
    LEFT(COALESCE(p_raw_text, ''), 2000),
    LEFT(COALESCE(p_source_app, 'MacroDroid'), 120),
    'UNCLAIMED'
  )
  ON CONFLICT (normalized_tx_id) DO NOTHING
  RETURNING id INTO v_transfer_id;

  IF v_transfer_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'outcome', 'DUPLICATE',
      'transaction_id', v_norm_tx,
      'message', 'Transaction ID already recorded.'
    );
  END IF;

  -- Look for a matching PENDING ShamCash top-up request with row-level lock
  SELECT *
  INTO v_topup
  FROM public.topup_requests
  WHERE status = 'PENDING'
    AND public.normalize_shamcash_tx_id(reference_id) = v_norm_tx
    AND (
      LOWER(gateway_id) LIKE '%sham%'
      OR LOWER(gateway_name_ar) LIKE '%sham%'
      OR gateway_name_ar LIKE '%شام%'
    )
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    v_tolerance := GREATEST(0.05, v_eq_usd * 0.02);

    -- Verify amount: compare original currency directly when currencies match, else compare USD equivalent
    IF (
         UPPER(TRIM(COALESCE(v_topup.currency_original, ''))) = v_currency
         AND ABS(COALESCE(v_topup.amount_original, 0) - p_amount) <= GREATEST(0.01, p_amount * 0.01)
       )
       OR ABS(COALESCE(v_topup.equivalent_usd, 0) - v_eq_usd) <= v_tolerance
    THEN
      UPDATE public.topup_requests
      SET
        status = 'APPROVED',
        equivalent_usd = v_eq_usd,
        equivalent_syp = ROUND(v_eq_usd * v_usd_to_syp),
        processed_at = NOW()
      WHERE id = v_topup.id;

      UPDATE public.shamcash_incoming_transfers
      SET
        status = 'CLAIMED',
        matched_topup_id = v_topup.id,
        claimed_by_user_id = v_topup.user_id,
        claimed_at = NOW()
      WHERE id = v_transfer_id;

      INSERT INTO public.user_wallets (user_id, user_name_ar, balance_usd, updated_at)
      VALUES (v_topup.user_id, COALESCE(v_topup.user_name_ar, 'عميل المنصة'), v_eq_usd, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET
        balance_usd = ROUND((public.user_wallets.balance_usd + EXCLUDED.balance_usd)::numeric, 4),
        updated_at = NOW()
      RETURNING balance_usd INTO v_new_balance;

      INSERT INTO public.activity_logs (id, event_type, title_ar, details_ar, amount_usd, net_profit_usd)
      VALUES (
        'act-sc-' || REPLACE(v_transfer_id::text, '-', ''),
        'TOPUP_AUTO_APPROVED',
        'شحن تلقائي فوري عبر شام كاش',
        'مطابقة تلقائية للحوالة #' || v_norm_tx || ' بقيمة ' || p_amount || ' ' || v_currency || ' ($' || ROUND(v_eq_usd, 2) || ') للحساب ' || COALESCE(v_topup.user_name_ar, v_topup.user_id),
        v_eq_usd,
        0
      );

      RETURN jsonb_build_object(
        'ok', true,
        'outcome', 'MATCHED_AND_CREDITED',
        'transfer_id', v_transfer_id,
        'transaction_id', v_norm_tx,
        'amount', p_amount,
        'currency', v_currency,
        'equivalent_usd', v_eq_usd,
        'topup_id', v_topup.id,
        'user_id', v_topup.user_id,
        'new_balance_usd', v_new_balance
      );
    ELSE
      -- Amount mismatch: keep transfer UNCLAIMED for safe admin review rather than crediting blindly
      RETURN jsonb_build_object(
        'ok', true,
        'outcome', 'SAVED_UNCLAIMED_AMOUNT_MISMATCH',
        'transfer_id', v_transfer_id,
        'transaction_id', v_norm_tx,
        'incoming_usd', v_eq_usd,
        'requested_usd', v_topup.equivalent_usd,
        'topup_id', v_topup.id
      );
    END IF;
  END IF;

  -- No pending request yet -> saved as UNCLAIMED until customer enters transaction_id
  RETURN jsonb_build_object(
    'ok', true,
    'outcome', 'SAVED_UNCLAIMED',
    'transfer_id', v_transfer_id,
    'transaction_id', v_norm_tx,
    'amount', p_amount,
    'currency', v_currency,
    'equivalent_usd', v_eq_usd
  );
END;
$$;

-- 4. Atomic Claim RPC (called when customer submits their ShamCash transaction_id)
CREATE OR REPLACE FUNCTION public.claim_shamcash_topup(
  p_topup_id TEXT,
  p_user_id TEXT,
  p_reference_id TEXT,
  p_requested_usd NUMERIC DEFAULT NULL
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

  SELECT *
  INTO v_transfer
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
      RETURN jsonb_build_object(
        'claimed', false,
        'reason', 'AMOUNT_MISMATCH',
        'verified_usd', v_transfer.equivalent_usd
      );
    END IF;
  END IF;

  SELECT COALESCE(NULLIF(usd_to_syp_rate, 0), 15175.00)
  INTO v_usd_to_syp
  FROM public.app_settings
  WHERE id = 'global_config'
  LIMIT 1;

  UPDATE public.shamcash_incoming_transfers
  SET
    status = 'CLAIMED',
    matched_topup_id = p_topup_id,
    claimed_by_user_id = p_user_id,
    claimed_at = NOW()
  WHERE id = v_transfer.id;

  UPDATE public.topup_requests
  SET
    status = 'APPROVED',
    equivalent_usd = v_transfer.equivalent_usd,
    equivalent_syp = ROUND(v_transfer.equivalent_usd * v_usd_to_syp),
    processed_at = NOW()
  WHERE id = p_topup_id AND status = 'PENDING';

  INSERT INTO public.user_wallets (user_id, user_name_ar, balance_usd, updated_at)
  VALUES (p_user_id, p_user_id, v_transfer.equivalent_usd, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET
    balance_usd = ROUND((public.user_wallets.balance_usd + EXCLUDED.balance_usd)::numeric, 4),
    updated_at = NOW()
  RETURNING balance_usd INTO v_new_balance;

  INSERT INTO public.activity_logs (id, event_type, title_ar, details_ar, amount_usd, net_profit_usd)
  VALUES (
    'act-sc-claim-' || REPLACE(v_transfer.id::text, '-', ''),
    'TOPUP_AUTO_APPROVED',
    'تفعيل فوري لحوالة شام كاش واردة',
    'تمت مطابقة رقم العملية #' || v_norm_tx || ' وإضافة $' || ROUND(v_transfer.equivalent_usd, 2) || ' تلقائياً للحساب ' || p_user_id,
    v_transfer.equivalent_usd,
    0
  );

  RETURN jsonb_build_object(
    'claimed', true,
    'transaction_id', v_norm_tx,
    'amount', v_transfer.amount,
    'currency', v_transfer.currency,
    'equivalent_usd', v_transfer.equivalent_usd,
    'new_balance_usd', v_new_balance
  );
END;
$$;

-- 5. Automatic Trigger: When a ShamCash PENDING row is inserted into topup_requests, auto-claim if already received!
CREATE OR REPLACE FUNCTION public.trg_auto_claim_shamcash_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'PENDING'
     AND (
       LOWER(NEW.gateway_id) LIKE '%sham%'
       OR LOWER(NEW.gateway_name_ar) LIKE '%sham%'
       OR NEW.gateway_name_ar LIKE '%شام%'
     )
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

-- 6. Lock down RPC execution strictly to service_role (block anon & authenticated direct calls)
REVOKE ALL ON FUNCTION public.process_shamcash_webhook(TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_shamcash_webhook(TEXT, NUMERIC, TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.claim_shamcash_topup(TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_shamcash_topup(TEXT, TEXT, TEXT, NUMERIC) TO service_role;
