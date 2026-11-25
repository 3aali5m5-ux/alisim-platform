import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Wallet,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  CreditCard,
  ShieldCheck,
  Sparkles,
  QrCode,
  Zap,
  Upload,
  X,
  Image as ImageIcon,
  ZoomIn,
  FileText,
  Ticket,
  Lock,
  RefreshCw,
  Timer,
} from 'lucide-react';
import {
  PaymentTransaction,
  PlatformSettings,
  SupportedCurrency,
  PaymentGatewayConfig,
  TopUpOrderRequest,
  AppLanguage,
  PaymentGatewayCustomField,
  PaymentInvoice,
  AutomatedInvoiceGateway,
} from '../types';
import {
  formatCurrencyAmount,
  convertCurrencyToUsd,
  ExchangeRatesConfig,
} from '../services/hybridSyncEngine';
import { t } from '../i18n';
import {
  useAutoTranslateBatch,
  getCleanPaymentMethodName,
} from '../services/dynamicTranslator';

interface WalletWorkspaceProps {
  lang?: AppLanguage;
  authToken?: string | null;
  walletUsd: number;
  currency: SupportedCurrency;
  rates: ExchangeRatesConfig;
  settings: PlatformSettings;
  paymentGateways: PaymentGatewayConfig[];
  topUpRequests: TopUpOrderRequest[];
  paymentHistory: PaymentTransaction[];
  onSubmitTopUpRequest: (payload: {
    gateway: PaymentGatewayConfig;
    referenceId: string;
    amountOriginal: number;
    currencyOriginal: SupportedCurrency;
    receiptImageUrl?: string;
    customFieldValues?: Record<string, string>;
  }) => Promise<{ ok: boolean; message: string; isAutoVerified?: boolean }>;
  onInvoicePaid?: (payload: {
    transaction: PaymentTransaction;
    walletUsd: number;
    message: string;
  }) => void;
  onRedeemVoucher?: (
    code: string
  ) => Promise<{ ok: boolean; message: string; creditedUsd?: number }>;
  onRequireAuth?: () => void;
  transferMemoTag?: string;
}

const MAX_RECEIPT_RAW_BYTES = 10 * 1024 * 1024; // Allow up to 10MB raw phone photo before client compression
const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

function compressReceiptImageToDataUrl(file: File): Promise<{
  dataUrl: string;
  originalKb: number;
  compressedKb: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('READ_FAILED'));
    reader.onload = () => {
      const rawSrc = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('DECODE_FAILED'));
      img.onload = () => {
        const maxDim = 1280;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.max(1, Math.round(w * ratio));
          h = Math.max(1, Math.round(h * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            dataUrl: rawSrc,
            originalKb: Math.max(1, Math.round(file.size / 1024)),
            compressedKb: Math.max(1, Math.round(file.size / 1024)),
          });
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        // Try WebP first for smallest footprint, fallback to JPEG
        let compressed = canvas.toDataURL('image/webp', 0.76);
        if (!compressed.startsWith('data:image/webp')) {
          compressed = canvas.toDataURL('image/jpeg', 0.78);
        }
        // If still large (> 650KB base64), compress slightly harder
        if (compressed.length > 900_000) {
          compressed = canvas.toDataURL('image/jpeg', 0.62);
        }
        const approxBytes = Math.round((compressed.length * 3) / 4);
        resolve({
          dataUrl: compressed,
          originalKb: Math.max(1, Math.round(file.size / 1024)),
          compressedKb: Math.max(1, Math.round(approxBytes / 1024)),
        });
      };
      img.src = rawSrc;
    };
    reader.readAsDataURL(file);
  });
}

function getFieldLabel(
  field: PaymentGatewayCustomField,
  lang: AppLanguage,
  translateCms: (text: string | undefined) => string
): string {
  if (lang === 'tr' && field.labelTr) return field.labelTr;
  if (lang === 'en' && field.labelEn) return field.labelEn;
  const raw = field.labelAr || field.labelEn || field.labelTr || '';
  return translateCms(raw);
}

