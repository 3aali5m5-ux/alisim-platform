import React, { useState, useMemo, useEffect } from 'react';
import {
  MessageSquare,
  Wifi,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Search,
  QrCode,
  RotateCcw,
  ShieldCheck,
  CreditCard,
  Radio,
} from 'lucide-react';
import {
  ActiveSmsOrder,
  ActiveESimOrder,
  PaymentTransaction,
  SupportedCurrency,
  AppLanguage,
} from '../types';
import {
  formatCurrencyAmount,
  ExchangeRatesConfig,
} from '../services/hybridSyncEngine';
import { CountryFlagSvg, ServiceBrandIcon } from './BrandVisuals';
import { getAllCodesForOrder } from './LiveOtpPanel';
import { getLocalizedServiceName } from '../i18n';
import {
  useAutoTranslateBatch,
  getCleanPaymentMethodName,
} from '../services/dynamicTranslator';

interface OrdersHistoryWorkspaceProps {
  lang?: AppLanguage;
  smsOrders: ActiveSmsOrder[];
  esimOrders: ActiveESimOrder[];
  paymentHistory: PaymentTransaction[];
  currency: SupportedCurrency;
  rates: ExchangeRatesConfig;
  onOpenOtpModal?: () => void;
  onSmsOrderAction?: (
    orderId: string,
    action: 'READY_1' | 'RETRY_3' | 'COMPLETE_6' | 'CANCEL_8' | 'SIMULATE_SMS'
  ) => Promise<void>;
}

type OrdersMainCategory = 'sms' | 'esim' | 'payments';
type SmsFilterStatus = 'all' | 'active' | 'completed' | 'cancelled';
type ESimFilterStatus = 'all' | 'active' | 'cancelled';

const ORDERS_COPY: Record<
  AppLanguage,
  {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    catSms: string;
    catEsim: string;
    catPayments: string;
    smsAll: string;
    smsActive: string;
    smsCompleted: string;
    smsCancelled: string;
    esimAll: string;
    esimActive: string;
    esimCancelled: string;
    emptySms: string;
    emptyEsim: string;
    emptyPayments: string;
    statusCompleted: string;
    statusCodeArrived: string;
    statusCancelled: string;
    statusActivating: string;
    copyNumber: string;
    copied: string;
    codeNumber: string;
    codeReceived: string;
    latest: string;
    copyCode: string;
    openOtpPopup: string;
    requestAnotherSms: string;
    finishActivation: string;
    cancelRefund: string;
    showMoreOrders: string;
    showMoreEsims: string;
    showMorePayments: string;
    days: string;
    esimCancelledLabel: string;
    esimReadyLabel: string;
    hideInstallData: string;
    showInstallData: string;
    refLabel: string;
    confirmed: string;
  }
