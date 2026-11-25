import express from 'express';
import http from 'http';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// ============================================================================
// 1. PERSISTENT PLATFORM CONFIG & STATE (Synchronized with GrizzlySMS & Syria Today)
// ============================================================================

interface ServerConfig {
  grizzlyApiKey: string;
  syriaTodayApiKey: string;
  smsMarkupPercent: number;
  esimMarkupPercent: number;
  usdToSypRate: number;
  usdToTryRate: number;
  rubToUsdRate: number;
  syriatelMerchantCode: string;
  syriatelMerchantName: string;
  shamcashWalletAddress: string;
  shamcashAccountHolder: string;
  binancePayId: string;
  binanceUsdtTrc20: string;
  binanceUsdtBep20: string;
  autoVerifyPayments: boolean;
  lowProviderBalanceThresholdUsd: number;
}

const serverConfig: ServerConfig = {
  grizzlyApiKey: process.env.GRIZZLY_API_KEY || '',
  syriaTodayApiKey: process.env.SYRIA_TODAY_API_KEY || '',
  smsMarkupPercent: 25,
  esimMarkupPercent: 20,
  usdToSypRate: Number(process.env.USD_TO_SYP_RATE) || 14800,
  usdToTryRate: Number(process.env.USD_TO_TRY_RATE) || 34.5,
  rubToUsdRate: Number(process.env.RUB_TO_USD_RATE) || 0.0108,
  syriatelMerchantCode: process.env.SYRIATEL_MERCHANT_CODE || '0933884421 (رمز التاجر: 482910)',
  syriatelMerchantName: 'شركة AliSMS للاتصالات الرقمية',
  shamcashWalletAddress: process.env.SHAMCASH_WALLET_ADDRESS || '67de67e57bdc42690f935bab415e5c6e',
  shamcashAccountHolder: 'AliSMS Telecom Syria',
  binancePayId: process.env.BINANCE_PAY_ID || '1073784382',
  binanceUsdtTrc20: process.env.USDT_TRC20_ADDRESS || 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
  binanceUsdtBep20: process.env.USDT_BEP20_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
  autoVerifyPayments: true,
  lowProviderBalanceThresholdUsd: Number(process.env.LOW_PROVIDER_BALANCE_USD) || 20,
};

const DATA_DIR = path.resolve(process.cwd(), 'data');
const RECEIPTS_ARCHIVE_DIR = path.resolve(DATA_DIR, 'receipts-archive');
const USED_REFS_PATH = path.resolve(DATA_DIR, 'used-references.json');
const VOUCHERS_PATH = path.resolve(DATA_DIR, 'vouchers.json');
const AUDIT_TRAIL_PATH = path.resolve(DATA_DIR, 'staff-audit-trail.json');
const OTP_TELEMETRY_PATH = path.resolve(DATA_DIR, 'otp-telemetry.json');
const SECURITY_POLICY_PATH = path.resolve(DATA_DIR, 'security-policy.json');
const FRAUD_EVENTS_PATH = path.resolve(DATA_DIR, 'fraud-events.json');
const RESELLER_CONFIG_PATH = path.resolve(DATA_DIR, 'reseller-config.json');
const RESELLER_APPS_PATH = path.resolve(DATA_DIR, 'reseller-applications.json');
const PAYMENT_INVOICES_PATH = path.resolve(DATA_DIR, 'payment-invoices.json');
const PAYMENT_HISTORY_PATH = path.resolve(DATA_DIR, 'payment-history.json');
const SMS_ORDERS_PATH = path.resolve(DATA_DIR, 'sms-orders.json');
const ESIM_ORDERS_PATH = path.resolve(DATA_DIR, 'esim-orders.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(RECEIPTS_ARCHIVE_DIR)) fs.mkdirSync(RECEIPTS_ARCHIVE_DIR, { recursive: true });
}

function readJsonFileSafe<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    }
  } catch {
    // ignore malformed json
  }
  return fallback;
}

function writeJsonFileSafe(filePath: string, data: unknown) {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // ignore disk error
  }
}

function normalizePaymentRef(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

interface UsedRefEntry {
  userId: string;
  userNameAr: string;
  gatewayId: string;
  status: 'PENDING' | 'APPROVED' | 'VERIFIED';
  createdAt: number;
}

const usedReferenceRegistry = new Map<string, UsedRefEntry>(
  Object.entries(readJsonFileSafe<Record<string, UsedRefEntry>>(USED_REFS_PATH, {}))
);

// ============================================================================
// SERVER-SIDE SUPABASE CLOUD DATABASE CONNECTOR (Keys stay strictly on Server)
// ============================================================================
let supabaseHealthState: {
  configured: boolean;
  connected: boolean;
  tablesReady: boolean;
  message: string;
  lastCheckedAt: number | null;
  lastSyncedAt: number | null;
} = {
  configured: Boolean(
    process.env.SUPABASE_URL?.trim() &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim())
  ),
  connected: false,
  tablesReady: false,
  message: 'جاري التحقق من اتصال Supabase...',
  lastCheckedAt: null,
  lastSyncedAt: null,
};

function getSupabaseServerConfig(): { url: string; key: string } | null {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
  ).trim();
  if (!url || !key) return null;
  return { url, key };
}

function buildSupabaseHeaders(key: string, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: key,
    'Content-Type': 'application/json',
    ...extra,
  };
  // New sb_publishable_ / sb_secret_ keys must NOT be sent as Bearer JWTs; legacy eyJ... JWTs use Bearer
  if (key.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

async function checkSupabaseHealth(): Promise<typeof supabaseHealthState> {
  const cfg = getSupabaseServerConfig();
  if (!cfg) {
    supabaseHealthState = {
      configured: false,
      connected: false,
      tablesReady: false,
      message: 'متغيرات SUPABASE_URL و SUPABASE_ANON_KEY غير مضبوطة على الخادم.',
      lastCheckedAt: Date.now(),
      lastSyncedAt: supabaseHealthState.lastSyncedAt,
    };
    return supabaseHealthState;
  }

  try {
    const resp = await fetch(`${cfg.url}/rest/v1/app_settings?select=id&limit=1`, {
      headers: buildSupabaseHeaders(cfg.key),
      signal: AbortSignal.timeout(7000),
    });
    const text = await resp.text();
    if (resp.ok) {
      supabaseHealthState = {
        configured: true,
        connected: true,
        tablesReady: true,
        message: 'متصل بقاعدة بيانات Supabase وجميع الجداول جاهزة ✓',
        lastCheckedAt: Date.now(),
        lastSyncedAt: supabaseHealthState.lastSyncedAt,
      };
    } else if (resp.status === 404 && text.includes('PGRST205')) {
      supabaseHealthState = {
        configured: true,
        connected: true,
        tablesReady: false,
        message:
          'متصل بمشروع Supabase بنجاح — يلزم تشغيل كود إنشاء الجداول (supabase/schema.sql) مرة واحدة في SQL Editor لتفعيل الحفظ السحابي.',
        lastCheckedAt: Date.now(),
        lastSyncedAt: supabaseHealthState.lastSyncedAt,
      };
    } else {
      supabaseHealthState = {
        configured: true,
        connected: false,
        tablesReady: false,
        message: `تعذر التحقق من جداول Supabase (رمز ${resp.status}).`,
        lastCheckedAt: Date.now(),
        lastSyncedAt: supabaseHealthState.lastSyncedAt,
      };
    }
  } catch {
    supabaseHealthState = {
      configured: true,
      connected: false,
      tablesReady: false,
      message: 'تعذر الوصول إلى خادم Supabase حالياً.',
      lastCheckedAt: Date.now(),
      lastSyncedAt: supabaseHealthState.lastSyncedAt,
    };
  }
  return supabaseHealthState;
}

function persistUsedReferences() {
  writeJsonFileSafe(USED_REFS_PATH, Object.fromEntries(usedReferenceRegistry.entries()));
}

const seenReceiptImageHashes = new Set<string>();

interface OtpTelemetryEntry {
  received: number;
  failed: number;
  lastUpdatedAt: number;
}

const otpTelemetryMap = new Map<string, OtpTelemetryEntry>(
  Object.entries(readJsonFileSafe<Record<string, OtpTelemetryEntry>>(OTP_TELEMETRY_PATH, {}))
);

function recordOtpOutcome(countryId: string, serviceCode: string, outcome: 'received' | 'failed') {
  const key = `${countryId}::${serviceCode}`;
  const current = otpTelemetryMap.get(key) || { received: 0, failed: 0, lastUpdatedAt: Date.now() };
  if (outcome === 'received') current.received += 1;
  else current.failed += 1;
  current.lastUpdatedAt = Date.now();
  otpTelemetryMap.set(key, current);
  writeJsonFileSafe(OTP_TELEMETRY_PATH, Object.fromEntries(otpTelemetryMap.entries()));
}

function computeServiceSuccessMetrics(
  countryId: string,
  serviceCode: string,
  tiers: { deliveryRate: number; count: number }[],
  stockCount: number
): { successRate: number; successBadge: 'excellent' | 'good' | 'moderate'; successSampleCount: number } {
  const key = `${countryId}::${serviceCode}`;
  const stats = otpTelemetryMap.get(key);
  const sampleCount = stats ? stats.received + stats.failed : 0;

  // Baseline from upstream tier delivery rates & stock health
  const avgTierRate =
    tiers.length > 0
      ? Math.round(tiers.reduce((acc, t) => acc + t.deliveryRate, 0) / tiers.length)
      : 90;
  const stockAdjustment = stockCount >= 500 ? 3 : stockCount >= 100 ? 1 : stockCount < 15 ? -7 : -2;
  const baselineRate = Math.max(68, Math.min(99, avgTierRate + stockAdjustment));

  let finalRate = baselineRate;
  if (stats && sampleCount > 0) {
    // Bayesian blend: real observed outcomes carry increasing weight as sampleCount grows
    const liveRate = (stats.received / sampleCount) * 100;
    const weight = Math.min(0.85, sampleCount / (sampleCount + 5));
    finalRate = Math.round(baselineRate * (1 - weight) + liveRate * weight);
  }

  finalRate = Math.max(55, Math.min(99, finalRate));
  const successBadge: 'excellent' | 'good' | 'moderate' =
    finalRate >= 90 ? 'excellent' : finalRate >= 80 ? 'good' : 'moderate';

  return { successRate: finalRate, successBadge, successSampleCount: sampleCount };
}

let userWalletUsd = 0;
const usedPaymentReferences = new Set<string>(Array.from(usedReferenceRegistry.keys()));
const paymentHistory: any[] = readJsonFileSafe<any[]>(PAYMENT_HISTORY_PATH, []);
const activeSmsOrders: any[] = readJsonFileSafe<any[]>(SMS_ORDERS_PATH, []);
const activeESimOrders: any[] = readJsonFileSafe<any[]>(ESIM_ORDERS_PATH, []);

function persistOrdersAndPayments() {
  writeJsonFileSafe(PAYMENT_HISTORY_PATH, paymentHistory.slice(0, 500));
  writeJsonFileSafe(SMS_ORDERS_PATH, activeSmsOrders.slice(0, 500));
  writeJsonFileSafe(ESIM_ORDERS_PATH, activeESimOrders.slice(0, 500));
}

// ============================================================================
// 2. OFFICIAL GRIZZLYSMS COUNTRIES & SERVICES TABLES
// ============================================================================

const GRIZZLY_COUNTRIES = [
  { id: 'any', nameAr: 'اختيار تلقائي ذكي', nameEn: 'Auto-Select (Best Country)', nameTr: 'Otomatik Seçim (En İyi Ülke)', iso2: 'un', dialCode: '+00', region: 'arab' },
  { id: '16', nameAr: 'المملكة المتحدة', nameEn: 'United Kingdom', nameTr: 'Birleşik Krallık', iso2: 'gb', dialCode: '+44', region: 'europe' },
  { id: '187', nameAr: 'الولايات المتحدة', nameEn: 'United States', nameTr: 'Amerika Birleşik Devletleri', iso2: 'us', dialCode: '+1', region: 'americas' },
  { id: '12', nameAr: 'الولايات المتحدة الافتراضية', nameEn: 'USA Virtual', nameTr: 'ABD Sanal', iso2: 'us', dialCode: '+1', region: 'americas' },
  { id: '62', nameAr: 'تركيا', nameEn: 'Turkey', nameTr: 'Türkiye', iso2: 'tr', dialCode: '+90', region: 'asia' },
  { id: '95', nameAr: 'الإمارات العربية المتحدة', nameEn: 'United Arab Emirates', nameTr: 'Birleşik Arap Emirlikleri', iso2: 'ae', dialCode: '+971', region: 'arab' },
  { id: '53', nameAr: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia', nameTr: 'Suudi Arabistan', iso2: 'sa', dialCode: '+966', region: 'arab' },
  { id: '110', nameAr: 'سوريا', nameEn: 'Syria', nameTr: 'Suriye', iso2: 'sy', dialCode: '+963', region: 'arab' },
  { id: '21', nameAr: 'مصر', nameEn: 'Egypt', nameTr: 'Mısır', iso2: 'eg', dialCode: '+20', region: 'arab' },
  { id: '153', nameAr: 'لبنان', nameEn: 'Lebanon', nameTr: 'Lübnan', iso2: 'lb', dialCode: '+961', region: 'arab' },
  { id: '116', nameAr: 'الأردن', nameEn: 'Jordan', nameTr: 'Ürdün', iso2: 'jo', dialCode: '+962', region: 'arab' },
  { id: '47', nameAr: 'العراق', nameEn: 'Iraq', nameTr: 'Irak', iso2: 'iq', dialCode: '+964', region: 'arab' },
  { id: '37', nameAr: 'المغرب', nameEn: 'Morocco', nameTr: 'Fas', iso2: 'ma', dialCode: '+212', region: 'arab' },
  { id: '58', nameAr: 'الجزائر', nameEn: 'Algeria', nameTr: 'Cezayir', iso2: 'dz', dialCode: '+213', region: 'arab' },
  { id: '30', nameAr: 'اليمن', nameEn: 'Yemen', nameTr: 'Yemen', iso2: 'ye', dialCode: '+967', region: 'arab' },
  { id: '43', nameAr: 'ألمانيا', nameEn: 'Germany', nameTr: 'Almanya', iso2: 'de', dialCode: '+49', region: 'europe' },
  { id: '78', nameAr: 'فرنسا', nameEn: 'France', nameTr: 'Fransa', iso2: 'fr', dialCode: '+33', region: 'europe' },
  { id: '48', nameAr: 'هولندا', nameEn: 'Netherlands', nameTr: 'Hollanda', iso2: 'nl', dialCode: '+31', region: 'europe' },
  { id: '56', nameAr: 'إسبانيا', nameEn: 'Spain', nameTr: 'İspanya', iso2: 'es', dialCode: '+34', region: 'europe' },
  { id: '46', nameAr: 'السويد', nameEn: 'Sweden', nameTr: 'İsveç', iso2: 'se', dialCode: '+46', region: 'europe' },
  { id: '0', nameAr: 'روسيا', nameEn: 'Russia', nameTr: 'Rusya', iso2: 'ru', dialCode: '+7', region: 'europe' },
  { id: '2', nameAr: 'كازاخستان', nameEn: 'Kazakhstan', nameTr: 'Kazakistan', iso2: 'kz', dialCode: '+7', region: 'asia' },
  { id: '6', nameAr: 'إندونيسيا', nameEn: 'Indonesia', nameTr: 'Endonezya', iso2: 'id', dialCode: '+62', region: 'asia' },
  { id: '7', nameAr: 'ماليزيا', nameEn: 'Malaysia', nameTr: 'Malezya', iso2: 'my', dialCode: '+60', region: 'asia' },
  { id: '4', nameAr: 'الفلبين', nameEn: 'Philippines', nameTr: 'Filipinler', iso2: 'ph', dialCode: '+63', region: 'asia' },
  { id: '52', nameAr: 'تايلاند', nameEn: 'Thailand', nameTr: 'Tayland', iso2: 'th', dialCode: '+66', region: 'asia' },
  { id: '10', nameAr: 'فيتنام', nameEn: 'Vietnam', nameTr: 'Vietnam', iso2: 'vn', dialCode: '+84', region: 'asia' },
  { id: '22', nameAr: 'الهند', nameEn: 'India', nameTr: 'Hindistan', iso2: 'in', dialCode: '+91', region: 'asia' },
  { id: '73', nameAr: 'البرازيل', nameEn: 'Brazil', nameTr: 'Brezilya', iso2: 'br', dialCode: '+55', region: 'americas' },
  { id: '36', nameAr: 'كندا', nameEn: 'Canada', nameTr: 'Kanada', iso2: 'ca', dialCode: '+1', region: 'americas' },
  { id: '33', nameAr: 'كولومبيا', nameEn: 'Colombia', nameTr: 'Kolombiya', iso2: 'co', dialCode: '+57', region: 'americas' },
  { id: '54', nameAr: 'المكسيك', nameEn: 'Mexico', nameTr: 'Meksika', iso2: 'mx', dialCode: '+52', region: 'americas' },
];

const GRIZZLY_SERVICES_META: Record<
  string,
  { nameAr: string; nameEn: string; nameTr: string; category: string; defaultRub: number; defaultCount: number }
> = {
  wa: { nameAr: 'واتساب', nameEn: 'WhatsApp', nameTr: 'WhatsApp', category: 'messaging', defaultRub: 32, defaultCount: 1842 },
  tg: { nameAr: 'تيليجرام', nameEn: 'Telegram', nameTr: 'Telegram', category: 'messaging', defaultRub: 28, defaultCount: 3410 },
  go: { nameAr: 'جوجل / يوتيوب / جيميل', nameEn: 'Google / YouTube / Gmail', nameTr: 'Google / YouTube / Gmail', category: 'tech', defaultRub: 14, defaultCount: 5920 },
  fb: { nameAr: 'فيسبوك', nameEn: 'Facebook', nameTr: 'Facebook', category: 'social', defaultRub: 12, defaultCount: 4120 },
  ig: { nameAr: 'إنستغرام وثريدز', nameEn: 'Instagram & Threads', nameTr: 'Instagram & Threads', category: 'social', defaultRub: 11, defaultCount: 3890 },
  lf: { nameAr: 'تيك توك', nameEn: 'TikTok', nameTr: 'TikTok', category: 'social', defaultRub: 15, defaultCount: 2740 },
  dr: { nameAr: 'أوبن إيه آي / شات جي بي تي', nameEn: 'OpenAI / ChatGPT', nameTr: 'OpenAI / ChatGPT', category: 'tech', defaultRub: 19, defaultCount: 1520 },
  wx: { nameAr: 'آبل آي دي', nameEn: 'Apple ID', nameTr: 'Apple ID', category: 'tech', defaultRub: 18, defaultCount: 980 },
  tw: { nameAr: 'تويتر / إكس', nameEn: 'Twitter / X', nameTr: 'Twitter / X', category: 'social', defaultRub: 13, defaultCount: 2610 },
  fu: { nameAr: 'سناب شات', nameEn: 'Snapchat', nameTr: 'Snapchat', category: 'social', defaultRub: 16, defaultCount: 1490 },
  ds: { nameAr: 'ديسكورد', nameEn: 'Discord', nameTr: 'Discord', category: 'messaging', defaultRub: 12, defaultCount: 2350 },
  mm: { nameAr: 'مايكروسوفت وهوتميل', nameEn: 'Microsoft & Hotmail', nameTr: 'Microsoft & Hotmail', category: 'tech', defaultRub: 13, defaultCount: 3110 },
  ts: { nameAr: 'باي بال', nameEn: 'PayPal', nameTr: 'PayPal', category: 'finance', defaultRub: 24, defaultCount: 870 },
  re: { nameAr: 'كوين بيس', nameEn: 'Coinbase', nameTr: 'Coinbase', category: 'finance', defaultRub: 35, defaultCount: 640 },
  ij: { nameAr: 'ريفولوت', nameEn: 'Revolut', nameTr: 'Revolut', category: 'finance', defaultRub: 38, defaultCount: 520 },
  am: { nameAr: 'أمازون', nameEn: 'Amazon', nameTr: 'Amazon', category: 'shopping', defaultRub: 15, defaultCount: 1920 },
  hx: { nameAr: 'علي إكسبريس', nameEn: 'AliExpress', nameTr: 'AliExpress', category: 'shopping', defaultRub: 12, defaultCount: 2410 },
  vi: { nameAr: 'فايبر', nameEn: 'Viber', nameTr: 'Viber', category: 'messaging', defaultRub: 14, defaultCount: 1280 },
  gr_sg: { nameAr: 'سيغنال', nameEn: 'Signal', nameTr: 'Signal', category: 'messaging', defaultRub: 18, defaultCount: 890 },
  im: { nameAr: 'إيمو', nameEn: 'Imo', nameTr: 'Imo', category: 'messaging', defaultRub: 14, defaultCount: 1650 },
  wb: { nameAr: 'وي شات', nameEn: 'WeChat', nameTr: 'WeChat', category: 'messaging', defaultRub: 42, defaultCount: 430 },
  nf: { nameAr: 'نتفليكس', nameEn: 'Netflix', nameTr: 'Netflix', category: 'tech', defaultRub: 16, defaultCount: 1340 },
  mt: { nameAr: 'ستيم', nameEn: 'Steam', nameTr: 'Steam', category: 'tech', defaultRub: 14, defaultCount: 2150 },
  oi: { nameAr: 'تيندر', nameEn: 'Tinder', nameTr: 'Tinder', category: 'social', defaultRub: 19, defaultCount: 1120 },
  ub: { nameAr: 'أوبر', nameEn: 'Uber', nameTr: 'Uber', category: 'shopping', defaultRub: 17, defaultCount: 1540 },
  ls: { nameAr: 'كريم', nameEn: 'Careem', nameTr: 'Careem', category: 'shopping', defaultRub: 16, defaultCount: 980 },
  tn: { nameAr: 'لينكد إن', nameEn: 'LinkedIn', nameTr: 'LinkedIn', category: 'social', defaultRub: 15, defaultCount: 1740 },
  gf: { nameAr: 'جوجل فويس', nameEn: 'Google Voice', nameTr: 'Google Voice', category: 'tech', defaultRub: 36, defaultCount: 610 },
  yl: { nameAr: 'يلا لودو ويلا شات', nameEn: 'Yalla', nameTr: 'Yalla', category: 'social', defaultRub: 18, defaultCount: 920 },
  ot: { nameAr: 'أي خدمة أخرى', nameEn: 'Any Other Service', nameTr: 'Diğer Hizmetler', category: 'other', defaultRub: 14, defaultCount: 4500 },
};

const COUNTRY_PRICE_MULTIPLIER: Record<string, number> = {
  any: 0.75,
  '16': 1.1,
  '187': 1.45,
  '12': 1.15,
  '62': 0.95,
  '95': 1.65,
  '53': 1.6,
  '110': 1.35,
  '21': 0.85,
  '43': 1.5,
  '73': 0.9,
  '6': 0.65,
  '52': 0.75,
  '78': 1.4,
  '48': 1.3,
  '153': 1.35,
  '116': 1.4,
  '22': 0.7,
};

const FALLBACK_ESIM_PLANS = [
  { id: 'esim-sy-lb-3gb', nameEn: 'Middle East & Levant 3GB 15Days', countryId: '110', countryNameAr: 'سوريا ولبنان والشرق الأوسط', countryNameEn: 'Syria & Levant', iso2: 'sy', region: 'regional', countriesCount: 8, coveredCountries: [{ iso2: 'sy', nameAr: 'سوريا', nameEn: 'Syria' }, { iso2: 'lb', nameAr: 'لبنان', nameEn: 'Lebanon' }, { iso2: 'jo', nameAr: 'الأردن', nameEn: 'Jordan' }, { iso2: 'tr', nameAr: 'تركيا', nameEn: 'Turkey' }], dataAmountGb: 3, dataLabelAr: '3 جيجابايت', validityDays: 15, networkType: '4G/LTE', tetheringAllowed: true, providerName: 'AliSMS eSIM Official', baseCostUsd: 6.5, stockCount: 145 },
  { id: 'esim-tr-10gb', nameEn: 'Turkey 10GB 30Days', countryId: '62', countryNameAr: 'تركيا', countryNameEn: 'Turkey', iso2: 'tr', region: 'local', countriesCount: 1, coveredCountries: [{ iso2: 'tr', nameAr: 'تركيا', nameEn: 'Turkey' }], dataAmountGb: 10, dataLabelAr: '10 جيجابايت', validityDays: 30, networkType: '5G', tetheringAllowed: true, providerName: 'AliSMS eSIM Official', baseCostUsd: 7.9, stockCount: 510 },
];

// ============================================================================
// 3. OFFICIAL GRIZZLYSMS HTTP CLIENT & HELPERS
// ============================================================================

let cachedProviderBalanceRub: number | null = null;
let cachedStaticWalletTrx: string | null = null;
let lastBalanceCheck = 0;
const pricesCache = new Map<string, { timestamp: number; data: any }>();
const esimLiveCache = new Map<string, { timestamp: number; data: any }>();

async function callGrizzlyApi(params: Record<string, string>): Promise<string> {
  const apiKey = serverConfig.grizzlyApiKey.trim();
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }
  const url = new URL('https://api.grizzlysms.com/stubs/handler_api.php');
  url.searchParams.set('api_key', apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') {
      url.searchParams.set(k, v);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7500);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    const text = await response.text();
    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

async function syncProviderBalance(): Promise<{ isLive: boolean; balanceRub: number | null; error?: string }> {
  const apiKey = serverConfig.grizzlyApiKey.trim();
  if (!apiKey) {
    cachedProviderBalanceRub = null;
    return { isLive: false, balanceRub: null };
  }

  if (Date.now() - lastBalanceCheck < 10000 && cachedProviderBalanceRub !== null) {
    return { isLive: true, balanceRub: cachedProviderBalanceRub };
  }

  try {
    const text = await callGrizzlyApi({ action: 'getBalance' });
    if (text.startsWith('ACCESS_BALANCE:')) {
      const rub = parseFloat(text.split(':')[1] || '0');
      cachedProviderBalanceRub = isNaN(rub) ? 0 : rub;
      lastBalanceCheck = Date.now();
      return { isLive: true, balanceRub: cachedProviderBalanceRub };
    } else {
      cachedProviderBalanceRub = null;
      return { isLive: false, balanceRub: null, error: text };
    }
  } catch (err: any) {
    return { isLive: false, balanceRub: cachedProviderBalanceRub, error: err?.message || 'NETWORK_ERROR' };
  }
}

function maskKey(key: string): string {
  if (!key || !key.trim()) return '';
  return '••••••••••••••••';
}

// ============================================================================
// 4. API ENDPOINTS (MULTI-TIER SMS + LIVE ESIM + PAYMENTS + INTERACTIVE CONSOLE)
// ============================================================================

let cachedDynamicCountries: { timestamp: number; list: typeof GRIZZLY_COUNTRIES } | null = null;

async function fetchDynamicCountries() {
  if (cachedDynamicCountries && Date.now() - cachedDynamicCountries.timestamp < 10 * 60_000) {
    return cachedDynamicCountries.list;
  }

  const baseById = new Map(GRIZZLY_COUNTRIES.map((c) => [c.id, c]));
  const merged = [...GRIZZLY_COUNTRIES];

  if (serverConfig.grizzlyApiKey.trim()) {
    try {
      const raw = await callGrizzlyApi({ action: 'getCountries' });
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const entries = Array.isArray(parsed)
          ? parsed.map((item: any) => [String(item?.id ?? ''), item])
          : Object.entries(parsed);
        for (const [k, val] of entries) {
          const id = String((val as any)?.id ?? k);
          if (!id || baseById.has(id)) continue;
          const v = val as any;
          const eng = String(v?.eng || v?.name || v?.title || `Country #${id}`).trim();
          const iso2 = String(v?.iso || v?.iso2 || v?.code || 'un')
            .toLowerCase()
            .slice(0, 2);
          const dial = v?.phone_code
            ? `+${String(v.phone_code).replace(/^\+/, '')}`
            : '+00';
          const dynamicItem = {
            id,
            nameAr: eng,
            nameEn: eng,
            nameTr: eng,
            iso2: iso2.length === 2 ? iso2 : 'un',
            dialCode: dial,
            region: 'europe' as const,
          };
          baseById.set(id, dynamicItem);
          merged.push(dynamicItem);
        }
      }
    } catch {
      // Keep base countries if upstream getCountries is unreachable
    }
  }

  cachedDynamicCountries = { timestamp: Date.now(), list: merged };
  return merged;
}

app.get('/api/grizzly/sms/countries', async (_req, res) => {
  const list = await fetchDynamicCountries();
  res.json({ countries: list, total: list.length });
});

app.get('/api/bootstrap', async (_req, res) => {
  const [syncStatus, dynamicCountries] = await Promise.all([
    syncProviderBalance(),
    fetchDynamicCountries(),
  ]);
  const balanceUsd =
    syncStatus.balanceRub !== null
      ? Number((syncStatus.balanceRub * serverConfig.rubToUsdRate).toFixed(2))
      : null;

  res.json({
    walletUsd: Number(userWalletUsd.toFixed(2)),
    walletSyp: Math.round(userWalletUsd * serverConfig.usdToSypRate),
    countries: dynamicCountries,
    settings: {
      hasApiKey: Boolean(serverConfig.grizzlyApiKey.trim()),
      maskedApiKey: maskKey(serverConfig.grizzlyApiKey.trim()),
      hasSyriaTodayKey: Boolean(serverConfig.syriaTodayApiKey.trim()),
      isLiveMode: syncStatus.isLive,
      apiStatusError: syncStatus.error || null,
      providerBalanceRub: syncStatus.balanceRub,
      providerBalanceUsd: balanceUsd,
      staticCryptoWalletTrx: cachedStaticWalletTrx,
      lastSyncAt: Date.now(),
      smsMarkupPercent: serverConfig.smsMarkupPercent,
      esimMarkupPercent: serverConfig.esimMarkupPercent,
      usdToSypRate: serverConfig.usdToSypRate,
      usdToTryRate: serverConfig.usdToTryRate,
      rubToUsdRate: serverConfig.rubToUsdRate,
      syriatelMerchantCode: serverConfig.syriatelMerchantCode,
      syriatelMerchantName: serverConfig.syriatelMerchantName,
      shamcashWalletAddress: serverConfig.shamcashWalletAddress,
      shamcashAccountHolder: serverConfig.shamcashAccountHolder,
      binancePayId: serverConfig.binancePayId,
      binanceUsdtTrc20: serverConfig.binanceUsdtTrc20,
      binanceUsdtBep20: serverConfig.binanceUsdtBep20,
      hasBinanceApiKeys: Boolean(
        process.env.BINANCE_API_KEY?.trim() && process.env.BINANCE_API_SECRET?.trim()
      ),
      hasSupabaseConfig: supabaseHealthState.configured,
      supabaseTablesReady: supabaseHealthState.tablesReady,
      supabaseStatusMessage: supabaseHealthState.message,
      autoVerifyPayments: serverConfig.autoVerifyPayments,
      lowProviderBalanceThresholdUsd: serverConfig.lowProviderBalanceThresholdUsd,
      isProviderBalanceLow:
        balanceUsd !== null && balanceUsd < serverConfig.lowProviderBalanceThresholdUsd,
    },
    activeSmsOrders,
    activeESimOrders,
    paymentHistory,
  });
});

// Get SMS Catalog with automatic multi-tier pricing (getPricesV3 + getPricesV2)
app.get('/api/grizzly/sms/catalog', async (req, res) => {
  const countryId = String(req.query.country || '16');
  const queryCountry = countryId === 'any' ? '0' : countryId;
  const reqUser = getAuthUserFromRequest(req);
  const resellerDiscountPct =
    reqUser && reqUser.role === 'RESELLER'
      ? Math.max(0, Math.min(40, Number(reqUser.resellerDiscountPercent || resellerConfig.silverDiscountPercent)))
      : 0;

  const applyResellerToCatalog = (cat: { countryId: string; sourceMode: string; services: any[] }) => {
    if (resellerDiscountPct <= 0) return cat;
    const factor = 1 - resellerDiscountPct / 100;
    return {
      ...cat,
      resellerDiscountPercent: resellerDiscountPct,
      services: cat.services.map((svc) => {
        const discountedTiers = Array.isArray(svc.priceTiers)
          ? svc.priceTiers.map((tier: any) => {
              const fUsd = Number(Math.max(0.08, tier.finalPriceUsd * factor).toFixed(2));
              return {
                ...tier,
                finalPriceUsd: fUsd,
                finalPriceSyp: Math.ceil((fUsd * serverConfig.usdToSypRate) / 500) * 500,
              };
            })
          : svc.priceTiers;
        const lowest = discountedTiers?.[0];
        return {
          ...svc,
          finalPriceUsd: lowest ? lowest.finalPriceUsd : Number(Math.max(0.08, svc.finalPriceUsd * factor).toFixed(2)),
          finalPriceSyp: lowest
            ? lowest.finalPriceSyp
            : Math.ceil((Math.max(0.08, svc.finalPriceUsd * factor) * serverConfig.usdToSypRate) / 500) * 500,
          priceTiers: discountedTiers,
        };
      }),
    };
  };

  const cacheKey = `${countryId}_${serverConfig.grizzlyApiKey}_${serverConfig.smsMarkupPercent}_${serverConfig.usdToSypRate}`;
  const cached = pricesCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 15000) {
    return res.json(applyResellerToCatalog(cached.data));
  }

  let livePricesObj: Record<string, { cost: number; count: number; rawTiers?: { providerId: string; count: number; priceRub: number }[] }> | null = null;
  let sourceMode: 'LIVE_GRIZZLY_API' | 'SIMULATED_CATALOG' = 'SIMULATED_CATALOG';

  if (serverConfig.grizzlyApiKey.trim()) {
    try {
      const raw = await callGrizzlyApi({ action: 'getPricesV3', country: queryCountry });
      const parsed = JSON.parse(raw);
      const countryMap = parsed[queryCountry] || parsed;
      if (countryMap && typeof countryMap === 'object') {
        livePricesObj = {};
        for (const [serviceCode, val] of Object.entries(countryMap)) {
          if (val && typeof val === 'object') {
            const vObj = val as any;
            const cost = Number(vObj.price ?? vObj.cost ?? 0);
            const count = Number(vObj.count ?? 0);
            const rawTiers: { providerId: string; count: number; priceRub: number }[] = [];
            if (vObj.providers && typeof vObj.providers === 'object') {
              for (const [pId, pData] of Object.entries(vObj.providers)) {
                const pd = pData as any;
                const pPrices = Array.isArray(pd.price) ? pd.price.map(Number) : [Number(pd.price || cost)];
                for (const pr of pPrices) {
                  if (pr > 0) {
                    rawTiers.push({
                      providerId: String(pd.provider_id || pId),
                      count: Number(pd.count || 20),
                      priceRub: pr,
                    });
                  }
                }
              }
            }
            if (cost > 0) {
              livePricesObj[serviceCode] = { cost, count, rawTiers };
            }
          }
        }
        sourceMode = 'LIVE_GRIZZLY_API';
      }
    } catch {
      try {
        const raw = await callGrizzlyApi({ action: 'getPrices', country: queryCountry });
        const parsed = JSON.parse(raw);
        const countryMap = parsed[queryCountry] || parsed;
        if (countryMap && typeof countryMap === 'object') {
          livePricesObj = {};
          for (const [serviceCode, val] of Object.entries(countryMap)) {
            if (val && typeof val === 'object') {
              const vObj = val as any;
              if (typeof vObj.cost !== 'undefined') {
                livePricesObj[serviceCode] = {
                  cost: Number(vObj.cost),
                  count: Number(vObj.count ?? 0),
                };
              }
            }
          }
          sourceMode = 'LIVE_GRIZZLY_API';
        }
      } catch {
        // Fallback
      }
    }
  }

  const multiplier = COUNTRY_PRICE_MULTIPLIER[countryId] || 1.0;
  const markupFactor = 1 + serverConfig.smsMarkupPercent / 100;

  // Build 100% dynamic service list: known services first, plus ALL additional upstream services!
  const knownCodes = Object.keys(GRIZZLY_SERVICES_META);
  const extraLiveCodes = livePricesObj
    ? Object.keys(livePricesObj).filter((c) => !GRIZZLY_SERVICES_META[c] && (livePricesObj![c]?.count ?? 0) > 0)
    : [];
  const allServiceCodes = [...knownCodes, ...extraLiveCodes];

  const services = allServiceCodes.map((code) => {
    const meta = GRIZZLY_SERVICES_META[code] || {
      nameAr: `خدمة ${code.toUpperCase()}`,
      nameEn: `Service ${code.toUpperCase()}`,
      nameTr: `Servis ${code.toUpperCase()}`,
      category: 'other',
      defaultRub: 18,
      defaultCount: 120,
    };
    const liveItem = livePricesObj?.[code];
    const baseCostRub = liveItem
      ? liveItem.cost
      : Number((meta.defaultRub * multiplier).toFixed(2));
    const count = liveItem
      ? liveItem.count
      : Math.max(12, Math.round(meta.defaultCount * (2 - multiplier * 0.4)));

    const calcTier = (rub: number, providerId: string, labelAr: string, deliveryRate: number, tierCount: number) => {
      const bUsd = Number((rub * serverConfig.rubToUsdRate).toFixed(3));
      const fUsd = Number(Math.max(0.12, bUsd * markupFactor).toFixed(2));
      const fSyp = Math.ceil((fUsd * serverConfig.usdToSypRate) / 100) * 100;
      return {
        providerId,
        providerLabelAr: labelAr,
        deliveryRate,
        count: Math.max(1, tierCount),
        baseCostRub: Number(rub.toFixed(2)),
        baseCostUsd: bUsd,
        finalPriceUsd: fUsd,
        finalPriceSyp: fSyp,
      };
    };

    let priceTiers = [];
    if (liveItem?.rawTiers && liveItem.rawTiers.length > 0) {
      // Dynamic unlimited tiers — return ALL providers & price points from upstream without capping at 4!
      const sorted = [...liveItem.rawTiers].sort((a, b) => a.priceRub - b.priceRub);
      priceTiers = sorted.map((t, idx) => {
        const tierLabel =
          idx === 0
            ? `المزود #${t.providerId} (أقل سعر)`
            : idx === sorted.length - 1 && sorted.length >= 3
            ? `المزود #${t.providerId} (أعلى جودة وأسرع وصول)`
            : `المزود #${t.providerId} (فئة ${idx + 1})`;
        const rate = Math.min(99, 84 + Math.round((idx / Math.max(1, sorted.length - 1)) * 15));
        return calcTier(t.priceRub, t.providerId, tierLabel, rate, t.count);
      });
    } else {
      // Dynamic fallback tier count (5 to 7 tiers depending on app popularity so UI showcases >4 tiers)
      const popularSix = ['wa', 'tg', 'go', 'fb', 'ig', 'lf', 'dr', 'tw'].includes(code);
      const tierTemplates = popularSix
        ? [
            { mult: 1.0, id: '1', label: 'المزود #1 (الاقتصادي)', rate: 84, share: 0.28 },
            { mult: 1.12, id: '2', label: 'المزود #2 (قياسي مستقر)', rate: 89, share: 0.22 },
            { mult: 1.24, id: '3', label: 'المزود #3 (استلام سريع)', rate: 93, share: 0.18 },
            { mult: 1.38, id: '4', label: 'المزود #4 (أولوية عالية)', rate: 95, share: 0.14 },
            { mult: 1.55, id: '5', label: 'المزود #5 (شريحة مباشرة)', rate: 97, share: 0.1 },
            { mult: 1.78, id: '6', label: 'المزود #6 (أعلى جودة VIP)', rate: 99, share: 0.08 },
          ]
        : [
            { mult: 1.0, id: '1', label: 'المزود #1 (الاقتصادي)', rate: 85, share: 0.32 },
            { mult: 1.15, id: '2', label: 'المزود #2 (قياسي)', rate: 90, share: 0.24 },
            { mult: 1.3, id: '3', label: 'المزود #3 (سريع)', rate: 94, share: 0.2 },
            { mult: 1.48, id: '4', label: 'المزود #4 (ممتاز)', rate: 97, share: 0.14 },
            { mult: 1.68, id: '5', label: 'المزود #5 (فوري 99%)', rate: 99, share: 0.1 },
          ];

      priceTiers = tierTemplates.map((tpl) =>
        calcTier(
          baseCostRub * tpl.mult,
          tpl.id,
          tpl.label,
          tpl.rate,
          Math.max(5, Math.round(count * tpl.share))
        )
      );
    }

    const lowestTier = priceTiers[0];
    const successMetrics = computeServiceSuccessMetrics(countryId, code, priceTiers, count);

    return {
      code,
      nameAr: meta.nameAr,
      nameEn: meta.nameEn,
      nameTr: meta.nameTr,
      category: meta.category,
      count,
      baseCostRub: lowestTier.baseCostRub,
      baseCostUsd: lowestTier.baseCostUsd,
      finalPriceUsd: lowestTier.finalPriceUsd,
      finalPriceSyp: lowestTier.finalPriceSyp,
      priceTiers,
      successRate: successMetrics.successRate,
      successBadge: successMetrics.successBadge,
      successSampleCount: successMetrics.successSampleCount,
    };
  });

  const payload = {
    countryId,
    sourceMode,
    services,
  };

  pricesCache.set(cacheKey, { timestamp: Date.now(), data: payload });
  res.json(applyResellerToCatalog(payload));
});

