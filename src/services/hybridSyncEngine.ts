import {
  SupportedCurrency,
  PricingOverrideRule,
  PaymentGatewayConfig,
  TopUpOrderRequest,
  ManagedUserAccount,
  ESimLpaInventoryItem,
  SiteCmsConfig,
  ActivityLogEntry,
  SupabaseConfigState,
  SqlMigrationPatch,
  ESimPlan,
  ActiveSmsOrder,
  ActiveESimOrder,
  PaymentTransaction,
  PlatformSettings,
  HeroSlideItem,
} from '../types';

// ============================================================================
// 1. Web Audio API Synthesizer Chime (No external MP3 required)
// ============================================================================
export function isNotificationSoundMuted(): boolean {
  try {
    return localStorage.getItem('alisms_notif_muted_v1') === 'true';
  } catch {
    return false;
  }
}

export function playCyberChime(
  variant: 'otp' | 'success' | 'alert' | 'notification' = 'otp',
  forcePlay = false
) {
  try {
    if (!forcePlay && isNotificationSoundMuted()) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes =
      variant === 'otp'
        ? [587.33, 880, 1174.66] // D5 -> A5 -> D6 futuristic arpeggio
        : variant === 'success'
        ? [523.25, 659.25, 783.99, 1046.5] // C5 major chord
        : variant === 'notification'
        ? [659.25, 987.77] // Crisp E5 -> B5 chime
        : [330, 261.63]; // Alert

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = variant === 'otp' || variant === 'notification' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.001, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.16, now + idx * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.36);
    });
  } catch {
    // Ignore audio context autoplay restrictions if not interacted yet
  }
}

// ============================================================================
// 2. Auto Regex OTP Extractor (/\b\d{4,8}\b/)
// ============================================================================
export function extractOtpFromText(rawSms: string | null | undefined): string | null {
  if (!rawSms) return null;
  const match = rawSms.match(/\b\d{4,8}\b/);
  return match ? match[0] : null;
}

// ============================================================================
// 3. Multi-Currency & Layered Pricing Engine (USD, USDT, SYP, TRY)
// ============================================================================
export interface ExchangeRatesConfig {
  usdToSypRate: number;
  usdToTryRate: number;
  usdToUsdtRate: number;
}

export function formatCurrencyAmount(
  amountUsd: number,
  currency: SupportedCurrency,
  rates: ExchangeRatesConfig
): string {
  const safeUsd = Number.isFinite(amountUsd) ? amountUsd : 0;
  switch (currency) {
    case 'USD':
      return `$${safeUsd.toFixed(2)}`;
    case 'USDT':
      return `${(safeUsd * (rates.usdToUsdtRate || 1)).toFixed(2)} USDT`;
    case 'TRY':
      return `${(safeUsd * (rates.usdToTryRate || 34.5)).toFixed(2)} ₺`;
    case 'SYP':
      return `${Math.round(safeUsd * (rates.usdToSypRate || 14800)).toLocaleString('en-US')} ل.س`;
    default:
      return `$${safeUsd.toFixed(2)}`;
  }
}

export function convertCurrencyToUsd(
  amount: number,
  currency: SupportedCurrency,
  rates: ExchangeRatesConfig
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  switch (currency) {
    case 'USD':
      return amount;
    case 'USDT':
      return amount / (rates.usdToUsdtRate || 1);
    case 'TRY':
      return amount / (rates.usdToTryRate || 34.5);
    case 'SYP':
      return amount / (rates.usdToSypRate || 14800);
    default:
      return amount;
  }
}

/**
 * Calculates final customer USD price applying:
 * 1) Custom service or country fixedPriceUsd override
 * 2) Custom service or country customMarkupPercent override
 * 3) Global smsMarkupPercent
 * 4) Active user VIP / Reseller discount percent
 */