> = {
  ar: {
    title: 'إدارة ومتابعة الطلبات الموحّدة',
    subtitle: 'عرض منظم ومقسّم حسب الحالة لأرقام التفعيل (SMS) وشرائح الإنترنت (eSIM) وسجل الشحن',
    searchPlaceholder: 'ابحث بالرقم، الخدمة، الكود، ICCID...',
    catSms: 'الأرقام SMS',
    catEsim: 'شرائح eSIM',
    catPayments: 'الشحن',
    smsAll: 'كل الأرقام',
    smsActive: 'جاري التفعيل',
    smsCompleted: 'مفعّل ومكتمل',
    smsCancelled: 'ملغي / منتهي',
    esimAll: 'كل الشرائح',
    esimActive: 'نشطة / جاهزة',
    esimCancelled: 'ملغاة / منتهية',
    emptySms: 'لا توجد طلبات أرقام ضمن هذا التصنيف حالياً.',
    emptyEsim: 'لا توجد شرائح eSIM ضمن هذا التصنيف حالياً.',
    emptyPayments: 'لا توجد عمليات شحن رصيد مسجلة حتى الآن.',
    statusCompleted: 'مفعّل ومكتمل',
    statusCodeArrived: 'وصل الكود بنجاح',
    statusCancelled: 'ملغي ومسترد',
    statusActivating: 'جاري التفعيل',
    copyNumber: 'نسخ الرقم',
    copied: 'تم!',
    codeNumber: 'كود التفعيل #',
    codeReceived: 'كود التفعيل المستلم',
    latest: 'الأحدث',
    copyCode: 'نسخ الكود',
    openOtpPopup: 'فتح نافذة التفعيل المباشرة',
    requestAnotherSms: 'طلب رسالة ثانية',
    finishActivation: 'إنهاء التفعيل',
    cancelRefund: 'إلغاء الرقم واسترداد الرصيد',
    showMoreOrders: 'عرض المزيد',
    showMoreEsims: 'عرض المزيد',
    showMorePayments: 'عرض المزيد',
    days: 'يوم',
    esimCancelledLabel: 'ملغاة ومستردة',
    esimReadyLabel: 'فعالة وجاهزة للتثبيت',
    hideInstallData: 'إخفاء بيانات التثبيت',
    showInstallData: 'عرض SM-DP+ وكود التفعيل',
    refLabel: 'رقم المرجع:',
    confirmed: 'مؤكد ✓',
  },
  tr: {
    title: 'Birleşik Sipariş Geçmişi',
    subtitle: 'SMS aktivasyon numaraları, eSIM paketleri ve bakiye yüklemelerini duruma göre takip edin',
    searchPlaceholder: 'Numara, servis, kod veya ICCID ara...',
    catSms: 'SMS Numaraları',
    catEsim: 'eSIM Kartlar',
    catPayments: 'Yüklemeler',
    smsAll: 'Tüm Numaralar',
    smsActive: 'Aktive Ediliyor',
    smsCompleted: 'Tamamlandı',
    smsCancelled: 'İptal / Süresi Doldu',
    esimAll: 'Tüm eSIMler',
    esimActive: 'Aktif / Hazır',
    esimCancelled: 'İptal / Süresi Doldu',
    emptySms: 'Bu kategoride henüz SMS numarası yok.',
    emptyEsim: 'Bu kategoride henüz eSIM siparişi yok.',
    emptyPayments: 'Henüz kayıtlı bakiye yükleme işlemi yok.',
    statusCompleted: 'Aktive Edildi',
    statusCodeArrived: 'Kod Geldi',
    statusCancelled: 'İptal & İade Edildi',
    statusActivating: 'Aktive Ediliyor',
    copyNumber: 'Numarayı Kopyala',
    copied: 'Kopyalandı!',
    codeNumber: 'Doğrulama Kodu #',
    codeReceived: 'Alınan Doğrulama Kodu',
    latest: 'En Yeni',
    copyCode: 'Kodu Kopyala',
    openOtpPopup: 'Canlı OTP Penceresini Aç',
    requestAnotherSms: 'İkinci Mesaj İste',
    finishActivation: 'Aktivasyonu Tamamla',
    cancelRefund: 'İptal Et & İade Al',
    showMoreOrders: 'Daha Fazla Göster',
    showMoreEsims: 'Daha Fazla Göster',
    showMorePayments: 'Daha Fazla Göster',
    days: 'gün',
    esimCancelledLabel: 'İptal & İade Edildi',
    esimReadyLabel: 'Aktif ve Kuruluma Hazır',
    hideInstallData: 'Kurulum Bilgilerini Gizle',
    showInstallData: 'SM-DP+ ve Aktivasyon Kodunu Göster',
    refLabel: 'Referans No:',
    confirmed: 'Onaylandı ✓',
  },
  en: {
    title: 'Unified Orders & History',
    subtitle: 'Organized tracking for virtual SMS numbers, eSIM profiles, and wallet top-ups',
    searchPlaceholder: 'Search by number, service, code, ICCID...',
    catSms: 'SMS Numbers',
    catEsim: 'eSIM Profiles',
    catPayments: 'Top-Ups',
    smsAll: 'All Numbers',
    smsActive: 'Activating',
    smsCompleted: 'Activated',
    smsCancelled: 'Cancelled / Expired',
    esimAll: 'All eSIMs',
    esimActive: 'Active / Ready',
    esimCancelled: 'Cancelled / Expired',
    emptySms: 'No SMS number orders in this category yet.',
    emptyEsim: 'No eSIM orders in this category yet.',
    emptyPayments: 'No wallet top-up transactions recorded yet.',
    statusCompleted: 'Activated',
    statusCodeArrived: 'Code Received',
    statusCancelled: 'Cancelled & Refunded',
    statusActivating: 'Activating',
    copyNumber: 'Copy Number',
    copied: 'Copied!',
    codeNumber: 'Verification Code #',
    codeReceived: 'Received Verification Code',
    latest: 'Latest',
    copyCode: 'Copy Code',
    openOtpPopup: 'Open Live OTP Window',
    requestAnotherSms: 'Request Another SMS',
    finishActivation: 'Finish Activation',
    cancelRefund: 'Cancel & Refund',
    showMoreOrders: 'Show More',
    showMoreEsims: 'Show More',
    showMorePayments: 'Show More',
    days: 'days',
    esimCancelledLabel: 'Cancelled & Refunded',
    esimReadyLabel: 'Active & Ready to Install',
    hideInstallData: 'Hide Installation Details',
    showInstallData: 'Show SM-DP+ & Activation Code',
    refLabel: 'Reference:',
    confirmed: 'Confirmed ✓',
  },
};