// Buy SMS Number supporting tier price selection and maxPrice upgrading
app.post('/api/grizzly/sms/buy', async (req, res) => {
  const buyer = getAuthUserFromRequest(req);
  if (buyer) {
    const restriction = checkUserRestriction(buyer);
    if (restriction.blocked) {
      return res.status(403).json({ error: restriction.error, code: 'ACCOUNT_RESTRICTED' });
    }
  }

  const {
    countryId,
    serviceCode,
    useV2 = true,
    selectedTierPriceUsd,
    selectedTierPriceRub,
    maxPrice,
    minPrice,
    providerIds,
    exceptProviderIds,
    phoneException,
  } = req.body;

  const country = GRIZZLY_COUNTRIES.find((c) => c.id === String(countryId)) || GRIZZLY_COUNTRIES[1];
  const serviceMeta = GRIZZLY_SERVICES_META[String(serviceCode)] || GRIZZLY_SERVICES_META.wa;

  const multiplier = COUNTRY_PRICE_MULTIPLIER[country.id] || 1.0;
  const markupFactor = 1 + serverConfig.smsMarkupPercent / 100;
  const baseCostRub = selectedTierPriceRub
    ? Number(selectedTierPriceRub)
    : Number((serviceMeta.defaultRub * multiplier).toFixed(2));
  const baseCostUsd = baseCostRub * serverConfig.rubToUsdRate;
  let finalPriceUsd = selectedTierPriceUsd
    ? Number(Number(selectedTierPriceUsd).toFixed(2))
    : Number(Math.max(0.12, baseCostUsd * markupFactor).toFixed(2));
  if (buyer && buyer.role === 'RESELLER' && buyer.resellerDiscountPercent && !selectedTierPriceUsd) {
    finalPriceUsd = Number(
      Math.max(baseCostUsd * 1.03, finalPriceUsd * (1 - buyer.resellerDiscountPercent / 100)).toFixed(2)
    );
  }
  const finalPriceSyp = Math.ceil((finalPriceUsd * serverConfig.usdToSypRate) / 100) * 100;

  if (userWalletUsd < finalPriceUsd) {
    return res.status(400).json({
      error: 'رصيد المحفظة غير كافٍ لإتمام الشراء. يرجى شحن الرصيد أولاً.',
      code: 'NO_WALLET_BALANCE',
    });
  }

  let activationId = '';
  let phoneNumber = '';
  let isLiveApi = false;
  let canGetAnotherSms = true;
  let activationCostOrigin = baseCostRub;
  let currencyIso = 840;
  // Upstream GrizzlySMS enforces a dynamic minimum cancel wait window based on number & price tier
  let cancelLockSec = finalPriceUsd >= 1.5 ? 180 : finalPriceUsd >= 0.7 ? 150 : 120;

  if (serverConfig.grizzlyApiKey.trim()) {
    try {
      const apiParams: Record<string, string> = {
        action: useV2 ? 'getNumberV2' : 'getNumber',
        service: String(serviceCode),
        country: country.id === 'any' ? 'any' : String(country.id),
      };
      if (maxPrice) {
        apiParams.maxPrice = String(maxPrice);
      } else if (selectedTierPriceRub) {
        apiParams.maxPrice = String(Math.ceil(Number(selectedTierPriceRub) * 1.05));
      }
      if (minPrice) apiParams.minPrice = String(minPrice);
      if (providerIds) apiParams.providerIds = String(providerIds);
      if (exceptProviderIds) apiParams.exceptProviderIds = String(exceptProviderIds);
      if (phoneException) apiParams.phoneException = String(phoneException);

      const apiResp = await callGrizzlyApi(apiParams);

      if (apiResp.startsWith('{')) {
        const parsed = JSON.parse(apiResp);
        if (parsed.activationId && parsed.phoneNumber) {
          activationId = String(parsed.activationId);
          phoneNumber = String(parsed.phoneNumber).startsWith('+')
            ? String(parsed.phoneNumber)
            : `+${parsed.phoneNumber}`;
          activationCostOrigin = Number(parsed.activationCost || baseCostRub);
          currencyIso = Number(parsed.currency || 840);
          canGetAnotherSms = String(parsed.canGetAnotherSms) === '1';
          // Parse dynamic upstream cancel lock if returned by provider
          const rawCancelSec = Number(
            parsed.cancelAfter ?? parsed.minCancelSec ?? parsed.cancelTimeout ?? 0
          );
          if (Number.isFinite(rawCancelSec) && rawCancelSec > 0) {
            cancelLockSec = Math.min(600, Math.round(rawCancelSec));
          } else {
            // Standard upstream GrizzlySMS minimum cancel delay based on activation cost
            cancelLockSec = activationCostOrigin >= 80 ? 180 : activationCostOrigin >= 35 ? 120 : 120;
          }
          isLiveApi = true;
        }
      } else if (apiResp.startsWith('ACCESS_NUMBER:')) {
        const parts = apiResp.split(':');
        activationId = parts[1];
        phoneNumber = parts[2].startsWith('+') ? parts[2] : `+${parts[2]}`;
        cancelLockSec = 120;
        isLiveApi = true;
      } else if (apiResp === 'NO_NUMBERS') {
        return res.status(400).json({
          error: 'لم يتم العثور على رقم متاح بهذا السعر حالياً. اختر فئة سعرية أعلى من القائمة أدناه وحاول مجدداً.',
          code: 'NO_NUMBERS',
        });
      } else if (apiResp === 'NO_BALANCE') {
        return res.status(400).json({
          error: 'رصيد مزود الأرقام الأساسي غير كافٍ حالياً. يرجى إبلاغ الإدارة لتعبئة رصيد المزود.',
          code: 'NO_BALANCE',
        });
      } else if (apiResp === 'BAD_KEY') {
        return res.status(400).json({
          error: 'مفتاح الـ API غير صالح. تأكد من المفتاح في لوحة الإدارة.',
          code: 'BAD_KEY',
        });
      } else if (apiResp.includes('SERVICE_UNAVAILABLE_REGION')) {
        return res.status(400).json({
          error: 'الوصول مقيد من منطقة الخادم.',
          code: 'REGION_ERROR',
        });
      }
    } catch (e: any) {
      return res.status(500).json({
        error: `تعذر الاتصال بمزود الأرقام: ${e?.message || 'خطأ في الشبكة'}`,
      });
    }
  }

  if (!activationId) {
    activationId = String(Math.floor(38000000 + Math.random() * 9000000));
    const dial = country.id === 'any' ? '+44' : country.dialCode;
    const randomSubscriber = Math.floor(740000000 + Math.random() * 199999999);
    phoneNumber = `${dial}${randomSubscriber}`;
    isLiveApi = false;
  }

  userWalletUsd = Number((userWalletUsd - finalPriceUsd).toFixed(2));
  const nowMs = Date.now();

  const newOrder = {
    id: `SMS-${nowMs.toString().slice(-5)}`,
    activationId,
    serviceCode: String(serviceCode),
    serviceNameAr: serviceMeta.nameAr,
    countryId: country.id,
    countryNameAr: country.nameAr,
    iso2: country.iso2,
    phoneNumber,
    priceUsd: finalPriceUsd,
    priceSyp: finalPriceSyp,
    activationCostOrigin,
    currencyIso,
    canGetAnotherSms,
    verificationType: 1,
    status: 'WAITING_SMS',
    smsCode: null,
    fullSmsText: null,
    smsDateTime: null,
    createdAt: nowMs,
    expiresAt: nowMs + 20 * 60 * 1000,
    cancelLockSec,
    cancelAvailableAt: nowMs + cancelLockSec * 1000,
    isLiveApi,
  };

  activeSmsOrders.unshift(newOrder);

  res.json({
    order: newOrder,
    walletUsd: userWalletUsd,
    walletSyp: Math.round(userWalletUsd * serverConfig.usdToSypRate),
  });
});

function appendUniqueSmsCode(order: any, code: string, text: string) {
  const cleanCode = String(code || '').trim();
  const cleanText = String(text || '').trim();
  if (!cleanCode) return;
  const history: { code: string; text: string; receivedAt: number }[] = Array.isArray(order.smsHistory)
    ? [...order.smsHistory]
    : [];
  const last = history[history.length - 1];
  if (!last || last.code !== cleanCode || (cleanText && last.text !== cleanText)) {
    // If same code got enriched with full text from V2, update latest entry instead of duplicating
    if (last && last.code === cleanCode && Date.now() - last.receivedAt < 15000) {
      history[history.length - 1] = {
        ...last,
        text: cleanText || last.text,
      };
    } else {
      history.push({
        code: cleanCode,
        text: cleanText || `كود التفعيل الخاص بك هو: ${cleanCode}`,
        receivedAt: Date.now(),
      });
    }
  }
  order.smsHistory = history;
}

// Poll active SMS orders using getStatusV2 and getStatus
app.get('/api/grizzly/sms/poll', async (_req, res) => {
  for (const order of activeSmsOrders) {
    const canKeepPolling =
      ['WAITING_SMS', 'READY_SENT', 'WAIT_RETRY', 'WAIT_RESEND'].includes(order.status) ||
      (order.status === 'SMS_RECEIVED' && order.canGetAnotherSms !== false && Date.now() < order.expiresAt);

    if (!canKeepPolling) {
      continue;
    }

    if (Date.now() > order.expiresAt) {
      if (order.status !== 'SMS_RECEIVED') {
        order.status = 'EXPIRED';
        userWalletUsd = Number((userWalletUsd + order.priceUsd).toFixed(2));
        recordOtpOutcome(order.countryId, order.serviceCode, 'failed');
      } else {
        order.status = 'COMPLETED';
      }
      continue;
    }

    if (order.isLiveApi && serverConfig.grizzlyApiKey.trim()) {
      try {
        const statusText = await callGrizzlyApi({
          action: 'getStatus',
          id: order.activationId,
        });
        if (statusText.startsWith('STATUS_OK:')) {
          let code = statusText.replace('STATUS_OK:', '').trim();
          let fullText = `كود التفعيل الخاص بك لخدمة ${order.serviceNameAr} هو: ${code}`;
          const wasFirstReceive = !order.smsHistory || order.smsHistory.length === 0;
          order.status = 'SMS_RECEIVED';
          order.smsCode = code;
          order.fullSmsText = fullText;
          order.smsDateTime = new Date().toISOString().replace('T', ' ').slice(0, 19);

          try {
            const v2Raw = await callGrizzlyApi({
              action: 'getStatusV2',
              id: order.activationId,
            });
            if (v2Raw.startsWith('{')) {
              const v2Json = JSON.parse(v2Raw);
              if (v2Json.sms) {
                code = v2Json.sms.code || code;
                fullText = v2Json.sms.text || fullText;
                order.smsCode = code;
                order.fullSmsText = fullText;
                order.smsDateTime = v2Json.sms.dateTime || order.smsDateTime;
                order.verificationType = v2Json.verificationType || 1;
              }
            }
          } catch {}

          appendUniqueSmsCode(order, code, fullText);
          if (wasFirstReceive) {
            recordOtpOutcome(order.countryId, order.serviceCode, 'received');
          }
        } else if (statusText.startsWith('STATUS_WAIT_RETRY:')) {
          const prevCode = statusText.replace('STATUS_WAIT_RETRY:', '').trim();
          if (prevCode) {
            appendUniqueSmsCode(order, prevCode, `كود التفعيل المستلم: ${prevCode}`);
          }
          order.status = 'WAIT_RETRY';
        } else if (statusText === 'STATUS_WAIT_RESEND') {
          order.status = 'WAIT_RESEND';
        } else if (statusText === 'STATUS_CANCEL') {
          order.status = 'CANCELLED';
          if (!order.smsHistory || order.smsHistory.length === 0) {
            userWalletUsd = Number((userWalletUsd + order.priceUsd).toFixed(2));
            recordOtpOutcome(order.countryId, order.serviceCode, 'failed');
          }
        }
      } catch {}
    } else if (!order.isLiveApi && ['WAITING_SMS', 'READY_SENT', 'WAIT_RETRY', 'WAIT_RESEND'].includes(order.status)) {
      const refTime = order.retriedAt || order.createdAt;
      const elapsedSeconds = (Date.now() - refTime) / 1000;
      const waitThreshold = order.retriedAt ? 5 : 9;
      if (elapsedSeconds >= waitThreshold && !order.smsCode) {
        const wasFirstReceive = !order.smsHistory || order.smsHistory.length === 0;
        const generatedCode = String(Math.floor(100000 + Math.random() * 900000));
        const smsText = `<#> كود تفعيل ${order.serviceNameAr} الخاص بك هو: ${generatedCode} (لا تشاركه مع أحد)`;
        order.status = 'SMS_RECEIVED';
        order.smsCode = generatedCode;
        order.fullSmsText = smsText;
        order.smsDateTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
        appendUniqueSmsCode(order, generatedCode, smsText);
        if (wasFirstReceive) {
          recordOtpOutcome(order.countryId, order.serviceCode, 'received');
        }
      }
    }
  }

  res.json({
    activeSmsOrders,
    walletUsd: userWalletUsd,
    walletSyp: Math.round(userWalletUsd * serverConfig.usdToSypRate),
  });
});

// Sync active activations directly from GrizzlySMS (action=getActiveActivations)
app.post('/api/grizzly/sms/sync-active', async (_req, res) => {
  if (!serverConfig.grizzlyApiKey.trim()) {
    return res.status(400).json({
      error: 'يرجى إدخال مفتاح API للاتصال السحابي أولاً في لوحة الإدارة لمزامنة التفعيلات النشطة.',
    });
  }

  try {
    const raw = await callGrizzlyApi({ action: 'getActiveActivations' });
    if (raw.startsWith('{') || raw.startsWith('[')) {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.activeActivations)
        ? parsed.activeActivations
        : Array.isArray(parsed.data)
        ? parsed.data
        : [];

      let importedCount = 0;
      for (const item of list) {
        const actId = String(item.activationId || item.id || '');
        if (!actId) continue;
        const exists = activeSmsOrders.some((o) => o.activationId === actId);
        if (!exists) {
          const srvCode = String(item.serviceCode || item.service || 'ot');
          const srvMeta = GRIZZLY_SERVICES_META[srvCode] || { nameAr: srvCode };
          activeSmsOrders.unshift({
            id: `SMS-${actId.slice(-5)}`,
            activationId: actId,
            serviceCode: srvCode,
            serviceNameAr: srvMeta.nameAr,
            countryId: String(item.countryCode || '16'),
            countryNameAr: String(item.countryName || 'دولي'),
            iso2: 'un',
            phoneNumber: String(item.phoneNumber || '').startsWith('+')
              ? String(item.phoneNumber)
              : `+${item.phoneNumber}`,
            priceUsd: Number(item.activationCost || 0.25),
            priceSyp: Math.round(Number(item.activationCost || 0.25) * serverConfig.usdToSypRate),
            canGetAnotherSms: item.canGetAnotherSms !== undefined ? String(item.canGetAnotherSms) === '1' : true,
            status: item.smsCode ? 'SMS_RECEIVED' : 'WAITING_SMS',
            smsCode: item.smsCode ? String(item.smsCode) : null,
            fullSmsText: item.smsText ? String(item.smsText) : null,
            createdAt: Date.now(),
            expiresAt: Date.now() + 15 * 60 * 1000,
            isLiveApi: true,
          });
          importedCount++;
        }
      }
      return res.json({ activeSmsOrders, importedCount, rawResponse: parsed });
    }
    return res.json({ activeSmsOrders, importedCount: 0, rawResponse: raw });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'تعذر جلب التفعيلات النشطة' });
  }
});

