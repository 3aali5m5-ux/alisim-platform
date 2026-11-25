import { useEffect, useMemo, useState } from 'react';
import { AppLanguage } from '../types';

const STORAGE_KEY = 'alisms_dynamic_translations_v1';
const HAS_ARABIC_REGEX = /[\u0600-\u06FF]/;

// Instant pre-seeded translations for all built-in Arabic CMS texts & payment gateways
// Any newly created or edited Arabic CMS text from Admin is automatically translated via /api/translate & cached.
const INSTANT_AR_TRANSLATIONS: Record<string, { tr: string; en: string }> = {
  // Default Hero Slides
  'أرقام تفعيل فورية لأكثر من 200 دولة': {
    tr: '200+ Ülke İçin Anında SMS Doğrulama Numaraları',
    en: 'Instant SMS Verification Numbers for 200+ Countries',
  },
  'استلم أكواد OTP مباشرة لتطبيقات واتساب وتيليجرام وجوجل مع حفظ جميع الأكواد المستلمة.': {
    tr: 'WhatsApp, Telegram ve Google için OTP kodlarını anında alın; tüm kodlar güvenle kaydedilir.',
    en: 'Receive OTP codes instantly for WhatsApp, Telegram & Google with full code history saved.',
  },
  'ابدأ التفعيل الآن': {
    tr: 'Hemen Aktive Et',
    en: 'Start Activating Now',
  },
  'شرائح بيانات eSIM عالمية بتقنية 5G': {
    tr: 'Küresel 5G eSIM Veri Paketleri',
    en: 'Global 5G eSIM Data Plans',
  },
  'تسليم فوري عبر رمز QR وبيانات SM-DP+ بدون شريحة بلاستيكية لجميع الوجهات.': {
    tr: 'Fiziksel SIM kart olmadan tüm destinasyonlar için anında QR kod ve SM-DP+ teslimatı.',
    en: 'Instant QR code & SM-DP+ delivery for destinations worldwide without a physical SIM.',
  },
  'تصفّح باقات eSIM': {
    tr: 'eSIM Paketlerini Keşfet',
    en: 'Browse eSIM Plans',
  },
  'شحن رصيد تلقائي عبر شام كاش وباينانس': {
    tr: 'ShamCash ve Binance Pay ile Anında Bakiye Yükleme',
    en: 'Instant Top-Up via ShamCash & Binance Pay',
  },
  'تحديث آلي لأسعار الصرف وعملات متعددة (USD / USDT / SYP / TRY) على مدار الساعة.': {
    tr: '7/24 otomatik döviz kuru güncellemesi ve çoklu para birimi desteği (USD / USDT / SYP / TRY).',
    en: '24/7 automated live exchange rates with multi-currency support (USD / USDT / SYP / TRY).',
  },
  'شحن المحفظة': {
    tr: 'Bakiye Yükle',
    en: 'Top Up Wallet',
  },
  // Default Announcement & Maintenance
  'أهلاً بكم في منصة AliSMS — شحن تلقائي فوري عبر Binance Pay وشام كاش، وتحديث لحظي لأسعار العملات وتفعيل مباشر للأرقام وشرائح eSIM.': {
    tr: 'Hoş geldiniz — Binance Pay ve ShamCash ile anında otomatik bakiye yükleme, canlı döviz kurları ve anlık SMS & eSIM aktivasyonu.',
    en: 'Welcome — Instant automated top-ups via Binance Pay & ShamCash, live exchange rates, and instant SMS & eSIM activation.',
  },
  'نقوم حالياً بإجراء صيانة دورية قصيرة لتحسين الأداء. سنعود للعمل خلال دقائق.': {
    tr: 'Performansı artırmak için kısa bir bakım çalışması yapıyoruz. Birkaç dakika içinde geri döneceğiz.',
    en: 'We are currently performing brief scheduled maintenance to improve performance. We will be back in minutes.',
  },
  // Default Support CMS Texts
  'الإدارة العليا — AliSMS': {
    tr: 'Üst Yönetim — Canlı Destek',
    en: 'Executive Support Team',
  },
  'المدير العام': {
    tr: 'Genel Yönetici',
    en: 'General Manager',
  },
  'إدارة الدعم الفني': {
    tr: 'Canlı Destek Yönetimi',
    en: 'Technical Support Team',
  },
  'المدير العام · دعم فوري': {
    tr: 'Genel Yönetici · Anlık Destek',
    en: 'Admin · Instant Support',
  },
  'مرحباً بك في الدعم الفني المباشر لمنصة AliSMS! كيف يمكننا مساعدتك اليوم؟ يمكنك إرسال نص أو صورة أو رسالة صوتية.': {
    tr: 'Canlı desteğe hoş geldiniz! Size bugün nasıl yardımcı olabiliriz? Metin, görsel veya sesli mesaj gönderebilirsiniz.',
    en: 'Welcome to live support! How can we help you today? You can send text, images, or voice notes.',
  },
  // Default Payment Gateways (Clean localized single-language names!)
  'باينانس باي (Binance Pay)': {
    tr: 'Binance Pay',
    en: 'Binance Pay',
  },
  'باينانس باي': {
    tr: 'Binance Pay',
    en: 'Binance Pay',
  },
  'شام كاش (Sham Cash)': {
    tr: 'ShamCash',
    en: 'ShamCash',
  },
  'شام كاش': {
    tr: 'ShamCash',
    en: 'ShamCash',
  },
  'سيرياتيل كاش (Syriatel Cash)': {
    tr: 'Syriatel Cash',
    en: 'Syriatel Cash',
  },
  'سيرياتيل كاش': {
    tr: 'Syriatel Cash',
    en: 'Syriatel Cash',
  },
  'تحويل بنكي تركي (IBAN / FAST)': {
    tr: 'Türk Bankası (IBAN / FAST)',
    en: 'Turkish Bank Transfer (IBAN / FAST)',
  },
  'بنك تركي': {
    tr: 'Türk Bankası',
    en: 'Turkish Bank',
  },
  'محافظ إلكترونية': {
    tr: 'Dijital Cüzdanlar',
    en: 'E-Wallets',
  },
  'USDT (TRC20 — شبكة ترون)': {
    tr: 'USDT (TRC20 — TRON)',
    en: 'USDT (TRC20 — TRON)',
  },
  'USDT (BEP20 — شبكة بينانس)': {
    tr: 'USDT (BEP20 — BNB Smart Chain)',
    en: 'USDT (BEP20 — BNB Smart Chain)',
  },
  // Default Gateway Instructions & Field Labels
  'أرسل USDT أو USD إلى Binance Pay ID (1073784382) بدون عمولة، ثم أدخل رقم الطلب (Order ID) للتحقق والشحن التلقائي الفوري.': {
    tr: 'Binance Pay ID (1073784382) adresine komisyonsuz USDT veya USD gönderin, ardından anında otomatik yükleme için Sipariş Numarasını (Order ID) girin.',
    en: 'Send USDT or USD to Binance Pay ID (1073784382) with zero fees, then enter your Order ID for instant automated verification.',
  },
  'قم بالتحويل إلى عنوان محفظة شام كاش أو امسح رمز QR ثم أدخل رقم عملية التحويل للتحقق التلقائي الفوري (يمكنك إرفاق إشعار الدفع اختيارياً).': {
    tr: 'ShamCash cüzdan adresine transfer yapın veya QR kodu tarayın, ardından otomatik onay için işlem numarasını girin (dekont isteğe bağlıdır).',
    en: 'Transfer to the ShamCash wallet address or scan the QR code, then enter the transaction ID for instant verification (receipt upload optional).',
  },
  'حوّل عبر تطبيق أقرب إليك إلى رمز التاجر، أدخل رقم العملية وارفع صورة إشعار التحويل لتأكيد الشحن.': {
    tr: 'Syriatel Cash üzerinden satıcı koduna transfer yapın, işlem numarasını girin ve onay için dekont görselini yükleyin.',
    en: 'Transfer via Syriatel Cash to the merchant code, enter the transaction ID, and upload your transfer receipt screenshot for confirmation.',
  },
  'قم بالتحويل عبر FAST/EFT إلى رقم الآيبان أعلاه، ثم ارفع صورة إيصال التحويل البنكي (Dekont) ليتم تأكيد الشحن مباشرة.': {
    tr: 'Yukarıdaki IBAN numarasına FAST/EFT ile transfer yapın, ardından anında onay için banka dekontunu yükleyin.',
    en: 'Transfer via FAST/EFT to the IBAN above, then upload your bank receipt (Dekont) for prompt balance confirmation.',
  },
  'رقم الهاتف المحوّل منه': {
    tr: 'Gönderen Telefon Numarası',
    en: 'Sender Phone Number',
  },
  'الاسم الكامل لصاحب الحساب البنكي': {
    tr: 'Banka Hesap Sahibinin Adı Soyadı',
    en: 'Bank Account Holder Full Name',
  },
  'الاسم كما يظهر في الإيصال': {
    tr: 'Dekontta görünen ad soyad',
    en: 'Full name as shown on receipt',
  },
  'شركة AliSMS للاتصالات الرقمية': {
    tr: 'alisim Dijital İletişim',
    en: 'alisim Digital Telecom',
  },
};

