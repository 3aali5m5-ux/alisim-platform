import React, { useState, useMemo } from 'react';
import {
  Smartphone,
  QrCode,
  Search,
  CheckCircle2,
  RefreshCw,
  Globe2,
  Wifi,
  Copy,
  Check,
  X,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { AppLanguage, ESimPlan, ActiveESimOrder, SupportedCurrency } from '../types';
import { CountryFlagSvg } from './BrandVisuals';
import {
  formatCurrencyAmount,
  ExchangeRatesConfig,
  calculateEffectiveESimPriceUsd,
} from '../services/hybridSyncEngine';
import { useAutoTranslateBatch } from '../services/dynamicTranslator';

interface ESimWorkspaceProps {
  lang?: AppLanguage;
  plans: ESimPlan[];
  customAdminPlans: ESimPlan[];
  totalPlans: number;
  esimSource: string;
  loadingESim: boolean;
  selectedCountryFilter: string;
  onChangeCountryFilter: (iso2: string) => void;
  selectedValidityFilter: string;
  onChangeValidityFilter: (days: string) => void;
  activeESims: ActiveESimOrder[];
  currency: SupportedCurrency;
  rates: ExchangeRatesConfig;
  globalESimMarkupPercent: number;
  onBuyESim: (plan: ESimPlan) => Promise<ActiveESimOrder | null>;
  buyingPlanId: string | null;
}

const ESIM_COPY: Record<
  AppLanguage,
  {
    storeTitle: string;
    connectedCatalog: (total: string) => string;
    instantSubtitle: string;
    checkDeviceBtn: string;
    checkerTitle: string;
    deviceSearchPh: string;
    eidTipPrefix: string;
    eidTipMid: string;
    eidTipSuffix: string;
    tabAll: string;
    tabLocal: string;
    tabRegional: string;
    tabGlobal: string;
    searchPh: string;
    allCountries: string;
    validityAll: string;
    validity1: string;
    validity7: string;
    validity14: string;
    validity30: string;
    specialOffer: string;
    globalLabel: (n: number) => string;
    regionalLabel: (n: number) => string;
    localLabel: string;
    dataVolume: string;
    validityPeriod: string;
    daysUnit: string;
    hotspot: string;
    supported: string;
    issuing: string;
    buyActivate: string;
    showMore: (n: number) => string;
    myEsimsTitle: string;
    myEsimsSub: string;
    esimCount: (n: number) => string;
    emptyTitle: string;
    emptyDesc: string;
    cancelled: string;
    readyToInstall: string;
    planValidity: string;
    scanQrNote: string;
    openManualGuide: string;
    modalTitle: string;
    modalScanNote: string;
    smdpLabel: string;
    actCodeLabel: string;
    lpaLabel: string;
    copied: string;
    copy: string;
    copyLpa: string;
    iosTab: string;
    androidTab: string;
    iosSteps: string[];
    androidSteps: string[];
    closeModalBtn: string;
    countryNames: Record<string, string>;
  }
> = {
  ar: {
    storeTitle: 'متجر شرائح البيانات الإلكترونية (eSIM)',
    connectedCatalog: (total) =>
      `متصل مباشرة بكتالوج شرائح eSIM العالمي — إجمالي الباقات المتوفرة: ${total} باقة`,
    instantSubtitle: 'تسليم فوري عبر رمز QR وبيانات SM-DP+ لجميع دول العالم',
    checkDeviceBtn: 'فحص توافق هاتفك مع eSIM',
    checkerTitle: 'أداة فحص توافق الهاتف التفاعلية مع شريحة eSIM',
    deviceSearchPh: 'ابحث عن موديل هاتفك (مثال: iPhone 14 أو S23 أو Pixel)...',
    eidTipPrefix: '💡 نصيحة سريعة: اطلب الكود',
    eidTipMid: 'في لوحة اتصال هاتفك؛ إذا ظهر لك رمز',
    eidTipSuffix: 'فهاتفك يدعم eSIM رسمياً 100%.',
    tabAll: 'جميع الباقات',
    tabLocal: 'محلية',
    tabRegional: 'إقليمية',
    tabGlobal: 'عالمية',
    searchPh: 'ابحث عن الدولة أو حجم الباقة (10GB)...',
    allCountries: 'جميع الدول',
    validityAll: 'جميع المدد',
    validity1: 'يوم واحد+',
    validity7: '7 أيام+',
    validity14: '14 يوم+',
    validity30: '30 يوم+',
    specialOffer: '★ عرض خاص',
    globalLabel: (n) => `عالمية (${n} دولة)`,
    regionalLabel: (n) => `إقليمية (${n} دول)`,
    localLabel: 'محلية',
    dataVolume: 'حجم البيانات',
    validityPeriod: 'مدة الصلاحية',
    daysUnit: 'يوم',
    hotspot: 'نقطة اتصال Hotspot',
    supported: 'مدعوم ✓',
    issuing: 'جاري إصدار الشريحة...',
    buyActivate: 'شراء وتفعيل فوري',
    showMore: (n) => `عرض المزيد (${n} باقة متبقية)`,
    myEsimsTitle: 'شرائحي الإلكترونية (eSIM)',
    myEsimsSub: 'امسح رمز الـ QR أو افتح نافذة التثبيت اليدوي خطوة بخطوة',
    esimCount: (n) => `${n} شريحة`,
    emptyTitle: 'لا توجد شرائح eSIM مشتراة بعد',
    emptyDesc: 'اختر أي باقة بيانات من المتجر ليتم توليد رمز QR Code وبيانات SM-DP+ فوراً.',
    cancelled: 'ملغاة',
    readyToInstall: 'جاهزة للتثبيت',
    planValidity: 'الباقة والصلاحية:',
    scanQrNote: 'امسح الرمز عبر كاميرا الهاتف أو من إعدادات (إضافة شريحة eSIM)',
    openManualGuide: 'فتح نافذة التثبيت اليدوي ودليل iOS / Android',
    modalTitle: 'بوابة التفعيل الفوري لشريحة eSIM',
    modalScanNote: 'امسح الرمز بجهاز آخر أو انسخ الأكواد أدناه للتثبيت على نفس الهاتف',
    smdpLabel: 'عنوان SM-DP+ Address',
    actCodeLabel: 'رمز التفعيل (Activation Code)',
    lpaLabel: 'كود LPA الموحد (LPA String)',
    copied: 'تم النسخ',
    copy: 'نسخ',
    copyLpa: 'نسخ LPA',
    iosTab: 'خطوات آيفون (iOS)',
    androidTab: 'خطوات أندرويد (Android)',
    iosSteps: [
      'افتح الإعدادات (Settings) ثم ادخل إلى خلوي (Cellular).',
      'اضغط على إضافة شريحة إلكترونية (Add eSIM) ثم اختر استخدام رمز QR.',
      'إذا كنت تثبت الشريحة على نفس الهاتف، اضغط على إدخال التفاصيل يدوياً في أسفل الشاشة.',
      'انسخ عنوان SM-DP+ ورمز التفعيل من الصناديق المجاورة والصقهما.',
      'بعد التثبيت، فعّل خيار التجوال الدولي (Data Roaming) للشريحة الجديدة لتعمل فوراً بأقصى سرعة 5G.',
    ],
    androidSteps: [
      'افتح الضبط (Settings) ثم الاتصالات (Connections) ثم إدارة بطاقات SIM.',
      'اضغط على إضافة شريحة eSIM ثم اختر مسح رمز QR.',
      'للتثبيت اليدوي على نفس الجهاز، اضغط على إدخال كود التفعيل يدوياً.',
      'انسخ كود LPA الموحد أو عنوان SM-DP+ والصقه لتبدأ عملية التنزيل فوراً.',
      'تأكد من تفعيل بيانات الهاتف والتجوال (Data Roaming) على شريحة الـ eSIM بعد التثبيت.',
    ],
    closeModalBtn: 'تم الاطلاع وإغلاق النافذة',
    countryNames: {
      TR: 'تركيا',
      AE: 'الإمارات',
      SA: 'السعودية',
      SY: 'سوريا',
      LB: 'لبنان',
      JO: 'الأردن',
      EG: 'مصر',
      IQ: 'العراق',
      DE: 'ألمانيا',
      GB: 'بريطانيا',
      US: 'أمريكا',
      FR: 'فرنسا',
    },
  },
  tr: {
    storeTitle: 'Global eSIM Veri Paketleri Mağazası',
    connectedCatalog: (total) => `Küresel eSIM kataloğuna bağlı — Toplam paket: ${total}`,
    instantSubtitle: 'Tüm dünya ülkeleri için anında QR kod ve SM-DP+ teslimatı',
    checkDeviceBtn: 'Cihaz eSIM Uyumluluğunu Kontrol Et',
    checkerTitle: 'Etkileşimli eSIM Cihaz Uyumluluk Kontrolü',
    deviceSearchPh: 'Telefon modelinizi arayın (ör: iPhone 14, S23, Pixel)...',
    eidTipPrefix: '💡 Hızlı İpucu: Arama ekranında',
    eidTipMid: 'kodunu tuşlayın; ekranda',
    eidTipSuffix: 'numarası görünüyorsa cihazınız %100 eSIM destekler.',
    tabAll: 'Tüm Paketler',
    tabLocal: 'Yerel',
    tabRegional: 'Bölgesel',
    tabGlobal: 'Küresel',
    searchPh: 'Ülke veya veri boyutu ara (10GB)...',
    allCountries: 'Tüm Ülkeler',
    validityAll: 'Tüm Süreler',
    validity1: '1+ Gün',
    validity7: '7+ Gün',
    validity14: '14+ Gün',
    validity30: '30+ Gün',
    specialOffer: '★ Özel Teklif',
    globalLabel: (n) => `Küresel (${n} ülke)`,
    regionalLabel: (n) => `Bölgesel (${n} ülke)`,
    localLabel: 'Yerel',
    dataVolume: 'Veri Miktarı',
    validityPeriod: 'Geçerlilik',
    daysUnit: 'gün',
    hotspot: 'Hotspot Paylaşım',
    supported: 'Desteklenir ✓',
    issuing: 'eSIM oluşturuluyor...',
    buyActivate: 'Satın Al ve Aktive Et',
    showMore: (n) => `Daha Fazla Göster (${n} paket kaldı)`,
    myEsimsTitle: 'eSIM Kartlarım',
    myEsimsSub: 'QR kodu tarayın veya adım adım manuel kurulum rehberini açın',
    esimCount: (n) => `${n} eSIM`,
    emptyTitle: 'Henüz satın alınmış eSIM yok',
    emptyDesc: 'Anında QR kod ve SM-DP+ kurulum bilgisi oluşturmak için bir veri paketi seçin.',
    cancelled: 'İptal Edildi',
    readyToInstall: 'Kuruluma Hazır',
    planValidity: 'Paket ve Süre:',
    scanQrNote: 'Telefon kamerasıyla veya Ayarlar > eSIM Ekle bölümünden QR kodu tarayın',
    openManualGuide: 'Manuel Kurulum ve iOS / Android Rehberini Aç',
    modalTitle: 'Anında eSIM Aktivasyon Portalı',
    modalScanNote: 'Başka cihazla QR tarayın veya aynı cihaza kurulum için kodları kopyalayın',
    smdpLabel: 'SM-DP+ Adresi',
    actCodeLabel: 'Aktivasyon Kodu',
    lpaLabel: 'Birleşik LPA Kodu',
    copied: 'Kopyalandı',
    copy: 'Kopyala',
    copyLpa: 'LPA Kopyala',
    iosTab: 'iPhone (iOS) Adımları',
    androidTab: 'Android Adımları',
    iosSteps: [
      'Ayarlar (Settings) > Hücresel (Cellular) menüsünü açın.',
      'eSIM Ekle (Add eSIM) > QR Kod Kullan seçeneğine dokunun.',
      'Aynı cihaza kuruyorsanız alttaki Ayrıntıları Elle Gir seçeneğini kullanın.',
      'SM-DP+ adresini ve Aktivasyon Kodunu kopyalayıp ilgili alanlara yapıştırın.',
      'Kurulum sonrası 5G bağlantı için yeni eSIM hattında Veri Dolaşımı (Data Roaming) ayarını açın.',
    ],
    androidSteps: [
      'Ayarlar > Bağlantılar > SIM Yöneticisi menüsünü açın.',
      'eSIM Ekle > QR Kod Tara seçeneğine dokunun.',
      'Manuel kurulum için Aktivasyon Kodunu Elle Gir seçeneğini kullanın.',
      'LPA kodunu veya SM-DP+ adresini yapıştırarak profili indirin.',
      'Kurulum tamamlandığında eSIM hattı için Veri Dolaşımı (Data Roaming) seçeneğini etkinleştirin.',
    ],
    closeModalBtn: 'Tamam, Pencereyi Kapat',
    countryNames: {
      TR: 'Türkiye',
      AE: 'BAE',
      SA: 'Suudi Arabistan',
      SY: 'Suriye',
      LB: 'Lübnan',
      JO: 'Ürdün',
      EG: 'Mısır',
      IQ: 'Irak',
      DE: 'Almanya',
      GB: 'Birleşik Krallık',
      US: 'ABD',
      FR: 'Fransa',
    },
  },
  en: {
    storeTitle: 'Global Digital eSIM Data Store',
    connectedCatalog: (total) => `Connected to live global eSIM catalog — ${total} plans available`,
    instantSubtitle: 'Instant QR Code & SM-DP+ delivery for countries worldwide',
    checkDeviceBtn: 'Check eSIM Compatibility',
    checkerTitle: 'Interactive eSIM Device Compatibility Checker',
    deviceSearchPh: 'Search your phone model (e.g. iPhone 14, S23, Pixel)...',
    eidTipPrefix: '💡 Quick Tip: Dial',
    eidTipMid: 'on your phone keypad; if an',
    eidTipSuffix: 'number appears, your device officially supports eSIM.',
    tabAll: 'All Plans',
    tabLocal: 'Local',
    tabRegional: 'Regional',
    tabGlobal: 'Global',
    searchPh: 'Search country or data size (10GB)...',
    allCountries: 'All Countries',
    validityAll: 'All Durations',
    validity1: '1+ Day',
    validity7: '7+ Days',
    validity14: '14+ Days',
    validity30: '30+ Days',
    specialOffer: '★ Featured',
    globalLabel: (n) => `Global (${n} countries)`,
    regionalLabel: (n) => `Regional (${n} countries)`,
    localLabel: 'Local',
    dataVolume: 'Data Volume',
    validityPeriod: 'Validity',
    daysUnit: 'days',
    hotspot: 'Hotspot Tethering',
    supported: 'Supported ✓',
    issuing: 'Provisioning eSIM...',
    buyActivate: 'Buy & Activate Now',
    showMore: (n) => `Show More (${n} remaining)`,
    myEsimsTitle: 'My eSIM Profiles',
    myEsimsSub: 'Scan the QR code or open the step-by-step manual setup guide',
    esimCount: (n) => `${n} eSIM`,
    emptyTitle: 'No eSIM profiles purchased yet',
    emptyDesc: 'Pick any data plan from the store to generate your QR code and SM-DP+ credentials immediately.',
    cancelled: 'Cancelled',
    readyToInstall: 'Ready to Install',
    planValidity: 'Plan & Validity:',
    scanQrNote: 'Scan with your camera or go to Settings > Add eSIM',
    openManualGuide: 'Open Manual Setup & iOS / Android Guide',
    modalTitle: 'Instant eSIM Activation Portal',
    modalScanNote: 'Scan with another device or copy codes below for same-device setup',
    smdpLabel: 'SM-DP+ Address',
    actCodeLabel: 'Activation Code',
    lpaLabel: 'Unified LPA String',
    copied: 'Copied',
    copy: 'Copy',
    copyLpa: 'Copy LPA',
    iosTab: 'iPhone (iOS) Steps',
    androidTab: 'Android Steps',
    iosSteps: [
      'Open Settings and go to Cellular / Mobile Data.',
      'Tap Add eSIM and select Use QR Code.',
      'For same-device setup, tap Enter Details Manually at the bottom.',
      'Copy the SM-DP+ Address and Activation Code from the boxes beside and paste them.',
      'After installation, turn on Data Roaming for the new eSIM to connect at full 5G/LTE speed.',
    ],
    androidSteps: [
      'Open Settings > Connections > SIM Manager.',
      'Tap Add eSIM and choose Scan QR Code.',
      'For manual same-device setup, tap Enter Activation Code Manually.',
      'Paste the unified LPA string or SM-DP+ address to download the profile.',
      'Enable Mobile Data and Data Roaming on your new eSIM line after installation.',
    ],
    closeModalBtn: 'Done, Close Window',
    countryNames: {
      TR: 'Turkey',
      AE: 'UAE',
      SA: 'Saudi Arabia',
      SY: 'Syria',
      LB: 'Lebanon',
      JO: 'Jordan',
      EG: 'Egypt',
      IQ: 'Iraq',
      DE: 'Germany',
      GB: 'United Kingdom',
      US: 'United States',
      FR: 'France',
    },
  },
};

const POPULAR_ISO_CODES = ['ALL', 'TR', 'AE', 'SA', 'SY', 'LB', 'JO', 'EG', 'IQ', 'DE', 'GB', 'US', 'FR'];

const COMPATIBLE_DEVICES_DB = [
  { brand: 'iphone', model: 'iPhone 16 / 16 Pro / 16 Pro Max', noteAr: 'يدعم شريحتي eSIM نشطتين + 5G.', noteTr: 'Çift aktif eSIM + 5G destekler.', noteEn: 'Supports dual active eSIM + 5G.' },
  { brand: 'iphone', model: 'iPhone 15 / 14 / 13 / 12 / 11', noteAr: 'متوافق 100% مع التثبيت المباشر عبر QR أو LPA اليدوي.', noteTr: 'QR veya manuel LPA kurulumu ile %100 uyumlu.', noteEn: '100% compatible with QR & manual LPA install.' },
  { brand: 'iphone', model: 'iPhone XS / XS Max / XR / SE (2020+)', noteAr: 'يدعم شريحة eSIM بشكل كامل.', noteTr: 'Tam eSIM desteğine sahiptir.', noteEn: 'Full eSIM profile support.' },
  { brand: 'samsung', model: 'Galaxy S24 / S23 / S22 / S21 / S20', noteAr: 'متوافق بالكامل من إدارة بطاقات SIM > إضافة eSIM.', noteTr: 'SIM Yöneticisi > eSIM Ekle üzerinden tam uyumlu.', noteEn: 'Fully supported via SIM Manager > Add eSIM.' },
  { brand: 'samsung', model: 'Galaxy Z Fold & Z Flip', noteAr: 'يدعم eSIM و 5G بشكل كامل.', noteTr: 'eSIM ve 5G tam destekli.', noteEn: 'Full eSIM & 5G support.' },
  { brand: 'xiaomi', model: 'Xiaomi 14 / 13 / 13T Pro / 12T Pro', noteAr: 'النسخ العالمية تدعم eSIM من إعدادات الشبكة.', noteTr: 'Global modeller ağ ayarlarından eSIM destekler.', noteEn: 'Global editions support eSIM in network settings.' },
  { brand: 'xiaomi', model: 'Google Pixel 8 / 7 / 6 / 5 / 4', noteAr: 'متوافق 100% مع التفعيل الفوري.', noteTr: 'Anında aktivasyon ile %100 uyumlu.', noteEn: '100% compatible with instant activation.' },
];

export const ESimWorkspace: React.FC<ESimWorkspaceProps> = ({
  lang = 'ar',
  plans,
  customAdminPlans,
  totalPlans,
  esimSource,
  loadingESim,
  selectedCountryFilter,
  onChangeCountryFilter,
  selectedValidityFilter,
  onChangeValidityFilter,
  activeESims,
  currency,
  rates,
  globalESimMarkupPercent,
  onBuyESim,
  buyingPlanId,
}) => {
  const c = ESIM_COPY[lang];
  const isRtl = lang === 'ar';

  const [regionTab, setRegionTab] = useState<'all' | 'local' | 'regional' | 'global'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visiblePlansLimit, setVisiblePlansLimit] = useState<number>(10);
  const [selectedESimId, setSelectedESimId] = useState<string | null>(
    activeESims[0]?.id || null
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showCompatibilityChecker, setShowCompatibilityChecker] = useState(false);
  const [deviceBrand, setDeviceBrand] = useState<'iphone' | 'samsung' | 'xiaomi'>('iphone');
  const [deviceSearch, setDeviceSearch] = useState('');

  const [provisioningOrder, setProvisioningOrder] = useState<ActiveESimOrder | null>(null);
  const [guideOsTab, setGuideOsTab] = useState<'ios' | 'android'>('ios');

  const allMergedPlans = useMemo(() => {
    const combined = [...customAdminPlans.filter((p) => p.isAvailable !== false), ...plans];
    return combined.map((p) => {
      const eff = calculateEffectiveESimPriceUsd({
        baseCostUsd: p.baseCostUsd,
        globalESimMarkupPercent,
      });
      return {
        ...p,
        finalPriceUsd: eff.finalUsd,
        finalPriceSyp: Math.round(eff.finalUsd * rates.usdToSypRate),
      };
    });
  }, [customAdminPlans, plans, globalESimMarkupPercent, rates.usdToSypRate]);

  const filteredPlans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allMergedPlans.filter((p) => {
      if (regionTab !== 'all' && p.region !== regionTab) return false;
      if (!q) return true;
      return (
        p.countryNameAr.toLowerCase().includes(q) ||
        p.countryNameEn.toLowerCase().includes(q) ||
        p.nameEn.toLowerCase().includes(q) ||
        p.dataLabelAr.toLowerCase().includes(q)
      );
    });
  }, [allMergedPlans, regionTab, searchQuery]);

  const activeSelectedESim = useMemo(() => {
    return activeESims.find((e) => e.id === selectedESimId) || activeESims[0] || null;
  }, [activeESims, selectedESimId]);

  const handleCopy = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const formatPrice = (usd: number) => formatCurrencyAmount(usd, currency, rates);

  const handlePurchasePlan = async (plan: ESimPlan) => {
    const createdOrder = await onBuyESim(plan);
    if (createdOrder) {
      setSelectedESimId(createdOrder.id);
      setProvisioningOrder(createdOrder);
    }
  };

  const filteredDevices = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase();
    return COMPATIBLE_DEVICES_DB.filter((d) => {
      if (d.brand !== deviceBrand && !q) return false;
      if (q) return d.model.toLowerCase().includes(q);
      return true;
    });
  }, [deviceBrand, deviceSearch]);

  const dynamicEsimTexts = useMemo(() => {
    const arr: (string | undefined)[] = [];
    customAdminPlans.forEach((p) => arr.push(p.countryNameAr, p.dataLabelAr));
    activeESims.forEach((e) => arr.push(e.countryNameAr, e.dataLabelAr));
    return arr;
  }, [customAdminPlans, activeESims]);

  const translateEsim = useAutoTranslateBatch(dynamicEsimTexts, lang);

  const formatDataLabel = (raw: string) => {
    if (lang === 'ar') return raw;
    if (/جيجابايت|غيغابايت/.test(raw)) {
      return raw.replace(/\s*(جيجابايت|غيغابايت)/g, ' GB').trim();
    }
    if (/ميجابايت|ميغابايت/.test(raw)) {
      return raw.replace(/\s*(ميجابايت|ميغابايت)/g, ' MB').trim();
    }
    return translateEsim(raw);
  };

  const getPlanCountryName = (plan: ESimPlan) =>
    lang === 'ar'
      ? plan.countryNameAr
      : c.countryNames[plan.iso2.toUpperCase()] ||
        (plan.countryNameEn && !/[\u0600-\u06FF]/.test(plan.countryNameEn)
          ? plan.countryNameEn
          : translateEsim(plan.countryNameAr));

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Main Storefront Column (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          <section className="cyber-glass rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <Globe2 className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-base font-extrabold text-white">{c.storeTitle}</h2>
                  {loadingESim && <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {esimSource === 'LIVE_GRIZZLYSMS_ESIM_API'
                    ? c.connectedCatalog(totalPlans.toLocaleString('en-US'))
                    : c.instantSubtitle}
                </p>
              </div>

              <button
                onClick={() => setShowCompatibilityChecker(!showCompatibilityChecker)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-500/20 border border-cyan-400/40 text-cyan-300 hover:bg-indigo-500/30 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>{c.checkDeviceBtn}</span>
              </button>
            </div>

            {showCompatibilityChecker && (
              <div className="p-4 rounded-xl bg-[#070A12] border border-cyan-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>{c.checkerTitle}</span>
                  </h3>

                  <div className="flex items-center gap-1">
                    {[
                      { id: 'iphone', label: 'Apple iPhone' },
                      { id: 'samsung', label: 'Samsung Galaxy' },
                      { id: 'xiaomi', label: 'Xiaomi / Pixel' },
                    ].map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setDeviceBrand(b.id as typeof deviceBrand)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                          deviceBrand === b.id
                            ? 'bg-gradient-to-l from-indigo-600 to-cyan-600 text-white btn-solid-white'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="text"
                  value={deviceSearch}
                  onChange={(e) => setDeviceSearch(e.target.value)}
                  placeholder={c.deviceSearchPh}
                  className="w-full px-3 py-2 rounded-xl bg-[#0B0F1A] border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-400"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredDevices.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-white/5 border border-white/10 flex items-start gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white" dir="ltr">
                          {item.model}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {lang === 'ar' ? item.noteAr : lang === 'tr' ? item.noteTr : item.noteEn}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-[11px] text-cyan-300 font-semibold pt-1">
                  {c.eidTipPrefix}{' '}
                  <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded" dir="ltr">
                    *#06#
                  </span>{' '}
                  {c.eidTipMid} <span className="font-mono">EID</span> {c.eidTipSuffix}
                </div>
              </div>
            )}

            {/* Region Tabs + Search */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#070A12] border border-white/10">
                {[
                  { id: 'all', label: c.tabAll },
                  { id: 'local', label: c.tabLocal },
                  { id: 'regional', label: c.tabRegional },
                  { id: 'global', label: c.tabGlobal },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRegionTab(tab.id as typeof regionTab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      regionTab === tab.id
                        ? 'bg-gradient-to-l from-indigo-600 to-cyan-600 text-white shadow-sm btn-solid-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search
                  className={`w-4 h-4 text-slate-400 absolute ${
                    isRtl ? 'right-3' : 'left-3'
                  } top-1/2 -translate-y-1/2 pointer-events-none`}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={c.searchPh}
                  className={`w-full ${
                    isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
                  } py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white focus:outline-none focus:border-cyan-400`}
                />
              </div>
            </div>

            {/* Country Quick Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {POPULAR_ISO_CODES.map((iso) => (
                <button
                  key={iso}
                  onClick={() => onChangeCountryFilter(iso)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer border ${
                    selectedCountryFilter === iso
                      ? 'bg-indigo-600/35 border-cyan-400 text-white'
                      : 'bg-[#070A12] border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {iso !== 'ALL' && (
                    <CountryFlagSvg iso2={iso} className="w-5 h-3.5 rounded-[2px]" />
                  )}
                  <span>{iso === 'ALL' ? c.allCountries : c.countryNames[iso] || iso}</span>
                </button>
              ))}
            </div>

            {/* Validity Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { val: '', label: c.validityAll },
                { val: '1', label: c.validity1 },
                { val: '7', label: c.validity7 },
                { val: '14', label: c.validity14 },
                { val: '30', label: c.validity30 },
              ].map((d) => (
                <button
                  key={d.val}
                  onClick={() => onChangeValidityFilter(d.val)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedValidityFilter === d.val
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-[#070A12] text-slate-400 hover:text-white border border-white/5'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Plans Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {filteredPlans.slice(0, visiblePlansLimit).map((plan) => {
                const isBuying = buyingPlanId === plan.id;
                return (
                  <div
                    key={plan.id}
                    className="cyber-card-3d p-4 rounded-xl bg-[#090D18]/90 border border-white/10 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <CountryFlagSvg
                            iso2={plan.iso2}
                            className="w-10 h-7 rounded-[4px] shadow-xs"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-extrabold text-white truncate">
                                {getPlanCountryName(plan)}
                              </h3>
                              {plan.isCustomAdminPlan && (
                                <span className="text-[10px] font-bold text-amber-300">
                                  {c.specialOffer}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 truncate">
                              <span className="font-mono">{plan.nameEn}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {plan.region === 'global'
                                  ? c.globalLabel(plan.countriesCount)
                                  : plan.region === 'regional'
                                  ? c.regionalLabel(plan.countriesCount)
                                  : c.localLabel}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className="text-[11px] font-mono font-bold text-cyan-300 flex items-center gap-1 shrink-0">
                          <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{plan.networkType || '5G/LTE'}</span>
                        </span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-[11px] text-slate-400">{c.dataVolume}</div>
                          <div className="text-xs font-extrabold text-white mt-0.5">
                            {formatDataLabel(plan.dataLabelAr)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">{c.validityPeriod}</div>
                          <div className="text-xs font-extrabold text-white mt-0.5 font-mono tabular-nums">
                            {plan.validityDays} {c.daysUnit}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">{c.hotspot}</div>
                          <div className="text-xs font-bold text-emerald-400 mt-0.5">
                            {c.supported}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/10">
                      <div className="text-base font-black font-mono tabular-nums text-cyan-300">
                        {formatPrice(plan.finalPriceUsd)}
                      </div>

                      <button
                        onClick={() => handlePurchasePlan(plan)}
                        disabled={isBuying}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-extrabold transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] btn-solid-white"
                      >
                        {isBuying ? c.issuing : c.buyActivate}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredPlans.length > visiblePlansLimit && (
              <button
                type="button"
                onClick={() => setVisiblePlansLimit((v) => v + 10)}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-extrabold text-cyan-300 cursor-pointer"
              >
                {c.showMore(filteredPlans.length - visiblePlansLimit)}
              </button>
            )}
          </section>
        </div>

        {/* Active eSIM Column (4 cols) */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-20">
          <section className="cyber-glass rounded-2xl p-5">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-white">
                  {c.myEsimsTitle}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{c.myEsimsSub}</p>
              </div>
              <span className="text-xs font-mono tabular-nums font-bold text-cyan-400">
                {c.esimCount(activeESims.length)}
              </span>
            </div>

            {activeESims.length > 1 && (
              <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
                {activeESims.map((esim) => (
                  <button
                    key={esim.id}
                    onClick={() => setSelectedESimId(esim.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer border ${
                      activeSelectedESim?.id === esim.id
                        ? 'bg-indigo-600/35 border-cyan-400 text-white'
                        : 'bg-[#070A12] border-white/10 text-slate-400'
                    }`}
                  >
                    <CountryFlagSvg iso2={esim.iso2} className="w-4 h-3 rounded-[2px]" />
                    <span>
                      {translateEsim(esim.countryNameAr)} ({formatDataLabel(esim.dataLabelAr)})
                    </span>
                  </button>
                ))}
              </div>
            )}

            {!activeSelectedESim ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-cyan-400 flex items-center justify-center mx-auto">
                  <QrCode className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-white">{c.emptyTitle}</p>
                <p className="text-xs text-slate-400">{c.emptyDesc}</p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="p-3.5 rounded-xl bg-[#070A12] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CountryFlagSvg
                        iso2={activeSelectedESim.iso2}
                        className="w-8 h-6 rounded-[3px]"
                      />
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          {translateEsim(activeSelectedESim.countryNameAr)}
                        </h3>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                          ICCID: {activeSelectedESim.iccid}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {activeSelectedESim.status === 'CANCELLED'
                          ? c.cancelled
                          : c.readyToInstall}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10">
                    <span className="text-slate-400">{c.planValidity}</span>
                    <span className="font-mono tabular-nums font-bold text-cyan-300">
                      {formatDataLabel(activeSelectedESim.dataLabelAr)} ({activeSelectedESim.validityDays}{' '}
                      {c.daysUnit})
                    </span>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center text-center space-y-3">
                  <QRCodeSVG
                    value={activeSelectedESim.lpaString}
                    size={164}
                    level="M"
                    includeMargin={false}
                  />
                  <div className="text-xs font-bold text-slate-900">{c.scanQrNote}</div>
                </div>

                <button
                  type="button"
                  onClick={() => setProvisioningOrder(activeSelectedESim)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer btn-solid-white"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{c.openManualGuide}</span>
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Instant eSIM Provisioning Modal */}
      {provisioningOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl cyber-glass border border-cyan-500/40 shadow-2xl overflow-hidden my-8">
            <div className="px-5 py-4 bg-[#070A12] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CountryFlagSvg iso2={provisioningOrder.iso2} className="w-8 h-6 rounded-[3px]" />
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    {c.modalTitle} ({provisioningOrder.countryNameAr})
                  </h3>
                  <p className="text-xs text-cyan-400 font-mono">
                    {provisioningOrder.dataLabelAr} · {provisioningOrder.validityDays} {c.daysUnit}{' '}
                    · 5G/LTE
                  </p>
                </div>
              </div>

              <button
                onClick={() => setProvisioningOrder(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              <div className="md:col-span-6 space-y-3">
                <div className="p-4 rounded-xl bg-white flex flex-col items-center justify-center text-center space-y-2">
                  <QRCodeSVG
                    value={provisioningOrder.lpaString}
                    size={160}
                    level="M"
                    includeMargin={false}
                  />
                  <span className="text-[11px] font-bold text-slate-800">{c.modalScanNote}</span>
                </div>

                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl bg-[#070A12] border border-white/10 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400">{c.smdpLabel}</div>
                      <div className="text-xs font-mono font-bold text-cyan-300 truncate" dir="ltr">
                        {provisioningOrder.smdpAddress}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopy(provisioningOrder.smdpAddress, 'modal-smdp')}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1 btn-solid-white"
                    >
                      {copiedField === 'modal-smdp' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedField === 'modal-smdp' ? c.copied : c.copy}</span>
                    </button>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#070A12] border border-white/10 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400">{c.actCodeLabel}</div>
                      <div
                        className="text-xs font-mono font-bold text-emerald-300 truncate"
                        dir="ltr"
                      >
                        {provisioningOrder.activationCode}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopy(provisioningOrder.activationCode, 'modal-act')}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1 btn-solid-white"
                    >
                      {copiedField === 'modal-act' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedField === 'modal-act' ? c.copied : c.copy}</span>
                    </button>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#070A12] border border-white/10 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400">{c.lpaLabel}</div>
                      <div className="text-xs font-mono text-white truncate" dir="ltr">
                        {provisioningOrder.lpaString}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopy(provisioningOrder.lpaString, 'modal-lpa')}
                      className="px-2.5 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1 btn-solid-white"
                    >
                      {copiedField === 'modal-lpa' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedField === 'modal-lpa' ? c.copied : c.copyLpa}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="md:col-span-6 space-y-3">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#070A12] border border-white/10">
                  <button
                    type="button"
                    onClick={() => setGuideOsTab('ios')}
                    className={`flex-1 py-2 rounded-lg text-xs font-extrabold cursor-pointer ${
                      guideOsTab === 'ios'
                        ? 'bg-gradient-to-l from-indigo-600 to-cyan-600 text-white btn-solid-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {c.iosTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideOsTab('android')}
                    className={`flex-1 py-2 rounded-lg text-xs font-extrabold cursor-pointer ${
                      guideOsTab === 'android'
                        ? 'bg-gradient-to-l from-indigo-600 to-cyan-600 text-white btn-solid-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {c.androidTab}
                  </button>
                </div>

                <ol className="space-y-2.5 text-xs text-slate-200 bg-[#070A12] p-4 rounded-xl border border-white/10 list-decimal list-inside leading-relaxed">
                  {(guideOsTab === 'ios' ? c.iosSteps : c.androidSteps).map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>

                <button
                  type="button"
                  onClick={() => setProvisioningOrder(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer btn-solid-white"
                >
                  {c.closeModalBtn}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