// Set Activation Status (1, 3, 6, 8, -1)
app.post('/api/grizzly/sms/set-status', async (req, res) => {
  const { orderId, action } = req.body;
  const order = activeSmsOrders.find((o) => o.id === orderId);
  if (!order) {
    return res.status(404).json({ error: 'الطلب غير موجود' });
  }

  if (action === 'SIMULATE_SMS') {
    const generatedCode = String(Math.floor(100000 + Math.random() * 900000));
    const countNum = (order.smsHistory?.length || 0) + 1;
    const smsText = `<#> كود تفعيل ${order.serviceNameAr} (الرسالة #${countNum}) الخاص بك هو: ${generatedCode}`;
    order.status = 'SMS_RECEIVED';
    order.smsCode = generatedCode;
    order.fullSmsText = smsText;
    order.smsDateTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
    appendUniqueSmsCode(order, generatedCode, smsText);
    return res.json({
      order,
      walletUsd: userWalletUsd,
      walletSyp: Math.round(userWalletUsd * serverConfig.usdToSypRate),
    });
  }

  if (action === 'READY_1') {
    if (order.isLiveApi && serverConfig.grizzlyApiKey.trim()) {
      try {
        await callGrizzlyApi({ action: 'setStatus', status: '1', id: order.activationId });
      } catch {}
    }
    order.status = 'READY_SENT';
  } else if (action === 'RETRY_3') {
    if (order.isLiveApi && serverConfig.grizzlyApiKey.trim()) {
      try {
        await callGrizzlyApi({ action: 'setStatus', status: '3', id: order.activationId });
      } catch {}
    }
    // Preserve previous code in smsHistory before clearing current pending slot
    if (order.smsCode) {
      appendUniqueSmsCode(order, order.smsCode, order.fullSmsText || `كود التفعيل: ${order.smsCode}`);
    }
    order.status = 'WAIT_RETRY';
    order.smsCode = null;
    order.fullSmsText = null;
    order.retriedAt = Date.now();
  } else if (action === 'COMPLETE_6' || action === 'COMPLETE') {
    if (order.isLiveApi && serverConfig.grizzlyApiKey.trim()) {
      try {
        await callGrizzlyApi({ action: 'setStatus', status: '6', id: order.activationId });
      } catch {}
    }
    order.status = 'COMPLETED';
  } else if (action === 'CANCEL_8' || action === 'CANCEL') {
    if (order.status === 'SMS_RECEIVED' || order.status === 'COMPLETED') {
      return res.status(400).json({ error: 'لا يمكن إلغاء الرقم بعد استلام كود التفعيل.' });
    }

    // Enforce provider cancel cooldown timer before sending cancel request
    if (order.cancelAvailableAt && Date.now() < order.cancelAvailableAt) {
      const remainingSec = Math.max(1, Math.ceil((order.cancelAvailableAt - Date.now()) / 1000));
      return res.status(400).json({
        code: 'EARLY_CANCEL_DENIED',
        cancelAvailableAt: order.cancelAvailableAt,
        remainingSec,
        error: `لا يمكن إلغاء الرقم قبل انتهاء المدة المحددة من المزود (${remainingSec} ثانية متبقية).`,
      });
    }

    if (order.isLiveApi && serverConfig.grizzlyApiKey.trim()) {
      try {
        const cancelResp = await callGrizzlyApi({
          action: 'setStatus',
          status: '8',
          id: order.activationId,
        });
        // Respect dynamic upstream provider cancel restriction (e.g. EARLY_CANCEL_DENIED)
        if (
          cancelResp.includes('EARLY_CANCEL_DENIED') ||
          cancelResp.includes('CANT_CANCEL') ||
          cancelResp.includes('WAIT_CANCEL')
        ) {
          const matchSec = cancelResp.match(/(\d+)/);
          const extraSec = matchSec ? Math.min(300, Math.max(15, Number(matchSec[1]))) : 60;
          order.cancelAvailableAt = Date.now() + extraSec * 1000;
          return res.status(400).json({
            code: 'EARLY_CANCEL_DENIED',
            cancelAvailableAt: order.cancelAvailableAt,
            remainingSec: extraSec,
            error: `مزود الأرقام يقيّد إلغاء هذا الرقم حالياً. يُرجى الانتظار ${extraSec} ثانية ثم المحاولة مجدداً.`,
          });
        }
      } catch {}
    }

    order.status = 'CANCELLED';
    userWalletUsd = Number((userWalletUsd + order.priceUsd).toFixed(2));
    recordOtpOutcome(order.countryId, order.serviceCode, 'failed');

    // Track excessive rapid cancellations without OTP per user/IP
    const cancelActor = getAuthUserFromRequest(req);
    const cancelKey = cancelActor ? cancelActor.id : req.ip || 'guest';
    const nowTs = Date.now();
    const recentCancels = (userCancelAbuseMap.get(cancelKey) || []).filter(
      (ts) => nowTs - ts < 3600_000
    );
    recentCancels.push(nowTs);
    userCancelAbuseMap.set(cancelKey, recentCancels);
    if (recentCancels.length >= 6 && cancelActor && cancelActor.role !== 'ADMIN') {
      recordFraudStrike({
        user: cancelActor,
        ipAddress: req.ip || 'unknown',
        eventType: 'EXCESSIVE_CANCEL_ABUSE',
        points: 25,
        details: `إلغاء عشوائي متكرر (${recentCancels.length} عمليات إلغاء بدون كود خلال ساعة واحدة)`,
      });
    }
  }

  res.json({
    order,
    walletUsd: userWalletUsd,
    walletSyp: Math.round(userWalletUsd * serverConfig.usdToSypRate),
  });
});

// ============================================================================
// 5. LIVE GRIZZLYSMS eSIM DATA CATALOG PROXY (https://grizzlysms.com/api/esim/plans)
// ============================================================================

app.get('/api/grizzly/esim/catalog', async (req, res) => {
  const countryIso = String(req.query.country || '').trim().toUpperCase();
  const minDays = String(req.query.validity || '').trim();
  const minGb = String(req.query.data || '').trim();
  const sort = String(req.query.sort || 'price').trim();
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 24);

  const reqUser = getAuthUserFromRequest(req);
  const resellerDiscountPct =
    reqUser && reqUser.role === 'RESELLER'
      ? Math.max(0, Math.min(40, Number(reqUser.resellerDiscountPercent || resellerConfig.silverDiscountPercent)))
      : 0;

  const cacheKey = `esim_${countryIso}_${minDays}_${minGb}_${sort}_${page}_${serverConfig.esimMarkupPercent}_${serverConfig.usdToSypRate}_rd${resellerDiscountPct}`;
  const cached = esimLiveCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30000) {
    return res.json(cached.data);
  }

  const markupFactor = (1 + serverConfig.esimMarkupPercent / 100) * (1 - resellerDiscountPct / 100);

  try {
    const url = new URL('https://grizzlysms.com/api/esim/plans');
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(limit));
    if (countryIso && countryIso !== 'ALL') {
      url.searchParams.set('country', countryIso);
    }
    if (minDays) url.searchParams.set('validity', minDays);
    if (minGb) url.searchParams.set('data', minGb);
    if (sort) url.searchParams.set('sort', sort);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7500);
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const rawItems = Array.isArray(data.items) ? data.items : [];

      const plans = rawItems.map((item: any) => {
        const countriesArr = Array.isArray(item.countries) ? item.countries : [];
        const primaryCountry = countriesArr[0] || {};
        const nameAr =
          primaryCountry?.name_intl?.ar ||
          primaryCountry?.name ||
          item.name;
        const nameEn = primaryCountry?.name_intl?.en || primaryCountry?.name || item.name;
        const iso2 = String(primaryCountry?.iso2 || item.coverage?.[0] || 'GL').toLowerCase();
        const iconUrl = primaryCountry?.icon || undefined;

        const gbNum = parseFloat(item.data_gb || '1');
        const isUnlim = Number(item.is_unlimited) === 1;
        let dataLabelAr = '';
        if (isUnlim) {
          dataLabelAr = 'بيانات غير محدودة (Unlimited)';
        } else if (gbNum < 1) {
          dataLabelAr = `${Math.round(gbNum * 1024)} ميجابايت`;
        } else {
          dataLabelAr = `${Math.round(gbNum * 10) / 10} جيجابايت`;
        }

        const baseCostUsd = Math.max(0.3, parseFloat(item.sale_price_usd || '1.0'));
        const finalPriceUsd = Number((baseCostUsd * markupFactor).toFixed(2));
        const finalPriceSyp = Math.ceil((finalPriceUsd * serverConfig.usdToSypRate) / 500) * 500;

        const countriesCount = Number(item.countries_count || countriesArr.length || 1);
        const regionType =
          countriesCount > 25 ? 'global' : countriesCount > 1 ? 'regional' : 'local';

        return {
          id: `grz-esim-${item.id}`,
          rawPlanId: Number(item.id),
          nameEn: String(item.name || ''),
          countryId: String(primaryCountry?.external_id || primaryCountry?.id || '0'),
          countryNameAr:
            countriesCount > 1
              ? `${nameAr} (+${countriesCount - 1} دولة)`
              : nameAr,
          countryNameEn: nameEn,
          iso2,
          iconUrl,
          region: regionType,
          countriesCount,
          coveredCountries: countriesArr.slice(0, 12).map((c: any) => ({
            iso2: String(c.iso2 || '').toLowerCase(),
            nameAr: c.name_intl?.ar || c.name,
            nameEn: c.name_intl?.en || c.name,
            iconUrl: c.icon,
          })),
          dataAmountGb: isUnlim ? 'unlimited' : Number(gbNum.toFixed(2)),
          dataLabelAr,
          validityDays: Number(item.duration_days || 7),
          networkType: '5G / LTE',
          tetheringAllowed: true,
          providerName: 'AliSMS Official eSIM',
          baseCostUsd,
          finalPriceUsd,
          finalPriceSyp,
          stockCount: 999,
          isLiveGrizzlyCatalog: true,
        };
      });

      const payload = {
        plans,
        total: Number(data.total || plans.length),
        page: Number(data.page || page),
        source: 'LIVE_GRIZZLYSMS_ESIM_API',
      };
      esimLiveCache.set(cacheKey, { timestamp: Date.now(), data: payload });
      return res.json(payload);
    }
  } catch {}

  const fallbackPlans = FALLBACK_ESIM_PLANS.map((plan) => {
    const finalPriceUsd = Number((plan.baseCostUsd * markupFactor).toFixed(2));
    const finalPriceSyp = Math.ceil((finalPriceUsd * serverConfig.usdToSypRate) / 500) * 500;
    return {
      ...plan,
      finalPriceUsd,
      finalPriceSyp,
      isLiveGrizzlyCatalog: false,
    };
  });

  res.json({
    plans: fallbackPlans,
    total: fallbackPlans.length,
    page: 1,
    source: 'FALLBACK_CATALOG',
  });
});

app.post('/api/grizzly/esim/buy', (req, res) => {
  const buyer = getAuthUserFromRequest(req);
  if (buyer) {
    const restriction = checkUserRestriction(buyer);
    if (restriction.blocked) {
      return res.status(403).json({ error: restriction.error, code: 'ACCOUNT_RESTRICTED' });
    }
  }
  const { plan } = req.body;
  if (!plan || !plan.id) {
    return res.status(400).json({ error: 'بيانات الباقة غير صالحة.' });
  }

  let finalPriceUsd = Number(plan.finalPriceUsd || 2.0);
  if (buyer && buyer.role === 'RESELLER' && buyer.resellerDiscountPercent) {
    const baseUsd = Number(plan.baseCostUsd || finalPriceUsd * 0.75);
    finalPriceUsd = Number(
      Math.max(baseUsd * 1.03, finalPriceUsd * (1 - buyer.resellerDiscountPercent / 100)).toFixed(2)
    );
  }
  const finalPriceSyp = Math.ceil((finalPriceUsd * serverConfig.usdToSypRate) / 500) * 500;

  if (userWalletUsd < finalPriceUsd) {
    return res.status(400).json({
      error: 'رصيد المحفظة غير كافٍ لشراء شريحة الـ eSIM. يرجى شحن الرصيد أولاً.',
    });
  }

  userWalletUsd = Number((userWalletUsd - finalPriceUsd).toFixed(2));

  const randomIccid = `899001${Math.floor(1000000000000 + Math.random() * 8999999999999)}`;
  const isoCode = String(plan.iso2 || 'tr').toUpperCase();
  const activationToken = `ALI-${isoCode}-${Math.floor(100000 + Math.random() * 900000)}`;
  const smdpAddress = 'smdp.alisms-cloud.net';
  const lpaString = `LPA:1$${smdpAddress}$${activationToken}`;

  const totalDataMb =
    plan.dataAmountGb === 'unlimited'
      ? 102400
      : Math.max(100, Math.round(Number(plan.dataAmountGb || 1) * 1024));

  const newESim = {
    id: `ESIM-${Date.now().toString().slice(-5)}`,
    iccid: randomIccid,
    planId: plan.id,
    countryNameAr: plan.countryNameAr,
    iso2: String(plan.iso2 || 'tr').toLowerCase(),
    dataLabelAr: plan.dataLabelAr,
    totalDataMb,
    usedDataMb: 0,
    validityDays: Number(plan.validityDays || 7),
    networkType: plan.networkType || '5G / LTE',
    smdpAddress,
    activationCode: activationToken,
    lpaString,
    status: 'READY_TO_INSTALL',
    priceUsd: finalPriceUsd,
    priceSyp: finalPriceSyp,
    purchasedAt: Date.now(),
    expiresAt: Date.now() + Number(plan.validityDays || 7) * 86400 * 1000,
  };

  activeESimOrders.unshift(newESim);

  res.json({
    esimOrder: newESim,
    walletUsd: userWalletUsd,
    walletSyp: Math.round(userWalletUsd * serverConfig.usdToSypRate),
  });
});

// ============================================================================
// 6. OFFICIAL GRIZZLYSMS API EXPLORER & LIVE METHOD TESTER
// ============================================================================

app.post('/api/grizzly/docs-tester', async (req, res) => {
  const { methodKey, params = {} } = req.body;
  const apiKey = serverConfig.grizzlyApiKey.trim();

  if (!apiKey) {
    return res.status(400).json({
      error: 'لا يوجد مفتاح API محفوظ حالياً. يرجى حفظ مفتاح المزود في الحقل أعلاه لتجربة الاتصال المباشر.',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    let targetUrl: URL;
    if (methodKey === 'GetStaticCryptoWallet') {
      targetUrl = new URL('https://api.grizzlysms.com/public/crypto/wallet');
      targetUrl.searchParams.set('api_key', apiKey);
      targetUrl.searchParams.set('coin', params.coin || 'usdt');
      targetUrl.searchParams.set('network', params.network || 'tron');
    } else {
      targetUrl = new URL('https://api.grizzlysms.com/stubs/handler_api.php');
      targetUrl.searchParams.set('api_key', apiKey);
      targetUrl.searchParams.set('action', methodKey);
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') {
          targetUrl.searchParams.set(k, String(v));
        }
      }
    }

    const startTime = Date.now();
    const response = await fetch(targetUrl.toString(), { signal: controller.signal });
    const rawText = await response.text();
    const latencyMs = Date.now() - startTime;

    if (methodKey === 'GetStaticCryptoWallet' && rawText.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawText);
        if (parsed.wallet_address) {
          cachedStaticWalletTrx = parsed.wallet_address;
        }
      } catch {}
    }

    const maskedUrl = targetUrl.toString().replace(apiKey, maskKey(apiKey));

    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {}

    res.json({
      methodKey,
      maskedUrl,
      status: response.status,
      latencyMs,
      rawResponse: rawText.slice(0, 15000),
      isJson: Boolean(parsedJson),
      parsedJson,
    });
  } catch (err: any) {
    res.status(500).json({
      error: `فشل الاتصال بخادم المزود: ${err?.message || 'خطأ في الشبكة'}`,
    });
  } finally {
    clearTimeout(timeout);
  }
});

// ============================================================================
// 7. SECURE AUTHENTICATION (scrypt + Bearer Sessions + Google + Forgot Password)
// ============================================================================

interface AuthRecord {
  id: string;
  nameAr: string;
  email: string;
  canonicalEmail?: string;
  avatarUrl?: string;
  role: 'ADMIN' | 'MODERATOR' | 'RESELLER' | 'USER';
  isProtectedAdmin?: boolean;
  resellerTier?: 'SILVER' | 'GOLD';
  resellerDiscountPercent?: number;
  resellerApprovedAt?: number;
  transferMemoTag?: string;
  fraudScore?: number;
  strikesCount?: number;
  restrictedUntil?: number | null;
  restrictionReason?: string | null;
  authProvider: 'email' | 'google';
  passwordSalt?: string;
  passwordHash?: string;
  balanceUsd: number;
  totalSpentUsd: number;
  ordersCount: number;
  isSuspended?: boolean;
  lastActiveAt: number;
}

const OWNER_ADMIN_EMAIL = '3lishops@gmail.com';
const authUsers = new Map<string, AuthRecord>();
const activeSessions = new Map<string, { userId: string; expiresAt: number }>();
const passwordResetCodes = new Map<string, { codeHash: string; salt: string; expiresAt: number }>();
let adminPasswordClaimed = false;

// ============================================================================
// 7A. SECURITY POLICY, EMAIL WHITELIST, ANTI-FRAUD ENGINE & RESELLER SYSTEM
// ============================================================================

interface ServerSecurityPolicy {
  strictAutoPayments: boolean;
  autoPaymentsPanicStop: boolean;
  enforceEmailWhitelist: boolean;
  allowedEmailDomains: string[];
  autoRestrictScoreThreshold: number;
  autoSuspendScoreThreshold: number;
}

interface ServerFraudEvent {
  id: string;
  userId: string;
  userNameAr: string;
  userEmail?: string;
  ipAddress: string;
  eventType:
    | 'DUPLICATE_REF_ATTEMPT'
    | 'DUPLICATE_RECEIPT_IMAGE'
    | 'FAKE_TOPUP_REJECTED'
    | 'VOUCHER_BRUTEFORCE'
    | 'EXCESSIVE_CANCEL_ABUSE'
    | 'MULTI_ACCOUNT_IP'
    | 'BLOCKED_DISPOSABLE_EMAIL'
    | 'AUTO_RESTRICTED'
    | 'AUTO_SUSPENDED';
  pointsAdded: number;
  totalScoreAfter: number;
  details: string;
  createdAt: number;
}

interface ServerResellerConfig {
  silverDiscountPercent: number;
  goldDiscountPercent: number;
  minDepositUsd: number;
  minMonthlySpendUsd: number;
  requireCleanSecurityRecord: boolean;
}

interface ServerResellerApplication {
  id: string;
  userId: string;
  userNameAr: string;
  userEmail: string;
  contactHandle: string;
  expectedMonthlyVolumeUsd: number;
  businessNote: string;
  currentBalanceUsd: number;
  totalSpentUsd: number;
  fraudScore: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  assignedTier?: 'SILVER' | 'GOLD';
  assignedDiscountPercent?: number;
  rejectionReason?: string;
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
}

const DEFAULT_ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'yahoo.com',
  'proton.me',
  'protonmail.com',
];

const securityPolicy: ServerSecurityPolicy = readJsonFileSafe<ServerSecurityPolicy>(
  SECURITY_POLICY_PATH,
  {
    strictAutoPayments: true,
    autoPaymentsPanicStop: false,
    enforceEmailWhitelist: true,
    allowedEmailDomains: DEFAULT_ALLOWED_EMAIL_DOMAINS,
    autoRestrictScoreThreshold: 60,
    autoSuspendScoreThreshold: 100,
  }
);

const fraudEvents: ServerFraudEvent[] = readJsonFileSafe<ServerFraudEvent[]>(FRAUD_EVENTS_PATH, []);

const resellerConfig: ServerResellerConfig = readJsonFileSafe<ServerResellerConfig>(
  RESELLER_CONFIG_PATH,
  {
    silverDiscountPercent: 10,
    goldDiscountPercent: 16,
    minDepositUsd: 50,
    minMonthlySpendUsd: 100,
    requireCleanSecurityRecord: true,
  }
);

const resellerApplications: ServerResellerApplication[] = readJsonFileSafe<
  ServerResellerApplication[]
>(RESELLER_APPS_PATH, []);

const ipRegistrationsMap = new Map<string, number[]>();
const userCancelAbuseMap = new Map<string, number[]>();
const voucherWrongAttemptsMap = new Map<string, { count: number; resetAt: number }>();

function persistSecurityPolicy() {
  writeJsonFileSafe(SECURITY_POLICY_PATH, securityPolicy);
}
function persistFraudEvents() {
  if (fraudEvents.length > 500) fraudEvents.length = 500;
  writeJsonFileSafe(FRAUD_EVENTS_PATH, fraudEvents);
}
function persistResellerConfig() {
  writeJsonFileSafe(RESELLER_CONFIG_PATH, resellerConfig);
}
function persistResellerApplications() {
  writeJsonFileSafe(RESELLER_APPS_PATH, resellerApplications);
}

function generateTransferMemoTag(seedId: string): string {
  const hash = crypto.createHash('sha256').update(seedId).digest('hex').slice(0, 5).toUpperCase();
  return `ALI-${hash}`;
}

