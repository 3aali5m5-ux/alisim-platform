import React, { useState, useEffect, useMemo } from 'react';
import {
  Copy,
  Check,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Radio,
  Sparkles,
  Play,
  ShieldCheck,
  Ban,
  BookOpen,
  MessageSquarePlus,
  KeyRound,
  Info,
  Lock,
} from 'lucide-react';
import { ActiveSmsOrder, AppLanguage, SupportedCurrency } from '../types';
import { CountryFlagSvg, ServiceBrandIcon } from './BrandVisuals';
import {
  formatCurrencyAmount,
  ExchangeRatesConfig,
  extractOtpFromText,
} from '../services/hybridSyncEngine';

interface LiveOtpPanelProps {
  lang?: AppLanguage;
  orders: ActiveSmsOrder[];
  currency: SupportedCurrency;
  rates: ExchangeRatesConfig;
  onOrderAction: (
    orderId: string,
    action: 'READY_1' | 'RETRY_3' | 'COMPLETE_6' | 'CANCEL_8'
  ) => Promise<void>;
  onSyncActiveFromGrizzly: () => Promise<void>;
  onOpenGuides?: () => void;
  compact?: boolean;
}

type OtpTabId = 'activating' | 'activated' | 'cancelled';

const TOTAL_LIFETIME_SEC = 20 * 60;