// In-memory cache + listeners so all mounted components re-render when new translations arrive
const memoryCache = new Map<string, string>();
const inFlightKeys = new Set<string>();
const pendingQueue: Record<'tr' | 'en', Set<string>> = {
  tr: new Set(),
  en: new Set(),
};
const listeners = new Set<() => void>();
let batchTimer: number | null = null;

function loadPersistedCache() {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') memoryCache.set(k, v);
      }
    }
  } catch {
    // ignore storage errors
  }
}
loadPersistedCache();

function persistCache() {
  if (typeof window === 'undefined') return;
  try {
    const entries = Array.from(memoryCache.entries()).slice(-500);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // ignore quota errors
  }
}

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

async function flushTranslationBatch(targetLang: 'tr' | 'en') {
  const items = Array.from(pendingQueue[targetLang]);
  pendingQueue[targetLang].clear();
  if (items.length === 0) return;

  const toFetch = items.filter((t) => {
    const key = `${targetLang}::${t}`;
    if (memoryCache.has(key) || inFlightKeys.has(key)) return false;
    inFlightKeys.add(key);
    return true;
  });

  if (toFetch.length === 0) return;

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetLang, texts: toFetch }),
    });
    if (res.ok) {
      const data = await res.json();
      const map: Record<string, string> = data?.translations || {};
      let changed = false;
      for (const src of toFetch) {
        const key = `${targetLang}::${src}`;
        inFlightKeys.delete(key);
        const translated = map[src];
        if (typeof translated === 'string' && translated.trim()) {
          memoryCache.set(key, translated.trim());
          changed = true;
        }
      }
      if (changed) {
        persistCache();
        notifyListeners();
      }
      return;
    }
  } catch {
    // fall through to release inFlight
  }

  for (const src of toFetch) {
    inFlightKeys.delete(`${targetLang}::${src}`);
  }
}