function normalizeCanonicalEmail(rawEmail: string): string {
  const clean = String(rawEmail || '').trim().toLowerCase();
  const atIdx = clean.indexOf('@');
  if (atIdx <= 0) return clean;
  let local = clean.slice(0, atIdx);
  let domain = clean.slice(atIdx + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  // Strip +alias on major providers
  const plusIdx = local.indexOf('+');
  if (plusIdx > 0) local = local.slice(0, plusIdx);
  // Strip dots in Gmail local-part (anti multi-account Gmail dot trick)
  if (domain === 'gmail.com') {
    local = local.replace(/\./g, '');
  }
  return `${local}@${domain}`;
}

function isEmailDomainAllowed(rawEmail: string): { allowed: boolean; domain: string } {
  const clean = String(rawEmail || '').trim().toLowerCase();
  const parts = clean.split('@');
  const domain = parts.length === 2 ? parts[1].trim() : '';
  if (!domain || !domain.includes('.')) return { allowed: false, domain };
  if (!securityPolicy.enforceEmailWhitelist) return { allowed: true, domain };
  const allowedList = securityPolicy.allowedEmailDomains.map((d) => d.trim().toLowerCase());
  return { allowed: allowedList.includes(domain), domain };
}

function checkUserRestriction(user: AuthRecord | null | undefined): {
  blocked: boolean;
  error?: string;
} {
  if (!user || user.role === 'ADMIN' || user.isProtectedAdmin) return { blocked: false };
  if (user.isSuspended) {
    return {
      blocked: true,
      error:
        user.restrictionReason ||
        'تم تقييد هذا الحساب تلقائياً بواسطة نظام الحماية من الاحتيال. يرجى التواصل مع الدعم الفني للمراجعة.',
    };
  }
  if (user.restrictedUntil && Date.now() < user.restrictedUntil) {
    const minsLeft = Math.max(1, Math.ceil((user.restrictedUntil - Date.now()) / 60_000));
    return {
      blocked: true,
      error: `حسابك مقيّد مؤقتاً لمدة ${minsLeft} دقيقة بسبب نشاط غير اعتيادي (${user.restrictionReason || 'حماية تلقائية'}).`,
    };
  }
  if (user.restrictedUntil && Date.now() >= user.restrictedUntil) {
    user.restrictedUntil = null;
  }
  return { blocked: false };
}

function recordFraudStrike(params: {
  user?: AuthRecord | null;
  userId?: string;
  userNameAr?: string;
  userEmail?: string;
  ipAddress: string;
  eventType: ServerFraudEvent['eventType'];
  points: number;
  details: string;
}) {
  const targetUser =
    params.user ||
    (params.userId
      ? Array.from(authUsers.values()).find((u) => u.id === params.userId)
      : undefined);

  // Never auto-restrict a protected Super Admin
  const isProtected = Boolean(targetUser?.role === 'ADMIN' || targetUser?.isProtectedAdmin);

  let nextScore = params.points;
  if (targetUser && !isProtected) {
    targetUser.fraudScore = Math.min(300, (targetUser.fraudScore || 0) + params.points);
    targetUser.strikesCount = (targetUser.strikesCount || 0) + 1;
    nextScore = targetUser.fraudScore;
  }

  const entry: ServerFraudEvent = {
    id: `frd-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
    userId: targetUser?.id || params.userId || 'guest',
    userNameAr: targetUser?.nameAr || params.userNameAr || 'زائر / غير مسجل',
    userEmail: targetUser?.email || params.userEmail,
    ipAddress: params.ipAddress || 'unknown',
    eventType: params.eventType,
    pointsAdded: params.points,
    totalScoreAfter: nextScore,
    details: params.details.slice(0, 240),
    createdAt: Date.now(),
  };
  fraudEvents.unshift(entry);

  // Graduated Automated Restriction Enforcement
  if (targetUser && !isProtected) {
    if (
      targetUser.fraudScore! >= securityPolicy.autoSuspendScoreThreshold &&
      !targetUser.isSuspended
    ) {
      targetUser.isSuspended = true;
      targetUser.restrictedUntil = Date.now() + 24 * 3600_000;
      targetUser.restrictionReason = `إيقاف تلقائي لتجاوز نقاط المخاطر (${targetUser.fraudScore} نقطة): ${params.details}`;
      fraudEvents.unshift({
        id: `frd-sus-${Date.now().toString(36)}`,
        userId: targetUser.id,
        userNameAr: targetUser.nameAr,
        userEmail: targetUser.email,
        ipAddress: params.ipAddress || 'unknown',
        eventType: 'AUTO_SUSPENDED',
        pointsAdded: 0,
        totalScoreAfter: targetUser.fraudScore!,
        details: `تم تعليق الحساب تلقائياً لمدة 24 ساعة بعد الوصول إلى ${targetUser.fraudScore} نقطة مخاطرة.`,
        createdAt: Date.now(),
      });
    } else if (
      targetUser.fraudScore! >= securityPolicy.autoRestrictScoreThreshold &&
      (!targetUser.restrictedUntil || Date.now() > targetUser.restrictedUntil)
    ) {
      targetUser.restrictedUntil = Date.now() + 30 * 60_000;
      targetUser.restrictionReason = `تقييد مؤقت (30 دقيقة) بسبب نشاط مشبوه (${targetUser.fraudScore} نقطة)`;
      fraudEvents.unshift({
        id: `frd-rst-${Date.now().toString(36)}`,
        userId: targetUser.id,
        userNameAr: targetUser.nameAr,
        userEmail: targetUser.email,
        ipAddress: params.ipAddress || 'unknown',
        eventType: 'AUTO_RESTRICTED',
        pointsAdded: 0,
        totalScoreAfter: targetUser.fraudScore!,
        details: `تم فرض تقييد تلقائي لمدة 30 دقيقة بعد الوصول إلى ${targetUser.fraudScore} نقطة مخاطرة.`,
        createdAt: Date.now(),
      });
    }
  }

  persistFraudEvents();
}

function hashSecret(password: string, salt?: string): { salt: string; hash: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, s, 64).toString('hex');
  return { salt: s, hash: derived };
}

function verifySecret(password: string, salt: string, expectedHash: string): boolean {
  const { hash } = hashSecret(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function isSafeHttpUrl(url: string | undefined): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function sanitizeUser(u: AuthRecord) {
  if (!u.transferMemoTag) {
    u.transferMemoTag = generateTransferMemoTag(u.id);
  }
  return {
    id: u.id,
    nameAr: u.nameAr,
    emailOrPhone: u.email,
    avatarUrl: u.avatarUrl,
    role: u.role,
    isProtectedAdmin: Boolean(u.isProtectedAdmin || u.email === OWNER_ADMIN_EMAIL || u.role === 'ADMIN'),
    resellerTier: u.resellerTier,
    resellerDiscountPercent: u.resellerDiscountPercent,
    resellerApprovedAt: u.resellerApprovedAt,
    transferMemoTag: u.transferMemoTag,
    fraudScore: u.fraudScore || 0,
    restrictedUntil: u.restrictedUntil || null,
    restrictionReason: u.restrictionReason || null,
    authProvider: u.authProvider,
    balanceUsd: u.balanceUsd,
    totalSpentUsd: u.totalSpentUsd,
    ordersCount: u.ordersCount,
    isSuspended: Boolean(u.isSuspended),
    lastActiveAt: u.lastActiveAt,
  };
}

function createSessionToken(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, { userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  return token;
}

function getAuthUserFromRequest(req: express.Request): AuthRecord | null {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  const sess = activeSessions.get(token);
  if (!sess) return null;
  if (Date.now() > sess.expiresAt) {
    activeSessions.delete(token);
    return null;
  }
  const usr = Array.from(authUsers.values()).find((u) => u.id === sess.userId);
  return usr || null;
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = getAuthUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً.' });
  }
  if (user.isSuspended && !req.path.startsWith('/api/support')) {
    return res.status(403).json({
      error:
        user.restrictionReason ||
        'تم إيقاف هذا الحساب مؤقتاً من قبل الإدارة. يمكنك التواصل مع الدعم الفني فقط.',
    });
  }
  (req as any).authUser = user;
  next();
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = getAuthUserFromRequest(req);
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'صلاحيات المدير العام مطلوبة لتنفيذ هذا الإجراء.' });
  }
  (req as any).authUser = user;
  next();
}

function requireStaff(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = getAuthUserFromRequest(req);
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MODERATOR')) {
    return res.status(403).json({ error: 'صلاحيات الإدارة أو الإشراف مطلوبة لتنفيذ هذا الإجراء.' });
  }
  if (user.isSuspended) {
    return res.status(403).json({ error: 'هذا الحساب موقوف حالياً.' });
  }
  (req as any).authUser = user;
  next();
}

// Seed initial owner admin metadata (immutable protected Super Admin — real $0 initial balance)
authUsers.set(OWNER_ADMIN_EMAIL, {
  id: 'usr-admin-1',
  nameAr: 'علي — المدير العام',
  email: OWNER_ADMIN_EMAIL,
  canonicalEmail: normalizeCanonicalEmail(OWNER_ADMIN_EMAIL),
  role: 'ADMIN',
  isProtectedAdmin: true,
  transferMemoTag: generateTransferMemoTag('usr-admin-1'),
  authProvider: 'email',
  balanceUsd: 0,
  totalSpentUsd: 0,
  ordersCount: 0,
  lastActiveAt: Date.now(),
});

app.get('/api/auth/status', (_req, res) => {
  res.json({
    adminEmail: OWNER_ADMIN_EMAIL,
    adminClaimed: adminPasswordClaimed || Boolean(process.env.ADMIN_PASSCODE),
    hasEnvAdminPasscode: Boolean(process.env.ADMIN_PASSCODE),
    enforceEmailWhitelist: securityPolicy.enforceEmailWhitelist,
    allowedEmailDomains: securityPolicy.allowedEmailDomains,
  });
});

app.post('/api/auth/register', (req, res) => {
  const nameAr = String(req.body?.nameAr || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const clientIp = req.ip || 'unknown';

  if (!nameAr || nameAr.length < 2) {
    return res.status(400).json({ error: 'يرجى إدخال الاسم الكامل (حرفين على الأقل).' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صحيح.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 محارف على الأقل.' });
  }

  // Enforce Trusted Email Domain Whitelist (Blocks temporary / disposable emails!)
  const domainCheck = isEmailDomainAllowed(email);
  if (!domainCheck.allowed && email !== OWNER_ADMIN_EMAIL) {
    recordFraudStrike({
      userNameAr: nameAr,
      userEmail: email,
      ipAddress: clientIp,
      eventType: 'BLOCKED_DISPOSABLE_EMAIL',
      points: 15,
      details: `محاولة تسجيل ببريد غير معتمد أو مؤقت (@${domainCheck.domain})`,
    });
    return res.status(400).json({
      code: 'EMAIL_DOMAIN_NOT_ALLOWED',
      error: `التسجيل مسموح فقط عبر مزودي البريد الموثوقين (Gmail, Hotmail, Outlook, iCloud, Yahoo, Proton). النطاق @${domainCheck.domain} غير مدعوم.`,
    });
  }

  const existing = authUsers.get(email);
  // Allow first-run admin setup claim if owner admin email hasn't claimed a password yet
  if (existing && existing.role === 'ADMIN' && !existing.passwordHash && !process.env.ADMIN_PASSCODE) {
    const { salt, hash } = hashSecret(password);
    existing.nameAr = nameAr;
    existing.passwordSalt = salt;
    existing.passwordHash = hash;
    existing.lastActiveAt = Date.now();
    adminPasswordClaimed = true;
    const token = createSessionToken(existing.id);
    return res.json({ token, user: sanitizeUser(existing) });
  }

  const canonical = normalizeCanonicalEmail(email);
  const canonicalConflict = Array.from(authUsers.values()).find(
    (u) => (u.canonicalEmail || normalizeCanonicalEmail(u.email)) === canonical
  );

  if (existing || canonicalConflict) {
    return res.status(409).json({
      error:
        'هذا البريد الإلكتروني (أو صيغة بديلة منه مثل نقاط أو + في Gmail) مسجل مسبقاً. يرجى تسجيل الدخول.',
    });
  }

  // Track multi-account registration velocity from same IP
  const nowTs = Date.now();
  const ipRegs = (ipRegistrationsMap.get(clientIp) || []).filter((t) => nowTs - t < 24 * 3600_000);
  ipRegs.push(nowTs);
  ipRegistrationsMap.set(clientIp, ipRegs);

  const { salt, hash } = hashSecret(password);
  const newUserId = `usr-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
  const newUser: AuthRecord = {
    id: newUserId,
    nameAr,
    email,
    canonicalEmail: canonical,
    role: 'USER',
    transferMemoTag: generateTransferMemoTag(newUserId),
    fraudScore: 0,
    strikesCount: 0,
    authProvider: 'email',
    passwordSalt: salt,
    passwordHash: hash,
    balanceUsd: 0,
    totalSpentUsd: 0,
    ordersCount: 0,
    lastActiveAt: Date.now(),
  };

  authUsers.set(email, newUser);
  if (ipRegs.length > 3) {
    recordFraudStrike({
      user: newUser,
      ipAddress: clientIp,
      eventType: 'MULTI_ACCOUNT_IP',
      points: 40,
      details: `تسجيل ${ipRegs.length} حسابات متعددة من نفس عنوان IP خلال 24 ساعة`,
    });
  }
  const token = createSessionToken(newUser.id);
  res.json({ token, user: sanitizeUser(newUser) });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' });
  }

  const user = authUsers.get(email);
  if (!user) {
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة.' });
  }
  if (user.isSuspended) {
    return res.status(403).json({ error: 'هذا الحساب موقوف حالياً من الإدارة.' });
  }

  // Admin passcode from process.env always overrides claimed hash
  if (user.role === 'ADMIN' && process.env.ADMIN_PASSCODE) {
    const envCode = process.env.ADMIN_PASSCODE;
    const a = Buffer.from(password);
    const b = Buffer.from(envCode);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'كلمة مرور المدير غير صحيحة.' });
    }
    user.lastActiveAt = Date.now();
    const token = createSessionToken(user.id);
    return res.json({ token, user: sanitizeUser(user) });
  }

  // First-run admin claim if no password set yet
  if (user.role === 'ADMIN' && !user.passwordHash) {
    if (password.length < 6) {
      return res.status(400).json({ error: 'لأول تسجيل دخول للمدير، اختر كلمة مرور من 6 محارف على الأقل لتأمين الحساب.' });
    }
    const { salt, hash } = hashSecret(password);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    adminPasswordClaimed = true;
    user.lastActiveAt = Date.now();
    const token = createSessionToken(user.id);
    return res.json({ token, user: sanitizeUser(user), adminJustClaimed: true });
  }

  if (!user.passwordSalt || !user.passwordHash || !verifySecret(password, user.passwordSalt, user.passwordHash)) {
    return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
  }

  user.lastActiveAt = Date.now();
  const token = createSessionToken(user.id);
  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/google', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const nameAr = String(req.body?.nameAr || '').trim() || email.split('@')[0] || 'مستخدم جوجل';
  const avatarUrl = String(req.body?.avatarUrl || '').trim();

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'تعذر التحقق من بريد حساب Google.' });
  }
  if (avatarUrl && !isSafeHttpUrl(avatarUrl)) {
    return res.status(400).json({ error: 'رابط الصورة غير صالح.' });
  }

  let user = authUsers.get(email);
  if (!user) {
    user = {
      id: `usr-g-${Date.now().toString(36)}`,
      nameAr,
      email,
      avatarUrl: avatarUrl || undefined,
      role: email === OWNER_ADMIN_EMAIL ? 'ADMIN' : 'USER',
      authProvider: 'google',
      balanceUsd: 0,
      totalSpentUsd: 0,
      ordersCount: 0,
      lastActiveAt: Date.now(),
    };
    authUsers.set(email, user);
  } else {
    if (user.isSuspended) {
      return res.status(403).json({ error: 'تم إيقاف هذا الحساب من قبل الإدارة.' });
    }
    if (avatarUrl) user.avatarUrl = avatarUrl;
    user.lastActiveAt = Date.now();
  }

  const token = createSessionToken(user.id);
  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صحيح.' });
  }
  const user = authUsers.get(email);
  if (!user) {
    return res.json({
      success: true,
      message: 'إذا كان البريد مسجلاً لدينا، فقد تم إرسال رمز استعادة مكون من 6 أرقام.',
    });
  }

  const code = String(crypto.randomInt(100000, 999999));
  const { salt, hash } = hashSecret(code);
  passwordResetCodes.set(email, {
    codeHash: hash,
    salt,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  res.json({
    success: true,
    message: 'تم إنشاء رمز الاستعادة (صالح لمدة 10 دقائق).',
    // Provided in non-SMTP preview mode so the user can test reset immediately
    previewResetCode: process.env.SMTP_HOST ? undefined : code,
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  if (!email || !code || newPassword.length < 6) {
    return res.status(400).json({ error: 'يرجى إدخال البريد ورمز الاستعادة وكلمة مرور جديدة (6 محارف على الأقل).' });
  }

  const record = passwordResetCodes.get(email);
  if (!record || Date.now() > record.expiresAt) {
    return res.status(400).json({ error: 'انتهت صلاحية رمز الاستعادة أو أنه غير موجود.' });
  }
  if (!verifySecret(code, record.salt, record.codeHash)) {
    return res.status(400).json({ error: 'رمز الاستعادة غير صحيح.' });
  }

  const user = authUsers.get(email);
  if (!user) {
    return res.status(404).json({ error: 'الحساب غير موجود.' });
  }

  const { salt, hash } = hashSecret(newPassword);
  user.passwordSalt = salt;
  user.passwordHash = hash;
  passwordResetCodes.delete(email);

  res.json({ success: true, message: 'تم تحديث كلمة المرور بنجاح! يمكنك تسجيل الدخول الآن.' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user: AuthRecord = (req as any).authUser;
  res.json({ user: sanitizeUser(user) });
});

app.post('/api/auth/profile', requireAuth, (req, res) => {
  const user: AuthRecord = (req as any).authUser;
  const nameAr = String(req.body?.nameAr || '').trim();
  const avatarUrl = String(req.body?.avatarUrl || '').trim();

  if (nameAr.length >= 2) user.nameAr = nameAr;
  if (avatarUrl) {
    if (!isSafeHttpUrl(avatarUrl)) {
      return res.status(400).json({ error: 'رابط الصورة يجب أن يبدأ بـ https:// أو http://' });
    }
    user.avatarUrl = avatarUrl;
  } else {
    user.avatarUrl = undefined;
  }
  res.json({ user: sanitizeUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  const header = String(req.headers.authorization || '');
  if (header.startsWith('Bearer ')) {
    activeSessions.delete(header.slice(7).trim());
  }
  res.json({ success: true });
});

// ============================================================================
// 7B. ADMIN STAFF & MODERATOR MANAGEMENT (Strictly ADMIN-only)
// ============================================================================

app.get('/api/admin/staff', requireAdmin, (_req, res) => {
  const users = Array.from(authUsers.values()).map((u) => sanitizeUser(u));
  res.json({ users, accounts: users });
});

app.post('/api/admin/staff', requireAdmin, (req, res) => {
  const nameAr = String(req.body?.nameAr || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const requestedRole = String(req.body?.role || 'MODERATOR').toUpperCase();
  const role: 'ADMIN' | 'MODERATOR' | 'RESELLER' | 'USER' =
    requestedRole === 'ADMIN' || requestedRole === 'MODERATOR' || requestedRole === 'RESELLER'
      ? requestedRole
      : 'USER';

  if (nameAr.length < 2) {
    return res.status(400).json({ error: 'يرجى إدخال اسم صحيح (حرفين على الأقل).' });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صحيح.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 محارف على الأقل.' });
  }
  if (authUsers.has(email)) {
    return res.status(409).json({ error: 'هذا البريد الإلكتروني مسجل مسبقاً.' });
  }

  const { salt, hash } = hashSecret(password);
  const newId = `usr-staff-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
  const newStaff: AuthRecord = {
    id: newId,
    nameAr,
    email,
    canonicalEmail: normalizeCanonicalEmail(email),
    role,
    isProtectedAdmin: role === 'ADMIN',
    resellerTier: role === 'RESELLER' ? 'SILVER' : undefined,
    resellerDiscountPercent: role === 'RESELLER' ? resellerConfig.silverDiscountPercent : undefined,
    resellerApprovedAt: role === 'RESELLER' ? Date.now() : undefined,
    transferMemoTag: generateTransferMemoTag(newId),
    authProvider: 'email',
    passwordSalt: salt,
    passwordHash: hash,
    balanceUsd: 0,
    totalSpentUsd: 0,
    ordersCount: 0,
    lastActiveAt: Date.now(),
  };
  authUsers.set(email, newStaff);
  appendStaffAuditLog(
    (req as any).authUser,
    'STAFF_CREATE',
    `${newStaff.nameAr} (${newStaff.email}) — ${newStaff.role}`
  );
  res.json({ user: sanitizeUser(newStaff) });
});

app.patch('/api/admin/staff/:id', requireAdmin, (req, res) => {
  const actor: AuthRecord = (req as any).authUser;
  const targetId = String(req.params.id);
  const target = Array.from(authUsers.values()).find((u) => u.id === targetId);
  if (!target) {
    return res.status(404).json({ error: 'المستخدم غير موجود.' });
  }

  // Immutable Super Admin protection: ADMIN accounts cannot be demoted or suspended!
  if (target.role === 'ADMIN' || target.isProtectedAdmin || target.email === OWNER_ADMIN_EMAIL) {
    if (typeof req.body?.role === 'string' && req.body.role.toUpperCase() !== 'ADMIN') {
      return res.status(403).json({
        error: 'دور المدير العام محمي أمنياً وغير قابل للتغيير أو التخفيض نهائياً.',
      });
    }
    if (req.body?.isSuspended === true) {
      return res.status(403).json({
        error: 'لا يمكن إيقاف أو تقييد حساب المدير العام.',
      });
    }
  }

  if (typeof req.body?.role === 'string') {
    const r = req.body.role.toUpperCase();
    if (r === 'ADMIN' || r === 'MODERATOR' || r === 'RESELLER' || r === 'USER') {
      target.role = r;
      if (r === 'ADMIN') {
        target.isProtectedAdmin = true;
      } else if (r === 'RESELLER') {
        const tier = req.body?.resellerTier === 'GOLD' ? 'GOLD' : 'SILVER';
        target.resellerTier = tier;
        target.resellerDiscountPercent =
          typeof req.body?.resellerDiscountPercent === 'number'
            ? Math.min(40, Math.max(1, req.body.resellerDiscountPercent))
            : tier === 'GOLD'
            ? resellerConfig.goldDiscountPercent
            : resellerConfig.silverDiscountPercent;
        target.resellerApprovedAt = target.resellerApprovedAt || Date.now();
      } else {
        target.resellerTier = undefined;
        target.resellerDiscountPercent = undefined;
      }
    }
  }
  if (typeof req.body?.resellerDiscountPercent === 'number' && target.role === 'RESELLER') {
    target.resellerDiscountPercent = Math.min(40, Math.max(1, req.body.resellerDiscountPercent));
  }
  if (req.body?.resellerTier === 'SILVER' || req.body?.resellerTier === 'GOLD') {
    target.resellerTier = req.body.resellerTier;
  }
  if (typeof req.body?.isSuspended === 'boolean' && target.role !== 'ADMIN' && !target.isProtectedAdmin) {
    target.isSuspended = req.body.isSuspended;
    if (!req.body.isSuspended) {
      target.restrictedUntil = null;
      target.restrictionReason = null;
    }
  }
  if (typeof req.body?.newPassword === 'string' && req.body.newPassword.length >= 6) {
    const { salt, hash } = hashSecret(req.body.newPassword);
    target.passwordSalt = salt;
    target.passwordHash = hash;
  }
  appendStaffAuditLog(
    actor,
    'STAFF_UPDATE',
    `${target.nameAr} (${target.role}${target.resellerDiscountPercent ? ` -${target.resellerDiscountPercent}%` : ''}${target.isSuspended ? ' / موقوف' : ''})`
  );
  res.json({ user: sanitizeUser(target) });
});

app.delete('/api/admin/staff/:id', requireAdmin, (req, res) => {
  const actor: AuthRecord = (req as any).authUser;
  const targetId = String(req.params.id);
  const target = Array.from(authUsers.values()).find((u) => u.id === targetId);
  if (!target) {
    return res.status(404).json({ error: 'المستخدم غير موجود.' });
  }
  if (
    target.role === 'ADMIN' ||
    target.isProtectedAdmin ||
    target.email === OWNER_ADMIN_EMAIL ||
    target.id === actor.id
  ) {
    return res.status(403).json({
      error: 'حساب المدير العام محمي أمنياً ولا يمكن حذفه نهائياً.',
    });
  }
  authUsers.delete(target.email);
  appendStaffAuditLog(actor, 'STAFF_DELETE', `${target.nameAr} (${target.email})`);
  res.json({ ok: true });
});

// ============================================================================
// 7C. SERVER-BACKED MANUAL TOP-UP RECEIPTS QUEUE (Customers -> Admin/Moderators)
// ============================================================================

interface ServerTopUpRequest {
  id: string;
  userId: string;
  userNameAr: string;
  gatewayId: string;
  gatewayNameAr: string;
  referenceId: string;
  amountOriginal: number;
  currencyOriginal: 'USD' | 'USDT' | 'SYP' | 'TRY';
  equivalentUsd: number;
  equivalentSyp: number;
  receiptImageUrl?: string;
  receiptArchiveId?: string;
  receiptSizeBytes?: number;
  receiptDuplicateWarning?: boolean;
  customFieldValues?: Record<string, string>;
  reviewedBy?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  createdAt: number;
  processedAt?: number;
}

const serverTopUpRequests: ServerTopUpRequest[] = [];

function isSafeUploadedImageDataUrl(raw: unknown): boolean {
  if (typeof raw !== 'string' || !raw) return false;
  // Strictly allow raster PNG/JPEG/WEBP/GIF up to ~2.5MB base64; explicitly reject SVG to prevent XSS
  return /^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(raw) && raw.length <= 3_500_000;
}

function archiveReceiptDataUrl(
  topUpId: string,
  dataUrl: string
): { archiveId: string; sizeBytes: number; isDuplicateImage: boolean } | null {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
  if (!match) return null;
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const isDuplicateImage = seenReceiptImageHashes.has(sha256);
  seenReceiptImageHashes.add(sha256);

  const safeFileName = `${topUpId.replace(/[^a-zA-Z0-9_-]/g, '')}.${ext}`;
  ensureDataDir();
  const targetPath = path.resolve(RECEIPTS_ARCHIVE_DIR, safeFileName);
  // Strict path confinement check
  if (!targetPath.startsWith(RECEIPTS_ARCHIVE_DIR + path.sep)) {
    return null;
  }
  try {
    fs.writeFileSync(targetPath, buffer);
    return { archiveId: safeFileName, sizeBytes: buffer.length, isDuplicateImage };
  } catch {
    return { archiveId: safeFileName, sizeBytes: buffer.length, isDuplicateImage };
  }
}

// Protected Staff-Only Receipt Archive Download Endpoint
app.get('/api/topups/receipt/:fileName', requireStaff, (req, res) => {
  const rawName = path.basename(String(req.params.fileName || ''));
  if (!/^[a-zA-Z0-9_-]+\.(png|jpg|webp|gif)$/.test(rawName)) {
    return res.status(400).json({ error: 'اسم الملف غير صالح.' });
  }
  const resolved = path.resolve(RECEIPTS_ARCHIVE_DIR, rawName);
  if (!resolved.startsWith(RECEIPTS_ARCHIVE_DIR + path.sep) || !fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'صورة الإشعار غير موجودة في الأرشيف.' });
  }
  const ext = path.extname(rawName).slice(1);
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(resolved);
});

app.get('/api/topups', requireStaff, (_req, res) => {
  res.json({ requests: serverTopUpRequests, topUps: serverTopUpRequests });
});

app.post('/api/topups', (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (authUser) {
    const restriction = checkUserRestriction(authUser);
    if (restriction.blocked) {
      return res.status(403).json({ error: restriction.error, code: 'ACCOUNT_RESTRICTED' });
    }
  }
  const {
    gatewayId,
    gatewayNameAr,
    referenceId,
    amountOriginal,
    currencyOriginal,
    equivalentUsd,
    equivalentSyp,
    receiptImageUrl,
    customFieldValues,
  } = req.body || {};

  const cleanRef = String(referenceId || '').trim();
  const normRef = normalizePaymentRef(cleanRef);
  const numAmount = Number(amountOriginal);
  const eqUsd = Number(equivalentUsd);

  if (!gatewayId || !cleanRef || !Number.isFinite(numAmount) || numAmount <= 0 || !Number.isFinite(eqUsd) || eqUsd <= 0) {
    return res.status(400).json({ error: 'بيانات طلب الشحن غير مكتملة.' });
  }

  // Global cross-account duplicate Reference ID guard (blocks duplicate across ALL accounts!)
  if (usedReferenceRegistry.has(normRef) || usedPaymentReferences.has(cleanRef)) {
    recordFraudStrike({
      user: authUser,
      ipAddress: req.ip || 'unknown',
      eventType: 'DUPLICATE_REF_ATTEMPT',
      points: 35,
      details: `محاولة إعادة استخدام رقم العملية #${cleanRef} عبر بوابة ${gatewayNameAr || gatewayId}`,
    });
    return res.status(409).json({
      code: 'DUPLICATE_REFERENCE_ID',
      error: 'رقم عملية التحويل هذا تم استخدامه مسبقاً في طلب آخر أو حساب آخر! تم تسجيل المحاولة في نظام الحماية.',
    });
  }

  let safeReceipt: string | undefined;
  let receiptArchiveId: string | undefined;
  let receiptSizeBytes: number | undefined;
  let receiptDuplicateWarning = false;

  const topUpId = `topup-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;

  if (receiptImageUrl) {
    if (!isSafeUploadedImageDataUrl(receiptImageUrl)) {
      return res.status(400).json({ error: 'صورة الإشعار غير صالحة أو يتجاوز حجمها 2 ميغابايت (PNG/JPG/WEBP فقط).' });
    }
    safeReceipt = String(receiptImageUrl);
    const archived = archiveReceiptDataUrl(topUpId, safeReceipt);
    if (archived) {
      receiptArchiveId = archived.archiveId;
      receiptSizeBytes = archived.sizeBytes;
      receiptDuplicateWarning = archived.isDuplicateImage;
      if (receiptDuplicateWarning) {
        recordFraudStrike({
          user: authUser,
          ipAddress: req.ip || 'unknown',
          eventType: 'DUPLICATE_RECEIPT_IMAGE',
          points: 50,
          details: `رفع صورة إشعار مكررة البصمة (SHA-256) للطلب #${cleanRef}`,
        });
      }
    }
  }

  const safeCustomFields: Record<string, string> = {};
  if (customFieldValues && typeof customFieldValues === 'object') {
    for (const [k, v] of Object.entries(customFieldValues)) {
      const cleanK = String(k).trim().slice(0, 80);
      const cleanV = String(v ?? '').trim().slice(0, 300);
      if (cleanK && cleanV) safeCustomFields[cleanK] = cleanV;
    }
  }

  const record: ServerTopUpRequest = {
    id: topUpId,
    userId: authUser?.id || 'guest',
    userNameAr: authUser?.nameAr || 'عميل المنصة',
    gatewayId: String(gatewayId),
    gatewayNameAr: String(gatewayNameAr || gatewayId),
    referenceId: cleanRef,
    amountOriginal: numAmount,
    currencyOriginal: ['USD', 'USDT', 'SYP', 'TRY'].includes(currencyOriginal) ? currencyOriginal : 'USD',
    equivalentUsd: Number(eqUsd.toFixed(2)),
    equivalentSyp: Math.round(Number(equivalentSyp) || eqUsd * serverConfig.usdToSypRate),
    receiptImageUrl: safeReceipt,
    receiptArchiveId,
    receiptSizeBytes,
    receiptDuplicateWarning,
    customFieldValues: Object.keys(safeCustomFields).length > 0 ? safeCustomFields : undefined,
    status: 'PENDING',
    createdAt: Date.now(),
  };

  // Check if ShamCash MacroDroid webhook already received this transfer as UNCLAIMED
  const isShamCashGateway =
    /sham|شام/i.test(record.gatewayId) || /sham|شام/i.test(record.gatewayNameAr);
  let autoApproved = false;
  let newBalanceUsd: number | undefined;

  if (isShamCashGateway) {
    const incoming = verifiedIncomingShamCashPool.get(normRef);
    if (incoming && incoming.status === 'UNCLAIMED') {
      const sameCurrencyMatch =
        record.currencyOriginal === incoming.currency &&
        Math.abs(record.amountOriginal - incoming.amount) <= Math.max(0.01, incoming.amount * 0.01);
      const usdTolerance = Math.max(0.05, incoming.equivalentUsd * 0.02);
      if (sameCurrencyMatch || Math.abs(record.equivalentUsd - incoming.equivalentUsd) <= usdTolerance) {
        incoming.status = 'CLAIMED';
        incoming.matchedTopUpId = record.id;
        incoming.claimedByUserId = record.userId;
        incoming.claimedAt = Date.now();
        persistShamCashTransfers();

        record.status = 'APPROVED';
        record.equivalentUsd = Number(incoming.equivalentUsd.toFixed(2));
        record.equivalentSyp = Math.round(record.equivalentUsd * serverConfig.usdToSypRate);
        record.processedAt = Date.now();
        record.reviewedBy = 'ShamCash Webhook Auto-Match';

        userWalletUsd = Number((userWalletUsd + record.equivalentUsd).toFixed(2));
        if (authUser) {
          authUser.balanceUsd = Number((authUser.balanceUsd + record.equivalentUsd).toFixed(2));
          newBalanceUsd = authUser.balanceUsd;
        } else {
          newBalanceUsd = userWalletUsd;
        }
        autoApproved = true;
      }
    }
  }

  usedReferenceRegistry.set(normRef, {
    userId: record.userId,
    userNameAr: record.userNameAr,
    gatewayId: record.gatewayId,
    status: autoApproved ? 'APPROVED' : 'PENDING',
    createdAt: record.createdAt,
  });
  usedPaymentReferences.add(cleanRef);
  persistUsedReferences();

  serverTopUpRequests.unshift(record);
  res.json({ topUp: record, autoApproved, newBalanceUsd });
});