export const OrdersHistoryWorkspace: React.FC<OrdersHistoryWorkspaceProps> = ({
  lang = 'ar',
  smsOrders,
  esimOrders,
  paymentHistory,
  currency,
  rates,
  onOpenOtpModal,
  onSmsOrderAction,
}) => {
  const c = ORDERS_COPY[lang];
  const isRtl = lang === 'ar';
  const locale = lang === 'ar' ? 'ar-SY' : lang === 'tr' ? 'tr-TR' : 'en-US';

  const [category, setCategory] = useState<OrdersMainCategory>('sms');
  const [smsFilter, setSmsFilter] = useState<SmsFilterStatus>('all');
  const [esimFilter, setEsimFilter] = useState<ESimFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedESimId, setExpandedESimId] = useState<string | null>(null);

  const [smsVisible, setSmsVisible] = useState(10);
  const [esimVisible, setEsimVisible] = useState(10);
  const [paymentsVisible, setPaymentsVisible] = useState(10);

  const dynamicTexts = useMemo(() => {
    const arr: (string | undefined)[] = [];
    paymentHistory.slice(0, paymentsVisible).forEach((p) => arr.push(p.gatewayLabelAr));
    smsOrders.slice(0, smsVisible).forEach((o) => arr.push(o.countryNameAr));
    esimOrders.slice(0, esimVisible).forEach((e) => arr.push(e.countryNameAr, e.dataLabelAr));
    return arr;
  }, [paymentHistory, paymentsVisible, smsOrders, smsVisible, esimOrders, esimVisible]);

  const translateDynamic = useAutoTranslateBatch(dynamicTexts, lang);

  useEffect(() => {
    setSmsVisible(10);
    setEsimVisible(10);
    setPaymentsVisible(10);
  }, [category, smsFilter, esimFilter, searchQuery]);

  const formatPrice = (usd: number) => formatCurrencyAmount(usd, currency, rates);

  const handleCopy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const nowTs = Date.now();

  const smsClassified = useMemo(() => {
    const active: ActiveSmsOrder[] = [];
    const completed: ActiveSmsOrder[] = [];
    const cancelled: ActiveSmsOrder[] = [];

    for (const o of smsOrders) {
      const notExpired = o.expiresAt > nowTs;
      if (o.status === 'CANCELLED' || o.status === 'EXPIRED') {
        cancelled.push(o);
      } else if (o.status === 'COMPLETED') {
        completed.push(o);
      } else if (o.status === 'SMS_RECEIVED') {
        if (o.canGetAnotherSms !== false && notExpired) {
          active.push(o);
        } else {
          completed.push(o);
        }
      } else if (['WAITING_SMS', 'READY_SENT', 'WAIT_RETRY', 'WAIT_RESEND'].includes(o.status)) {
        if (notExpired) {
          active.push(o);
        } else {
          cancelled.push(o);
        }
      } else {
        completed.push(o);
      }
    }

    return { active, completed, cancelled };
  }, [smsOrders, nowTs]);

  const filteredSmsOrders = useMemo(() => {
    const base =
      smsFilter === 'active'
        ? smsClassified.active
        : smsFilter === 'completed'
        ? smsClassified.completed
        : smsFilter === 'cancelled'
        ? smsClassified.cancelled
        : smsOrders;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (o) =>
        o.serviceNameAr.toLowerCase().includes(q) ||
        o.countryNameAr.toLowerCase().includes(q) ||
        o.phoneNumber.toLowerCase().includes(q) ||
        o.activationId.toLowerCase().includes(q) ||
        (o.smsCode && o.smsCode.includes(q))
    );
  }, [smsOrders, smsClassified, smsFilter, searchQuery]);

  const esimClassified = useMemo(() => {
    const active = esimOrders.filter(
      (e) => e.status === 'ACTIVE' || e.status === 'READY_TO_INSTALL'
    );
    const cancelled = esimOrders.filter(
      (e) => e.status === 'CANCELLED' || e.status === 'EXPIRED'
    );
    return { active, cancelled };
  }, [esimOrders]);

  const filteredESimOrders = useMemo(() => {
    const base =
      esimFilter === 'active'
        ? esimClassified.active
        : esimFilter === 'cancelled'
        ? esimClassified.cancelled
        : esimOrders;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (e) =>
        e.countryNameAr.toLowerCase().includes(q) ||
        e.iccid.toLowerCase().includes(q) ||
        e.dataLabelAr.toLowerCase().includes(q)
    );
  }, [esimOrders, esimClassified, esimFilter, searchQuery]);

  return (
    <div className="space-y-4">
      <div className="cyber-glass rounded-2xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white">{c.title}</h2>
            <p className="text-xs text-slate-400">{c.subtitle}</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search
              className={`w-4 h-4 text-slate-400 absolute ${
                isRtl ? 'right-3' : 'left-3'
              } top-1/2 -translate-y-1/2 pointer-events-none`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={c.searchPlaceholder}
              className={`w-full ${
                isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
              } py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white focus:outline-none focus:border-cyan-400`}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 p-1.5 rounded-xl bg-[#070A12] border border-white/10">
          <button
            type="button"
            onClick={() => setCategory('sms')}
            className={`py-2.5 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              category === 'sms'
                ? 'bg-gradient-to-l from-indigo-600 to-cyan-600 text-white btn-solid-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span>
              {c.catSms} ({smsOrders.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCategory('esim')}
            className={`py-2.5 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              category === 'esim'
                ? 'bg-gradient-to-l from-indigo-600 to-cyan-600 text-white btn-solid-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wifi className="w-4 h-4 shrink-0" />
            <span>
              {c.catEsim} ({esimOrders.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCategory('payments')}
            className={`py-2.5 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              category === 'payments'
                ? 'bg-gradient-to-l from-indigo-600 to-cyan-600 text-white btn-solid-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>
              {c.catPayments} ({paymentHistory.length})
            </span>
          </button>
        </div>

        {category === 'sms' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              {
                id: 'all',
                label: c.smsAll,
                count: smsOrders.length,
                icon: MessageSquare,
                activeCls: 'bg-indigo-600/25 border-cyan-400/60 text-cyan-200',
              },
              {
                id: 'active',
                label: c.smsActive,
                count: smsClassified.active.length,
                icon: Clock,
                activeCls: 'bg-cyan-500/20 border-cyan-400 text-cyan-200',
              },
              {
                id: 'completed',
                label: c.smsCompleted,
                count: smsClassified.completed.length,
                icon: ShieldCheck,
                activeCls: 'bg-emerald-500/20 border-emerald-400 text-emerald-200',
              },
              {
                id: 'cancelled',
                label: c.smsCancelled,
                count: smsClassified.cancelled.length,
                icon: XCircle,
                activeCls: 'bg-rose-500/20 border-rose-400 text-rose-200',
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = smsFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSmsFilter(tab.id as SmsFilterStatus)}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? tab.activeCls
                      : 'bg-[#070A12] border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{tab.label}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-black/30 font-mono text-[11px]">
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {category === 'esim' && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'all', label: c.esimAll, count: esimOrders.length },
              { id: 'active', label: c.esimActive, count: esimClassified.active.length },
              { id: 'cancelled', label: c.esimCancelled, count: esimClassified.cancelled.length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setEsimFilter(tab.id as ESimFilterStatus)}
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                  esimFilter === tab.id
                    ? 'bg-indigo-600/25 border-cyan-400/60 text-cyan-200'
                    : 'bg-[#070A12] border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className="px-2 py-0.5 rounded-md bg-black/30 font-mono text-[11px]">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SMS Orders */}
      {category === 'sms' && (
        <div className="cyber-glass rounded-2xl p-4 space-y-3">
          {filteredSmsOrders.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">{c.emptySms}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredSmsOrders.slice(0, smsVisible).map((o) => {
                  const allCodes = getAllCodesForOrder(o);
                  const isWaiting = [
                    'WAITING_SMS',
                    'READY_SENT',
                    'WAIT_RETRY',
                    'WAIT_RESEND',
                  ].includes(o.status);
                  const isCancelled = o.status === 'CANCELLED' || o.status === 'EXPIRED';
                  const displayService = getLocalizedServiceName(
                    {
                      code: o.serviceCode,
                      nameAr: o.serviceNameAr,
                      nameEn: o.serviceNameAr,
                    },
                    lang
                  );

                  return (
                    <div
                      key={o.id}
                      className="p-3.5 rounded-xl bg-[#070A12] border border-white/10 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ServiceBrandIcon
                            code={o.serviceCode}
                            className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-extrabold text-white truncate">
                                {displayService}
                              </span>
                              <CountryFlagSvg iso2={o.iso2} className="w-4 h-3 rounded-[2px]" />
                              <span className="text-[11px] text-slate-400 truncate">
                                {translateDynamic(o.countryNameAr)}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              #{o.activationId} · {new Date(o.createdAt).toLocaleString(locale)}
                            </div>
                          </div>
                        </div>

                        <div className="text-end shrink-0">
                          <div className="text-xs font-mono font-black text-cyan-300">
                            {formatPrice(o.priceUsd)}
                          </div>
                          <span
                            className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isCancelled
                                ? 'bg-rose-500/15 text-rose-300'
                                : o.status === 'COMPLETED' ||
                                  (o.status === 'SMS_RECEIVED' && !isWaiting)
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-cyan-500/15 text-cyan-300'
                            }`}
                          >
                            {o.status === 'COMPLETED'
                              ? c.statusCompleted
                              : o.status === 'SMS_RECEIVED'
                              ? c.statusCodeArrived
                              : isCancelled
                              ? c.statusCancelled
                              : c.statusActivating}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#0B0F1A] border border-white/10">
                        <div className="font-mono text-xs font-bold text-white" dir="ltr">
                          {o.phoneNumber}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(o.phoneNumber, `ord-ph-${o.id}`)}
                          className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[11px] font-bold text-cyan-300 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === `ord-ph-${o.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedKey === `ord-ph-${o.id}` ? c.copied : c.copyNumber}</span>
                        </button>
                      </div>

                      {allCodes.length > 0 && (
                        <div className="space-y-1.5">
                          {allCodes.map((entry, idx) => (
                            <div
                              key={`${o.id}-hist-code-${idx}-${entry.code}`}
                              className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30"
                            >
                              <div className="min-w-0">
                                <div className="text-[10px] text-emerald-300 flex items-center gap-1.5">
                                  <span>
                                    {allCodes.length > 1
                                      ? `${c.codeNumber}${idx + 1}`
                                      : c.codeReceived}
                                  </span>
                                  {idx === allCodes.length - 1 && allCodes.length > 1 && (
                                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold">
                                      {c.latest}
                                    </span>
                                  )}
                                </div>
                                <div
                                  className="font-mono text-base font-black text-emerald-300"
                                  dir="ltr"
                                >
                                  {entry.code}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopy(entry.code, `ord-otp-${o.id}-${idx}`)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-black flex items-center gap-1 cursor-pointer shrink-0 btn-solid-white"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>
                                  {copiedKey === `ord-otp-${o.id}-${idx}` ? c.copied : c.copyCode}
                                </span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {(isWaiting || o.status === 'SMS_RECEIVED') && !isCancelled && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {onOpenOtpModal && (
                            <button
                              type="button"
                              onClick={onOpenOtpModal}
                              className="col-span-2 py-1.5 px-2 rounded-lg bg-gradient-to-l from-indigo-600 to-cyan-600 text-white text-[11px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer btn-solid-white"
                            >
                              <Radio className="w-3.5 h-3.5" />
                              <span>{c.openOtpPopup}</span>
                            </button>
                          )}

                          {onSmsOrderAction &&
                            o.status === 'SMS_RECEIVED' &&
                            o.canGetAnotherSms !== false && (
                              <button
                                type="button"
                                onClick={() => onSmsOrderAction(o.id, 'RETRY_3')}
                                className="py-1.5 px-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>{c.requestAnotherSms}</span>
                              </button>
                            )}
                          {onSmsOrderAction && o.status === 'SMS_RECEIVED' && (
                            <button
                              type="button"
                              onClick={() => onSmsOrderAction(o.id, 'COMPLETE_6')}
                              className={`${
                                o.canGetAnotherSms === false ? 'col-span-2' : ''
                              } py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer btn-solid-white`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{c.finishActivation}</span>
                            </button>
                          )}
                          {onSmsOrderAction && isWaiting && (
                            <button
                              type="button"
                              onClick={() => onSmsOrderAction(o.id, 'CANCEL_8')}
                              className="col-span-2 py-1.5 px-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>{c.cancelRefund}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {filteredSmsOrders.length > smsVisible && (
                <button
                  type="button"
                  onClick={() => setSmsVisible((v) => v + 10)}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-extrabold text-cyan-300 cursor-pointer"
                >
                  {c.showMoreOrders} ({filteredSmsOrders.length - smsVisible})
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* eSIM Orders */}
      {category === 'esim' && (
        <div className="cyber-glass rounded-2xl p-4 space-y-3">
          {filteredESimOrders.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">{c.emptyEsim}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredESimOrders.slice(0, esimVisible).map((e) => {
                  const isExpanded = expandedESimId === e.id;
                  const isCancelled = e.status === 'CANCELLED' || e.status === 'EXPIRED';
                  return (
                    <div
                      key={e.id}
                      className="p-3.5 rounded-xl bg-[#070A12] border border-white/10 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CountryFlagSvg iso2={e.iso2} className="w-8 h-5 rounded shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-white truncate">
                              {translateDynamic(e.countryNameAr)} — {translateDynamic(e.dataLabelAr)}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              ICCID: {e.iccid} · {e.validityDays} {c.days} ({e.networkType})
                            </div>
                          </div>
                        </div>

                        <div className="text-end shrink-0">
                          <div className="text-xs font-mono font-black text-cyan-300">
                            {formatPrice(e.priceUsd)}
                          </div>
                          <span
                            className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isCancelled
                                ? 'bg-rose-500/15 text-rose-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {isCancelled ? c.esimCancelledLabel : c.esimReadyLabel}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedESimId(isExpanded ? null : e.id)}
                        className="w-full py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-cyan-300 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>{isExpanded ? c.hideInstallData : c.showInstallData}</span>
                      </button>

                      {isExpanded && (
                        <div className="p-3 rounded-lg bg-[#0B0F1A] border border-cyan-500/30 space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-400">SM-DP+ Address:</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(e.smdpAddress, `smdp-${e.id}`)}
                              className="font-mono text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                              dir="ltr"
                            >
                              <span>{e.smdpAddress}</span>
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-400">Activation Code:</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(e.activationCode, `act-${e.id}`)}
                              className="font-mono text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer"
                              dir="ltr"
                            >
                              <span>{e.activationCode}</span>
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {filteredESimOrders.length > esimVisible && (
                <button
                  type="button"
                  onClick={() => setEsimVisible((v) => v + 10)}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-extrabold text-cyan-300 cursor-pointer"
                >
                  {c.showMoreEsims} ({filteredESimOrders.length - esimVisible})
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Payments History */}
      {category === 'payments' && (
        <div className="cyber-glass rounded-2xl p-4 space-y-3">
          {paymentHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">{c.emptyPayments}</div>
          ) : (
            <>
              <div className="space-y-2.5">
                {paymentHistory.slice(0, paymentsVisible).map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-[#070A12] border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-extrabold text-white">
                        {getCleanPaymentMethodName(p.gatewayLabelAr, lang)}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {c.refLabel} {p.referenceId} · {new Date(p.createdAt).toLocaleString(locale)}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="text-xs font-mono font-black text-emerald-400">
                        +{formatPrice(p.creditedUsd)}
                      </div>
                      <div className="text-[10px] text-slate-400">{c.confirmed}</div>
                    </div>
                  </div>
                ))}
              </div>

              {paymentHistory.length > paymentsVisible && (
                <button
                  type="button"
                  onClick={() => setPaymentsVisible((v) => v + 10)}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-extrabold text-cyan-300 cursor-pointer"
                >
                  {c.showMorePayments} ({paymentHistory.length - paymentsVisible})
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