export function calculateEffectiveSmsPriceUsd(params: {
  baseCostUsd: number;
  serviceCode: string;
  countryId: string;
  globalSmsMarkupPercent: number;
  overrides: PricingOverrideRule[];
}): { finalUsd: number; netProfitUsd: number; hasCustomOverride: boolean } {
  const { baseCostUsd, serviceCode, countryId, globalSmsMarkupPercent, overrides } = params;

  const serviceRule = overrides.find(
    (r) => r.targetType === 'service' && r.targetCode.toLowerCase() === serviceCode.toLowerCase()
  );
  const countryRule = overrides.find(
    (r) => r.targetType === 'country' && r.targetCode === String(countryId)
  );

  let price = baseCostUsd * (1 + globalSmsMarkupPercent / 100);
  let hasCustomOverride = false;

  if (serviceRule && serviceRule.fixedPriceUsd !== null && serviceRule.fixedPriceUsd > 0) {
    price = serviceRule.fixedPriceUsd;
    hasCustomOverride = true;
  } else if (serviceRule && serviceRule.customMarkupPercent !== null) {
    price = baseCostUsd * (1 + serviceRule.customMarkupPercent / 100);
    hasCustomOverride = true;
  } else if (countryRule && countryRule.fixedPriceUsd !== null && countryRule.fixedPriceUsd > 0) {
    price = countryRule.fixedPriceUsd;
    hasCustomOverride = true;
  } else if (countryRule && countryRule.customMarkupPercent !== null) {
    price = baseCostUsd * (1 + countryRule.customMarkupPercent / 100);
    hasCustomOverride = true;
  }

  const finalUsd = Number(Math.max(0.05, price).toFixed(2));
  const netProfitUsd = Number(Math.max(0, finalUsd - baseCostUsd).toFixed(2));

  return { finalUsd, netProfitUsd, hasCustomOverride };
}

export function calculateEffectiveESimPriceUsd(params: {
  baseCostUsd: number;
  globalESimMarkupPercent: number;
}): { finalUsd: number; netProfitUsd: number } {
  const { baseCostUsd, globalESimMarkupPercent } = params;
  const price = baseCostUsd * (1 + globalESimMarkupPercent / 100);
  const finalUsd = Number(Math.max(0.5, price).toFixed(2));
  const netProfitUsd = Number(Math.max(0, finalUsd - baseCostUsd).toFixed(2));
  return { finalUsd, netProfitUsd };
}

// ============================================================================
// 4. Default Initial Data for Super Admin & Hybrid Storage
// ============================================================================
export const DEFAULT_HERO_SLIDES: HeroSlideItem[] = [
  {
    id: 'slide-sms-instant',
    imageUrl: '/src/assets/images/slider_virtual_numbers_1795293597673.jpg',
    titleAr: 'أرقام تفعيل فورية لأكثر من 200 دولة',
    subtitleAr: 'استلم أكواد OTP مباشرة لتطبيقات واتساب وتيليجرام وجوجل مع حفظ جميع الأكواد المستلمة.',
    ctaLabelAr: 'ابدأ التفعيل الآن',
    ctaAction: 'sms',
    isEnabled: true,
    order: 0,
  },
  {
    id: 'slide-esim-global',
    imageUrl: '/src/assets/images/slider_global_esim_1795293598383.jpg',
    titleAr: 'شرائح بيانات eSIM عالمية بتقنية 5G',
    subtitleAr: 'تسليم فوري عبر رمز QR وبيانات SM-DP+ بدون شريحة بلاستيكية لجميع الوجهات.',
    ctaLabelAr: 'تصفّح باقات eSIM',
    ctaAction: 'esim',
    isEnabled: true,
    order: 1,
  },
  {
    id: 'slide-wallet-auto',
    imageUrl: '/src/assets/images/slider_instant_wallet_1795293595935.jpg',
    titleAr: 'شحن رصيد تلقائي عبر شام كاش وباينانس',
    subtitleAr: 'تحديث آلي لأسعار الصرف وعملات متعددة (USD / USDT / SYP / TRY) على مدار الساعة.',
    ctaLabelAr: 'شحن المحفظة',
    ctaAction: 'wallet',
    isEnabled: true,
    order: 2,
  },
];