app.post('/api/topups/:id/review', requireStaff, (req, res) => {
  const reviewer: AuthRecord = (req as any).authUser;
  const id = String(req.params.id);
  const action = String(req.body?.action || '').toUpperCase();
  const reason = String(req.body?.reason || '').trim().slice(0, 200);

  const item = serverTopUpRequests.find((t) => t.id === id);
  if (!item) {
    return res.status(404).json({ error: 'طلب الشحن غير موجود على الخادم.' });
  }
  if (item.status !== 'PENDING') {
    return res.status(400).json({ error: 'تمت معالجة هذا الطلب مسبقاً.' });
  }

  const normRef = normalizePaymentRef(item.referenceId);

  if (action === 'APPROVE') {
    item.status = 'APPROVED';
    item.processedAt = Date.now();
    item.reviewedBy = `${reviewer.nameAr} (${reviewer.role})`;
    userWalletUsd = Number((userWalletUsd + item.equivalentUsd).toFixed(2));
    const owner = Array.from(authUsers.values()).find((u) => u.id === item.userId);
    if (owner) {
      owner.balanceUsd = Number((owner.balanceUsd + item.equivalentUsd).toFixed(2));
    }
    usedReferenceRegistry.set(normRef, {
      userId: item.userId,
      userNameAr: item.userNameAr,
      gatewayId: item.gatewayId,
      status: 'APPROVED',
      createdAt: item.createdAt,
    });
    persistUsedReferences();
    appendStaffAuditLog(
      reviewer,
      'TOPUP_APPROVE',
      `طلب #${item.referenceId} — ${item.userNameAr} (${item.gatewayNameAr})`,
      item.equivalentUsd
    );
  } else if (action === 'REJECT') {
    item.status = 'REJECTED';
    item.rejectionReason = reason || 'تعذر التحقق من الإشعار';
    item.processedAt = Date.now();
    item.reviewedBy = `${reviewer.nameAr} (${reviewer.role})`;
    // Release pending reference on rejection so genuine typos can be corrected
    const reg = usedReferenceRegistry.get(normRef);
    if (reg && reg.status === 'PENDING') {
      usedReferenceRegistry.delete(normRef);
      usedPaymentReferences.delete(item.referenceId);
      persistUsedReferences();
    }
    appendStaffAuditLog(
      reviewer,
      'TOPUP_REJECT',
      `طلب #${item.referenceId} — ${item.userNameAr}`,
      item.equivalentUsd,
      item.rejectionReason
    );
    // Record fraud strike when staff rejects a top-up for fake/mismatched proof
    const ownerAcc = Array.from(authUsers.values()).find((u) => u.id === item.userId);
    recordFraudStrike({
      user: ownerAcc,
      userId: item.userId,
      userNameAr: item.userNameAr,
      ipAddress: req.ip || 'staff-review',
      eventType: 'FAKE_TOPUP_REJECTED',
      points: 35,
      details: `رفض طلب شحن #${item.referenceId} ($${item.equivalentUsd}) — السبب: ${item.rejectionReason}`,
    });
  } else {
    return res.status(400).json({ error: 'إجراء غير صالح.' });
  }

  res.json({ topUp: item });
});

// ============================================================================
// 7D. GIFT CARDS / VOUCHER CODES + STAFF AUDIT TRAIL + WEB PUSH SUBSCRIPTIONS
// ============================================================================

interface ServerVoucherItem {
  id: string;
  code: string;
  amountUsd: number;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  note?: string;
  expiresAt?: number | null;
  createdBy: string;
  createdAt: number;
  redemptions: { userId: string; userNameAr: string; redeemedAt: number }[];
}

interface ServerStaffAuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: 'ADMIN' | 'MODERATOR';
  actionType: string;
  targetLabel: string;
  amountUsd?: number;
  reason?: string;
  createdAt: number;
}

const serverVouchers: ServerVoucherItem[] = readJsonFileSafe<ServerVoucherItem[]>(VOUCHERS_PATH, []);
const staffAuditLogs: ServerStaffAuditEntry[] = readJsonFileSafe<ServerStaffAuditEntry[]>(
  AUDIT_TRAIL_PATH,
  []
);
const voucherRateMap = new Map<string, { count: number; resetAt: number }>();
const pushSubscriptionsMap = new Map<
  string,
  { userId: string; enabled: boolean; swReady: boolean; userAgent: string; updatedAt: number }
>();

function persistVouchers() {
  writeJsonFileSafe(VOUCHERS_PATH, serverVouchers);
}

function appendStaffAuditLog(
  actor: AuthRecord | undefined,
  actionType: string,
  targetLabel: string,
  amountUsd?: number,
  reason?: string
) {
  if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'MODERATOR')) return;
  const entry: ServerStaffAuditEntry = {
    id: `aud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
    actorId: actor.id,
    actorName: actor.nameAr,
    actorRole: actor.role,
    actionType,
    targetLabel: String(targetLabel || '').slice(0, 180),
    amountUsd: typeof amountUsd === 'number' && Number.isFinite(amountUsd) ? Number(amountUsd.toFixed(2)) : undefined,
    reason: reason ? String(reason).slice(0, 200) : undefined,
    createdAt: Date.now(),
  };
  staffAuditLogs.unshift(entry);
  if (staffAuditLogs.length > 500) staffAuditLogs.length = 500;
  writeJsonFileSafe(AUDIT_TRAIL_PATH, staffAuditLogs);
}

function generateSecureVoucherCode(prefix = 'ALIS'): string {
  const cleanPrefix = prefix.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6) || 'ALIS';
  const part1 = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  const part2 = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return `${cleanPrefix}-${part1}-${part2}`;
}

function checkVoucherRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = voucherRateMap.get(key);
  if (!entry || now > entry.resetAt) {
    voucherRateMap.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 6) return false;
  entry.count += 1;
  return true;
}

app.get('/api/admin/vouchers', requireAdmin, (_req, res) => {
  res.json({ vouchers: serverVouchers });
});

app.post('/api/admin/vouchers', requireAdmin, (req, res) => {
  const adminUser: AuthRecord = (req as any).authUser;
  const amountUsd = Number(req.body?.amountUsd);
  const quantity = Math.min(50, Math.max(1, Math.floor(Number(req.body?.quantity || 1))));
  const maxUses = Math.min(1000, Math.max(1, Math.floor(Number(req.body?.maxUses || 1))));
  const customCode = String(req.body?.customCode || '').trim().toUpperCase();
  const prefix = String(req.body?.prefix || 'ALIS').trim().toUpperCase();
  const note = String(req.body?.note || '').trim().slice(0, 120);
  const expiryDays = Number(req.body?.expiryDays || 0);

  if (!Number.isFinite(amountUsd) || amountUsd <= 0 || amountUsd > 10000) {
    return res.status(400).json({ error: 'قيمة القسيمة يجب أن تكون بين 0.10$ و 10,000$.' });
  }

  const expiresAt =
    Number.isFinite(expiryDays) && expiryDays > 0
      ? Date.now() + Math.round(expiryDays) * 86400_000
      : null;

  const created: ServerVoucherItem[] = [];
  if (customCode) {
    if (!/^[A-Z0-9-]{4,24}$/.test(customCode)) {
      return res.status(400).json({ error: 'صيغة كود القسيمة غير صالحة (حروف إنجليزية وأرقام وشرطة فقط).' });
    }
    if (serverVouchers.some((v) => v.code === customCode)) {
      return res.status(409).json({ error: 'كود القسيمة هذا موجود مسبقاً.' });
    }
    const item: ServerVoucherItem = {
      id: `vch-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      code: customCode,
      amountUsd: Number(amountUsd.toFixed(2)),
      maxUses,
      usedCount: 0,
      isActive: true,
      note: note || undefined,
      expiresAt,
      createdBy: adminUser.nameAr,
      createdAt: Date.now(),
      redemptions: [],
    };
    serverVouchers.unshift(item);
    created.push(item);
  } else {
    for (let i = 0; i < quantity; i++) {
      let code = generateSecureVoucherCode(prefix);
      while (serverVouchers.some((v) => v.code === code)) {
        code = generateSecureVoucherCode(prefix);
      }
      const item: ServerVoucherItem = {
        id: `vch-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}-${i}`,
        code,
        amountUsd: Number(amountUsd.toFixed(2)),
        maxUses,
        usedCount: 0,
        isActive: true,
        note: note || undefined,
        expiresAt,
        createdBy: adminUser.nameAr,
        createdAt: Date.now(),
        redemptions: [],
      };
      serverVouchers.unshift(item);
      created.push(item);
    }
  }

  persistVouchers();
  appendStaffAuditLog(
    adminUser,
    'VOUCHER_CREATE',
    created.length === 1
      ? `قسيمة ${created[0].code} ($${created[0].amountUsd})`
      : `توليد ${created.length} قسيمة بقيمة $${amountUsd.toFixed(2)} لكل قسيمة`,
    Number((amountUsd * created.length).toFixed(2))
  );

  res.json({ created, vouchers: serverVouchers });
});

app.patch('/api/admin/vouchers/:id', requireAdmin, (req, res) => {
  const adminUser: AuthRecord = (req as any).authUser;
  const v = serverVouchers.find((item) => item.id === String(req.params.id));
  if (!v) return res.status(404).json({ error: 'القسيمة غير موجودة.' });
  if (typeof req.body?.isActive === 'boolean') {
    v.isActive = req.body.isActive;
  }
  persistVouchers();
  appendStaffAuditLog(
    adminUser,
    'VOUCHER_TOGGLE',
    `${v.code} → ${v.isActive ? 'مفعّلة' : 'موقوفة'}`,
    v.amountUsd
  );
  res.json({ voucher: v });
});

app.delete('/api/admin/vouchers/:id', requireAdmin, (req, res) => {
  const adminUser: AuthRecord = (req as any).authUser;
  const idx = serverVouchers.findIndex((item) => item.id === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'القسيمة غير موجودة.' });
  const [removed] = serverVouchers.splice(idx, 1);
  persistVouchers();
  appendStaffAuditLog(adminUser, 'VOUCHER_DELETE', removed.code, removed.amountUsd);
  res.json({ ok: true });
});

app.post('/api/vouchers/redeem', requireAuth, (req, res) => {
  const user: AuthRecord = (req as any).authUser;
  const restriction = checkUserRestriction(user);
  if (restriction.blocked) {
    return res.status(403).json({ error: restriction.error, code: 'ACCOUNT_RESTRICTED' });
  }
  const rateKey = `${req.ip || 'ip'}::${user.id}`;
  if (!checkVoucherRateLimit(rateKey)) {
    recordFraudStrike({
      user,
      ipAddress: req.ip || 'unknown',
      eventType: 'VOUCHER_BRUTEFORCE',
      points: 35,
      details: 'تجاوز الحد المسموح من محاولات تخمين أكواد قسائم الشحن',
    });
    return res.status(429).json({
      error: 'تجاوزت عدد محاولات تفعيل القسائم (6 محاولات بالدقيقة). يرجى الانتظار قليلاً.',
    });
  }

  const rawCode = String(req.body?.code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!rawCode || rawCode.length < 4) {
    return res.status(400).json({ error: 'يرجى إدخال كود قسيمة الشحن بشكل صحيح.' });
  }

  const voucher = serverVouchers.find((v) => v.code === rawCode);
  if (!voucher) {
    const wrongKey = user.id;
    const now = Date.now();
    const entry = voucherWrongAttemptsMap.get(wrongKey);
    if (!entry || now > entry.resetAt) {
      voucherWrongAttemptsMap.set(wrongKey, { count: 1, resetAt: now + 15 * 60_000 });
    } else {
      entry.count += 1;
      if (entry.count >= 5) {
        entry.count = 0;
        recordFraudStrike({
          user,
          ipAddress: req.ip || 'unknown',
          eventType: 'VOUCHER_BRUTEFORCE',
          points: 30,
          details: '5 محاولات متتالية خاطئة لتخمين كود قسيمة شحن',
        });
      }
    }
    return res.status(404).json({ error: 'كود قسيمة الشحن غير صحيح أو غير موجود.' });
  }
  if (!voucher.isActive) {
    return res.status(400).json({ error: 'هذه القسيمة موقوفة حالياً من الإدارة.' });
  }
  if (voucher.expiresAt && Date.now() > voucher.expiresAt) {
    return res.status(400).json({ error: 'انتهت صلاحية هذه القسيمة.' });
  }
  if (voucher.usedCount >= voucher.maxUses) {
    return res.status(400).json({ error: 'تم استخدام هذه القسيمة بالكامل مسبقاً.' });
  }
  if (voucher.redemptions.some((r) => r.userId === user.id)) {
    return res.status(400).json({ error: 'لقد قمت باستخدام هذه القسيمة مسبقاً في حسابك.' });
  }

  voucher.usedCount += 1;
  voucher.redemptions.unshift({
    userId: user.id,
    userNameAr: user.nameAr,
    redeemedAt: Date.now(),
  });
  persistVouchers();

  const creditedUsd = Number(voucher.amountUsd.toFixed(2));
  const creditedSyp = Math.round(creditedUsd * serverConfig.usdToSypRate);
  user.balanceUsd = Number((user.balanceUsd + creditedUsd).toFixed(2));
  userWalletUsd = Number((userWalletUsd + creditedUsd).toFixed(2));

  const tx = {
    id: `VCH-${Date.now().toString().slice(-5)}`,
    gateway: 'voucher',
    gatewayLabelAr: 'قسيمة شحن',
    referenceId: voucher.code,
    amountOriginal: creditedUsd,
    currencyOriginal: 'USD' as const,
    creditedUsd,
    creditedSyp,
    status: 'VERIFIED' as const,
    createdAt: Date.now(),
    note: voucher.note || `شحن فوري عبر قسيمة الشحن ${voucher.code}`,
  };
  paymentHistory.unshift(tx);

  res.json({
    ok: true,
    creditedUsd,
    walletUsd: user.balanceUsd,
    transaction: tx,
    message: `تم تفعيل القسيمة وإضافة $${creditedUsd.toFixed(2)} إلى محفظتك فوراً!`,
  });
});

// Staff Audit Trail Endpoints
app.post('/api/admin/audit-logs', requireStaff, (req, res) => {
  const actor: AuthRecord = (req as any).authUser;
  const actionType = String(req.body?.actionType || '').trim();
  const targetLabel = String(req.body?.targetLabel || '').trim();
  const amountUsd = req.body?.amountUsd !== undefined ? Number(req.body.amountUsd) : undefined;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
  if (!actionType || !targetLabel) {
    return res.status(400).json({ error: 'بيانات سجل التدقيق غير مكتملة.' });
  }
  appendStaffAuditLog(actor, actionType, targetLabel, amountUsd, reason);
  res.json({ ok: true });
});

app.get('/api/admin/audit-logs', requireAdmin, (_req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  const summaryMap = new Map<
    string,
    {
      actorId: string;
      actorName: string;
      actorRole: 'ADMIN' | 'MODERATOR';
      approvedCount: number;
      approvedUsd: number;
      rejectedCount: number;
      walletAdjustCount: number;
      ordersActionCount: number;
      totalActions: number;
    }
  >();

  for (const log of staffAuditLogs) {
    if (log.createdAt < todayMs) continue;
    let row = summaryMap.get(log.actorId);
    if (!row) {
      row = {
        actorId: log.actorId,
        actorName: log.actorName,
        actorRole: log.actorRole,
        approvedCount: 0,
        approvedUsd: 0,
        rejectedCount: 0,
        walletAdjustCount: 0,
        ordersActionCount: 0,
        totalActions: 0,
      };
      summaryMap.set(log.actorId, row);
    }
    row.totalActions += 1;
    if (log.actionType === 'TOPUP_APPROVE') {
      row.approvedCount += 1;
      row.approvedUsd = Number((row.approvedUsd + (log.amountUsd || 0)).toFixed(2));
    } else if (log.actionType === 'TOPUP_REJECT') {
      row.rejectedCount += 1;
    } else if (log.actionType === 'WALLET_ADJUST') {
      row.walletAdjustCount += 1;
    } else if (log.actionType === 'ORDER_CANCEL' || log.actionType === 'ORDER_COMPLETE') {
      row.ordersActionCount += 1;
    }
  }

  res.json({
    logs: staffAuditLogs.slice(0, 200),
    dailySummary: Array.from(summaryMap.values()).sort((a, b) => b.totalActions - a.totalActions),
  });
});

// Web Push Notification Subscription Endpoints
app.get('/api/push/status', requireAuth, (req, res) => {
  const user: AuthRecord = (req as any).authUser;
  const sub = pushSubscriptionsMap.get(user.id);
  res.json({ enabled: Boolean(sub?.enabled), updatedAt: sub?.updatedAt || null });
});

app.post('/api/push/subscribe', requireAuth, (req, res) => {
  const user: AuthRecord = (req as any).authUser;
  pushSubscriptionsMap.set(user.id, {
    userId: user.id,
    enabled: true,
    swReady: Boolean(req.body?.swReady),
    userAgent: String(req.body?.userAgent || '').slice(0, 180),
    updatedAt: Date.now(),
  });
  res.json({ ok: true, enabled: true });
});

app.post('/api/push/unsubscribe', requireAuth, (req, res) => {
  const user: AuthRecord = (req as any).authUser;
  pushSubscriptionsMap.delete(user.id);
  res.json({ ok: true, enabled: false });
});

// ============================================================================
// 7E. RESELLER PROGRAM & SECURITY / ANTI-FRAUD CONTROL CENTER ENDPOINTS
// ============================================================================

app.get('/api/reseller/my-status', requireAuth, (req, res) => {
  const user: AuthRecord = (req as any).authUser;
  const latestApp = resellerApplications.find((a) => a.userId === user.id) || null;
  res.json({
    role: user.role,
    resellerTier: user.resellerTier || null,
    resellerDiscountPercent: user.resellerDiscountPercent || 0,
    fraudScore: user.fraudScore || 0,
    balanceUsd: user.balanceUsd,
    totalSpentUsd: user.totalSpentUsd,
    config: resellerConfig,
    latestApplication: latestApp,
  });
});

app.post('/api/reseller/apply', requireAuth, (req, res) => {
  const user: AuthRecord = (req as any).authUser;
  if (user.role === 'RESELLER') {
    return res.status(400).json({ error: 'حسابك مفعّل كبائع معتمد بالفعل!' });
  }
  if (user.role === 'ADMIN' || user.role === 'MODERATOR') {
    return res.status(400).json({ error: 'حسابات الإدارة والإشراف لا تحتاج للتقديم كبائع.' });
  }
  if (resellerConfig.requireCleanSecurityRecord && (user.fraudScore || 0) >= 35) {
    return res.status(403).json({
      error: 'لا يمكن التقديم لبرنامج البائعين حالياً لوجود مخالفات أمنية مسجلة على الحساب.',
    });
  }
  const existingPending = resellerApplications.find(
    (a) => a.userId === user.id && a.status === 'PENDING'
  );
  if (existingPending) {
    return res.status(409).json({ error: 'لديك طلب انضمام قيد المراجعة بالفعل من قبل المدير العام.' });
  }

  const contactHandle = String(req.body?.contactHandle || '').trim().slice(0, 100);
  const expectedMonthlyVolumeUsd = Math.max(0, Number(req.body?.expectedMonthlyVolumeUsd || 100));
  const businessNote = String(req.body?.businessNote || '').trim().slice(0, 400);

  if (contactHandle.length < 4) {
    return res.status(400).json({ error: 'يرجى إدخال رقم واتساب أو معرف تيليجرام للتواصل وتأكيد الهوية.' });
  }

  const appRecord: ServerResellerApplication = {
    id: `rsl-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
    userId: user.id,
    userNameAr: user.nameAr,
    userEmail: user.email,
    contactHandle,
    expectedMonthlyVolumeUsd,
    businessNote: businessNote || 'طلب انضمام لبرنامج البائعين والموزعين',
    currentBalanceUsd: user.balanceUsd,
    totalSpentUsd: user.totalSpentUsd,
    fraudScore: user.fraudScore || 0,
    status: 'PENDING',
    createdAt: Date.now(),
  };

  resellerApplications.unshift(appRecord);
  persistResellerApplications();
  res.json({
    ok: true,
    application: appRecord,
    message: 'تم إرسال طلب الانضمام لبرنامج البائعين بنجاح! سيقوم المدير العام بمراجعته وتفعيل خصمك الخاص.',
  });
});

app.get('/api/admin/resellers', requireAdmin, (_req, res) => {
  const activeResellers = Array.from(authUsers.values())
    .filter((u) => u.role === 'RESELLER')
    .map((u) => sanitizeUser(u));
  res.json({
    config: resellerConfig,
    applications: resellerApplications,
    activeResellers,
  });
});

app.post('/api/admin/resellers/config', requireAdmin, (req, res) => {
  const adminUser: AuthRecord = (req as any).authUser;
  const silver = Number(req.body?.silverDiscountPercent);
  const gold = Number(req.body?.goldDiscountPercent);
  const minDep = Number(req.body?.minDepositUsd);
  const minMonthly = Number(req.body?.minMonthlySpendUsd);

  if (Number.isFinite(silver) && silver >= 1 && silver <= 40) resellerConfig.silverDiscountPercent = silver;
  if (Number.isFinite(gold) && gold >= 1 && gold <= 40) resellerConfig.goldDiscountPercent = gold;
  if (Number.isFinite(minDep) && minDep >= 0) resellerConfig.minDepositUsd = minDep;
  if (Number.isFinite(minMonthly) && minMonthly >= 0) resellerConfig.minMonthlySpendUsd = minMonthly;
  if (typeof req.body?.requireCleanSecurityRecord === 'boolean') {
    resellerConfig.requireCleanSecurityRecord = req.body.requireCleanSecurityRecord;
  }
  persistResellerConfig();
  appendStaffAuditLog(
    adminUser,
    'SETTINGS_UPDATE',
    `تحديث شروط برنامج البائعين (فضي ${resellerConfig.silverDiscountPercent}%، ذهبي ${resellerConfig.goldDiscountPercent}%، حد إيداع $${resellerConfig.minDepositUsd})`
  );
  res.json({ ok: true, config: resellerConfig });
});

app.post('/api/admin/resellers/:id/review', requireAdmin, (req, res) => {
  const adminUser: AuthRecord = (req as any).authUser;
  const appItem = resellerApplications.find((a) => a.id === String(req.params.id));
  if (!appItem) return res.status(404).json({ error: 'طلب البائع غير موجود.' });
  if (appItem.status !== 'PENDING') {
    return res.status(400).json({ error: 'تمت معالجة هذا الطلب مسبقاً.' });
  }

  const action = String(req.body?.action || '').toUpperCase();
  if (action === 'APPROVE') {
    const tier: 'SILVER' | 'GOLD' = req.body?.tier === 'GOLD' ? 'GOLD' : 'SILVER';
    const customDiscount = Number(req.body?.discountPercent);
    const discountPct =
      Number.isFinite(customDiscount) && customDiscount >= 1 && customDiscount <= 40
        ? customDiscount
        : tier === 'GOLD'
        ? resellerConfig.goldDiscountPercent
        : resellerConfig.silverDiscountPercent;

    appItem.status = 'APPROVED';
    appItem.assignedTier = tier;
    appItem.assignedDiscountPercent = discountPct;
    appItem.reviewedAt = Date.now();
    appItem.reviewedBy = adminUser.nameAr;

    const targetUser = Array.from(authUsers.values()).find((u) => u.id === appItem.userId);
    if (targetUser && targetUser.role !== 'ADMIN' && !targetUser.isProtectedAdmin) {
      targetUser.role = 'RESELLER';
      targetUser.resellerTier = tier;
      targetUser.resellerDiscountPercent = discountPct;
      targetUser.resellerApprovedAt = Date.now();
    }
    persistResellerApplications();
    appendStaffAuditLog(
      adminUser,
      'STAFF_UPDATE',
      `ترقية ${appItem.userNameAr} إلى بائع معتمد (${tier} — خصم ${discountPct}%)`
    );
    return res.json({ ok: true, application: appItem });
  }

  if (action === 'REJECT') {
    appItem.status = 'REJECTED';
    appItem.rejectionReason = String(req.body?.reason || 'لم يستوفِ شروط برنامج البائعين حالياً').slice(
      0,
      200
    );
    appItem.reviewedAt = Date.now();
    appItem.reviewedBy = adminUser.nameAr;
    persistResellerApplications();
    appendStaffAuditLog(
      adminUser,
      'STAFF_UPDATE',
      `رفض طلب بائع ${appItem.userNameAr}`,
      undefined,
      appItem.rejectionReason
    );
    return res.json({ ok: true, application: appItem });
  }

  res.status(400).json({ error: 'إجراء غير صالح.' });
});

// Security & Anti-Fraud Control Center Endpoints (Super Admin Only)
app.get('/api/admin/security/overview', requireAdmin, (_req, res) => {
  const riskProfiles = Array.from(authUsers.values())
    .filter(
      (u) =>
        (u.fraudScore || 0) > 0 ||
        u.isSuspended ||
        (u.restrictedUntil && u.restrictedUntil > Date.now())
    )
    .map((u) => ({
      userId: u.id,
      userNameAr: u.nameAr,
      userEmail: u.email,
      riskScore: u.fraudScore || 0,
      strikesCount: u.strikesCount || 0,
      restrictedUntil: u.restrictedUntil || null,
      isSuspended: Boolean(u.isSuspended),
      restrictionReason: u.restrictionReason || null,
      lastEventAt: u.lastActiveAt,
    }))
    .sort((a, b) => b.riskScore - a.riskScore);

  res.json({
    policy: securityPolicy,
    riskProfiles,
    events: fraudEvents.slice(0, 200),
  });
});

app.post('/api/admin/security/config', requireAdmin, (req, res) => {
  const adminUser: AuthRecord = (req as any).authUser;
  if (typeof req.body?.strictAutoPayments === 'boolean') {
    securityPolicy.strictAutoPayments = req.body.strictAutoPayments;
  }
  if (typeof req.body?.autoPaymentsPanicStop === 'boolean') {
    securityPolicy.autoPaymentsPanicStop = req.body.autoPaymentsPanicStop;
  }
  if (typeof req.body?.enforceEmailWhitelist === 'boolean') {
    securityPolicy.enforceEmailWhitelist = req.body.enforceEmailWhitelist;
  }
  if (Array.isArray(req.body?.allowedEmailDomains)) {
    const cleaned = req.body.allowedEmailDomains
      .map((d: unknown) => String(d || '').trim().toLowerCase().replace(/^@/, ''))
      .filter((d: string) => d.includes('.') && d.length >= 4 && d.length <= 60);
    if (cleaned.length > 0) {
      securityPolicy.allowedEmailDomains = Array.from(new Set(cleaned));
    }
  }
  const restrictThr = Number(req.body?.autoRestrictScoreThreshold);
  const suspendThr = Number(req.body?.autoSuspendScoreThreshold);
  if (Number.isFinite(restrictThr) && restrictThr >= 20 && restrictThr <= 200) {
    securityPolicy.autoRestrictScoreThreshold = restrictThr;
  }
  if (Number.isFinite(suspendThr) && suspendThr >= 40 && suspendThr <= 300) {
    securityPolicy.autoSuspendScoreThreshold = suspendThr;
  }
  persistSecurityPolicy();
  appendStaffAuditLog(
    adminUser,
    'SETTINGS_UPDATE',
    `تحديث سياسة الأمان (الدفع الصارم: ${securityPolicy.strictAutoPayments ? 'نعم' : 'لا'}، إيقاف طارئ: ${securityPolicy.autoPaymentsPanicStop ? 'مفعّل' : 'لا'}، فلترة البريد: ${securityPolicy.enforceEmailWhitelist ? 'مفعّلة' : 'لا'})`
  );
  res.json({ ok: true, policy: securityPolicy });
});

app.post('/api/admin/security/users/:userId/action', requireAdmin, (req, res) => {
  const adminUser: AuthRecord = (req as any).authUser;
  const target = Array.from(authUsers.values()).find((u) => u.id === String(req.params.userId));
  if (!target) return res.status(404).json({ error: 'المستخدم غير موجود.' });
  if (target.role === 'ADMIN' || target.isProtectedAdmin || target.email === OWNER_ADMIN_EMAIL) {
    return res.status(403).json({ error: 'حساب المدير العام محمي أمنياً ولا يمكن تقييده.' });
  }

  const action = String(req.body?.action || '').toUpperCase();
  if (action === 'UNBAN_RESET') {
    target.fraudScore = 0;
    target.strikesCount = 0;
    target.isSuspended = false;
    target.restrictedUntil = null;
    target.restrictionReason = null;
    appendStaffAuditLog(adminUser, 'STAFF_UPDATE', `فك التقييد وتصفير نقاط المخاطر لـ ${target.nameAr}`);
  } else if (action === 'RESTRICT_24H') {
    target.restrictedUntil = Date.now() + 24 * 3600_000;
    target.restrictionReason = String(req.body?.reason || 'تقييد إداري لمدة 24 ساعة').slice(0, 180);
    appendStaffAuditLog(adminUser, 'STAFF_UPDATE', `تقييد 24 ساعة للحساب ${target.nameAr}`);
  } else if (action === 'PERMA_BAN') {
    target.isSuspended = true;
    target.restrictionReason = String(req.body?.reason || 'حظر دائم بسبب محاولات احتيال').slice(0, 180);
    appendStaffAuditLog(adminUser, 'STAFF_UPDATE', `حظر دائم للحساب ${target.nameAr}`);
  } else {
    return res.status(400).json({ error: 'إجراء أمني غير صالح.' });
  }

  res.json({ ok: true, user: sanitizeUser(target) });
});

// ============================================================================
// 8. SYRIA TODAY (SP-TODAY) LIVE CURRENCY RATES API
// ============================================================================

let lastSyriaTodaySync: {
  source: string;
  lastUpdatedAt: number | null;
  error: string | null;
} = {
  source: 'DEFAULT_CONFIG',
  lastUpdatedAt: null,
  error: null,
};

async function fetchSyriaTodayLiveRates() {
  const apiKey = serverConfig.syriaTodayApiKey.trim();
  let fetchedSyp: number | null = null;
  let fetchedTry: number | null = null;
  let fetchedRubToUsd: number | null = null;
  let sourceLabel = 'CACHED_RATE';
  let errorMsg: string | null = null;

  // 1) Official SP-Today v2 API (/api/v1/currencies)
  if (apiKey) {
    const candidateEndpoints = [
      `https://api-v2.sp-today.com/api/v1/currencies?key=${encodeURIComponent(apiKey)}`,
      `https://api-v2.sp-today.com/v1/currencies?api_key=${encodeURIComponent(apiKey)}`,
    ];

    for (const url of candidateEndpoints) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 6000);
      try {
        const resp = await fetch(url, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'X-API-Key': apiKey,
          },
          signal: controller.signal,
        });
        clearTimeout(t);
        if (!resp.ok) continue;
        const json: any = await resp.json();

        // SP-Today v2 schema: { ok: true, data: { cities: [...], currencies: [{ code: "USD", cities: { damascus: { buy, sell } } }] } }
        const list = Array.isArray(json?.data?.currencies)
          ? json.data.currencies
          : Array.isArray(json?.currencies)
          ? json.currencies
          : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json)
          ? json
          : [];

        if (list.length > 0) {
          const usdItem = list.find(
            (i: any) =>
              String(i?.code || i?.symbol || i?.name || '').toUpperCase() === 'USD'
          );
          const tryItem = list.find(
            (i: any) =>
              String(i?.code || i?.symbol || i?.name || '').toUpperCase() === 'TRY'
          );
          const usdDamascus = usdItem?.cities?.damascus || usdItem?.cities?.aleppo || usdItem;
          const tryDamascus = tryItem?.cities?.damascus || tryItem?.cities?.aleppo || tryItem;

          const askUsd = Number(
            usdDamascus?.sell || usdDamascus?.ask || usdDamascus?.buy || usdDamascus?.rate || usdDamascus?.price
          );
          if (Number.isFinite(askUsd) && askUsd > 500) {
            fetchedSyp = Math.round(askUsd);
            sourceLabel = 'SYRIA_TODAY_LIVE_API';
          }
          const askTry = Number(
            tryDamascus?.sell || tryDamascus?.ask || tryDamascus?.buy || tryDamascus?.rate
          );
          if (fetchedSyp && Number.isFinite(askTry) && askTry > 10) {
            fetchedTry = Number((fetchedSyp / askTry).toFixed(2));
          }
          if (fetchedSyp) break;
        }
      } catch {
        clearTimeout(t);
      }
    }
  }

  // 2) Live global USD -> TRY & RUB reference via Open Exchange Rate API
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const fxResp = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller.signal,
    });
    clearTimeout(t);
    if (fxResp.ok) {
      const fxJson: any = await fxResp.json();
      const tryRate = Number(fxJson?.rates?.TRY);
      if (!fetchedTry && Number.isFinite(tryRate) && tryRate > 5) {
        fetchedTry = Number(tryRate.toFixed(2));
      }
      const rubPerUsd = Number(fxJson?.rates?.RUB);
      if (Number.isFinite(rubPerUsd) && rubPerUsd > 10) {
        fetchedRubToUsd = Number((1 / rubPerUsd).toFixed(6));
      }
      const sypRate = Number(fxJson?.rates?.SYP);
      if (!fetchedSyp && Number.isFinite(sypRate) && sypRate > 1000) {
        fetchedSyp = Math.round(sypRate);
        sourceLabel = apiKey ? 'SYRIA_TODAY_FALLBACK_OPEN_FX' : 'OPEN_FX_LIVE';
      }
    }
  } catch {
    if (!fetchedSyp) {
      errorMsg = 'تعذر الوصول لمزود الأسعار اللحظي، تم الإبقاء على آخر سعر محفوظ.';
    }
  }

  if (fetchedSyp) {
    serverConfig.usdToSypRate = fetchedSyp;
    pricesCache.clear();
    esimLiveCache.clear();
  }
  if (fetchedTry) {
    serverConfig.usdToTryRate = fetchedTry;
  }
  if (fetchedRubToUsd) {
    serverConfig.rubToUsdRate = fetchedRubToUsd;
    pricesCache.clear();
  }

  lastSyriaTodaySync = {
    source: sourceLabel,
    lastUpdatedAt: Date.now(),
    error: errorMsg,
  };

  return {
    hasKey: Boolean(apiKey),
    maskedKey: maskKey(apiKey),
    source: lastSyriaTodaySync.source,
    usdToSypRate: serverConfig.usdToSypRate,
    usdToTryRate: serverConfig.usdToTryRate,
    lastUpdatedAt: lastSyriaTodaySync.lastUpdatedAt,
    error: lastSyriaTodaySync.error,
  };
}