function enqueueTranslation(text: string, targetLang: 'tr' | 'en') {
  const clean = text.trim();
  if (!clean || !HAS_ARABIC_REGEX.test(clean)) return;
  const key = `${targetLang}::${clean}`;
  if (memoryCache.has(key) || inFlightKeys.has(key) || INSTANT_AR_TRANSLATIONS[clean]) return;

  pendingQueue[targetLang].add(clean);
  if (batchTimer === null && typeof window !== 'undefined') {
    batchTimer = window.setTimeout(() => {
      batchTimer = null;
      flushTranslationBatch('tr');
      flushTranslationBatch('en');
    }, 60);
  }
}

export function getTranslatedSync(text: string | undefined, lang: AppLanguage): string {
  if (!text) return '';
  const clean = text.trim();
  if (!clean) return '';

  // Arabic is the source language — strip redundant English parenthetical only when formatting payment names separately
  if (lang === 'ar') return clean;

  // Instant pre-seeded dictionary lookup
  const instant = INSTANT_AR_TRANSLATIONS[clean];
  if (instant) {
    return lang === 'tr' ? instant.tr : instant.en;
  }

  // Dynamic cache lookup
  const key = `${lang}::${clean}`;
  const cached = memoryCache.get(key);
  if (cached) return cached;

  // No Arabic characters -> return as-is
  if (!HAS_ARABIC_REGEX.test(clean)) return clean;

  // Trigger background fetch for any custom/edited Arabic text from Admin
  enqueueTranslation(clean, lang);
  return clean;
}

/**
 * Clean single-language payment gateway display name:
 * - In Arabic: strips duplicate Latin parenthetical like "شام كاش (Sham Cash)" -> "شام كاش"
 * - In Turkish / English: uses instant dictionary or auto-translates any Admin-entered Arabic name
 */
export function getCleanPaymentMethodName(rawNameAr: string, lang: AppLanguage): string {
  const clean = (rawNameAr || '').trim();
  if (!clean) return '';

  if (lang === 'ar') {
    // Only strip duplicate Latin parentheticals when the name starts with Arabic (e.g. "شام كاش (Sham Cash)")
    // Preserve crypto network labels like "USDT (TRC20)" or "USDT (BEP20)"
    if (HAS_ARABIC_REGEX.test(clean) && !/\b(TRC20|BEP20|ERC20|USDT)\b/i.test(clean)) {
      const stripped = clean.replace(/\s*\([A-Za-z0-9\s/._-]+\)\s*$/g, '').trim();
      return stripped || clean;
    }
    return clean;
  }

  return getTranslatedSync(clean, lang);
}

/**
 * React hook that returns an auto-translated version of a single Arabic CMS string.
 * Re-renders automatically once newly edited Admin Arabic texts finish translating.
 */
export function useAutoTranslate(text: string | undefined, lang: AppLanguage): string {
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (lang === 'ar' || !text) return;
    const onUpdate = () => setVersion((v) => v + 1);
    listeners.add(onUpdate);
    enqueueTranslation(text, lang);
    return () => {
      listeners.delete(onUpdate);
    };
  }, [text, lang]);

  return getTranslatedSync(text, lang);
}

/**
 * React hook for batch-translating an array of Arabic CMS strings in one component.
 */
export function useAutoTranslateBatch(
  texts: (string | undefined | null)[],
  lang: AppLanguage
): (text: string | undefined) => string {
  const [, setVersion] = useState(0);
  const signature = useMemo(
    () =>
      texts
        .filter((s): s is string => Boolean(s && s.trim()))
        .map((s) => s.trim())
        .join('\u0001'),
    [texts]
  );

  useEffect(() => {
    if (lang === 'ar' || !signature) return;
    const onUpdate = () => setVersion((v) => v + 1);
    listeners.add(onUpdate);
    for (const item of signature.split('\u0001')) {
      enqueueTranslation(item, lang);
    }
    return () => {
      listeners.delete(onUpdate);
    };
  }, [signature, lang]);

  return (text: string | undefined) => getTranslatedSync(text, lang);
}