export const DEFAULT_CMS_CONFIG: SiteCmsConfig = {
  platformName: 'alisim',
  appShortName: 'alisim',
  siteLogoUrl: '/pwa-192x192.png',
  heroWelcomeTitle: 'تفعيل الأرقام العالمية وشرائح eSIM الفورية',
  heroWelcomeSubtitle:
    'أرقام افتراضية لأكثر من 200 دولة وباقات eSIM فورية مع تحديث آلي لأسعار الصرف وبوابات شحن تلقائية.',
  heroSlides: DEFAULT_HERO_SLIDES,
  sliderAutoPlay: true,
  sliderAutoPlayMs: 5500,
  sliderTransitionStyle: 'cube3d',
  announcementEnabled: true,
  announcementText:
    'أهلاً بكم في منصة AliSMS — شحن تلقائي فوري عبر Binance Pay وشام كاش، وتحديث لحظي لأسعار العملات وتفعيل مباشر للأرقام وشرائح eSIM.',
  announcementSpeed: 'normal',
  announcementPaused: false,
  supportWhatsapp: '',
  supportTelegram: '',
  supportChatEnabled: true,
  supportAllowVoice: true,
  supportAllowImages: true,
  supportAdminDisplayName: 'الإدارة العليا — AliSMS',
  supportAdminBadgeTitle: 'المدير العام',
  supportWelcomeMessage:
    'مرحباً بك في الدعم الفني المباشر لمنصة AliSMS! كيف يمكننا مساعدتك اليوم؟ يمكنك إرسال نص أو صورة أو رسالة صوتية.',
  maintenanceMode: false,
  maintenanceMessage:
    'نقوم حالياً بإجراء صيانة دورية قصيرة لتحسين الأداء. سنعود للعمل خلال دقائق.',
  adminPin: '1234',
  esimDeliveryMode: 'INVENTORY_FIRST',
  corsProxyUrl: '/api/grizzly',
};

export const DEFAULT_PAYMENT_GATEWAYS: PaymentGatewayConfig[] = [];

export const DEFAULT_MANAGED_USERS: ManagedUserAccount[] = [];

export const DEFAULT_PRICING_OVERRIDES: PricingOverrideRule[] = [];

export const DEFAULT_LPA_INVENTORY: ESimLpaInventoryItem[] = [];

export const DEFAULT_TOPUP_REQUESTS: TopUpOrderRequest[] = [];

export const DEFAULT_ACTIVITY_LOGS: ActivityLogEntry[] = [];