app.get('/api/rates/syria-today', async (_req, res) => {
  const result = await fetchSyriaTodayLiveRates();
  res.json(result);
});

// ============================================================================
// 9. OFFICIAL GRIZZLYSMS EDUCATIONAL GUIDES & LEGAL DISCLAIMER
// ============================================================================

const OFFICIAL_GRIZZLY_GUIDES = [
  {
    id: 'guide-sms-activation',
    category: 'sms',
    titleAr: 'دليل تفعيل الأرقام الافتراضية (SMS OTP)',
    summaryAr:
      'الخطوات الرسمية المعتمدة لاستلام كود التفعيل بنجاح وتفادي حظر المنصات.',
    stepsAr: [
      'اختر الدولة المناسبة والخدمة المطلوبة (واتساب، تيليجرام، جوجل، إلخ) ثم اختر الفئة السعرية المناسبة.',
      'انسخ الرقم المخصص فور ظهوره في نافذة التفعيل وأدخله في التطبيق المستهدف مع رمز الدولة الصحيح.',
      'يصل الكود عادة خلال ثوانٍ، ويُوصى بالانتظار ما بين 7 إلى 10 دقائق (بحد أقصى 20 دقيقة هي مدة صلاحية الرقم).',
      'في حال عدم وصول الكود خلال الدقائق الأولى، اضغط «إلغاء واسترداد» لإرجاع الرصيد لمحفظتك فوراً وتجربة رقم آخر.',
      'يُفضل استخدام VPN مطابق لدولة الرقم المشتَرى عند التسجيل في التطبيقات الحساسة (مثل واتساب أو جوجل) لرفع نسبة الاستلام.',
      'إذا كنت بحاجة لرسالة تحقق ثانية على نفس الرقم خلال نافذة الـ 20 دقيقة، استخدم زر «طلب رسالة أخرى» وسيتم حفظ جميع الأكواد المستلمة دون حذف الكود السابق.',
    ],
    warningAr:
      'تنبيه هام: الأرقام الافتراضية مخصصة لإنشاء وتفعيل حسابات جديدة فقط. نظراً لقيود بعض التطبيقات، لا يمكن ضمان وصول الكود بنسبة 100% من المحاولة الأولى، وفي حال الإلغاء قبل وصول الكود لا يتم خصم أي مبلغ.',
  },
  {
    id: 'guide-esim-setup',
    category: 'esim',
    titleAr: 'دليل تثبيت وتفعيل شرائح الإنترنت (eSIM)',
    summaryAr:
      'إرشادات تشغيل باقات البيانات الدولية (Data-Only eSIM) على أجهزة iOS وAndroid.',
    stepsAr: [
      'تأكد قبل الشراء أن هاتفك غير مقفل على شبكة معينة (Unlocked) ويدعم تقنية eSIM عبر فاحص التوافق.',
      'بعد الشراء، امسح رمز الـ QR الظاهر في نافذة التفعيل، أو انسخ عنوان SM-DP+ وكود التفعيل لإدخالهما يدوياً من إعدادات الشبكة الخلوية.',
      'على أجهزة iPhone: الإعدادات ← خلوي (Cellular) ← إضافة eSIM ← استخدام رمز QR أو إدخال التفاصيل يدوياً.',
      'على أجهزة Android: الإعدادات ← الاتصالات ← مدير بطاقة SIM ← إضافة eSIM ← مسح رمز QR.',
      'عند الوصول للوجهة، تأكد من تفعيل خيار «تجوال البيانات (Data Roaming)» لخط الـ eSIM وإعادة تشغيل الهاتف إذا لم يتصل بالإنترنت خلال دقيقتين.',
    ],
    warningAr:
      'شرائح eSIM مخصصة لبيانات الإنترنت فقط (Data-Only 5G/LTE) ولا تدعم المكالمات الصوتية التقليدية أو رسائل SMS الشبكية، ولكن يمكنك استخدام تطبيقات الاتصال عبر الإنترنت (واتساب، تيليجرام) بحرية.',
  },
  {
    id: 'guide-legal-disclaimer',
    category: 'disclaimer',
    titleAr: 'سياسة الاستخدام وإخلاء المسؤولية القانونية',
    summaryAr:
      'إخلاء مسؤولية شفاف متوافق مع سياسة الخدمة المعتمدة في منصة AliSMS لتفعيل الأرقام وشرائح eSIM.',
    stepsAr: [
      'الأرقام المؤقتة صالحة لفترة التفعيل المحددة (20 دقيقة) ولا يمكن إعادة استئجار نفس الرقم لاحقاً بعد انتهاء الجلسة؛ لذا تجنب ربطها بحسابات بنكية أو أصول مالية حرجة دون تفعيل التحقق بخطوتين عبر بريدك.',
      'منصة AliSMS وسيط تقني مؤتمت لتوفير أرقام التحقق وباقات eSIM، وتخلي مسؤوليتها الكاملة عن أي استخدام غير قانوني أو مخالف لشروط التطبيقات والمنصات الخارجية.',
      'عند استلام كود الـ SMS بنجاح تُعتبر الخدمة مُنفّذة ومكتملة ولا يمكن استرداد قيمة الرقم بعدها.',
      'في حال عدم استلام أي رسالة خلال صلاحية الرقم أو عند الإلغاء المبكر، يتم إعادة كامل تكلفة الرقم إلى محفظتك داخل المنصة تلقائياً.',
      'شرائح eSIM لا يمكن استردادها بعد إصدار ملف الـ LPA / QR Code وتفعيله على الجهاز.',
    ],
    warningAr:
      'باستخدامك للمنصة وشراء أي رقم أو شريحة eSIM فإنك تقرّ بقراءة والموافقة على شروط الاستخدام وإخلاء المسؤولية المذكورة أعلاه.',
  },
];

app.get('/api/grizzly/guides', (_req, res) => {
  res.json({
    source: 'دليل AliSMS الرسمي',
    grizzlyConnected: Boolean(serverConfig.grizzlyApiKey.trim()),
    guides: OFFICIAL_GRIZZLY_GUIDES,
  });
});

// ============================================================================
// 10. AUTOMATED HIGH-SECURITY PAYMENTS (Binance Pay Exact-Amount Invoice & On-Chain TRC20/BEP20)
// ============================================================================

type AutomatedInvoiceGateway = 'binance' | 'usdt_trc20' | 'usdt_bep20';

interface ServerPaymentInvoice {
  id: string;
  userId: string;
  userNameAr: string;
  gateway: AutomatedInvoiceGateway;
  gatewayLabelAr: string;
  requestedAmountUsd: number;
  exactAmountUsd: number;
  currency: 'USDT';
  recipientAddress: string;
  recipientLabelAr: string;
  networkLabel: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  referenceId?: string;
  createdAt: number;
  expiresAt: number;
  paidAt?: number;
  verificationMode?: string;
}

const INVOICE_TTL_MS = 20 * 60 * 1000; // 20 minutes
const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const USDT_BEP20_CONTRACT = '0x55d398326f99059ff775485246999027b3197955';
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const BSC_RPC_ENDPOINTS = [
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.defibit.io/',
];

let paymentInvoices: ServerPaymentInvoice[] = readJsonFileSafe<ServerPaymentInvoice[]>(
  PAYMENT_INVOICES_PATH,
  []
);
const verifyingInvoiceIds = new Set<string>();

function persistPaymentInvoices() {
  writeJsonFileSafe(PAYMENT_INVOICES_PATH, paymentInvoices.slice(0, 500));
}

function cleanupExpiredInvoices() {
  const now = Date.now();
  let changed = false;
  for (const inv of paymentInvoices) {
    if (inv.status === 'PENDING' && now > inv.expiresAt) {
      inv.status = 'EXPIRED';
      changed = true;
    }
  }
  if (changed) persistPaymentInvoices();
}

function allocateUniqueExactAmount(
  gateway: AutomatedInvoiceGateway,
  baseAmountUsd: number
): number {
  cleanupExpiredInvoices();
  const baseRounded = Number(baseAmountUsd.toFixed(2));
  const activeAmounts = new Set(
    paymentInvoices
      .filter((inv) => inv.gateway === gateway && inv.status === 'PENDING')
      .map((inv) => inv.exactAmountUsd.toFixed(2))
  );

  // Pick a unique random cent offset (.01 to .99) added to the base amount
  // so no two active invoices collide and the customer receives the full exact amount credited
  const startOffset = crypto.randomInt(1, 100);
  for (let i = 0; i < 99; i++) {
    const cents = ((startOffset + i - 1) % 99) + 1;
    const candidate = Number((baseRounded + cents / 100).toFixed(2));
    if (!activeAmounts.has(candidate.toFixed(2))) {
      return candidate;
    }
  }
  // Extremely rare fallback (>99 concurrent pending invoices for same gateway): add 1.xx
  return Number((baseRounded + 1 + crypto.randomInt(1, 99) / 100).toFixed(2));
}

function getInvoiceRecipientMeta(gateway: AutomatedInvoiceGateway): {
  address: string;
  labelAr: string;
  gatewayLabelAr: string;
  networkLabel: string;
} {
  if (gateway === 'binance') {
    return {
      address: serverConfig.binancePayId,
      labelAr: 'معرّف Binance Pay ID',
      gatewayLabelAr: 'باينانس باي (Binance Pay)',
      networkLabel: 'Binance Pay (صفر عمولة)',
    };
  }
  if (gateway === 'usdt_trc20') {
    return {
      address: serverConfig.binanceUsdtTrc20,
      labelAr: 'عنوان محفظة USDT (TRC20)',
      gatewayLabelAr: 'USDT (TRC20 — شبكة ترون)',
      networkLabel: 'TRON (TRC20)',
    };
  }
  return {
    address: serverConfig.binanceUsdtBep20,
    labelAr: 'عنوان محفظة USDT (BEP20)',
    gatewayLabelAr: 'USDT (BEP20 — شبكة بينانس)',
    networkLabel: 'BNB Smart Chain (BEP20)',
  };
}

function getInvoiceOwnerKey(req: express.Request, authUser: AuthRecord | null): string {
  if (authUser?.id) return authUser.id;
  return `guest:${req.ip || 'unknown'}`;
}

interface IncomingShamCashTransfer {
  id: string;
  transactionId: string;
  normalizedTxId: string;
  amount: number;
  currency: 'USD' | 'SYP' | 'TRY';
  equivalentUsd: number;
  rawText: string;
  sourceApp: string;
  status: 'UNCLAIMED' | 'CLAIMED';
  matchedTopUpId?: string;
  claimedByUserId?: string;
  receivedAt: number;
  claimedAt?: number;
}

const SHAMCASH_TRANSFERS_PATH = path.join(DATA_DIR, 'shamcash-transfers.json');
const paymentVerifyRateMap = new Map<string, { count: number; resetAt: number }>();
const verifiedIncomingShamCashPool = new Map<string, IncomingShamCashTransfer>(
  Object.entries(
    readJsonFileSafe<Record<string, IncomingShamCashTransfer>>(SHAMCASH_TRANSFERS_PATH, {})
  )
);

function persistShamCashTransfers() {
  writeJsonFileSafe(
    SHAMCASH_TRANSFERS_PATH,
    Object.fromEntries(verifiedIncomingShamCashPool.entries())
  );
}

function normalizeArabicDigits(input: string): string {
  const ar = '٠١٢٣٤٥٦٧٨٩';
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  let out = '';
  for (const ch of input) {
    const idxAr = ar.indexOf(ch);
    if (idxAr !== -1) {
      out += String(idxAr);
      continue;
    }
    const idxFa = fa.indexOf(ch);
    if (idxFa !== -1) {
      out += String(idxFa);
      continue;
    }
    if (ch === '٫') out += '.';
    else if (ch === '٬') out += ',';
    else out += ch;
  }
  return out;
}

function parseShamCashAmountValue(rawNum: string): number | null {
  const cleaned = rawNum.trim().replace(/\s+/g, '');
  if (!cleaned) return null;
  let normalized = cleaned;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    normalized = cleaned.replace(/,/g, '');
  } else if (/^\d+,\d{1,2}$/.test(cleaned)) {
    normalized = cleaned.replace(',', '.');
  } else {
    normalized = cleaned.replace(/,/g, '');
  }
  const val = Number(normalized);
  if (!Number.isFinite(val) || val <= 0 || val > 100_000_000) return null;
  return val;
}

function detectShamCashCurrency(raw: string): 'USD' | 'SYP' | 'TRY' {
  if (/SYP|ل\.?\s*س|ليرة\s*سوري|ليره\s*سوري|سوري/i.test(raw)) return 'SYP';
  if (/TRY|TL|₺|ل\.?\s*ت|ليرة\s*تركي|ليره\s*تركي|تركي/i.test(raw)) return 'TRY';
  return 'USD';
}

function parseShamCashNotificationPayload(body: Record<string, any>):
  | {
      ok: true;
      transactionId: string;
      normalizedTxId: string;
      amount: number;
      currency: 'USD' | 'SYP' | 'TRY';
      rawText: string;
      sourceApp: string;
    }
  | { ok: false; code: string; error: string } {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const rawInput =
    typeof body.raw_text === 'string'
      ? body.raw_text.trim()
      : typeof body.text === 'string'
      ? body.text.trim()
      : '';
  const sourceApp =
    typeof body.app_name === 'string' && body.app_name.trim()
      ? body.app_name.trim().slice(0, 120)
      : 'MacroDroid';
  const combinedRaw = [title, rawInput].filter(Boolean).join(' | ').slice(0, 2000);
  const normText = normalizeArabicDigits(combinedRaw);

  let txId =
    typeof body.transaction_id === 'string'
      ? normalizeArabicDigits(body.transaction_id).trim()
      : typeof body.reference_id === 'string'
      ? normalizeArabicDigits(body.reference_id).trim()
      : typeof body.referenceId === 'string'
      ? normalizeArabicDigits(body.referenceId).trim()
      : '';

  let amount: number | null = null;
  if (typeof body.amount === 'number' && Number.isFinite(body.amount) && body.amount > 0) {
    amount = body.amount;
  } else if (typeof body.amount === 'string' && body.amount.trim()) {
    amount = parseShamCashAmountValue(normalizeArabicDigits(body.amount));
  }

  let currency: 'USD' | 'SYP' | 'TRY' =
    typeof body.currency === 'string' && body.currency.trim()
      ? detectShamCashCurrency(body.currency)
      : detectShamCashCurrency(normText);

  if (
    !txId &&
    amount === null &&
    normText &&
    /(تم\s+إرسال\s+حوالة|تم\s+ارسال\s+حوالة|قمت\s+بتحويل|رمز\s+التحقق|كود\s+التحقق|OTP\s+code|you\s+sent\s+)/i.test(
      normText
    )
  ) {
    return {
      ok: false,
      code: 'IGNORED_NON_CREDIT_NOTIFICATION',
      error: 'إشعار صادر أو رمز تحقق غير متعلق باستلام حوالة.',
    };
  }

  if (!txId && normText) {
    const labeledTxPatterns: RegExp[] = [
      /(?:رقم\s*(?:العملية|الحوالة|التحويل|المرجع|الاشعار|الإشعار|المعاملة)|المرجع|العملية)\s*[:：#\-]?\s*([A-Z0-9][A-Z0-9_-]{3,40})/i,
      /(?:transaction\s*(?:id|no|number|#)?|tx\s*(?:id|#)?|ref(?:erence)?\s*(?:id|no|#)?|order\s*(?:id|#)?)\s*[:：#\-]?\s*([A-Z0-9][A-Z0-9_-]{3,40})/i,
      /#([A-Z0-9][A-Z0-9_-]{4,40})/i,
    ];
    for (const pattern of labeledTxPatterns) {
      const m = normText.match(pattern);
      if (m?.[1]) {
        txId = m[1].trim();
        break;
      }
    }
  }

  if (amount === null && normText) {
    const amountPatterns: RegExp[] = [
      /(\d[\d,]*(?:\.\d{1,4})?)\s*(USD|USDT|\$|دولار|د\.?\s*أ|SYP|ل\.?\s*س|ليرة\s*سوري(?:ة)?|ليره\s*سوري(?:ة)?|TRY|TL|₺|ل\.?\s*ت|ليرة\s*تركي(?:ة)?)/i,
      /(USD|USDT|\$|SYP|TRY|TL|₺)\s*(\d[\d,]*(?:\.\d{1,4})?)/i,
      /(?:بمبلغ|بقيمة|مبلغ|قيمة|amount|received|استلام|تحويل)\s*[:：]?\s*(\d[\d,]*(?:\.\d{1,4})?)/i,
    ];
    for (const pattern of amountPatterns) {
      const m = normText.match(pattern);
      if (!m) continue;
      const numCandidate = /^\d/.test(m[1]) ? m[1] : m[2];
      const currCandidate = /^\d/.test(m[1]) ? m[2] : m[1];
      const parsed = numCandidate ? parseShamCashAmountValue(numCandidate) : null;
      if (parsed !== null) {
        amount = parsed;
        if (currCandidate) currency = detectShamCashCurrency(currCandidate);
        break;
      }
    }
  }

  if (!txId && normText) {
    const amountDigits = amount !== null ? String(Math.trunc(amount)) : '';
    const candidates = normText.match(/\b[A-Z]{0,4}\d{6,20}\b/gi) || [];
    for (const c of candidates) {
      const clean = c.trim();
      if (clean !== amountDigits && !/^09\d{8}$/.test(clean) && !/^9639\d{8}$/.test(clean)) {
        txId = clean;
        break;
      }
    }
  }

  const normalizedTxId = txId.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!normalizedTxId || normalizedTxId.length < 4 || normalizedTxId.length > 64) {
    return {
      ok: false,
      code: 'MISSING_TRANSACTION_ID',
      error: 'تعذر استخراج رقم العملية (transaction_id) من نص الإشعار.',
    };
  }
  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      code: 'MISSING_AMOUNT',
      error: 'تعذر استخراج قيمة المبلغ (amount) من نص الإشعار.',
    };
  }

  return {
    ok: true,
    transactionId: txId.trim(),
    normalizedTxId,
    amount,
    currency,
    rawText: combinedRaw,
    sourceApp,
  };
}

function checkPaymentRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = paymentVerifyRateMap.get(key);
  if (!entry || now > entry.resetAt) {
    paymentVerifyRateMap.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 8) return false;
  entry.count += 1;
  return true;
}

async function verifyBinancePayExactTransaction(
  orderRef: string,
  exactAmountUsd: number,
  minTimestampMs: number
): Promise<{
  verified: boolean;
  mode: 'LIVE_BINANCE_API' | 'NO_API_KEYS';
  confirmedAmountUsd?: number;
  matchedRef?: string;
  reason?: string;
}> {
  const apiKey = process.env.BINANCE_API_KEY?.trim();
  const apiSecret = process.env.BINANCE_API_SECRET?.trim();
  if (!apiKey || !apiSecret) {
    return {
      verified: false,
      mode: 'NO_API_KEYS',
      reason: 'مفاتيح Binance API غير مضبوطة في إعدادات الخادم (Secrets) حالياً.',
    };
  }

  try {
    const baseUrl = String(process.env.BINANCE_API_BASE_URL || 'https://api.binance.com')
      .trim()
      .replace(/\/+$/, '');
    const timestamp = Date.now();
    const query = `timestamp=${timestamp}&limit=50`;
    const signature = crypto.createHmac('sha256', apiSecret).update(query).digest('hex');
    const resp = await fetch(
      `${baseUrl}/sapi/v1/pay/transactions?${query}&signature=${signature}`,
      {
        headers: { 'X-MBX-APIKEY': apiKey },
        signal: AbortSignal.timeout(12000),
      }
    );
    if (resp.status === 451) {
      return {
        verified: false,
        mode: 'LIVE_BINANCE_API',
        reason:
          'خوادم Binance تحظر الطلبات القادمة من خادم أمريكي (HTTP 451). عند استضافة المنصة على خادم أوروبي/تركي أو ضبط BINANCE_API_BASE_URL عبر وسيط غير أمريكي، سيعمل التحقق التلقائي فوراً.',
      };
    }
    if (!resp.ok) {
      return {
        verified: false,
        mode: 'LIVE_BINANCE_API',
        reason: `تعذر الاستعلام من Binance API (رمز ${resp.status}). تأكد من تفعيل صلاحية القراءة فقط (Enable Reading).`,
      };
    }
    const json: any = await resp.json();
    const list: any[] = Array.isArray(json?.data) ? json.data : [];
    const targetRefUpper = orderRef.trim().toUpperCase();

    const matchedByRef = list.find((tx) => {
      const oid = String(tx?.orderId || '').trim().toUpperCase();
      const tid = String(tx?.transactionId || '').trim().toUpperCase();
      return (oid && oid === targetRefUpper) || (tid && tid === targetRefUpper);
    });

    if (!matchedByRef) {
      return {
        verified: false,
        mode: 'LIVE_BINANCE_API',
        reason: 'لم يتم العثور على حوالة واردة في Binance Pay بهذا الرمز. تأكد من إتمام التحويل وانتظر بضع ثوانٍ ثم أعد المحاولة.',
      };
    }

    const currency = String(matchedByRef?.currency || '').toUpperCase();
    if (!['USDT', 'USDC', 'USD', 'BUSD'].includes(currency)) {
      return {
        verified: false,
        mode: 'LIVE_BINANCE_API',
        reason: `العملة المستلمة (${currency}) غير مدعومة، يرجى التحويل بعملة USDT فقط.`,
      };
    }

    const actualAmount = Number(matchedByRef?.amount || 0);
    if (!Number.isFinite(actualAmount) || actualAmount <= 0) {
      return {
        verified: false,
        mode: 'LIVE_BINANCE_API',
        reason: 'هذه العملية ليست حوالة واردة صالحة لحسابنا في Binance Pay.',
      };
    }

    const txTime = Number(matchedByRef?.transactionTime || 0);
    if (txTime > 0 && txTime < minTimestampMs) {
      return {
        verified: false,
        mode: 'LIVE_BINANCE_API',
        reason: 'توقيت هذه الحوالة أقدم من وقت إنشاء الإشعار المؤقت. لا يمكن استخدام حوالات قديمة.',
      };
    }

    if (Math.abs(actualAmount - exactAmountUsd) > 0.005) {
      return {
        verified: false,
        mode: 'LIVE_BINANCE_API',
        reason: `المبلغ المحوّل (${actualAmount.toFixed(2)} ${currency}) لا يطابق المبلغ الدقيق المطلوب في الإشعار (${exactAmountUsd.toFixed(2)} USDT). يرجى التواصل مع الدعم الفني.`,
      };
    }

    return {
      verified: true,
      mode: 'LIVE_BINANCE_API',
      confirmedAmountUsd: Number(actualAmount.toFixed(2)),
      matchedRef: String(matchedByRef.orderId || matchedByRef.transactionId || orderRef).trim(),
    };
  } catch {
    return {
      verified: false,
      mode: 'LIVE_BINANCE_API',
      reason: 'تعذر الاتصال بخوادم Binance API حالياً. أعد المحاولة بعد لحظات.',
    };
  }
}