export const WalletWorkspace: React.FC<WalletWorkspaceProps> = ({
  lang = 'ar',
  authToken,
  walletUsd,
  currency,
  rates,
  settings,
  paymentGateways,
  topUpRequests,
  paymentHistory,
  onSubmitTopUpRequest,
  onInvoicePaid,
  onRedeemVoucher,
  onRequireAuth,
  transferMemoTag,
}) => {
  const enabledGateways = useMemo(
    () => paymentGateways.filter((g) => g.isEnabled),
    [paymentGateways]
  );

  // Batch auto-translate all Admin-configured Arabic gateway strings, instructions, custom fields & history
  const textsToTranslate = useMemo(() => {
    const list: (string | undefined)[] = [];
    for (const gw of enabledGateways) {
      list.push(gw.nameAr, gw.instructionsAr, gw.accountHolder);
      for (const f of gw.customFields || []) {
        list.push(f.labelAr, f.placeholder);
      }
    }
    for (const r of topUpRequests.slice(0, 15)) {
      list.push(r.gatewayNameAr, r.rejectionReason);
    }
    for (const p of paymentHistory.slice(0, 15)) {
      list.push(p.gatewayLabelAr);
    }
    return list;
  }, [enabledGateways, topUpRequests, paymentHistory]);

  const translateCms = useAutoTranslateBatch(textsToTranslate, lang);

  const [selectedGatewayId, setSelectedGatewayId] = useState<string>(
    enabledGateways[0]?.id || ''
  );
  const [referenceId, setReferenceId] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [receiptDataUrl, setReceiptDataUrl] = useState<string>('');
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [receiptCompressionMeta, setReceiptCompressionMeta] = useState<{
    originalKb: number;
    compressedKb: number;
  } | null>(null);
  const [compressingReceipt, setCompressingReceipt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; title: string } | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);

  // Temporary Exact-Amount Invoice state (Binance Pay, USDT-TRC20, USDT-BEP20)
  const [activeInvoice, setActiveInvoice] = useState<PaymentInvoice | null>(null);
  const [invoiceAmountInput, setInvoiceAmountInput] = useState('10');
  const [invoiceRefInput, setInvoiceRefInput] = useState('');
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [verifyingInvoice, setVerifyingInvoice] = useState(false);
  const [cancellingInvoice, setCancellingInvoice] = useState(false);
  const [invoiceFeedback, setInvoiceFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Gift Card / Voucher Redemption state
  const [voucherCode, setVoucherCode] = useState('');
  const [redeemingVoucher, setRedeemingVoucher] = useState(false);
  const [voucherFeedback, setVoucherFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const selectedGateway = useMemo(
    () => enabledGateways.find((g) => g.id === selectedGatewayId) || enabledGateways[0],
    [enabledGateways, selectedGatewayId]
  );

  const isInvoiceGateway = Boolean(
    selectedGateway &&
      (selectedGateway.code === 'binance' ||
        selectedGateway.code === 'usdt_trc20' ||
        selectedGateway.code === 'usdt_bep20')
  );

  const isAutomatedGateway = Boolean(
    selectedGateway &&
      (isInvoiceGateway || selectedGateway.isAutomated === true) &&
      selectedGateway.code !== 'shamcash' &&
      selectedGateway.code !== 'syriatel'
  );

  const showReceiptUploader = Boolean(
    selectedGateway && (selectedGateway.allowReceiptUpload !== false || !isAutomatedGateway)
  );
  const receiptIsRequired = Boolean(selectedGateway?.requireReceiptUpload);

  const fetchActiveInvoiceForGateway = useCallback(
    async (gwCode: AutomatedInvoiceGateway) => {
      try {
        const res = await fetch(
          `/api/payments/invoice/active?gateway=${encodeURIComponent(gwCode)}`,
          {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        setActiveInvoice(data.invoice || null);
      } catch {
        // ignore network hiccup
      }
    },
    [authToken]
  );

  useEffect(() => {
    if (
      selectedGateway &&
      (selectedGateway.code === 'binance' ||
        selectedGateway.code === 'usdt_trc20' ||
        selectedGateway.code === 'usdt_bep20')
    ) {
      fetchActiveInvoiceForGateway(selectedGateway.code as AutomatedInvoiceGateway);
    } else {
      setActiveInvoice(null);
    }
  }, [selectedGateway?.code, fetchActiveInvoiceForGateway]);

  // Live 1-second countdown ticker while an active invoice is open
  useEffect(() => {
    if (!activeInvoice || activeInvoice.status !== 'PENDING') return;
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeInvoice]);

  const invoiceRemainingSec = useMemo(() => {
    if (!activeInvoice || activeInvoice.status !== 'PENDING') return 0;
    return Math.max(0, Math.floor((activeInvoice.expiresAt - nowTick) / 1000));
  }, [activeInvoice, nowTick]);

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGateway || !isInvoiceGateway) return;
    const num = Number(invoiceAmountInput);
    if (!Number.isFinite(num) || num < 1 || num > 10000) {
      setInvoiceFeedback({
        type: 'error',
        text:
          lang === 'tr'
            ? 'Lütfen 1 ile 10.000 USDT arasında geçerli bir tutar girin.'
            : lang === 'en'
            ? 'Please enter a valid amount between 1 and 10,000 USDT.'
            : 'يرجى إدخال مبلغ شحن صحيح بين 1 و 10,000 USDT.',
      });
      return;
    }

    setCreatingInvoice(true);
    setInvoiceFeedback(null);
    try {
      const res = await fetch('/api/payments/invoice/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          gateway: selectedGateway.code,
          amountUsd: num,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInvoiceFeedback({
          type: 'error',
          text: data.error || 'تعذر إنشاء الإشعار المؤقت حالياً.',
        });
        return;
      }
      setActiveInvoice(data.invoice);
      setInvoiceRefInput('');
      setNowTick(Date.now());
    } catch {
      setInvoiceFeedback({
        type: 'error',
        text: 'تعذر الاتصال بالخادم لإنشاء الإشعار المؤقت.',
      });
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!activeInvoice) return;
    setCancellingInvoice(true);
    setInvoiceFeedback(null);
    try {
      await fetch(`/api/payments/invoice/${encodeURIComponent(activeInvoice.id)}/cancel`, {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
      setActiveInvoice(null);
      setInvoiceRefInput('');
    } finally {
      setCancellingInvoice(false);
    }
  };

  const handleVerifyInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoice) return;

    const cleanRef = invoiceRefInput.trim();
    if (activeInvoice.gateway === 'binance' && cleanRef.length < 6) {
      setInvoiceFeedback({
        type: 'error',
        text:
          lang === 'tr'
            ? 'Lütfen Binance Pay işlem/sipariş numarasını (Order ID) yapıştırın.'
            : lang === 'en'
            ? 'Please paste the Binance Pay Order ID / Transaction ID.'
            : 'يرجى لصق رمز العملية (Order ID / Transaction ID) من تطبيق Binance Pay.',
      });
      return;
    }
    if (activeInvoice.gateway === 'usdt_bep20' && !/^0x[a-fA-F0-9]{64}$/.test(cleanRef)) {
      setInvoiceFeedback({
        type: 'error',
        text:
          lang === 'tr'
            ? 'Lütfen geçerli bir BEP20 TxHash girin (0x ile başlayan 66 karakter).'
            : lang === 'en'
            ? 'Please paste a valid BEP20 TxHash (starts with 0x, 66 characters).'
            : 'يرجى لصق رمز المعاملة (TxHash) الصحيح لشبكة BEP20 (يبدأ بـ 0x وطوله 66 محرفاً).',
      });
      return;
    }

    setVerifyingInvoice(true);
    setInvoiceFeedback(null);
    try {
      const res = await fetch(
        `/api/payments/invoice/${encodeURIComponent(activeInvoice.id)}/verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            referenceId: cleanRef || undefined,
            txHash: cleanRef || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'INVOICE_EXPIRED') {
          setActiveInvoice(null);
        }
        setInvoiceFeedback({
          type: 'error',
          text: data.error || 'لم يتم العثور على مطابقة بعد، حاول بعد ثوانٍ.',
        });
        return;
      }

      setActiveInvoice(null);
      setInvoiceRefInput('');
      setInvoiceFeedback({
        type: 'success',
        text: data.message || 'تم التحقق وشحن رصيدك فوراً بنجاح!',
      });
      if (data.transaction && typeof data.walletUsd === 'number') {
        onInvoicePaid?.({
          transaction: data.transaction,
          walletUsd: data.walletUsd,
          message: data.message || 'تم شحن الرصيد بنجاح!',
        });
      }
    } catch {
      setInvoiceFeedback({
        type: 'error',
        text: 'تعذر الاتصال بخادم التحقق حالياً، يرجى المحاولة مرة أخرى.',
      });
    } finally {
      setVerifyingInvoice(false);
    }
  };

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleSelectGateway = (gwId: string) => {
    setSelectedGatewayId(gwId);
    setCustomValues({});
    setReceiptDataUrl('');
    setReceiptFileName('');
    setReceiptCompressionMeta(null);
    setFeedback(null);
    setInvoiceFeedback(null);
  };

  const handleReceiptPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_IMAGE_MIME.includes(file.type)) {
      setFeedback({
        type: 'error',
        text:
          lang === 'tr'
            ? 'Yalnızca PNG, JPG veya WEBP görsel formatları desteklenir.'
            : lang === 'en'
            ? 'Only PNG, JPG, or WEBP image files are supported.'
            : 'يُسمح فقط برفع صور بصيغة PNG أو JPG أو WEBP.',
      });
      return;
    }
    if (file.size > MAX_RECEIPT_RAW_BYTES) {
      setFeedback({
        type: 'error',
        text:
          lang === 'tr'
            ? 'Dekont görseli 10MB boyutunu aşmamalıdır.'
            : lang === 'en'
            ? 'Receipt image must be smaller than 10MB.'
            : 'يجب ألا يتجاوز حجم صورة الإشعار الأصلية 10 ميغابايت.',
      });
      return;
    }

    setCompressingReceipt(true);
    setFeedback(null);
    try {
      const { dataUrl, originalKb, compressedKb } = await compressReceiptImageToDataUrl(file);
      if (dataUrl.startsWith('data:image/')) {
        setReceiptDataUrl(dataUrl);
        setReceiptFileName(file.name);
        setReceiptCompressionMeta({ originalKb, compressedKb });
      }
    } catch {
      setFeedback({
        type: 'error',
        text:
          lang === 'tr'
            ? 'Görsel işlenirken bir hata oluştu, lütfen başka bir görsel seçin.'
            : lang === 'en'
            ? 'Failed to process receipt image. Please pick another file.'
            : 'تعذر معالجة وضغط صورة الإشعار، يرجى اختيار صورة أخرى.',
      });
    } finally {
      setCompressingReceipt(false);
    }
  };

  const handleRedeemVoucherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onRedeemVoucher) return;
    if (!authToken) {
      onRequireAuth?.();
      return;
    }
    const clean = voucherCode.trim().toUpperCase();
    if (clean.length < 4) {
      setVoucherFeedback({
        type: 'error',
        text:
          lang === 'tr'
            ? 'Lütfen geçerli bir kupon kodu girin.'
            : lang === 'en'
            ? 'Please enter a valid voucher code.'
            : 'يرجى إدخال كود قسيمة الشحن بشكل صحيح.',
      });
      return;
    }
    setRedeemingVoucher(true);
    setVoucherFeedback(null);
    try {
      const res = await onRedeemVoucher(clean);
      if (res.ok) {
        setVoucherCode('');
        setVoucherFeedback({ type: 'success', text: res.message });
      } else {
        setVoucherFeedback({ type: 'error', text: res.message });
      }
    } finally {
      setRedeemingVoucher(false);
    }
  };

  const estimatedUsd = useMemo(() => {
    if (!selectedGateway) return 0;
    const val = Number(amountInput);
    if (!Number.isFinite(val) || val <= 0) return 0;
    return convertCurrencyToUsd(val, selectedGateway.currency, rates);
  }, [amountInput, selectedGateway, rates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGateway) return;

    const numAmount = Number(amountInput);
    const cleanSelectedName = getCleanPaymentMethodName(selectedGateway.nameAr, lang);
    if (!Number.isFinite(numAmount) || numAmount < selectedGateway.minTopUpAmount) {
      setFeedback({
        type: 'error',
        text:
          lang === 'tr'
            ? `${cleanSelectedName} ile minimum yükleme tutarı ${selectedGateway.minTopUpAmount.toLocaleString('en-US')} ${selectedGateway.currency}.`
            : lang === 'en'
            ? `Minimum top-up amount via ${cleanSelectedName} is ${selectedGateway.minTopUpAmount.toLocaleString('en-US')} ${selectedGateway.currency}.`
            : `الحد الأدنى للشحن عبر ${cleanSelectedName} هو ${selectedGateway.minTopUpAmount.toLocaleString('en-US')} ${selectedGateway.currency}.`,
      });
      return;
    }

    if (referenceId.trim().length < 4) {
      setFeedback({
        type: 'error',
        text:
          lang === 'tr'
            ? 'Lütfen geçerli bir işlem / referans numarası girin (en az 4 karakter).'
            : lang === 'en'
            ? 'Please enter a valid transaction / reference ID (at least 4 characters).'
            : 'يرجى إدخال رقم عملية التحويل / الإشعار بشكل صحيح (4 محارف على الأقل).',
      });
      return;
    }

    // Validate required custom fields configured by Admin
    const fields = selectedGateway.customFields || [];
    const collectedCustom: Record<string, string> = {};
    for (const f of fields) {
      const val = (customValues[f.id] || '').trim();
      if (f.required && !val) {
        const label = getFieldLabel(f, lang, translateCms);
        setFeedback({
          type: 'error',
          text:
            lang === 'tr'
              ? `Lütfen zorunlu alanı doldurun: ${label}`
              : lang === 'en'
              ? `Please fill in the required field: ${label}`
              : `يرجى ملء الحقل المطلوب: ${label}`,
        });
        return;
      }
      if (val) {
        collectedCustom[f.labelAr || f.labelEn || f.id] = val;
      }
    }

    // Validate required receipt upload
    if (showReceiptUploader && receiptIsRequired && !receiptDataUrl) {
      setFeedback({
        type: 'error',
        text:
          lang === 'tr'
            ? 'Bu ödeme yöntemi için ödeme dekontu yüklemek zorunludur.'
            : lang === 'en'
            ? 'Uploading a payment receipt screenshot is required for this payment method.'
            : 'يرجى رفع صورة إشعار الدفع لتأكيد عملية الشحن عبر هذه الطريقة.',
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await onSubmitTopUpRequest({
        gateway: selectedGateway,
        referenceId: referenceId.trim(),
        amountOriginal: numAmount,
        currencyOriginal: selectedGateway.currency,
        receiptImageUrl: receiptDataUrl || undefined,
        customFieldValues: Object.keys(collectedCustom).length > 0 ? collectedCustom : undefined,
      });

      if (res.ok) {
        setFeedback({ type: 'success', text: res.message });
        setReferenceId('');
        setAmountInput('');
        setCustomValues({});
        setReceiptDataUrl('');
        setReceiptFileName('');
        setReceiptCompressionMeta(null);
      } else {
        setFeedback({ type: 'error', text: res.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Lightbox Modal for QR or Receipt Zoom */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cyber-glass rounded-2xl p-4 max-w-md w-full space-y-3 border border-cyan-500/40"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-white">{lightboxImage.title}</h4>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1.5 rounded-lg bg-white/10 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-white rounded-xl p-3 flex items-center justify-center">
              <img
                src={lightboxImage.src}
                alt={lightboxImage.title}
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Wallet Hero Card */}
      <div className="cyber-glass android-card rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-cyan-500/25">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-bold">{t(lang, 'wallet_balance')}</div>
            <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-white mt-0.5">
              {formatCurrencyAmount(walletUsd, currency, rates)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 self-start sm:self-center">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{t(lang, 'wallet_subtitle')}</span>
        </div>
      </div>

      {/* Instant Gift Card / Voucher Redemption Card */}
      {onRedeemVoucher && (
        <div className="cyber-glass android-card rounded-2xl p-4 border border-indigo-500/30 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-sm shrink-0">
                <Ticket className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-white">
                  {lang === 'tr'
                    ? 'Hediye Kartı / Bakiye Kuponu Kullan'
                    : lang === 'en'
                    ? 'Redeem Gift Card / Voucher Code'
                    : 'شحن فوري عبر قسيمة الشحن (Voucher)'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {lang === 'tr'
                    ? 'Yöneticiden veya bayilerden aldığınız kupon kodunu girerek bakiyenizi anında yükleyin.'
                    : lang === 'en'
                    ? 'Enter a voucher code from resellers or promos to credit your wallet instantly.'
                    : 'أدخل كود القسيمة المستلم من الإدارة أو الوكلاء لإضافة الرصيد لمحفظتك فوراً.'}
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleRedeemVoucherSubmit}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
          >
            <input
              type="text"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              placeholder="ALIS-XXXX-XXXX"
              dir="ltr"
              className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm font-mono tracking-wider uppercase rounded-xl bg-[#070A12] border border-white/15 text-white focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={redeemingVoucher}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {!authToken ? <Lock className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
              <span>
                {redeemingVoucher
                  ? '...'
                  : !authToken
                  ? lang === 'tr'
                    ? 'Giriş Yap ve Kullan'
                    : lang === 'en'
                    ? 'Sign in to Redeem'
                    : 'سجّل الدخول للتفعيل'
                  : lang === 'tr'
                  ? 'Kuponu Aktifleştir'
                  : lang === 'en'
                  ? 'Redeem Now'
                  : 'تفعيل القسيمة الآن'}
              </span>
            </button>
          </form>

          {voucherFeedback && (
            <div
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                voucherFeedback.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
              }`}
            >
              {voucherFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{voucherFeedback.text}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Split: Gateways Selector + Transfer/Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Available Payment Gateways */}
        <div className="lg:col-span-5 cyber-glass android-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-cyan-400" />
              <span>{t(lang, 'select_payment_method')}</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              {enabledGateways.length}
            </span>
          </div>

          <div className="space-y-2">
            {enabledGateways.map((gw) => {
              const isSelected = selectedGateway?.id === gw.id;
              const cleanName = getCleanPaymentMethodName(gw.nameAr, lang);

              return (
                <button
                  key={gw.id}
                  type="button"
                  onClick={() => handleSelectGateway(gw.id)}
                  className={`w-full p-3 rounded-xl border text-start transition-all cursor-pointer flex items-center gap-3 active:scale-[0.99] ${
                    isSelected
                      ? 'bg-indigo-600/20 border-cyan-400 text-white shadow-md'
                      : 'bg-[#070A12] border-white/10 text-slate-300 hover:border-indigo-500/40'
                  }`}
                >
                  {gw.iconUrl ? (
                    <img
                      src={gw.iconUrl}
                      alt={cleanName}
                      className="w-10 h-10 rounded-xl object-cover border border-white/15 bg-white/5 shrink-0"
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                        gw.code === 'binance'
                          ? 'bg-[#F3BA2F] text-slate-950'
                          : gw.code === 'usdt_trc20'
                          ? 'bg-emerald-500 text-slate-950'
                          : gw.code === 'usdt_bep20'
                          ? 'bg-amber-400 text-slate-950'
                          : gw.code === 'shamcash'
                          ? 'bg-emerald-600 text-white'
                          : gw.code === 'syriatel'
                          ? 'bg-rose-600 text-white'
                          : 'bg-gradient-to-br from-indigo-600 to-cyan-500 text-white'
                      }`}
                    >
                      <Wallet className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-extrabold truncate">
                      {cleanName}
                    </div>
                  </div>
                  {(gw.code === 'binance' ||
                    gw.code === 'usdt_trc20' ||
                    gw.code === 'usdt_bep20') && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 shrink-0">
                      {lang === 'tr' ? 'Anında' : lang === 'en' ? 'Instant' : 'تلقائي فوري'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Gateway Transfer Details, QR Image, Instructions, Dynamic Fields & Receipt Upload */}
        {selectedGateway && (
          <div className="lg:col-span-7 cyber-glass android-card rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                {selectedGateway.iconUrl ? (
                  <img
                    src={selectedGateway.iconUrl}
                    alt={getCleanPaymentMethodName(selectedGateway.nameAr, lang)}
                    className="w-9 h-9 rounded-xl object-cover border border-white/15 shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shrink-0">
                    <QrCode className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-white truncate">
                    {getCleanPaymentMethodName(selectedGateway.nameAr, lang)}
                  </h3>
                  <p className="text-[11px] text-slate-400">{t(lang, 'transfer_details')}</p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 font-mono text-xs font-extrabold shrink-0">
                {selectedGateway.currency}
              </span>
            </div>

            {/* AUTOMATED 2-STEP TEMPORARY EXACT-AMOUNT INVOICE FLOW (Binance Pay, USDT-TRC20, USDT-BEP20) */}
            {isInvoiceGateway ? (
              <div className="space-y-4">
                {selectedGateway.code === 'binance' && settings.hasBinanceApiKeys === false && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/35 text-[11px] text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      {lang === 'tr'
                        ? 'Binance API anahtarları henüz sunucu ayarlarında tanımlanmamış. Yönetici anahtarları eklediğinde otomatik onay aktifleşecektir.'
                        : lang === 'en'
                        ? 'Binance API keys are not yet configured in server Secrets. Instant verification activates automatically once configured by the Admin.'
                        : 'تنبيه: مفاتيح Binance API لم تُضف في إعدادات الخادم (Secrets) بعد. يمكنك تجربة توليد الإشعار المؤقت، وسيتفعّل التحقق التلقائي الفوري فور إضافة المفاتيح من المدير.'}
                    </span>
                  </div>
                )}

                {!activeInvoice || activeInvoice.gateway !== selectedGateway.code ? (
                  /* STEP 1: Enter Amount & Generate 20-Minute Exact-Amount Temporary Invoice */
                  <form onSubmit={handleCreateInvoice} className="space-y-4">
                    <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-400/30 text-xs text-slate-200 space-y-1.5">
                      <div className="font-black text-cyan-300 flex items-center gap-1.5">
                        <Zap className="w-4 h-4" />
                        <span>
                          {lang === 'tr'
                            ? 'Otomatik Geçici Fatura Nasıl Çalışır?'
                            : lang === 'en'
                            ? 'How the Instant Temporary Invoice Works:'
                            : 'كيف يعمل نظام الإشعار المؤقت بالمبلغ الدقيق؟'}
                        </span>
                      </div>
                      <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300 leading-relaxed">
                        <li>
                          {lang === 'tr'
                            ? 'Yüklemek istediğiniz tutarı girin; sistem 20 dakikalık benzersiz küsüratlı bir fatura (örn. 10.07 USDT) oluşturur.'
                            : lang === 'en'
                            ? 'Enter your desired amount — the system creates a 20-minute temporary invoice with a unique exact decimal (e.g., 10.07 USDT).'
                            : 'أدخل المبلغ المطلوب؛ سيولّد النظام إشعاراً مؤقتاً لمدة 20 دقيقة بمبلغ دقيق وفريد (مثلاً 10.07 USDT).'}
                        </li>
                        <li>
                          {selectedGateway.code === 'binance'
                            ? lang === 'tr'
                              ? 'Binance Pay üzerinden tam tutarı verilen ID’ye gönderin ve İşlem/Sipariş Numarasını (Order ID) kopyalayın.'
                              : lang === 'en'
                              ? 'Send the EXACT amount to the displayed Binance Pay ID and copy the Order ID / Transaction ID.'
                              : 'حوّل المبلغ الدقيق بالضبط إلى Binance Pay ID الظاهر في الإشعار وانسخ رمز العملية (Order ID).'
                            : lang === 'tr'
                            ? 'Net tutarın tam olarak ulaşması için ağ komisyonunu dikkate alarak verilen cüzdan adresine gönderin.'
                            : lang === 'en'
                            ? 'Send USDT so the exact net received amount matches the invoice on-chain.'
                            : 'حوّل المبلغ إلى عنوان المحفظة بحيث يصل صافي المبلغ مطابقاً تماماً لقيمة الإشعار.'}
                        </li>
                        <li>
                          {lang === 'tr'
                            ? 'İşlem kodunu yapıştırıp "Doğrula" butonuna basın; bakiyeniz anında hesabınıza tanımlanır.'
                            : lang === 'en'
                            ? 'Paste the reference / TxHash and click Verify — your exact amount is credited immediately.'
                            : 'الصق رمز العملية / TxHash في الإشعار واضغط "تحقق وشحن فوراً" ليضاف الرصيد لمحفظتك مباشرة!'}
                        </li>
                      </ol>
                    </div>

                    {/* Quick Amount Presets */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 block">
                        {lang === 'tr'
                          ? 'Yükleme Tutarı (USDT) *'
                          : lang === 'en'
                          ? 'Top-Up Amount (USDT) *'
                          : 'أدخل مبلغ الشحن المطلوب (USDT) *'}
                      </label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[5, 10, 25, 50, 100].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setInvoiceAmountInput(String(preset))}
                            className={`py-2 rounded-xl text-xs font-mono font-black border transition-all cursor-pointer ${
                              Number(invoiceAmountInput) === preset
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                                : 'bg-[#070A12] border-white/10 text-slate-300 hover:border-cyan-500/40'
                            }`}
                          >
                            ${preset}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        max="10000"
                        required
                        value={invoiceAmountInput}
                        onChange={(e) => setInvoiceAmountInput(e.target.value)}
                        placeholder="10"
                        dir="ltr"
                        className="w-full px-3.5 py-2.5 text-sm font-mono font-bold rounded-xl bg-[#070A12] border border-white/15 text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    {invoiceFeedback && (
                      <div
                        className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                          invoiceFeedback.type === 'success'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                        }`}
                      >
                        {invoiceFeedback.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0" />
                        )}
                        <span>{invoiceFeedback.text}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={creatingInvoice}
                      className="w-full py-3 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99] cursor-pointer disabled:opacity-50 btn-solid-white"
                    >
                      <Timer className="w-4 h-4" />
                      <span>
                        {creatingInvoice
                          ? '...'
                          : lang === 'tr'
                          ? 'Geçici Ödeme Faturası Oluştur (20 Dakika)'
                          : lang === 'en'
                          ? 'Generate Temporary Payment Invoice (20 Min)'
                          : 'إنشاء إشعار شحن مؤقت بالمبلغ الدقيق (20 دقيقة)'}
                      </span>
                    </button>
                  </form>
                ) : (
                  /* STEP 2: Active Waiting Temporary Invoice with Countdown & Exact-Amount Strict Warning */
                  <div className="space-y-4">
                    {/* Header: Invoice ID + Live Countdown */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-[#070A12] border border-cyan-500/35">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-xs font-black text-white">
                          {lang === 'tr'
                            ? 'Aktif Geçici Fatura'
                            : lang === 'en'
                            ? 'Active Temporary Invoice'
                            : 'إشعار شحن مؤقت بانتظار التحويل'}
                        </span>
                        <code className="px-2 py-0.5 rounded bg-white/10 text-[11px] font-mono text-cyan-300">
                          {activeInvoice.id}
                        </code>
                      </div>

                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-300 font-mono text-xs font-black">
                        <Clock className="w-3.5 h-3.5" />
                        <span dir="ltr">
                          {invoiceRemainingSec > 0 ? formatCountdown(invoiceRemainingSec) : '00:00'}
                        </span>
                      </div>
                    </div>

                    {/* STRICT EXACT-AMOUNT WARNING BANNER */}
                    <div className="p-3.5 rounded-2xl bg-rose-500/15 border-2 border-rose-500/50 text-rose-100 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-black text-rose-300">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>
                          {lang === 'tr'
                            ? 'KRİTİK UYARI: TAM TUTAR EŞLEŞMESİ ZORUNLUDUR!'
                            : lang === 'en'
                            ? 'STRICT WARNING: EXACT AMOUNT MATCH REQUIRED!'
                            : 'تحذير صارم: يجب تطابق المبلغ المحوّل بدقة متناهية!'}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-rose-100/95">
                        {activeInvoice.gateway === 'binance'
                          ? lang === 'tr'
                            ? `Lütfen Binance Pay üzerinden TAM OLARAK ${activeInvoice.exactAmountUsd.toFixed(2)} USDT gönderin (ne eksik ne fazla). Farklı bir tutar gönderilirse otomatik doğrulama başarısız olur.`
                            : lang === 'en'
                            ? `Send EXACTLY ${activeInvoice.exactAmountUsd.toFixed(2)} USDT via Binance Pay (not a single cent more or less). The full ${activeInvoice.exactAmountUsd.toFixed(2)} USDT will be credited to your wallet.`
                            : `يجب تحويل مبلغ ${activeInvoice.exactAmountUsd.toFixed(2)} USDT بالضبط (مع الفواصل العشرية كما هي، دون زيادة أو نقصان سنت واحد). سيتم إضافة كامل المبلغ (${activeInvoice.exactAmountUsd.toFixed(2)} USD) إلى رصيدك فور التحقق.`
                          : lang === 'tr'
                          ? `Ağ kesintisi sonrası cüzdanımıza ulaşan NET tutar TAM OLARAK ${activeInvoice.exactAmountUsd.toFixed(2)} USDT olmalıdır.`
                          : lang === 'en'
                          ? `The NET received amount after network fees must equal EXACTLY ${activeInvoice.exactAmountUsd.toFixed(2)} USDT so our blockchain verifier credits your wallet automatically.`
                          : `يجب أن يصل صافي المبلغ بعد رسوم الشبكة إلى محفظتنا بقيمة ${activeInvoice.exactAmountUsd.toFixed(2)} USDT بالضبط لكي يتعرف عليه نظام البلوكشين ويشحن رصيدك فوراً.`}
                      </p>
                    </div>

                    {/* Exact Amount + Recipient Address + QR */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-3.5 rounded-2xl bg-[#070A12] border border-white/10">
                      <div className="sm:col-span-7 space-y-3">
                        {/* Exact Amount Copy Card */}
                        <div>
                          <div className="text-[10px] text-amber-300 font-bold mb-1">
                            {lang === 'tr'
                              ? 'Gönderilecek Tam Tutar (USDT):'
                              : lang === 'en'
                              ? 'Exact Amount to Send (USDT):'
                              : 'المبلغ الدقيق المطلوب تحويله (انسخه كما هو):'}
                          </div>
                          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-400/45 rounded-xl px-3 py-2">
                            <code
                              className="text-lg font-mono font-black text-amber-300 flex-1"
                              dir="ltr"
                            >
                              {activeInvoice.exactAmountUsd.toFixed(2)} USDT
                            </code>
                            <button
                              type="button"
                              onClick={() =>
                                copyText('exact_amt', activeInvoice.exactAmountUsd.toFixed(2))
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 text-[11px] font-black text-amber-100 flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              {copiedKey === 'exact_amt' ? (
                                <Check className="w-3.5 h-3.5 text-emerald-300" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {copiedKey === 'exact_amt' ? t(lang, 'copied') : t(lang, 'copy')}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Recipient Address / Binance Pay ID Copy Card */}
                        <div>
                          <div className="text-[10px] text-slate-400 font-bold mb-1">
                            {translateCms(activeInvoice.recipientLabelAr)}:
                          </div>
                          <div className="flex items-center gap-2 bg-[#0B0F1A] border border-white/10 rounded-xl px-3 py-2">
                            <code
                              className="text-xs font-mono text-cyan-300 break-all flex-1"
                              dir="ltr"
                            >
                              {activeInvoice.recipientAddress}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyText('inv_addr', activeInvoice.recipientAddress)}
                              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold text-white flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              {copiedKey === 'inv_addr' ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {copiedKey === 'inv_addr' ? t(lang, 'copied') : t(lang, 'copy')}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="sm:col-span-5 flex flex-col items-center justify-center gap-1.5">
                        <div className="bg-white p-2.5 rounded-xl border border-white/20">
                          <QRCodeSVG value={activeInvoice.recipientAddress} size={116} />
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold text-center">
                          {activeInvoice.networkLabel}
                        </span>
                      </div>
                    </div>

                    {/* Verification Form: Paste Order ID / TxHash */}
                    <form onSubmit={handleVerifyInvoice} className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-200 block mb-1">
                          {activeInvoice.gateway === 'binance'
                            ? lang === 'tr'
                              ? 'Binance Pay Sipariş / İşlem Kodu (Order ID / Transaction ID) *'
                              : lang === 'en'
                              ? 'Binance Pay Order ID / Transaction ID *'
                              : 'الصق رمز العملية من Binance Pay (Order ID / Transaction ID) *'
                            : activeInvoice.gateway === 'usdt_trc20'
                            ? lang === 'tr'
                              ? 'TRON İşlem Kodu (TxHash — opsiyonel, boş bırakırsanız ağ otomatik taranır)'
                              : lang === 'en'
                              ? 'TRON Transaction Hash (TxHash — optional, leave blank for automatic scan)'
                              : 'رمز المعاملة على شبكة TRON (TxHash — اختياري، أو اتركه فارغاً للفحص التلقائي عبر البلوكشين)'
                            : lang === 'tr'
                            ? 'BEP20 İşlem Kodu (TxHash — 0x ile başlayan 66 karakter) *'
                            : lang === 'en'
                            ? 'BSC BEP20 Transaction Hash (TxHash — starts with 0x) *'
                            : 'الصق رمز المعاملة على شبكة BEP20 (TxHash يبدأ بـ 0x) *'}
                        </label>
                        <input
                          type="text"
                          required={activeInvoice.gateway !== 'usdt_trc20'}
                          value={invoiceRefInput}
                          onChange={(e) => setInvoiceRefInput(e.target.value)}
                          placeholder={
                            activeInvoice.gateway === 'binance'
                              ? 'Example: 382910485719283746'
                              : activeInvoice.gateway === 'usdt_trc20'
                              ? '64-hex TRON TxHash (optional for auto-scan)'
                              : '0x...'
                          }
                          dir="ltr"
                          className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono rounded-xl bg-[#070A12] border border-cyan-500/35 text-white focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      {invoiceFeedback && (
                        <div
                          className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                            invoiceFeedback.type === 'success'
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          {invoiceFeedback.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 shrink-0" />
                          )}
                          <span>{invoiceFeedback.text}</span>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <button
                          type="submit"
                          disabled={verifyingInvoice || invoiceRemainingSec === 0}
                          className="flex-1 py-3 rounded-xl bg-gradient-to-l from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99] cursor-pointer disabled:opacity-50 btn-solid-white"
                        >
                          <RefreshCw
                            className={`w-4 h-4 ${verifyingInvoice ? 'animate-spin' : ''}`}
                          />
                          <span>
                            {verifyingInvoice
                              ? lang === 'tr'
                                ? 'Doğrulanıyor...'
                                : lang === 'en'
                                ? 'Verifying Live...'
                                : 'جاري التحقق المباشر...'
                              : lang === 'tr'
                              ? 'Ödemeyi Doğrula ve Bakiyeyi Yükle'
                              : lang === 'en'
                              ? 'Verify Transfer & Credit Instantly'
                              : 'تحقق من الحوالة وشحن الرصيد فوراً'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCancelInvoice}
                          disabled={cancellingInvoice || verifyingInvoice}
                          className="px-4 py-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-xs font-extrabold cursor-pointer disabled:opacity-50"
                        >
                          {lang === 'tr'
                            ? 'İptal Et'
                            : lang === 'en'
                            ? 'Cancel Invoice'
                            : 'إلغاء الإشعار'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              /* MANUAL GATEWAYS FLOW (ShamCash, Syriatel Cash & Custom Admin Gateways) */
              <>
                {/* Instructions Banner */}
                {selectedGateway.instructionsAr && (
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-400/30 text-xs text-slate-200 leading-relaxed flex items-start gap-2">
                    <FileText className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[11px] font-extrabold text-cyan-300 mb-0.5">
                        {t(lang, 'instructions')}:
                      </div>
                      <p>{translateCms(selectedGateway.instructionsAr)}</p>
                    </div>
                  </div>
                )}

                {/* Account Info + Custom QR Image (or auto-generated QR) */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-3.5 rounded-2xl bg-[#070A12] border border-white/10">
                  <div className="sm:col-span-7 space-y-2.5">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold mb-1">
                        {t(lang, 'account_address')}
                      </div>
                      <div className="flex items-center gap-2 bg-[#0B0F1A] border border-white/10 rounded-xl px-3 py-2">
                        <code
                          className="text-xs font-mono text-cyan-300 break-all flex-1"
                          dir="ltr"
                        >
                          {selectedGateway.accountAddress}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyText('addr', selectedGateway.accountAddress)}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold text-white flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          {copiedKey === 'addr' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedKey === 'addr' ? t(lang, 'copied') : t(lang, 'copy')}</span>
                        </button>
                      </div>
                    </div>

                    {selectedGateway.accountHolder && (
                      <div className="text-xs text-slate-300">
                        <span className="text-slate-400">{t(lang, 'account_holder')}: </span>
                        <span className="font-extrabold text-white">
                          {translateCms(selectedGateway.accountHolder)}
                        </span>
                      </div>
                    )}

                    {transferMemoTag && (
                      <div className="pt-1">
                        <div className="text-[10px] text-amber-300 font-bold mb-1">
                          {lang === 'tr'
                            ? 'Özel Transfer Kodu (Açıklamaya yazın):'
                            : lang === 'en'
                            ? 'Your Unique Transfer Memo Tag (put in transfer note):'
                            : 'رمز التحويل المميز الخاص بحسابك (أضفه في ملاحظة التحويل):'}
                        </div>
                        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-400/35 rounded-xl px-3 py-1.5">
                          <code className="text-xs font-mono font-black text-amber-300 flex-1" dir="ltr">
                            {transferMemoTag}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyText('memo', transferMemoTag)}
                            className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-[10px] font-bold text-amber-200 flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            {copiedKey === 'memo' ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedKey === 'memo' ? t(lang, 'copied') : t(lang, 'copy')}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* QR Display (Admin custom QR image preferred, fallback to SVG QR) */}
                  <div className="sm:col-span-5 flex flex-col items-center justify-center gap-1.5">
                    {selectedGateway.qrImageUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxImage({
                            src: selectedGateway.qrImageUrl!,
                            title: `${getCleanPaymentMethodName(selectedGateway.nameAr, lang)} — QR`,
                          })
                        }
                        className="group relative bg-white p-2 rounded-xl border border-cyan-400/40 cursor-pointer overflow-hidden"
                        title={t(lang, 'enlarge_qr')}
                      >
                        <img
                          src={selectedGateway.qrImageUrl}
                          alt="Payment QR"
                          className="w-32 h-32 object-contain rounded"
                        />
                        <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold gap-1">
                          <ZoomIn className="w-4 h-4" />
                          <span>{t(lang, 'enlarge_qr')}</span>
                        </span>
                      </button>
                    ) : (
                      <div className="bg-white p-2.5 rounded-xl border border-white/20">
                        <QRCodeSVG
                          value={selectedGateway.qrCodeText || selectedGateway.accountAddress}
                          size={112}
                        />
                      </div>
                    )}
                    <span className="text-[10px] text-slate-400 font-bold">
                      {t(lang, 'payment_qr')}
                    </span>
                  </div>
                </div>

                {/* Top-Up Submission Form */}
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        {t(lang, 'amount')} ({selectedGateway.currency}) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        placeholder={`Min ${selectedGateway.minTopUpAmount}`}
                        className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white focus:outline-none focus:border-cyan-400"
                        dir="ltr"
                      />
                      {estimatedUsd > 0 && (
                        <div className="text-[11px] font-mono text-emerald-400 mt-1">
                          ≈ ${estimatedUsd.toFixed(2)} USD
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        {t(lang, 'reference_id')} *
                      </label>
                      <input
                        type="text"
                        required
                        value={referenceId}
                        onChange={(e) => setReferenceId(e.target.value)}
                        placeholder="Order ID / TX Hash / Receipt #"
                        className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white focus:outline-none focus:border-cyan-400"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* Admin-Configured Dynamic Custom Customer Fields */}
                  {selectedGateway.customFields && selectedGateway.customFields.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {selectedGateway.customFields.map((field) => {
                        const resolvedLabel = getFieldLabel(field, lang, translateCms);
                        const resolvedPlaceholder = field.placeholder
                          ? translateCms(field.placeholder)
                          : resolvedLabel;
                        return (
                          <div key={field.id}>
                            <label className="text-xs font-bold text-slate-300 block mb-1">
                              {resolvedLabel}{' '}
                              {field.required ? (
                                <span className="text-rose-400">*</span>
                              ) : (
                                <span className="text-slate-500 text-[10px]">
                                  ({t(lang, 'receipt_optional')})
                                </span>
                              )}
                            </label>
                            <input
                              type={field.type || 'text'}
                              required={field.required}
                              value={customValues[field.id] || ''}
                              onChange={(e) =>
                                setCustomValues((prev) => ({
                                  ...prev,
                                  [field.id]: e.target.value,
                                }))
                              }
                              placeholder={resolvedPlaceholder}
                              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white focus:outline-none focus:border-cyan-400"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Customer Payment Receipt Image Uploader */}
                  {showReceiptUploader && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{t(lang, 'upload_receipt')}</span>
                        </label>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            receiptIsRequired
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-white/10 text-slate-400'
                          }`}
                        >
                          {receiptIsRequired ? t(lang, 'receipt_required') : t(lang, 'receipt_optional')}
                        </span>
                      </div>

                      <input
                        ref={receiptInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleReceiptPick}
                        className="hidden"
                      />

                      {!receiptDataUrl ? (
                        <button
                          type="button"
                          disabled={compressingReceipt}
                          onClick={() => receiptInputRef.current?.click()}
                          className="w-full p-4 rounded-xl border-2 border-dashed border-cyan-500/35 hover:border-cyan-400 bg-[#070A12] hover:bg-indigo-500/10 transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          <Upload className="w-5 h-5 text-cyan-400" />
                          <span className="text-xs font-extrabold text-white">
                            {compressingReceipt
                              ? lang === 'tr'
                                ? 'Dekont sıkıştırılıyor ve korunuyor...'
                                : lang === 'en'
                                ? 'Compressing & securing receipt...'
                                : 'جاري ضغط وحماية صورة الإشعار...'
                              : t(lang, 'upload_receipt')}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {t(lang, 'upload_receipt_hint')} ·{' '}
                            {lang === 'tr'
                              ? 'Otomatik WebP sıkıştırma ve kopya koruması'
                              : lang === 'en'
                              ? 'Auto WebP compression & duplicate protection'
                              : 'ضغط ذكي تلقائي وحماية ضد التكرار'}
                          </span>
                        </button>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-[#070A12] border border-emerald-500/40 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={receiptDataUrl}
                              alt="Receipt preview"
                              onClick={() =>
                                setLightboxImage({
                                  src: receiptDataUrl,
                                  title: t(lang, 'upload_receipt'),
                                })
                              }
                              className="w-14 h-14 rounded-lg object-cover border border-white/15 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-extrabold text-emerald-400 truncate">
                                {receiptFileName || 'receipt.webp'}
                              </div>
                              {receiptCompressionMeta && (
                                <div className="text-[10px] font-mono text-cyan-300">
                                  {receiptCompressionMeta.originalKb}KB → {receiptCompressionMeta.compressedKb}KB{' '}
                                  {lang === 'tr'
                                    ? '(Sıkıştırıldı ✓)'
                                    : lang === 'en'
                                    ? '(Compressed ✓)'
                                    : '(مضغوطة ومحمية ✓)'}
                                </div>
                              )}
                              <div className="text-[10px] text-slate-400">
                                {lang === 'tr'
                                  ? 'Büyütmek için görsele tıklayın'
                                  : lang === 'en'
                                  ? 'Tap preview to enlarge'
                                  : 'اضغط على الصورة للمعاينة'}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setReceiptDataUrl('');
                              setReceiptFileName('');
                              setReceiptCompressionMeta(null);
                            }}
                            className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 cursor-pointer shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {feedback && (
                    <div
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                        feedback.type === 'success'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      {feedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{feedback.text}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99] cursor-pointer disabled:opacity-50 btn-solid-white"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{submitting ? '...' : t(lang, 'submit_topup')}</span>
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>

      {/* Top-Up Requests & Verified Payment History */}
      <div className="cyber-glass android-card rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-black text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span>{t(lang, 'pending_requests')}</span>
        </h3>

        {topUpRequests.length === 0 && paymentHistory.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            {t(lang, 'no_transactions')}
          </div>
        ) : (
          <div className="space-y-2">
            {topUpRequests.slice(0, 10).map((req) => {
              const cleanReqGwName = getCleanPaymentMethodName(req.gatewayNameAr, lang);
              return (
                <div
                  key={req.id}
                  className="p-3 rounded-xl bg-[#070A12] border border-white/10 flex flex-wrap items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {req.receiptImageUrl && (
                      <img
                        src={req.receiptImageUrl}
                        alt="Receipt"
                        onClick={() =>
                          setLightboxImage({
                            src: req.receiptImageUrl!,
                            title: `${cleanReqGwName} #${req.referenceId}`,
                          })
                        }
                        className="w-10 h-10 rounded-lg object-cover border border-cyan-500/40 cursor-pointer shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-white truncate">
                        {cleanReqGwName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        #{req.referenceId} · {req.amountOriginal.toLocaleString('en-US')}{' '}
                        {req.currencyOriginal} (≈ ${req.equivalentUsd.toFixed(2)})
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 ${
                      req.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : req.status === 'REJECTED'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {req.status === 'PENDING'
                      ? t(lang, 'status_pending')
                      : req.status === 'APPROVED'
                      ? t(lang, 'status_approved')
                      : `${t(lang, 'status_rejected')}${
                          req.rejectionReason ? `: ${translateCms(req.rejectionReason)}` : ''
                        }`}
                  </span>
                </div>
              );
            })}

            {paymentHistory.slice(0, 10).map((tx) => (
              <div
                key={tx.id}
                className="p-3 rounded-xl bg-[#070A12] border border-white/10 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-white truncate">
                    {getCleanPaymentMethodName(tx.gatewayLabelAr, lang)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    #{tx.referenceId} · +${tx.creditedUsd.toFixed(2)} USD
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  {t(lang, 'status_approved')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