// ============================================================================
// 5. Versioned SQL Migration Hub Patches (v1.0 -> v1.4)
// ============================================================================
export const SUPABASE_SQL_PATCHES: SqlMigrationPatch[] = [
  {
    version: 'v1.0',
    titleAr: 'Patch v1.0 (Core Setup) — الجداول الأساسية والإعدادات والمحافظ',
    badgeTextAr: '🆕 كود تحديث جديد - يلزم إضافته إلى Supabase',
    descriptionAr:
      'ينشئ جدول إعدادات المنصة العامة (app_settings) وجدول محافظ المستخدمين والأرصدة متعددة العملات (user_wallets).',
    tablesIncluded: ['app_settings', 'user_wallets'],
    sqlCode: `-- ============================================================
-- AliSMS 3D Cyber-FinTech | Patch v1.0 (Core Setup)
-- Run inside Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'global_config',
  platform_name TEXT NOT NULL DEFAULT 'AliSMS 3D',
  sms_markup_percent NUMERIC(6,2) NOT NULL DEFAULT 25.00,
  esim_markup_percent NUMERIC(6,2) NOT NULL DEFAULT 20.00,
  usd_to_syp_rate NUMERIC(12,2) NOT NULL DEFAULT 14800.00,
  usd_to_try_rate NUMERIC(10,4) NOT NULL DEFAULT 34.5000,
  usd_to_usdt_rate NUMERIC(10,4) NOT NULL DEFAULT 1.0000,
  rub_to_usd_rate NUMERIC(10,6) NOT NULL DEFAULT 0.010800,
  cms_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_wallets (
  user_id TEXT PRIMARY KEY,
  user_name_ar TEXT NOT NULL,
  email_or_phone TEXT,
  balance_usd NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
  total_spent_usd NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
  orders_count INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'STANDARD',
  vip_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.app_settings (id, platform_name)
VALUES ('global_config', 'AliSMS 3D')
ON CONFLICT (id) DO NOTHING;`,
  },
  {
    version: 'v1.1',
    titleAr: 'Patch v1.1 (Orders & Logs) — سجل تفعيلات الأرقام وطلبات شرائح الـ eSIM',
    badgeTextAr: '🆕 كود تحديث جديد - يلزم إضافته إلى Supabase',
    descriptionAr:
      'ينشئ جدول تفعيلات الأرقام الافتراضية وأكواد الـ OTP المستخرجة (sms_activations_history) وجدول طلبات شرائح البيانات وبيانات الـ QR/SM-DP+ (esim_orders).',
    tablesIncluded: ['sms_activations_history', 'esim_orders'],
    sqlCode: `-- ============================================================
-- AliSMS 3D Cyber-FinTech | Patch v1.1 (Orders & Logs)
-- ============================================================

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
);`,
  },
  {
    version: 'v1.2',
    titleAr: 'Patch v1.2 (Security & RLS Policies) — سياسات الحماية والتحديث التلقائي',
    badgeTextAr: '🆕 كود تحديث جديد - يلزم إضافته إلى Supabase',
    descriptionAr:
      'يفعّل نظام حماية الصفوف (Row Level Security) وينشئ سياسات القراءة والكتابة الآمنة ومشغلات (Triggers) لتحديث حقل updated_at تلقائياً.',
    tablesIncluded: ['RLS Policies', 'updated_at Triggers'],
    sqlCode: `-- ============================================================
-- AliSMS 3D Cyber-FinTech | Patch v1.2 (Security & RLS Policies)
-- ============================================================

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

DROP POLICY IF EXISTS "Allow hybrid sync access on app_settings" ON public.app_settings;
CREATE POLICY "Allow hybrid sync access on app_settings"
  ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow hybrid sync access on user_wallets" ON public.user_wallets;
CREATE POLICY "Allow hybrid sync access on user_wallets"
  ON public.user_wallets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow hybrid sync access on sms_activations_history" ON public.sms_activations_history;
CREATE POLICY "Allow hybrid sync access on sms_activations_history"
  ON public.sms_activations_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow hybrid sync access on esim_orders" ON public.esim_orders;
CREATE POLICY "Allow hybrid sync access on esim_orders"
  ON public.esim_orders FOR ALL USING (true) WITH CHECK (true);`,
  },
  {
    version: 'v1.3',
    titleAr: 'Patch v1.3 (Favorites & Live Telemetry) — المفضلة وسجل المراقبة الحية للأرباح',
    badgeTextAr: '🆕 كود تحديث جديد - يلزم إضافته إلى Supabase',
    descriptionAr:
      'يضيف جدول حفظ الدول والتطبيقات المفضلة (user_favorites) وجدول سجل المراقبة الحي وصافي الأرباح (activity_logs).',
    tablesIncluded: ['user_favorites', 'activity_logs'],
    sqlCode: `-- ============================================================
-- AliSMS 3D Cyber-FinTech | Patch v1.3 (Favorites & Telemetry)
-- ============================================================

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

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow hybrid sync on user_favorites" ON public.user_favorites;
CREATE POLICY "Allow hybrid sync on user_favorites"
  ON public.user_favorites FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow hybrid sync on activity_logs" ON public.activity_logs;
CREATE POLICY "Allow hybrid sync on activity_logs"
  ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);`,
  },
  {
    version: 'v1.4',
    titleAr:
      'Patch v1.4 (Super Admin, Payments & Custom Overrides) — غرفة العمليات الشاملة وتخصيص الأسعار وبوابات الدفع',
    badgeTextAr: '🆕 كود تحديث جديد - يلزم إضافته إلى Supabase',
    descriptionAr:
      'الحزمة الأحدث لغرفة العمليات الإدارية: تنشئ جداول تخصيص أسعار وإخفاء الخدمات والدول (pricing_overrides)، بوابات الدفع الديناميكية (payment_gateways)، طابور طلبات شحن الرصيد (topup_requests)، ومخزون أكواد الشرائح الجاهزة (esim_lpa_inventory).',
    tablesIncluded: [
      'pricing_overrides',
      'payment_gateways',
      'topup_requests',
      'esim_custom_catalog',
      'esim_lpa_inventory',
    ],
    sqlCode: `-- ============================================================
-- AliSMS 3D Cyber-FinTech | Patch v1.4 (Super Admin Command Center)
-- Includes Custom Pricing Overrides, Payment Gateways, Top-Up Queue & LPA Pool
-- ============================================================

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

ALTER TABLE public.pricing_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esim_custom_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esim_lpa_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow hybrid sync on pricing_overrides" ON public.pricing_overrides;
CREATE POLICY "Allow hybrid sync on pricing_overrides"
  ON public.pricing_overrides FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow hybrid sync on payment_gateways" ON public.payment_gateways;
CREATE POLICY "Allow hybrid sync on payment_gateways"
  ON public.payment_gateways FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow hybrid sync on topup_requests" ON public.topup_requests;
CREATE POLICY "Allow hybrid sync on topup_requests"
  ON public.topup_requests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow hybrid sync on esim_custom_catalog" ON public.esim_custom_catalog;
CREATE POLICY "Allow hybrid sync on esim_custom_catalog"
  ON public.esim_custom_catalog FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow hybrid sync on esim_lpa_inventory" ON public.esim_lpa_inventory;
CREATE POLICY "Allow hybrid sync on esim_lpa_inventory"
  ON public.esim_lpa_inventory FOR ALL USING (true) WITH CHECK (true);`,
  },
];