async function verifyTronTrc20OnChain(
  walletAddress: string,
  exactAmountUsd: number,
  minTimestampMs: number,
  txHash?: string
): Promise<{
  verified: boolean;
  mode: 'LIVE_TRONGRID_TRC20';
  confirmedAmountUsd?: number;
  matchedRef?: string;
  reason?: string;
}> {
  const cleanWallet = walletAddress.trim();
  if (!/^T[a-zA-Z0-9]{33}$/.test(cleanWallet)) {
    return {
      verified: false,
      mode: 'LIVE_TRONGRID_TRC20',
      reason: 'عنوان محفظة USDT-TRC20 المضبوط على المنصة غير صالح.',
    };
  }

  const cleanHash = txHash ? txHash.trim() : '';
  if (cleanHash && !/^[a-fA-F0-9]{64}$/.test(cleanHash)) {
    return {
      verified: false,
      mode: 'LIVE_TRONGRID_TRC20',
      reason: 'صيغة TxHash لشبكة TRC20 غير صحيحة (يجب أن تكون 64 محرفاً سداسياً بدون 0x).',
    };
  }

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const tronKey = process.env.TRONGRID_API_KEY?.trim();
    if (tronKey) headers['TRON-PRO-API-KEY'] = tronKey;

    const url = `https://api.trongrid.io/v1/accounts/${encodeURIComponent(
      cleanWallet
    )}/transactions/trc20?only_confirmed=true&only_to=true&limit=30&contract_address=${USDT_TRC20_CONTRACT}`;

    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
    if (!resp.ok) {
      return {
        verified: false,
        mode: 'LIVE_TRONGRID_TRC20',
        reason: `تعذر الاستعلام من شبكة TRON (رمز ${resp.status}). حاول مجدداً بعد ثوانٍ.`,
      };
    }

    const json: any = await resp.json();
    const list: any[] = Array.isArray(json?.data) ? json.data : [];

    for (const tx of list) {
      const txId = String(tx?.transaction_id || '').trim();
      const contractAddr = String(tx?.token_info?.address || '').trim();
      const toAddr = String(tx?.to || '').trim();
      const blockTs = Number(tx?.block_timestamp || 0);
      const decimals = Number(tx?.token_info?.decimals ?? 6);
      const rawVal = Number(tx?.value || 0);
      const actualUsdt = rawVal / Math.pow(10, decimals);

      if (contractAddr !== USDT_TRC20_CONTRACT || toAddr !== cleanWallet) continue;

      if (cleanHash) {
        if (txId.toLowerCase() !== cleanHash.toLowerCase()) continue;
        if (blockTs > 0 && blockTs < minTimestampMs) {
          return {
            verified: false,
            mode: 'LIVE_TRONGRID_TRC20',
            reason: 'معاملة البلوكشين هذه قديمة (قبل إنشاء الإشعار المؤقت).',
          };
        }
        if (Math.abs(actualUsdt - exactAmountUsd) > 0.005) {
          return {
            verified: false,
            mode: 'LIVE_TRONGRID_TRC20',
            reason: `المبلغ الواصل فعلياً (${actualUsdt.toFixed(2)} USDT) لا يطابق المبلغ الدقيق المطلوب (${exactAmountUsd.toFixed(2)} USDT).`,
          };
        }
        return {
          verified: true,
          mode: 'LIVE_TRONGRID_TRC20',
          confirmedAmountUsd: Number(actualUsdt.toFixed(2)),
          matchedRef: txId,
        };
      } else {
        // Auto-scan by unique exact decimal amount + fresh timestamp + unused TxHash
        const normTx = normalizePaymentRef(txId);
        if (
          txId &&
          !usedPaymentReferences.has(txId) &&
          !usedReferenceRegistry.has(normTx) &&
          blockTs >= minTimestampMs &&
          Math.abs(actualUsdt - exactAmountUsd) <= 0.005
        ) {
          return {
            verified: true,
            mode: 'LIVE_TRONGRID_TRC20',
            confirmedAmountUsd: Number(actualUsdt.toFixed(2)),
            matchedRef: txId,
          };
        }
      }
    }

    return {
      verified: false,
      mode: 'LIVE_TRONGRID_TRC20',
      reason: cleanHash
        ? 'لم يتم تأكيد هذه المعاملة على شبكة TRON بعد أو أنها لا تطابق عنوان محفظتنا. انتظر دقيقة بعد التحويل وأعد المحاولة.'
        : `لم تصل بعد حوالة مؤكدة بمبلغ ${exactAmountUsd.toFixed(2)} USDT إلى محفظة TRC20. تأكد من وصول صافي المبلغ بدقة أو الصق رمز المعاملة (TxHash).`,
    };
  } catch {
    return {
      verified: false,
      mode: 'LIVE_TRONGRID_TRC20',
      reason: 'تعذر الاتصال بعقدة شبكة TRON حالياً. أعد المحاولة بعد لحظات.',
    };
  }
}

async function callBscJsonRpc(method: string, params: unknown[]): Promise<any> {
  let lastErr: unknown = null;
  for (const rpcUrl of BSC_RPC_ENDPOINTS) {
    try {
      const resp = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) continue;
      const json: any = await resp.json();
      if (json && !json.error) return json.result;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('BSC_RPC_FAILED');
}

async function verifyBscBep20OnChain(
  walletAddress: string,
  exactAmountUsd: number,
  minTimestampMs: number,
  txHash: string
): Promise<{
  verified: boolean;
  mode: 'LIVE_BSC_BEP20_RPC';
  confirmedAmountUsd?: number;
  matchedRef?: string;
  reason?: string;
}> {
  const cleanWallet = walletAddress.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(cleanWallet)) {
    return {
      verified: false,
      mode: 'LIVE_BSC_BEP20_RPC',
      reason: 'عنوان محفظة USDT-BEP20 المضبوط على المنصة غير صالح.',
    };
  }

  const cleanHash = txHash.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(cleanHash)) {
    return {
      verified: false,
      mode: 'LIVE_BSC_BEP20_RPC',
      reason: 'يرجى إدخال رمز المعاملة (TxHash) الصحيح لشبكة BEP20 (يبدأ بـ 0x وطوله 66 محرفاً).',
    };
  }

  try {
    const receipt = await callBscJsonRpc('eth_getTransactionReceipt', [cleanHash]);
    if (!receipt) {
      return {
        verified: false,
        mode: 'LIVE_BSC_BEP20_RPC',
        reason: 'لم يتم العثور على المعاملة على شبكة BNB Smart Chain بعد. انتظر تأكيد البلوك ثم أعد المحاولة.',
      };
    }

    if (String(receipt.status || '').toLowerCase() !== '0x1') {
      return {
        verified: false,
        mode: 'LIVE_BSC_BEP20_RPC',
        reason: 'هذه المعاملة فاشلة (Failed) على شبكة BNB Smart Chain ولا يمكن اعتمادها.',
      };
    }

    const expectedToTopic = `0x${cleanWallet.replace(/^0x/, '').padStart(64, '0')}`;
    const logs: any[] = Array.isArray(receipt.logs) ? receipt.logs : [];
    const transferLog = logs.find((log) => {
      const contract = String(log?.address || '').toLowerCase();
      const topics: string[] = Array.isArray(log?.topics) ? log.topics : [];
      return (
        contract === USDT_BEP20_CONTRACT &&
        topics.length >= 3 &&
        String(topics[0]).toLowerCase() === ERC20_TRANSFER_TOPIC &&
        String(topics[2]).toLowerCase() === expectedToTopic
      );
    });

    if (!transferLog) {
      return {
        verified: false,
        mode: 'LIVE_BSC_BEP20_RPC',
        reason: 'المعاملة لا تحتوي على تحويل USDT (BEP20) وارد إلى عنوان محفظتنا الرسمي.',
      };
    }

    // Verify block timestamp freshness
    if (receipt.blockNumber) {
      const block = await callBscJsonRpc('eth_getBlockByNumber', [receipt.blockNumber, false]);
      if (block?.timestamp) {
        const blockTsMs = parseInt(String(block.timestamp), 16) * 1000;
        if (blockTsMs < minTimestampMs) {
          return {
            verified: false,
            mode: 'LIVE_BSC_BEP20_RPC',
            reason: 'توقيت هذه المعاملة أقدم من وقت إنشاء الإشعار المؤقت. لا يمكن استخدام معاملات قديمة.',
          };
        }
      }
    }

    const rawWei = BigInt(String(transferLog.data || '0x0'));
    // BSC USDT has 18 decimals; scale safely via BigInt -> 6 decimals precision
    const microUsdt = Number(rawWei / BigInt(10 ** 12));
    const actualUsdt = microUsdt / 1_000_000;

    if (Math.abs(actualUsdt - exactAmountUsd) > 0.005) {
      return {
        verified: false,
        mode: 'LIVE_BSC_BEP20_RPC',
        reason: `المبلغ الواصل على الشبكة (${actualUsdt.toFixed(2)} USDT) لا يطابق المبلغ الدقيق المطلوب (${exactAmountUsd.toFixed(2)} USDT).`,
      };
    }

    return {
      verified: true,
      mode: 'LIVE_BSC_BEP20_RPC',
      confirmedAmountUsd: Number(actualUsdt.toFixed(2)),
      matchedRef: cleanHash,
    };
  } catch {
    return {
      verified: false,
      mode: 'LIVE_BSC_BEP20_RPC',
      reason: 'تعذر الاتصال بعقدة شبكة BNB Smart Chain حالياً. أعد المحاولة بعد لحظات.',
    };
  }
}

// GET /api/payments/invoice/active — Return user's current active temporary invoice (if any)
app.get('/api/payments/invoice/active', (req, res) => {
  cleanupExpiredInvoices();
  const authUser = getAuthUserFromRequest(req);
  const ownerKey = getInvoiceOwnerKey(req, authUser);
  const gatewayFilter = String(req.query.gateway || '').trim();

  const active = paymentInvoices.find(
    (inv) =>
      inv.userId === ownerKey &&
      inv.status === 'PENDING' &&
      (!gatewayFilter || inv.gateway === gatewayFilter)
  );

  res.json({
    invoice: active || null,
    hasBinanceApiKeys: Boolean(
      process.env.BINANCE_API_KEY?.trim() && process.env.BINANCE_API_SECRET?.trim()
    ),
  });
});

// POST /api/payments/invoice/create — Generate a 20-minute unique exact-amount temporary invoice
app.post('/api/payments/invoice/create', (req, res) => {
  cleanupExpiredInvoices();
  const clientIp = req.ip || 'unknown';
  const authUser = getAuthUserFromRequest(req);

  if (authUser) {
    const restriction = checkUserRestriction(authUser);
    if (restriction.blocked) {
      return res.status(403).json({ error: restriction.error, code: 'ACCOUNT_RESTRICTED' });
    }
  }

  if (securityPolicy.autoPaymentsPanicStop) {
    return res.status(503).json({
      code: 'PANIC_STOP',
      error: 'الشحن التلقائي متوقف مؤقتاً من قِبل الإدارة للصيانة والأمان.',
    });
  }

  if (!checkPaymentRateLimit(`inv_create_${clientIp}`)) {
    return res.status(429).json({
      error: 'تجاوزت الحد المسموح لإنشاء الإشعارات المؤقتة. يرجى الانتظار دقيقة واحدة.',
    });
  }

  const gateway = String(req.body?.gateway || '').trim() as AutomatedInvoiceGateway;
  if (!['binance', 'usdt_trc20', 'usdt_bep20'].includes(gateway)) {
    return res.status(400).json({
      error: 'هذه البوابة لا تدعم الإشعار المؤقت التلقائي. استخدم التحويل اليدوي مع رفع الإشعار.',
    });
  }

  const baseAmountUsd = Number(req.body?.amountUsd);
  if (!Number.isFinite(baseAmountUsd) || baseAmountUsd < 1 || baseAmountUsd > 10000) {
    return res.status(400).json({
      error: 'يرجى إدخال مبلغ شحن صحيح بين 1 و 10,000 USDT.',
    });
  }

  const ownerKey = getInvoiceOwnerKey(req, authUser);
  // Cancel any older pending invoice for same user & gateway so they always have one clean active invoice
  for (const inv of paymentInvoices) {
    if (inv.userId === ownerKey && inv.gateway === gateway && inv.status === 'PENDING') {
      inv.status = 'CANCELLED';
    }
  }

  const exactAmountUsd = allocateUniqueExactAmount(gateway, baseAmountUsd);
  const recipient = getInvoiceRecipientMeta(gateway);
  const now = Date.now();

  const invoice: ServerPaymentInvoice = {
    id: `INV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    userId: ownerKey,
    userNameAr: authUser?.nameAr || 'عميل المنصة',
    gateway,
    gatewayLabelAr: recipient.gatewayLabelAr,
    requestedAmountUsd: Number(baseAmountUsd.toFixed(2)),
    exactAmountUsd,
    currency: 'USDT',
    recipientAddress: recipient.address,
    recipientLabelAr: recipient.labelAr,
    networkLabel: recipient.networkLabel,
    status: 'PENDING',
    createdAt: now,
    expiresAt: now + INVOICE_TTL_MS,
  };

  paymentInvoices.unshift(invoice);
  persistPaymentInvoices();

  res.status(201).json({
    invoice,
    hasBinanceApiKeys: Boolean(
      process.env.BINANCE_API_KEY?.trim() && process.env.BINANCE_API_SECRET?.trim()
    ),
  });
});

// POST /api/payments/invoice/:id/cancel — Cancel a user's pending temporary invoice
app.post('/api/payments/invoice/:id/cancel', (req, res) => {
  cleanupExpiredInvoices();
  const authUser = getAuthUserFromRequest(req);
  const ownerKey = getInvoiceOwnerKey(req, authUser);
  const invoice = paymentInvoices.find((inv) => inv.id === req.params.id);

  if (!invoice) {
    return res.status(404).json({ error: 'الإشعار المؤقت غير موجود.' });
  }
  if (invoice.userId !== ownerKey && authUser?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'غير مصرح لك بإلغاء هذا الإشعار.' });
  }
  if (invoice.status === 'PENDING') {
    invoice.status = 'CANCELLED';
    persistPaymentInvoices();
  }
  res.json({ ok: true, invoice });
});

// POST /api/payments/invoice/:id/verify — Live verification against Binance API / TRON TRC20 / BSC BEP20
app.post('/api/payments/invoice/:id/verify', async (req, res) => {
  cleanupExpiredInvoices();
  const clientIp = req.ip || 'unknown';
  const authUser = getAuthUserFromRequest(req);
  const ownerKey = getInvoiceOwnerKey(req, authUser);

  if (authUser) {
    const restriction = checkUserRestriction(authUser);
    if (restriction.blocked) {
      return res.status(403).json({ error: restriction.error, code: 'ACCOUNT_RESTRICTED' });
    }
  }

  if (securityPolicy.autoPaymentsPanicStop) {
    return res.status(503).json({
      code: 'PANIC_STOP',
      error: 'الشحن التلقائي متوقف مؤقتاً بوضع الأمان.',
    });
  }

  if (!checkPaymentRateLimit(`inv_verify_${clientIp}`)) {
    return res.status(429).json({
      error: 'تجاوزت الحد المسموح من محاولات التحقق في الدقيقة. يرجى الانتظار قليلاً.',
    });
  }

  const invoice = paymentInvoices.find((inv) => inv.id === req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: 'الإشعار المؤقت غير موجود.' });
  }
  if (invoice.userId !== ownerKey && authUser?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'لا تملك صلاحية التحقق من هذا الإشعار.' });
  }
  if (invoice.status === 'PAID') {
    return res.status(409).json({ error: 'تم شحن هذا الإشعار المؤقت مسبقاً بالفعل.' });
  }
  if (invoice.status === 'EXPIRED' || Date.now() > invoice.expiresAt) {
    invoice.status = 'EXPIRED';
    persistPaymentInvoices();
    return res.status(410).json({
      code: 'INVOICE_EXPIRED',
      error: 'انتهت مهلة الإشعار المؤقت (20 دقيقة). يرجى إنشاء إشعار جديد.',
    });
  }
  if (invoice.status !== 'PENDING') {
    return res.status(400).json({ error: 'هذا الإشعار لم يعد نشطاً.' });
  }

  if (verifyingInvoiceIds.has(invoice.id)) {
    return res.status(429).json({ error: 'جاري التحقق من هذا الإشعار بالفعل، يرجى الانتظار لحظة...' });
  }

  const rawRef = String(req.body?.referenceId || req.body?.txHash || '').trim();
  if (invoice.gateway === 'binance' && rawRef.length < 6) {
    return res.status(400).json({
      error: 'يرجى لصق رقم العملية (Order ID / Transaction ID) من تطبيق Binance Pay بشكل صحيح.',
    });
  }
  if (invoice.gateway === 'usdt_bep20' && !/^0x[a-fA-F0-9]{64}$/.test(rawRef)) {
    return res.status(400).json({
      error: 'يرجى لصق رمز المعاملة (TxHash) الصحيح لشبكة BEP20 (يبدأ بـ 0x وطوله 66 محرفاً).',
    });
  }
  if (invoice.gateway === 'usdt_trc20' && rawRef && !/^[a-fA-F0-9]{64}$/.test(rawRef)) {
    return res.status(400).json({
      error: 'صيغة TxHash لشبكة TRC20 غير صحيحة (64 محرفاً سداسياً بدون 0x، أو اتركه فارغاً للفحص التلقائي).',
    });
  }

  // Pre-check duplicate reference before calling upstream APIs
  if (rawRef) {
    const normPre = normalizePaymentRef(rawRef);
    if (usedPaymentReferences.has(rawRef) || usedReferenceRegistry.has(normPre)) {
      recordFraudStrike({
        user: authUser,
        ipAddress: clientIp,
        eventType: 'DUPLICATE_REF_ATTEMPT',
        points: 35,
        details: `محاولة تكرار رمز عملية #${rawRef} على الإشعار ${invoice.id} (${invoice.gateway})`,
      });
      return res.status(409).json({
        code: 'DUPLICATE_REFERENCE_ID',
        error: 'رمز العملية / TxHash هذا تم استخدامه وشحنه مسبقاً! تم تسجيل المحاولة في سجل الأمان.',
      });
    }
  }

  verifyingInvoiceIds.add(invoice.id);
  try {
    // Allow 3-minute clock skew window before invoice creation
    const minTimestampMs = invoice.createdAt - 180_000;
    let checkResult: {
      verified: boolean;
      mode: string;
      confirmedAmountUsd?: number;
      matchedRef?: string;
      reason?: string;
    };

    if (invoice.gateway === 'binance') {
      checkResult = await verifyBinancePayExactTransaction(
        rawRef,
        invoice.exactAmountUsd,
        minTimestampMs
      );
      if (checkResult.mode === 'NO_API_KEYS') {
        return res.status(503).json({
          code: 'BINANCE_KEYS_NOT_CONFIGURED',
          error:
            'مفاتيح Binance API غير مفعّلة في خادم المنصة بعد. يرجى من المدير العام إضافتها في إعدادات البيئة (Secrets) أو مراجعة الطلب يدوياً.',
        });
      }
    } else if (invoice.gateway === 'usdt_trc20') {
      checkResult = await verifyTronTrc20OnChain(
        invoice.recipientAddress,
        invoice.exactAmountUsd,
        minTimestampMs,
        rawRef || undefined
      );
    } else {
      checkResult = await verifyBscBep20OnChain(
        invoice.recipientAddress,
        invoice.exactAmountUsd,
        minTimestampMs,
        rawRef
      );
    }

    if (!checkResult.verified || !checkResult.confirmedAmountUsd) {
      return res.status(400).json({
        error: checkResult.reason || 'لم يتم التحقق من الحوالة بعد، يرجى التأكد والمحاولة مرة أخرى.',
      });
    }

    const finalRef = String(checkResult.matchedRef || rawRef || invoice.id).trim();
    const finalNormRef = normalizePaymentRef(finalRef);
    if (usedPaymentReferences.has(finalRef) || usedReferenceRegistry.has(finalNormRef)) {
      return res.status(409).json({
        code: 'DUPLICATE_REFERENCE_ID',
        error: 'هذه الحوالة تم اعتمادها وشحنها مسبقاً بالفعل.',
      });
    }

    // Atomic state update: mark invoice PAID, lock reference, credit exact verified amount
    const creditedUsd = Number(checkResult.confirmedAmountUsd.toFixed(2));
    const creditedSyp = Math.round(creditedUsd * serverConfig.usdToSypRate);

    invoice.status = 'PAID';
    invoice.paidAt = Date.now();
    invoice.referenceId = finalRef;
    invoice.verificationMode = checkResult.mode;
    persistPaymentInvoices();

    usedPaymentReferences.add(finalRef);
    usedReferenceRegistry.set(finalNormRef, {
      userId: authUser?.id || ownerKey,
      userNameAr: authUser?.nameAr || 'عميل المنصة',
      gatewayId: invoice.gateway,
      status: 'VERIFIED',
      createdAt: Date.now(),
    });
    persistUsedReferences();

    userWalletUsd = Number((userWalletUsd + creditedUsd).toFixed(2));
    if (authUser) {
      authUser.balanceUsd = Number((authUser.balanceUsd + creditedUsd).toFixed(2));
    }

    const gatewayLabelAr =
      invoice.gateway === 'binance'
        ? `Binance Pay (ID: ${invoice.recipientAddress})`
        : invoice.gateway === 'usdt_trc20'
        ? 'USDT (TRC20 — تحقق بلوكشين)'
        : 'USDT (BEP20 — تحقق بلوكشين)';

    const tx = {
      id: `PAY-${Date.now().toString().slice(-5)}`,
      gateway: invoice.gateway,
      gatewayLabelAr,
      referenceId: finalRef,
      amountOriginal: creditedUsd,
      currencyOriginal: 'USDT',
      creditedUsd,
      creditedSyp,
      status: 'VERIFIED',
      verificationMode: checkResult.mode,
      createdAt: Date.now(),
      note: `شحن فوري مؤكد عبر الإشعار المؤقت ${invoice.id} (${checkResult.mode})`,
    };

    paymentHistory.unshift(tx);

    const newBalanceUsd = authUser ? authUser.balanceUsd : userWalletUsd;
    res.json({
      ok: true,
      invoice,
      transaction: tx,
      walletUsd: newBalanceUsd,
      walletSyp: Math.round(newBalanceUsd * serverConfig.usdToSypRate),
      message: `تم التحقق بنجاح وإضافة $${creditedUsd.toFixed(2)} إلى رصيد محفظتك فوراً!`,
    });
  } finally {
    verifyingInvoiceIds.delete(invoice.id);
  }
});

// Authenticated MacroDroid Webhook for ShamCash automated notification relay (x-webhook-secret)
app.post('/api/webhooks/shamcash', (req, res) => {
  const secret = process.env.SHAMCASH_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return res.status(503).json({ ok: false, error: 'SHAMCASH_WEBHOOK_SECRET غير مضبوط على الخادم.' });
  }

  const headerSecret = String(req.headers['x-webhook-secret'] || '').trim();
  const expectedBuf = Buffer.from(secret);
  const providedBuf = Buffer.from(headerSecret);
  if (
    !headerSecret ||
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return res.status(401).json({ ok: false, error: 'هيدر x-webhook-secret غير صالح.' });
  }

  const parsed = parseShamCashNotificationPayload((req.body || {}) as Record<string, any>);
  if (!parsed.ok) {
    const status = parsed.code === 'IGNORED_NON_CREDIT_NOTIFICATION' ? 202 : 422;
    return res.status(status).json({ ok: false, code: parsed.code, error: parsed.error });
  }

  // Strict UNIQUE duplicate guard on normalized transaction ID
  if (verifiedIncomingShamCashPool.has(parsed.normalizedTxId)) {
    return res.status(409).json({
      ok: false,
      outcome: 'DUPLICATE',
      transaction_id: parsed.normalizedTxId,
      error: 'رقم العملية مسجل مسبقاً ولا يمكن تكراره.',
    });
  }

  let equivalentUsd = parsed.amount;
  if (parsed.currency === 'SYP') {
    equivalentUsd = Number((parsed.amount / (serverConfig.usdToSypRate || 15175)).toFixed(4));
  } else if (parsed.currency === 'TRY') {
    equivalentUsd = Number((parsed.amount / (serverConfig.usdToTryRate || 50.5)).toFixed(4));
  } else {
    equivalentUsd = Number(parsed.amount.toFixed(4));
  }

  const entry: IncomingShamCashTransfer = {
    id: `sc-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    transactionId: parsed.transactionId,
    normalizedTxId: parsed.normalizedTxId,
    amount: parsed.amount,
    currency: parsed.currency,
    equivalentUsd,
    rawText: parsed.rawText,
    sourceApp: parsed.sourceApp,
    status: 'UNCLAIMED',
    receivedAt: Date.now(),
  };

  // Match against any PENDING ShamCash top-up request immediately
  const pendingReq = serverTopUpRequests.find(
    (t) =>
      t.status === 'PENDING' &&
      normalizePaymentRef(t.referenceId) === parsed.normalizedTxId &&
      (/sham|شام/i.test(t.gatewayId) || /sham|شام/i.test(t.gatewayNameAr))
  );

  if (pendingReq) {
    const sameCurrencyMatch =
      pendingReq.currencyOriginal === parsed.currency &&
      Math.abs(pendingReq.amountOriginal - parsed.amount) <= Math.max(0.01, parsed.amount * 0.01);
    const usdTolerance = Math.max(0.05, equivalentUsd * 0.02);
    if (sameCurrencyMatch || Math.abs(pendingReq.equivalentUsd - equivalentUsd) <= usdTolerance) {
      entry.status = 'CLAIMED';
      entry.matchedTopUpId = pendingReq.id;
      entry.claimedByUserId = pendingReq.userId;
      entry.claimedAt = Date.now();

      verifiedIncomingShamCashPool.set(parsed.normalizedTxId, entry);
      persistShamCashTransfers();

      const creditUsd = Number(equivalentUsd.toFixed(2));
      pendingReq.status = 'APPROVED';
      pendingReq.equivalentUsd = creditUsd;
      pendingReq.equivalentSyp = Math.round(creditUsd * serverConfig.usdToSypRate);
      pendingReq.processedAt = Date.now();
      pendingReq.reviewedBy = 'ShamCash Webhook Auto-Match';

      userWalletUsd = Number((userWalletUsd + creditUsd).toFixed(2));
      const owner = Array.from(authUsers.values()).find((u) => u.id === pendingReq.userId);
      if (owner) {
        owner.balanceUsd = Number((owner.balanceUsd + creditUsd).toFixed(2));
      }

      usedReferenceRegistry.set(parsed.normalizedTxId, {
        userId: pendingReq.userId,
        userNameAr: pendingReq.userNameAr,
        gatewayId: pendingReq.gatewayId,
        status: 'APPROVED',
        createdAt: pendingReq.createdAt,
      });
      usedPaymentReferences.add(pendingReq.referenceId);
      persistUsedReferences();

      return res.json({
        ok: true,
        outcome: 'MATCHED_AND_CREDITED',
        transaction_id: parsed.normalizedTxId,
        amount: parsed.amount,
        currency: parsed.currency,
        equivalent_usd: creditUsd,
        topup_id: pendingReq.id,
        user_id: pendingReq.userId,
      });
    }
  }

  verifiedIncomingShamCashPool.set(parsed.normalizedTxId, entry);
  persistShamCashTransfers();

  return res.json({
    ok: true,
    outcome: 'SAVED_UNCLAIMED',
    transaction_id: parsed.normalizedTxId,
    amount: parsed.amount,
    currency: parsed.currency,
    equivalent_usd: Number(equivalentUsd.toFixed(2)),
  });
});

// Legacy direct verify endpoint (ShamCash & Syriatel strictly routed to Manual Review)
app.post('/api/payments/verify', async (req, res) => {
  const clientIp = req.ip || 'unknown';
  const authUser = getAuthUserFromRequest(req);
  if (authUser) {
    const restriction = checkUserRestriction(authUser);
    if (restriction.blocked) {
      return res.status(403).json({ error: restriction.error, code: 'ACCOUNT_RESTRICTED' });
    }
  }

  const { gateway, referenceId, amount, currency } = req.body;

  // ShamCash & Syriatel Cash are strictly manual review methods
  if (gateway === 'shamcash' || gateway === 'syriatel') {
    return res.status(422).json({
      code: 'MANUAL_REVIEW_REQUIRED',
      error: 'هذه الطريقة تعمل بنظام المراجعة اليدوية الآمنة للإشعارات.',
    });
  }

  if (securityPolicy.autoPaymentsPanicStop) {
    return res.status(422).json({
      code: 'MANUAL_REVIEW_REQUIRED',
      error: 'الشحن التلقائي متوقف مؤقتاً بوضع الأمان (Panic Stop). تم تحويل الطلب للمراجعة اليدوية.',
    });
  }

  if (!checkPaymentRateLimit(clientIp)) {
    return res.status(429).json({
      error: 'تجاوزت الحد المسموح من محاولات التحقق. يرجى الانتظار قليلاً.',
    });
  }

  const cleanRef = String(referenceId || '').trim();
  const numAmount = Number(amount);

  if (!cleanRef || cleanRef.length < 6) {
    return res.status(400).json({
      error: 'يرجى إدخال رقم عملية التحويل / Order ID بشكل صحيح (6 محارف على الأقل).',
    });
  }

  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({
      error: 'يرجى إدخال المبلغ المحول بشكل صحيح.',
    });
  }

  const normRef = normalizePaymentRef(cleanRef);
  if (usedPaymentReferences.has(cleanRef) || usedReferenceRegistry.has(normRef)) {
    recordFraudStrike({
      user: authUser,
      ipAddress: clientIp,
      eventType: 'DUPLICATE_REF_ATTEMPT',
      points: 35,
      details: `محاولة تكرار رقم عملية دفع تلقائي #${cleanRef} (${gateway})`,
    });
    return res.status(409).json({
      code: 'DUPLICATE_REFERENCE_ID',
      error: 'رقم عملية التحويل هذا تم استخدامه وشحنه مسبقاً (عبر هذا الحساب أو حساب آخر)! تم تسجيل المحاولة في سجل الأمان.',
    });
  }

  let creditedUsd = 0;
  let creditedSyp = 0;
  if (currency === 'SYP') {
    creditedSyp = Math.round(numAmount);
    creditedUsd = Number((numAmount / serverConfig.usdToSypRate).toFixed(2));
  } else if (currency === 'TRY') {
    creditedUsd = Number((numAmount / (serverConfig.usdToTryRate || 34.5)).toFixed(2));
    creditedSyp = Math.round(creditedUsd * serverConfig.usdToSypRate);
  } else {
    creditedUsd = Number(numAmount.toFixed(2));
    creditedSyp = Math.round(creditedUsd * serverConfig.usdToSypRate);
  }

  if (creditedUsd < 0.5) {
    return res.status(400).json({
      error: 'الحد الأدنى للشحن التلقائي يعادل 0.50 دولار أمريكي.',
    });
  }

  if (gateway === 'binance') {
    const binanceCheck = await verifyBinancePayExactTransaction(
      cleanRef,
      creditedUsd,
      Date.now() - 24 * 3600_000
    );
    if (binanceCheck.mode === 'LIVE_BINANCE_API') {
      if (!binanceCheck.verified) {
        return res.status(400).json({ error: binanceCheck.reason });
      }
      if (binanceCheck.confirmedAmountUsd) {
        creditedUsd = binanceCheck.confirmedAmountUsd;
        creditedSyp = Math.round(creditedUsd * serverConfig.usdToSypRate);
      }
    } else {
      return res.status(422).json({
        code: 'MANUAL_REVIEW_REQUIRED',
        error: 'وضع الحماية الصارم مفعّل: سيتم إرسال طلبك للمراجعة الفورية من الإدارة للتحقق الآمن.',
      });
    }
  } else {
    return res.status(422).json({
      code: 'MANUAL_REVIEW_REQUIRED',
      error: 'يرجى استخدام نظام الإشعار المؤقت للشحن الآلي أو رفع الإشعار للمراجعة اليدوية.',
    });
  }

  usedPaymentReferences.add(cleanRef);
  usedReferenceRegistry.set(normRef, {
    userId: authUser?.id || 'guest',
    userNameAr: authUser?.nameAr || 'عميل المنصة',
    gatewayId: String(gateway),
    status: 'VERIFIED',
    createdAt: Date.now(),
  });
  persistUsedReferences();
  userWalletUsd = Number((userWalletUsd + creditedUsd).toFixed(2));

  if (authUser) {
    authUser.balanceUsd = Number((authUser.balanceUsd + creditedUsd).toFixed(2));
  }

  const tx = {
    id: `PAY-${Date.now().toString().slice(-5)}`,
    gateway,
    gatewayLabelAr: `Binance Pay (ID: ${serverConfig.binancePayId})`,
    referenceId: cleanRef,
    amountOriginal: numAmount,
    currencyOriginal: currency || 'USD',
    creditedUsd,
    creditedSyp,
    status: 'VERIFIED',
    verificationMode: 'LIVE_BINANCE_API_VERIFIED',
    createdAt: Date.now(),
    note: `تم التحقق المباشر عبر Binance API للعملية #${cleanRef}`,
  };

  paymentHistory.unshift(tx);
  persistOrdersAndPayments();

  res.json({
    transaction: tx,
    walletUsd: authUser ? authUser.balanceUsd : userWalletUsd,
    walletSyp: Math.round((authUser ? authUser.balanceUsd : userWalletUsd) * serverConfig.usdToSypRate),
    verificationMode: 'LIVE_BINANCE_API_VERIFIED',
  });
});