export function getAllCodesForOrder(order: ActiveSmsOrder): Array<{
  code: string;
  text: string;
  receivedAt: number;
}> {
  const list: Array<{ code: string; text: string; receivedAt: number }> = [];
  const seen = new Set<string>();

  if (Array.isArray(order.smsHistory)) {
    for (const item of order.smsHistory) {
      const code = (item.code || extractOtpFromText(item.text) || '').trim();
      if (!code) continue;
      const key = `${code}|${(item.text || '').trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          code,
          text: item.text || `OTP: ${code}`,
          receivedAt: item.receivedAt || order.createdAt,
        });
      }
    }
  }

  const latestCode = (extractOtpFromText(order.fullSmsText) || order.smsCode || '').trim();
  if (latestCode && !list.some((x) => x.code === latestCode)) {
    list.push({
      code: latestCode,
      text: order.fullSmsText || `OTP: ${latestCode}`,
      receivedAt: order.createdAt,
    });
  }

  return list;
}

const OTP_COPY: Record<
  AppLanguage,
  {
    title: string;
    subtitle: string;
    guidesTip: string;
    syncTip: string;
    tabActivating: string;
    tabActivated: string;
    tabCancelled: string;
    emptyActivatingTitle: string;
    emptyActivatedTitle: string;
    emptyCancelledTitle: string;
    emptyActivatingDesc: string;
    emptyHistoryDesc: string;
    phoneLabel: string;
    copy: string;
    copied: string;
    receivedCodes: string;
    allSaved: string;
    codePrefix: string;
    latest: string;
    waitingMorePrefix: string;
    waitingMoreSuffix: string;
    waitingFirst: string;
    simulateCode: string;
    readyBtn: string;
    retryBtn: string;
    completeBtn: string;
    cancelRefundBtn: string;
    statusWaiting: string;
    statusReady: string;
    statusRetry: string;
    statusResend: string;
    statusReceived: string;
    statusCompleted: string;
    statusCancelled: string;
    statusExpired: string;
    instructionsTitle: string;
    step1: string;
    step2: string;
    step3: string;
    cancelWaitPrefix: string;
    cancelLockTooltip: string;
  }
> = {
  ar: {
    title: 'تفعيل الأرقام الحية',
    subtitle: 'تحديث تلقائي فوري مع حفظ جميع الأكواد المستلمة',
    guidesTip: 'دليل التفعيل وإخلاء المسؤولية',
    syncTip: 'مزامنة التفعيلات النشطة',
    tabActivating: 'جاري',
    tabActivated: 'مفعّل',
    tabCancelled: 'ملغي',
    emptyActivatingTitle: 'لا توجد أرقام قيد التفعيل حالياً',
    emptyActivatedTitle: 'لا توجد أرقام مكتملة بعد',
    emptyCancelledTitle: 'لا توجد أرقام ملغاة',
    emptyActivatingDesc:
      'اختر الدولة والتطبيق من القائمة واضغط على زر الشراء ليظهر رقمك هنا مباشرة مع استلام فوري للأكواد.',
    emptyHistoryDesc: 'ستظهر هنا تفاصيل الأرقام والأكواد المستلمة محفوظة دائماً للرجوع إليها.',
    phoneLabel: 'رقم الهاتف للتفعيل',
    copy: 'نسخ',
    copied: 'نُسخ',
    receivedCodes: 'الأكواد المستلمة',
    allSaved: 'محفوظة جميعها ✓',
    codePrefix: 'الكود #',
    latest: 'الأحدث',
    waitingMorePrefix: 'بانتظار الكود #',
    waitingMoreSuffix: '(الأكواد السابقة محفوظة)...',
    waitingFirst: 'بانتظار وصول رسالة التفعيل...',
    simulateCode: 'محاكاة كود',
    readyBtn: 'جاهز للاستلام',
    retryBtn: 'طلب كود إضافي',
    completeBtn: 'إنهاء التفعيل',
    cancelRefundBtn: 'إلغاء واسترداد',
    statusWaiting: 'بانتظار الكود',
    statusReady: 'جاهز للاستلام',
    statusRetry: 'بانتظار كود إضافي',
    statusResend: 'إعادة إرسال',
    statusReceived: 'تم استلام الكود',
    statusCompleted: 'مفعّل ومكتمل',
    statusCancelled: 'ملغي ومسترد',
    statusExpired: 'منتهي الوقت',
    instructionsTitle: 'تعليمات تفعيل الرقم',
    step1: 'انسخ الرقم وأدخله في التطبيق المطلوب ثم اطلب إرسال رمز التحقق.',
    step2: 'يصل الكود تلقائياً هنا خلال ثوانٍ ويتم حفظ جميع الأكواد دون مسح السابق.',
    step3: 'إذا لم يصل الكود خلال دقيقتين يمكنك إلغاء الرقم لاسترداد كامل رصيدك فوراً.',
    cancelWaitPrefix: 'الإلغاء خلال',
    cancelLockTooltip: 'مدة تقييد الإلغاء يحددها مزود الأرقام تلقائياً حسب الدولة والسعر.',
  },
  tr: {
    title: 'Canlı Numara Doğrulama',
    subtitle: 'Anlık otomatik güncelleme · tüm kodlar kaydedilir',
    guidesTip: 'Doğrulama Rehberi ve Yasal Uyarı',
    syncTip: 'Aktif Numaraları Senkronize Et',
    tabActivating: 'Aktif',
    tabActivated: 'Onaylı',
    tabCancelled: 'İptal',
    emptyActivatingTitle: 'Şu anda aktif doğrulama yok',
    emptyActivatedTitle: 'Henüz tamamlanan numara yok',
    emptyCancelledTitle: 'İptal edilen numara yok',
    emptyActivatingDesc:
      'Listeden ülke ve uygulama seçip satın alma butonuna dokunun; numaranız anında burada görünür.',
    emptyHistoryDesc: 'Onaylanan numaralarınız ve alınan tüm kodlar burada saklanır.',
    phoneLabel: 'Doğrulama Telefon Numarası',
    copy: 'Kopyala',
    copied: 'Kopyalandı',
    receivedCodes: 'Alınan Kodlar',
    allSaved: 'Tümü kayıtlı ✓',
    codePrefix: 'Kod #',
    latest: 'En Yeni',
    waitingMorePrefix: 'Kod #',
    waitingMoreSuffix: 'bekleniyor (önceki kodlar korunur)...',
    waitingFirst: 'SMS doğrulama kodu bekleniyor...',
    simulateCode: 'Kodu Test Et',
    readyBtn: 'Alıma Hazır',
    retryBtn: 'Ek Kod İste',
    completeBtn: 'Tamamla',
    cancelRefundBtn: 'İptal ve İade',
    statusWaiting: 'Kod Bekleniyor',
    statusReady: 'Hazır',
    statusRetry: 'Ek Kod Bekleniyor',
    statusResend: 'Yeniden Gönderim',
    statusReceived: 'Kod Alındı',
    statusCompleted: 'Tamamlandı',
    statusCancelled: 'İptal ve İade Edildi',
    statusExpired: 'Süresi Doldu',
    instructionsTitle: 'Numara Doğrulama Talimatları',
    step1: 'Numarayı kopyalayıp ilgili uygulamaya girin ve SMS doğrulama kodu isteyin.',
    step2: 'Kod saniyeler içinde otomatik görünür; birden fazla kod geldiğinde eskiler silinmez.',
    step3: 'Kod 2 dakika içinde ulaşmazsa numarayı iptal ederek bakiyenizi anında geri alabilirsiniz.',
    cancelWaitPrefix: 'İptal için',
    cancelLockTooltip: 'İptal bekleme süresi numara sağlayıcısı tarafından fiyata göre belirlenir.',
  },
  en: {
    title: 'Live OTP Activations',
    subtitle: 'Auto-refreshes live · all received codes preserved',
    guidesTip: 'Activation Guide & Disclaimer',
    syncTip: 'Sync Active Numbers',
    tabActivating: 'Active',
    tabActivated: 'Done',
    tabCancelled: 'Cancelled',
    emptyActivatingTitle: 'No active numbers right now',
    emptyActivatedTitle: 'No completed activations yet',
    emptyCancelledTitle: 'No cancelled numbers',
    emptyActivatingDesc:
      'Pick a country and app from the catalog and tap Buy — your number appears here immediately.',
    emptyHistoryDesc: 'Your completed numbers and every received OTP code stay saved here.',
    phoneLabel: 'Phone Number for Verification',
    copy: 'Copy',
    copied: 'Copied',
    receivedCodes: 'Received Codes',
    allSaved: 'All saved ✓',
    codePrefix: 'Code #',
    latest: 'Latest',
    waitingMorePrefix: 'Waiting for code #',
    waitingMoreSuffix: '(previous codes kept)...',
    waitingFirst: 'Waiting for verification SMS...',
    simulateCode: 'Simulate OTP',
    readyBtn: 'Mark Ready',
    retryBtn: 'Request Extra Code',
    completeBtn: 'Complete',
    cancelRefundBtn: 'Cancel & Refund',
    statusWaiting: 'Waiting for SMS',
    statusReady: 'Ready to Receive',
    statusRetry: 'Waiting for Extra SMS',
    statusResend: 'Resending',
    statusReceived: 'Code Received',
    statusCompleted: 'Activated & Complete',
    statusCancelled: 'Cancelled & Refunded',
    statusExpired: 'Expired',
    instructionsTitle: 'Activation Instructions',
    step1: 'Copy the phone number above, enter it in your app, and request the verification SMS.',
    step2: 'Your OTP arrives automatically within seconds; multiple codes are all saved.',
    step3: 'If no SMS arrives within 2 minutes, cancel to receive an instant full wallet refund.',
    cancelWaitPrefix: 'Cancel in',
    cancelLockTooltip: 'Cancel cooldown is enforced dynamically by the upstream SMS provider.',
  },
};

export const LiveOtpPanel: React.FC<LiveOtpPanelProps> = ({
  lang = 'ar',
  orders,
  currency,
  rates,
  onOrderAction,
  onSyncActiveFromGrizzly,
  onOpenGuides,
  compact = false,
}) => {
  const c = OTP_COPY[lang] || OTP_COPY.ar;
  const locale = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-US' : 'ar-SY';
  const [activeTab, setActiveTab] = useState<OtpTabId>('activating');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const [syncing, setSyncing] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSyncActiveFromGrizzly();
    } finally {
      setSyncing(false);
    }
  };

  const handleAction = async (
    orderId: string,
    action: 'READY_1' | 'RETRY_3' | 'COMPLETE_6' | 'CANCEL_8'
  ) => {
    setBusyOrderId(`${orderId}-${action}`);
    try {
      await onOrderAction(orderId, action);
    } finally {
      setBusyOrderId(null);
    }
  };

  const categorized = useMemo(() => {
    const activating: ActiveSmsOrder[] = [];
    const activated: ActiveSmsOrder[] = [];
    const cancelled: ActiveSmsOrder[] = [];

    for (const o of orders) {
      const notExpired = o.expiresAt > nowTs;
      if (o.status === 'CANCELLED' || o.status === 'EXPIRED') {
        cancelled.push(o);
      } else if (o.status === 'COMPLETED') {
        activated.push(o);
      } else if (o.status === 'SMS_RECEIVED') {
        if (notExpired && o.canGetAnotherSms !== false) {
          activating.push(o);
        } else {
          activated.push(o);
        }
      } else if (['WAITING_SMS', 'READY_SENT', 'WAIT_RETRY', 'WAIT_RESEND'].includes(o.status)) {
        if (notExpired) {
          activating.push(o);
        } else {
          cancelled.push(o);
        }
      } else {
        activated.push(o);
      }
    }

    return { activating, activated, cancelled };
  }, [orders, nowTs]);

  const currentList =
    activeTab === 'activating'
      ? categorized.activating
      : activeTab === 'activated'
      ? categorized.activated
      : categorized.cancelled;

  const formatCountdown = (expiresAt: number) => {
    const remainingSec = Math.max(0, Math.floor((expiresAt - nowTs) / 1000));
    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;
    return {
      text: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      remainingSec,
      progress: Math.min(1, remainingSec / TOTAL_LIFETIME_SEC),
    };
  };

  const getOfficialStatusBadge = (order: ActiveSmsOrder) => {
    const map: Record<string, { label: string; cls: string }> = {
      WAITING_SMS: {
        label: c.statusWaiting,
        cls: 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300',
      },
      READY_SENT: {
        label: c.statusReady,
        cls: 'bg-indigo-500/20 border-indigo-400/40 text-indigo-300',
      },
      WAIT_RETRY: {
        label: c.statusRetry,
        cls: 'bg-amber-500/15 border-amber-400/40 text-amber-300',
      },
      WAIT_RESEND: {
        label: c.statusResend,
        cls: 'bg-amber-500/15 border-amber-400/40 text-amber-300',
      },
      SMS_RECEIVED: {
        label: c.statusReceived,
        cls: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300',
      },
      COMPLETED: {
        label: c.statusCompleted,
        cls: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300',
      },
      CANCELLED: {
        label: c.statusCancelled,
        cls: 'bg-rose-500/15 border-rose-500/40 text-rose-300',
      },
      EXPIRED: {
        label: c.statusExpired,
        cls: 'bg-rose-500/15 border-rose-500/40 text-rose-300',
      },
    };
    return (
      map[order.status] || {
        label: c.statusWaiting,
        cls: 'bg-white/10 border-white/15 text-slate-300',
      }
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-white/10 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-white truncate">{c.title}</h3>
              <p className="text-[10px] text-slate-400 truncate">{c.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onOpenGuides && (
              <button
                type="button"
                onClick={onOpenGuides}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 cursor-pointer"
                title={c.guidesTip}
              >
                <BookOpen className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-400 cursor-pointer"
              title={c.syncTip}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 3 Lifecycle Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#070A12] border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('activating')}
            className={`py-1.5 px-1.5 rounded-lg text-[11px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'activating'
                ? 'bg-gradient-to-l from-indigo-600 to-cyan-600 text-white btn-solid-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3 h-3 shrink-0" />
            <span>{c.tabActivating}</span>
            <span className="px-1 rounded bg-black/25 font-mono text-[10px]">
              {categorized.activating.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activated')}
            className={`py-1.5 px-1.5 rounded-lg text-[11px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'activated'
                ? 'bg-emerald-600 text-white btn-solid-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3 h-3 shrink-0" />
            <span>{c.tabActivated}</span>
            <span className="px-1 rounded bg-black/25 font-mono text-[10px]">
              {categorized.activated.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cancelled')}
            className={`py-1.5 px-1.5 rounded-lg text-[11px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'cancelled'
                ? 'bg-rose-600 text-white btn-solid-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Ban className="w-3 h-3 shrink-0" />
            <span>{c.tabCancelled}</span>
            <span className="px-1 rounded bg-black/25 font-mono text-[10px]">
              {categorized.cancelled.length}
            </span>
          </button>
        </div>
      </div>

      {/* Orders List (Internal Smooth Vertical Scroll) */}
      <div
        className={`p-3 space-y-3 overflow-y-auto overscroll-auto flex-1 min-h-0 ${
          compact ? 'max-h-[600px]' : ''
        }`}
      >
        {currentList.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-2.5 rounded-2xl bg-[#070A12]/70 border border-dashed border-white/10">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 text-cyan-400 flex items-center justify-center mx-auto">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="text-xs font-extrabold text-white">
              {activeTab === 'activating'
                ? c.emptyActivatingTitle
                : activeTab === 'activated'
                ? c.emptyActivatedTitle
                : c.emptyCancelledTitle}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {activeTab === 'activating' ? c.emptyActivatingDesc : c.emptyHistoryDesc}
            </p>
          </div>
        ) : (
          currentList.map((order) => {
            const countdown = formatCountdown(order.expiresAt);
            const allCodes = getAllCodesForOrder(order);
            const statusBadge = getOfficialStatusBadge(order);
            const isWaiting = [
              'WAITING_SMS',
              'READY_SENT',
              'WAIT_RETRY',
              'WAIT_RESEND',
            ].includes(order.status);
            const isCancelled = order.status === 'CANCELLED' || order.status === 'EXPIRED';
            const canRetryMore =
              (order.status === 'SMS_RECEIVED' || allCodes.length > 0) &&
              !isCancelled &&
              order.status !== 'COMPLETED' &&
              countdown.remainingSec > 0 &&
              order.canGetAnotherSms !== false;
            const ringRadius = 15;
            const ringCircumference = 2 * Math.PI * ringRadius;
            const ringOffset = ringCircumference * (1 - countdown.progress);

            return (
              <div
                key={order.id}
                className={`rounded-2xl p-3.5 border space-y-3 transition-all ${
                  allCodes.length > 0 && !isCancelled
                    ? 'bg-emerald-950/25 border-emerald-500/45'
                    : isCancelled
                    ? 'bg-rose-950/15 border-rose-500/25'
                    : 'bg-[#070A12] border-cyan-500/35'
                }`}
              >
                {/* Top Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ServiceBrandIcon
                      code={order.serviceCode}
                      className="w-9 h-9 rounded-xl shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white truncate">
                          {order.serviceNameAr}
                        </span>
                        <CountryFlagSvg iso2={order.iso2} className="w-4 h-3 rounded-[2px]" />
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {order.countryNameAr} · #{order.activationId}
                      </div>
                    </div>
                  </div>

                  {!isCancelled && order.status !== 'COMPLETED' ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="relative w-10 h-10 flex items-center justify-center">
                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 38 38">
                          <circle
                            cx="19"
                            cy="19"
                            r={ringRadius}
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="3"
                          />
                          <circle
                            cx="19"
                            cy="19"
                            r={ringRadius}
                            fill="none"
                            stroke={allCodes.length > 0 ? '#10B981' : '#22D3EE'}
                            strokeWidth="3"
                            strokeDasharray={ringCircumference}
                            strokeDashoffset={ringOffset}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute font-mono text-[9px] font-black text-white">
                          {countdown.text}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="font-mono text-xs font-black text-cyan-300 shrink-0">
                      {formatCurrencyAmount(order.priceUsd, currency, rates)}
                    </span>
                  )}
                </div>

                {/* Status Row */}
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className={`px-2 py-0.5 rounded-md border font-bold ${statusBadge.cls}`}>
                    {statusBadge.label}
                  </span>
                  <span className="font-mono font-bold text-slate-400">
                    {formatCurrencyAmount(order.priceUsd, currency, rates)}
                  </span>
                </div>

                {/* Phone Number Copy Box */}
                <div className="p-2.5 rounded-xl bg-[#0B0F1A] border border-white/10 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-400">{c.phoneLabel}</div>
                    <div
                      className="text-sm sm:text-base font-black font-mono text-white tracking-wide truncate"
                      dir="ltr"
                    >
                      {order.phoneNumber}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(order.phoneNumber, `ph-${order.id}`)}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-cyan-300 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedKey === `ph-${order.id}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === `ph-${order.id}` ? c.copied : c.copy}</span>
                  </button>
                </div>

                {/* Multi-Code Timeline (NEVER erases previous codes) */}
                {allCodes.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-black text-emerald-300 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>
                          {c.receivedCodes} ({allCodes.length})
                        </span>
                      </span>
                      {allCodes.length > 1 && (
                        <span className="text-[10px] text-cyan-300 font-bold">{c.allSaved}</span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {allCodes.map((entry, idx) => {
                        const isNewest = idx === allCodes.length - 1;
                        const copyId = `otp-${order.id}-${idx}`;
                        return (
                          <div
                            key={`${order.id}-code-${idx}-${entry.code}`}
                            className={`p-2.5 rounded-xl border space-y-1.5 ${
                              isNewest
                                ? 'bg-emerald-500/15 border-emerald-400/50'
                                : 'bg-[#0B0F1A] border-emerald-500/25'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-black">
                                  {c.codePrefix}
                                  {idx + 1}
                                </span>
                                {isNewest && allCodes.length > 1 && (
                                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-black">
                                    {c.latest}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-slate-400">
                                {new Date(entry.receivedAt).toLocaleTimeString(locale, {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span
                                className="font-mono text-lg sm:text-xl font-black text-emerald-300 tracking-widest"
                                dir="ltr"
                              >
                                {entry.code}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(entry.code, copyId)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer btn-solid-white"
                              >
                                {copiedKey === copyId ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                                <span>{copiedKey === copyId ? c.copied : c.copy}</span>
                              </button>
                            </div>

                            {entry.text && (
                              <div
                                className="text-[10px] text-slate-300 font-mono bg-black/25 p-1.5 rounded-lg break-words"
                                dir="ltr"
                              >
                                {entry.text}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Waiting Radar Banner */}
                {isWaiting && !isCancelled && (
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 radar-dot shrink-0" />
                      <span className="text-[11px] text-cyan-200 font-bold truncate">
                        {order.status === 'WAIT_RETRY' || allCodes.length > 0
                          ? `${c.waitingMorePrefix}${allCodes.length + 1} ${c.waitingMoreSuffix}`
                          : c.waitingFirst}
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Controls */}
                {!isCancelled && order.status !== 'COMPLETED' && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {order.status === 'WAITING_SMS' && (
                      <button
                        type="button"
                        disabled={busyOrderId === `${order.id}-READY_1`}
                        onClick={() => handleAction(order.id, 'READY_1')}
                        className="px-2.5 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-400/35 text-indigo-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span>{c.readyBtn}</span>
                      </button>
                    )}

                    {canRetryMore && (
                      <button
                        type="button"
                        disabled={busyOrderId === `${order.id}-RETRY_3`}
                        onClick={() => handleAction(order.id, 'RETRY_3')}
                        className="px-2.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 text-amber-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5 shrink-0" />
                        <span>{c.retryBtn}</span>
                      </button>
                    )}

                    {allCodes.length > 0 && (
                      <button
                        type="button"
                        disabled={busyOrderId === `${order.id}-COMPLETE_6`}
                        onClick={() => handleAction(order.id, 'COMPLETE_6')}
                        className="px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer btn-solid-white"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{c.completeBtn}</span>
                      </button>
                    )}

                    {allCodes.length === 0 && (() => {
                      const lockRemainingSec = order.cancelAvailableAt
                        ? Math.max(0, Math.ceil((order.cancelAvailableAt - nowTs) / 1000))
                        : 0;
                      const isLocked = lockRemainingSec > 0;
                      const lockMins = Math.floor(lockRemainingSec / 60);
                      const lockSecs = lockRemainingSec % 60;
                      const lockLabel =
                        lockMins > 0
                          ? `${lockMins}:${String(lockSecs).padStart(2, '0')}`
                          : `${lockSecs}${lang === 'ar' ? 'ث' : 's'}`;
                      return (
                        <button
                          type="button"
                          disabled={isLocked || busyOrderId === `${order.id}-CANCEL_8`}
                          onClick={() => handleAction(order.id, 'CANCEL_8')}
                          title={isLocked ? c.cancelLockTooltip : c.cancelRefundBtn}
                          className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-colors ${
                            isLocked
                              ? 'bg-slate-800/70 border-white/10 text-slate-400 cursor-not-allowed'
                              : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-300 cursor-pointer'
                          }`}
                        >
                          {isLocked ? (
                            <Lock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span className="font-mono tabular-nums">
                            {isLocked ? `${c.cancelWaitPrefix} ${lockLabel}` : c.cancelRefundBtn}
                          </span>
                        </button>
                      );
                    })()}
                  </div>
                )}

                {/* Activation Instructions Card Directly Below Created Active Number */}
                {!isCancelled && order.status !== 'COMPLETED' && (
                  <div className="p-2.5 rounded-xl bg-[#0B0F1A]/90 border border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold text-cyan-300 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        <span>{c.instructionsTitle}</span>
                      </span>
                      {onOpenGuides && (
                        <button
                          type="button"
                          onClick={onOpenGuides}
                          className="text-[10px] font-bold text-slate-400 hover:text-cyan-300 underline cursor-pointer"
                        >
                          {c.guidesTip}
                        </button>
                      )}
                    </div>
                    <ol className="space-y-1 text-[10px] text-slate-300 leading-relaxed list-decimal list-inside">
                      <li>{c.step1}</li>
                      <li>{c.step2}</li>
                      <li>{c.step3}</li>
                    </ol>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