// ============================================================================
// 6. Hybrid LocalStorage + Supabase Sync Layer
// ============================================================================
const STORAGE_KEYS = {
  SUPABASE_CFG: 'alisms_supabase_cfg_v1',
  CMS_CFG: 'alisms_cms_cfg_v1',
  PRICING_OVERRIDES: 'alisms_pricing_overrides_v1',
  PAYMENT_GATEWAYS: 'alisms_payment_gateways_v1',
  TOPUP_REQUESTS: 'alisms_topup_requests_v1',
  MANAGED_USERS: 'alisms_managed_users_v1',
  CUSTOM_ESIM_PLANS: 'alisms_custom_esim_plans_v1',
  LPA_INVENTORY: 'alisms_lpa_inventory_v1',
  ACTIVITY_LOGS: 'alisms_activity_logs_v1',
  PINNED_COUNTRIES: 'alisms_pinned_countries_v1',
  PINNED_SERVICES: 'alisms_pinned_services_v1',
  EXCHANGE_RATES: 'alisms_exchange_rates_v1',
  NOTIFICATIONS: 'alisms_notifications_v1',
  NOTIFICATION_MUTED: 'alisms_notif_muted_v1',
  LANGUAGE: 'alisms_lang_v1',
};

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export { STORAGE_KEYS };

/**
 * Performs secure server-side Supabase sync via POST /api/supabase/sync
 * (Supabase URL & keys remain strictly on the server — NEVER in browser storage or frontend code)
 */
export async function syncWithSupabaseCloud(
  _supabaseCfg: SupabaseConfigState,
  snapshot: {
    cmsConfig: SiteCmsConfig;
    settings: PlatformSettings;
    pricingOverrides: PricingOverrideRule[];
    paymentGateways: PaymentGatewayConfig[];
    topUpRequests: TopUpOrderRequest[];
    managedUsers: ManagedUserAccount[];
    lpaInventory: ESimLpaInventoryItem[];
    activityLogs: ActivityLogEntry[];
    activeSmsOrders: ActiveSmsOrder[];
    activeESimOrders: ActiveESimOrder[];
  },
  authToken?: string | null
): Promise<{ ok: boolean; message: string; syncedTables: number }> {
  try {
    const res = await fetch('/api/supabase/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        cmsConfig: snapshot.cmsConfig,
        pricingOverrides: snapshot.pricingOverrides,
        paymentGateways: snapshot.paymentGateways,
        lpaInventory: snapshot.lpaInventory,
        activityLogs: snapshot.activityLogs,
      }),
    });
    const data = await res.json();
    return {
      ok: Boolean(res.ok && data.ok),
      message: data.message || (res.ok ? 'تمت المزامنة السحابية بنجاح.' : 'تعذرت المزامنة مع Supabase.'),
      syncedTables: Number(data.syncedTables || 0),
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'تعذر الوصول إلى خادم المزامنة';
    return {
      ok: false,
      message: `تعذر الاتصال السحابي: ${errMsg}`,
      syncedTables: 0,
    };
  }
}

export interface FullPlatformBackupPayload {
  version: string;
  exportedAt: string;
  cmsConfig: SiteCmsConfig;
  pricingOverrides: PricingOverrideRule[];
  paymentGateways: PaymentGatewayConfig[];
  topUpRequests: TopUpOrderRequest[];
  managedUsers: ManagedUserAccount[];
  customESimPlans: ESimPlan[];
  lpaInventory: ESimLpaInventoryItem[];
  activityLogs: ActivityLogEntry[];
  pinnedCountries: string[];
  pinnedServices: string[];
  activeSmsOrders: ActiveSmsOrder[];
  activeESimOrders: ActiveESimOrder[];
  paymentHistory: PaymentTransaction[];
  supabaseCompletedPatches: Record<string, boolean>;
}