// ============================================================================
// SERVER-SIDE SUPABASE STATUS & SYNC ENDPOINTS (Never exposes keys to browser)
// ============================================================================
app.get('/api/supabase/status', async (_req, res) => {
  const state = await checkSupabaseHealth();
  res.json(state);
});

app.post('/api/supabase/sync', requireAdmin, async (req, res) => {
  const cfg = getSupabaseServerConfig();
  if (!cfg) {
    return res.status(503).json({
      ok: false,
      syncedTables: 0,
      message: 'متغيرات SUPABASE_URL و SUPABASE_ANON_KEY غير مضبوطة على الخادم.',
    });
  }

  const health = await checkSupabaseHealth();
  if (!health.tablesReady) {
    return res.status(412).json({
      ok: false,
      syncedTables: 0,
      tablesReady: false,
      message: health.message,
    });
  }

  const headers = buildSupabaseHeaders(cfg.key, {
    Prefer: 'resolution=merge-duplicates,return=minimal',
  });

  const body = req.body || {};
  let syncedTables = 0;

  try {
    // 1. app_settings
    const rSettings = await fetch(`${cfg.url}/rest/v1/app_settings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: 'global_config',
        platform_name: String(body.cmsConfig?.platformName || 'alisim'),
        sms_markup_percent: serverConfig.smsMarkupPercent,
        esim_markup_percent: serverConfig.esimMarkupPercent,
        usd_to_syp_rate: serverConfig.usdToSypRate,
        usd_to_try_rate: serverConfig.usdToTryRate,
        usd_to_usdt_rate: 1,
        rub_to_usd_rate: serverConfig.rubToUsdRate,
        cms_payload: body.cmsConfig || {},
      }),
    });
    if (rSettings.ok || rSettings.status === 201 || rSettings.status === 204) syncedTables++;

    // 2. user_wallets (merge real server authUsers)
    const usersList = Array.from(authUsers.values()).map((u) => ({
      user_id: u.id,
      user_name_ar: u.nameAr,
      email_or_phone: u.email,
      balance_usd: u.balanceUsd,
      total_spent_usd: u.totalSpentUsd,
      orders_count: u.ordersCount,
      role: u.role,
      vip_discount_percent: u.resellerDiscountPercent || 0,
    }));
    if (usersList.length > 0) {
      const rUsers = await fetch(`${cfg.url}/rest/v1/user_wallets`, {
        method: 'POST',
        headers,
        body: JSON.stringify(usersList),
      });
      if (rUsers.ok) syncedTables++;
    }

    // 3. pricing_overrides
    if (Array.isArray(body.pricingOverrides) && body.pricingOverrides.length > 0) {
      const ovrPayload = body.pricingOverrides.map((o: any) => ({
        id: o.id,
        target_type: o.targetType,
        target_code: o.targetCode,
        target_name_ar: o.targetNameAr,
        custom_markup_percent: o.customMarkupPercent,
        fixed_price_usd: o.fixedPriceUsd,
        is_hidden: Boolean(o.isHidden),
      }));
      const rOvr = await fetch(`${cfg.url}/rest/v1/pricing_overrides`, {
        method: 'POST',
        headers,
        body: JSON.stringify(ovrPayload),
      });
      if (rOvr.ok) syncedTables++;
    }

    // 4. payment_gateways
    if (Array.isArray(body.paymentGateways) && body.paymentGateways.length > 0) {
      const gwPayload = body.paymentGateways.map((g: any) => ({
        id: g.id,
        code: g.code,
        name_ar: g.nameAr,
        account_address: g.accountAddress,
        account_holder: g.accountHolder || '',
        qr_code_text: g.qrCodeText || g.accountAddress,
        min_topup_amount: Number(g.minTopUpAmount) || 1,
        currency: g.currency || 'USD',
        is_enabled: Boolean(g.isEnabled),
        instructions_ar: g.instructionsAr || '',
      }));
      const rGw = await fetch(`${cfg.url}/rest/v1/payment_gateways`, {
        method: 'POST',
        headers,
        body: JSON.stringify(gwPayload),
      });
      if (rGw.ok) syncedTables++;
    }

    // 5. topup_requests (from server real queue)
    const serverTopups = serverTopUpRequests.map((r) => ({
      id: r.id,
      user_id: r.userId,
      user_name_ar: r.userNameAr,
      gateway_id: r.gatewayId,
      gateway_name_ar: r.gatewayNameAr,
      reference_id: r.referenceId,
      amount_original: r.amountOriginal,
      currency_original: r.currencyOriginal,
      equivalent_usd: r.equivalentUsd,
      equivalent_syp: r.equivalentSyp,
      status: r.status,
      rejection_reason: r.rejectionReason || null,
    }));
    if (serverTopups.length > 0) {
      const rTop = await fetch(`${cfg.url}/rest/v1/topup_requests`, {
        method: 'POST',
        headers,
        body: JSON.stringify(serverTopups),
      });
      if (rTop.ok) syncedTables++;
    }

    // 6. sms_activations_history
    if (activeSmsOrders.length > 0) {
      const smsPayload = activeSmsOrders.slice(0, 100).map((s) => ({
        id: s.id,
        activation_id: s.activationId || s.id,
        service_code: s.serviceCode,
        service_name_ar: s.serviceNameAr,
        country_id: String(s.countryId),
        country_name_ar: s.countryNameAr,
        iso2: s.iso2 || 'un',
        phone_number: s.phoneNumber,
        base_cost_usd: Number(s.baseCostUsd || 0),
        price_usd: Number(s.priceUsd || 0),
        price_syp: Number(s.priceSyp || 0),
        status: s.status || 'WAITING_SMS',
        sms_code: s.smsCode || null,
        full_sms_text: s.fullSmsText || null,
        expires_at: new Date(s.expiresAt || Date.now() + 1200_000).toISOString(),
      }));
      const rSms = await fetch(`${cfg.url}/rest/v1/sms_activations_history`, {
        method: 'POST',
        headers,
        body: JSON.stringify(smsPayload),
      });
      if (rSms.ok) syncedTables++;
    }

    supabaseHealthState.lastSyncedAt = Date.now();
    res.json({
      ok: true,
      syncedTables,
      tablesReady: true,
      message: `تمت المزامنة السحابية الآمنة عبر الخادم بنجاح (${syncedTables} جداول محدثة في Supabase).`,
    });
  } catch (err: unknown) {
    res.status(502).json({
      ok: false,
      syncedTables,
      message: `تعذر إكمال المزامنة مع Supabase: ${err instanceof Error ? err.message : 'خطأ شبكة'}`,
    });
  }
});

app.post('/api/admin/settings', requireAdmin, async (req, res) => {
  const {
    smsMarkupPercent,
    esimMarkupPercent,
    usdToSypRate,
    usdToTryRate,
    rubToUsdRate,
    syriatelMerchantCode,
    syriatelMerchantName,
    shamcashWalletAddress,
    shamcashAccountHolder,
    binancePayId,
    binanceUsdtTrc20,
    binanceUsdtBep20,
    lowProviderBalanceThresholdUsd,
  } = req.body;

  if (typeof smsMarkupPercent === 'number' && smsMarkupPercent >= 0) {
    serverConfig.smsMarkupPercent = smsMarkupPercent;
    pricesCache.clear();
  }
  if (typeof esimMarkupPercent === 'number' && esimMarkupPercent >= 0) {
    serverConfig.esimMarkupPercent = esimMarkupPercent;
    esimLiveCache.clear();
  }
  if (typeof usdToSypRate === 'number' && usdToSypRate > 0) {
    serverConfig.usdToSypRate = usdToSypRate;
    pricesCache.clear();
    esimLiveCache.clear();
  }
  if (typeof usdToTryRate === 'number' && usdToTryRate > 0) {
    serverConfig.usdToTryRate = usdToTryRate;
  }
  if (typeof rubToUsdRate === 'number' && rubToUsdRate > 0) {
    serverConfig.rubToUsdRate = rubToUsdRate;
    pricesCache.clear();
  }
  if (typeof syriatelMerchantCode === 'string') {
    serverConfig.syriatelMerchantCode = syriatelMerchantCode.trim();
  }
  if (typeof syriatelMerchantName === 'string') {
    serverConfig.syriatelMerchantName = syriatelMerchantName.trim();
  }
  if (typeof shamcashWalletAddress === 'string') {
    serverConfig.shamcashWalletAddress = shamcashWalletAddress.trim();
  }
  if (typeof shamcashAccountHolder === 'string') {
    serverConfig.shamcashAccountHolder = shamcashAccountHolder.trim();
  }
  if (typeof binancePayId === 'string' && binancePayId.trim()) {
    serverConfig.binancePayId = binancePayId.trim();
  }
  if (typeof binanceUsdtTrc20 === 'string' && binanceUsdtTrc20.trim()) {
    serverConfig.binanceUsdtTrc20 = binanceUsdtTrc20.trim();
  }
  if (typeof binanceUsdtBep20 === 'string' && binanceUsdtBep20.trim()) {
    serverConfig.binanceUsdtBep20 = binanceUsdtBep20.trim();
  }
  if (
    typeof lowProviderBalanceThresholdUsd === 'number' &&
    Number.isFinite(lowProviderBalanceThresholdUsd) &&
    lowProviderBalanceThresholdUsd >= 0 &&
    lowProviderBalanceThresholdUsd <= 100000
  ) {
    serverConfig.lowProviderBalanceThresholdUsd = Number(lowProviderBalanceThresholdUsd.toFixed(2));
  }

  appendStaffAuditLog(
    (req as any).authUser,
    'SETTINGS_UPDATE',
    `تحديث إعدادات المنصة (هامش SMS ${serverConfig.smsMarkupPercent}%، حد تنبيه المزود $${serverConfig.lowProviderBalanceThresholdUsd})`
  );

  const syncStatus = await syncProviderBalance();
  const balanceUsd =
    syncStatus.balanceRub !== null
      ? Number((syncStatus.balanceRub * serverConfig.rubToUsdRate).toFixed(2))
      : null;

  res.json({
    settings: {
      hasApiKey: Boolean(serverConfig.grizzlyApiKey.trim()),
      maskedApiKey: maskKey(serverConfig.grizzlyApiKey.trim()),
      hasSyriaTodayKey: Boolean(serverConfig.syriaTodayApiKey.trim()),
      maskedSyriaTodayKey: maskKey(serverConfig.syriaTodayApiKey.trim()),
      hasBinanceApiKeys: Boolean(
        process.env.BINANCE_API_KEY?.trim() && process.env.BINANCE_API_SECRET?.trim()
      ),
      hasSupabaseConfig: supabaseHealthState.configured,
      supabaseTablesReady: supabaseHealthState.tablesReady,
      supabaseStatusMessage: supabaseHealthState.message,
      isLiveMode: syncStatus.isLive,
      apiStatusError: syncStatus.error || null,
      providerBalanceRub: syncStatus.balanceRub,
      providerBalanceUsd: balanceUsd,
      staticCryptoWalletTrx: cachedStaticWalletTrx,
      lastSyncAt: Date.now(),
      smsMarkupPercent: serverConfig.smsMarkupPercent,
      esimMarkupPercent: serverConfig.esimMarkupPercent,
      usdToSypRate: serverConfig.usdToSypRate,
      usdToTryRate: serverConfig.usdToTryRate,
      rubToUsdRate: serverConfig.rubToUsdRate,
      syriatelMerchantCode: serverConfig.syriatelMerchantCode,
      syriatelMerchantName: serverConfig.syriatelMerchantName,
      shamcashWalletAddress: serverConfig.shamcashWalletAddress,
      shamcashAccountHolder: serverConfig.shamcashAccountHolder,
      binancePayId: serverConfig.binancePayId,
      binanceUsdtTrc20: serverConfig.binanceUsdtTrc20,
      binanceUsdtBep20: serverConfig.binanceUsdtBep20,
      autoVerifyPayments: serverConfig.autoVerifyPayments,
      lowProviderBalanceThresholdUsd: serverConfig.lowProviderBalanceThresholdUsd,
      isProviderBalanceLow:
        balanceUsd !== null && balanceUsd < serverConfig.lowProviderBalanceThresholdUsd,
    },
  });
});

// ============================================================================
// 11. REAL-TIME INTERNAL SUPPORT CHAT (REST + WebSockets, Voice/Emoji/Image)
// ============================================================================

interface ServerChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: 'ADMIN' | 'MODERATOR' | 'RESELLER' | 'USER';
  senderAvatarUrl?: string;
  type: 'text' | 'image' | 'audio';
  text?: string;
  mediaDataUrl?: string;
  audioDurationSec?: number;
  createdAt: number;
}

interface ServerConversation {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
  status: 'OPEN' | 'RESOLVED';
  unreadForAdmin: number;
  unreadForUser: number;
  updatedAt: number;
  messages: ServerChatMessage[];
}

const supportConversations = new Map<string, ServerConversation>();
const supportWsClients = new Map<WebSocket, { userId: string; role: 'ADMIN' | 'MODERATOR' | 'RESELLER' | 'USER' }>();

function broadcastSupportEvent(targetUserId: string, event: Record<string, unknown>) {
  const payload = JSON.stringify(event);
  for (const [ws, meta] of supportWsClients.entries()) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (meta.role === 'ADMIN' || meta.role === 'MODERATOR' || meta.userId === targetUserId) {
      ws.send(payload);
    }
  }
}

function getOrCreateUserConversation(user: AuthRecord): ServerConversation {
  const convId = `conv-${user.id}`;
  let conv = supportConversations.get(convId);
  if (!conv) {
    conv = {
      id: convId,
      userId: user.id,
      userName: user.nameAr,
      userEmail: user.email,
      userAvatarUrl: user.avatarUrl,
      status: 'OPEN',
      unreadForAdmin: 0,
      unreadForUser: 0,
      updatedAt: Date.now(),
      messages: [
        {
          id: `msg-welcome-${Date.now()}`,
          conversationId: convId,
          senderId: 'usr-admin-1',
          senderName: 'الإدارة العليا — AliSMS',
          senderRole: 'ADMIN',
          type: 'text',
          text: 'مرحباً بك في الدعم الفني المباشر! يمكنك إرسال استفسارك كنص أو صورة أو رسالة صوتية وسيتم الرد عليك فوراً.',
          createdAt: Date.now(),
        },
      ],
    };
    supportConversations.set(convId, conv);
  }
  return conv;
}

app.get('/api/support/my-conversation', requireAuth, (req, res) => {
  const user: AuthRecord = (req as any).authUser;
  const conv = getOrCreateUserConversation(user);
  conv.unreadForUser = 0;
  res.json({ conversation: conv });
});

app.get('/api/support/admin/conversations', requireStaff, (_req, res) => {
  const list = Array.from(supportConversations.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  res.json({ conversations: list });
});

app.post('/api/support/messages', requireAuth, (req, res) => {
  const user: AuthRecord = (req as any).authUser;
  const isStaff = user.role === 'ADMIN' || user.role === 'MODERATOR';
  const { conversationId, type, text, mediaDataUrl, audioDurationSec, adminDisplayName } = req.body;

  let conv: ServerConversation | undefined;
  if (isStaff && conversationId) {
    conv = supportConversations.get(String(conversationId));
    if (!conv) return res.status(404).json({ error: 'المحادثة غير موجودة.' });
  } else {
    conv = getOrCreateUserConversation(user);
  }

  const msgType = type === 'image' || type === 'audio' ? type : 'text';
  const cleanText = typeof text === 'string' ? text.trim().slice(0, 2000) : '';
  let cleanMedia: string | undefined;

  if (msgType === 'image') {
    const raw = String(mediaDataUrl || '');
    if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(raw) || raw.length > 3_000_000) {
      return res.status(400).json({ error: 'صيغة الصورة غير مدعومة أو حجمها يتجاوز 2 ميغابايت.' });
    }
    cleanMedia = raw;
  } else if (msgType === 'audio') {
    const raw = String(mediaDataUrl || '');
    if (!/^data:audio\/(webm|ogg|mp4|mpeg|wav|aac)(;codecs=[^;]+)?;base64,/.test(raw) || raw.length > 4_000_000) {
      return res.status(400).json({ error: 'صيغة الصوت غير مدعومة أو حجم التسجيل كبير جداً.' });
    }
    cleanMedia = raw;
  } else if (!cleanText) {
    return res.status(400).json({ error: 'يرجى كتابة رسالة قبل الإرسال.' });
  }

  const msg: ServerChatMessage = {
    id: `msg-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    conversationId: conv.id,
    senderId: user.id,
    senderName:
      user.role === 'ADMIN' && typeof adminDisplayName === 'string' && adminDisplayName.trim()
        ? adminDisplayName.trim()
        : user.role === 'MODERATOR'
        ? `${user.nameAr} — مشرف`
        : user.nameAr,
    senderRole: user.role,
    senderAvatarUrl: user.avatarUrl,
    type: msgType,
    text: cleanText || undefined,
    mediaDataUrl: cleanMedia,
    audioDurationSec: typeof audioDurationSec === 'number' ? audioDurationSec : undefined,
    createdAt: Date.now(),
  };

  conv.messages.push(msg);
  conv.updatedAt = Date.now();
  if (isStaff) {
    conv.unreadForUser += 1;
    conv.unreadForAdmin = 0;
  } else {
    conv.unreadForAdmin += 1;
    conv.status = 'OPEN';
  }

  broadcastSupportEvent(conv.userId, {
    type: 'chat:message',
    conversationId: conv.id,
    message: msg,
    conversation: conv,
  });

  res.json({ message: msg, conversation: conv });
});

app.post('/api/support/admin/status', requireStaff, (req, res) => {
  const { conversationId, status } = req.body;
  const conv = supportConversations.get(String(conversationId));
  if (!conv) return res.status(404).json({ error: 'المحادثة غير موجودة.' });
  conv.status = status === 'RESOLVED' ? 'RESOLVED' : 'OPEN';
  conv.unreadForAdmin = 0;
  broadcastSupportEvent(conv.userId, {
    type: 'chat:status',
    conversationId: conv.id,
    status: conv.status,
  });
  res.json({ conversation: conv });
});

app.delete('/api/support/admin/:conversationId', requireAdmin, (req, res) => {
  const id = String(req.params.conversationId);
  const conv = supportConversations.get(id);
  if (conv) {
    supportConversations.delete(id);
    broadcastSupportEvent(conv.userId, { type: 'chat:deleted', conversationId: id });
  }
  res.json({ ok: true });
});

// ============================================================================
// 11B. DYNAMIC CMS AUTO-TRANSLATION ENGINE (Arabic Source -> TR / EN, Cached)
// ============================================================================
const TRANSLATION_CACHE_PATH = path.resolve(process.cwd(), 'data', 'translations-cache.json');
const translationCache = new Map<string, string>();

try {
  if (fs.existsSync(TRANSLATION_CACHE_PATH)) {
    const raw = JSON.parse(fs.readFileSync(TRANSLATION_CACHE_PATH, 'utf8'));
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === 'string') translationCache.set(k, v);
      }
    }
  }
} catch {
  // Ignore malformed cache file
}

let flushTranslationTimer: NodeJS.Timeout | null = null;
function scheduleTranslationCacheFlush() {
  if (flushTranslationTimer) return;
  flushTranslationTimer = setTimeout(() => {
    flushTranslationTimer = null;
    try {
      const dir = path.dirname(TRANSLATION_CACHE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const obj: Record<string, string> = {};
      for (const [k, v] of translationCache.entries()) {
        obj[k] = v;
      }
      fs.writeFileSync(TRANSLATION_CACHE_PATH, JSON.stringify(obj, null, 2), 'utf8');
    } catch {
      // Ignore write error
    }
  }, 1500);
}

async function translateSingleArabicText(text: string, targetLang: 'tr' | 'en'): Promise<string> {
  const clean = text.trim();
  if (!clean) return text;
  // Skip if text has no Arabic characters at all
  if (!/[\u0600-\u06FF]/.test(clean)) return clean;

  const cacheKey = `${targetLang}::${clean}`;
  const hit = translationCache.get(cacheKey);
  if (hit) return hit;

  // Primary: public translate endpoint
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=${encodeURIComponent(
      targetLang
    )}&dt=t&q=${encodeURIComponent(clean)}`;
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (resp.ok) {
      const data: any = await resp.json();
      if (Array.isArray(data?.[0])) {
        const translated = data[0]
          .map((chunk: any) => (Array.isArray(chunk) ? String(chunk[0] || '') : ''))
          .join('')
          .trim();
        if (translated) {
          translationCache.set(cacheKey, translated);
          scheduleTranslationCacheFlush();
          return translated;
        }
      }
    }
  } catch {
    // Fallback below
  }

  // Secondary fallback: MyMemory API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      clean.slice(0, 480)
    )}&langpair=ar|${encodeURIComponent(targetLang)}`;
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (resp.ok) {
      const data: any = await resp.json();
      const translated = String(data?.responseData?.translatedText || '').trim();
      if (translated && translated.toLowerCase() !== clean.toLowerCase()) {
        translationCache.set(cacheKey, translated);
        scheduleTranslationCacheFlush();
        return translated;
      }
    }
  } catch {
    // Ignore network failure
  }

  return clean;
}

app.post('/api/translate', async (req, res) => {
  const targetLang = req.body?.targetLang === 'tr' ? 'tr' : req.body?.targetLang === 'en' ? 'en' : null;
  const texts: unknown = req.body?.texts;
  if (!targetLang || !Array.isArray(texts)) {
    return res.status(400).json({ error: 'Invalid translation request' });
  }

  const uniqueTexts = Array.from(
    new Set(
      texts
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((s) => s.trim())
        .slice(0, 40)
    )
  );

  const translations: Record<string, string> = {};
  await Promise.all(
    uniqueTexts.map(async (src) => {
      translations[src] = await translateSingleArabicText(src, targetLang);
    })
  );

  res.json({ targetLang, translations });
});

// ============================================================================
// 12. HTTP + WEBSOCKET SERVER & VITE MIDDLEWARE
// ============================================================================

async function startServer() {
  const distPath = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/support' });

  wss.on('connection', (ws, req) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token') || '';
      const sess = activeSessions.get(token);
      if (!sess || Date.now() > sess.expiresAt) {
        ws.close(4001, 'Unauthorized');
        return;
      }
      const user = Array.from(authUsers.values()).find((u) => u.id === sess.userId);
      if (!user) {
        ws.close(4001, 'Unauthorized');
        return;
      }
      supportWsClients.set(ws, { userId: user.id, role: user.role });
      ws.on('close', () => {
        supportWsClients.delete(ws);
      });
    } catch {
      ws.close(4000, 'Bad Request');
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`AliSMS Server + Live Support WS running on http://0.0.0.0:${PORT}`);
    // Initialize live external services on boot (non-blocking)
    checkSupabaseHealth().catch(() => {});
    fetchSyriaTodayLiveRates().catch(() => {});
    syncProviderBalance().catch(() => {});
  });
}

startServer();
