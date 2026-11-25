import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Save,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Play,
  Database,
  BarChart3,
  Sliders,
  CreditCard,
  Users,
  Wifi,
  Layout,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Download,
  Upload,
  RefreshCw,
  Shield,
  Lock,
  Unlock,
  XCircle,
  Search,
  ShoppingBag,
  Megaphone,
  Ban,
  Headphones,
  Send,
  Image as ImageIcon,
  Mic,
  Square,
  Smile,
  Crown,
  BadgeCheck,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  QrCode,
  ZoomIn,
  X,
  UserPlus,
  ShieldCheck,
  RotateCcw,
  Globe,
  Ticket,
  ClipboardList,
  Copy,
  Check,
  Archive,
  ShieldAlert,
  Store,
  Award,
  Power,
} from 'lucide-react';
import {
  PlatformSettings,
  PricingOverrideRule,
  PaymentGatewayConfig,
  PaymentGatewayCustomField,
  TopUpOrderRequest,
  ManagedUserAccount,
  ESimPlan,
  ESimLpaInventoryItem,
  SiteCmsConfig,
  HeroSlideItem,
  ActivityLogEntry,
  SupabaseConfigState,
  ActiveSmsOrder,
  ActiveESimOrder,
  GrizzlyCountry,
  GrizzlyServiceItem,
  SupportedCurrency,
  SupportConversation,
  SupportChatMessage,
  UserRole,
  VoucherCodeItem,
  StaffAuditLogEntry,
  StaffDailySummaryItem,
  ResellerProgramConfig,
  ResellerApplication,
  ResellerTier,
  SecurityPolicyConfig,
  FraudEventEntry,
  UserRiskProfile,
} from '../types';
import { SupabaseSqlHubModal } from './SupabaseSqlHubModal';
import { AdminPagination } from './AdminPagination';
import { FullPlatformBackupPayload } from '../services/hybridSyncEngine';

interface AdminWorkspaceProps {
  authToken: string;
  userRole?: 'ADMIN' | 'MODERATOR';
  settings: PlatformSettings & { apiStatusError?: string | null };
  onSaveSettings: (payload: Record<string, unknown>) => Promise<void>;
  onSyncSyriaTodayRates: () => Promise<{ ok: boolean; message: string; usdToSypRate?: number; usdToTryRate?: number }>;
  countries: GrizzlyCountry[];
  services: GrizzlyServiceItem[];
  pricingOverrides: PricingOverrideRule[];
  onUpdatePricingOverrides: (rules: PricingOverrideRule[]) => void;
  paymentGateways: PaymentGatewayConfig[];
  onUpdatePaymentGateways: (gateways: PaymentGatewayConfig[]) => void;
  topUpRequests: TopUpOrderRequest[];
  onProcessTopUpRequest: (
    requestId: string,
    action: 'APPROVE' | 'REJECT',
    rejectionReason?: string
  ) => void;
  managedUsers: ManagedUserAccount[];
  onUpdateManagedUsers: (users: ManagedUserAccount[]) => void;
  onAdjustUserWallet: (userId: string, deltaUsd: number, reasonAr: string) => void;
  customESimPlans: ESimPlan[];
  onUpdateCustomESimPlans: (plans: ESimPlan[]) => void;
  lpaInventory: ESimLpaInventoryItem[];
  onUpdateLpaInventory: (items: ESimLpaInventoryItem[]) => void;
  activeSmsOrders: ActiveSmsOrder[];
  activeESimOrders: ActiveESimOrder[];
  onAdminCancelOrder: (orderType: 'SMS' | 'ESIM', orderId: string, refundCustomer: boolean) => void;
  onAdminCompleteSmsOrder?: (orderId: string) => void;
  cmsConfig: SiteCmsConfig;
  onUpdateCmsConfig: (cms: SiteCmsConfig) => void;
  activityLogs: ActivityLogEntry[];
  supabaseConfig: SupabaseConfigState;
  onUpdateSupabaseConfig: (cfg: SupabaseConfigState) => void;
  onTriggerFullSupabaseSync: () => Promise<void>;
  syncingSupabase: boolean;
  onExportBackup: () => void;
  onImportBackup: (data: FullPlatformBackupPayload) => void;
}

type AdminSectionId =
  | 'analytics'
  | 'support'
  | 'users'
  | 'resellers'
  | 'security'
  | 'orders'
  | 'pricing'
  | 'payments'
  | 'vouchers'
  | 'audit'
  | 'cms_esim'
  | 'api_cloud';

const OFFICIAL_GRIZZLY_METHODS = [
  { key: 'getBalance', label: 'طلب الرصيد (action=getBalance)', params: [] },
  {
    key: 'getNumberV2',
    label: 'طلب رقم V2 JSON (action=getNumberV2)',
    params: [
      { name: 'service', label: 'رمز الخدمة (service)', defaultVal: 'wa' },
      { name: 'country', label: 'رمز الدولة (country)', defaultVal: '16' },
      { name: 'maxPrice', label: 'السعر الأقصى (maxPrice)', defaultVal: '' },
    ],
  },
  {
    key: 'getPricesV3',
    label: 'الأسعار V3 (action=getPricesV3)',
    params: [
      { name: 'country', label: 'رمز الدولة (country)', defaultVal: '16' },
      { name: 'service', label: 'رمز الخدمة (service)', defaultVal: 'wa' },
    ],
  },
  { key: 'getActiveActivations', label: 'التفعيلات النشطة (action=getActiveActivations)', params: [] },
  { key: 'getCountries', label: 'قائمة الدول (action=getCountries)', params: [] },
];

const ADMIN_EMOJIS = ['👋', '✅', '🙏', '🔥', '💯', '⚡', '💳', '🛠️', '👍', '❤️', '🎉', '📩'];

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({
  authToken,
  userRole = 'ADMIN',
  settings,
  onSaveSettings,
  onSyncSyriaTodayRates,
  countries,
  services,
  pricingOverrides,
  onUpdatePricingOverrides,
  paymentGateways,
  onUpdatePaymentGateways,
  topUpRequests,
  onProcessTopUpRequest,
  managedUsers,
  onUpdateManagedUsers,
  onAdjustUserWallet,
  customESimPlans,
  onUpdateCustomESimPlans,
  lpaInventory,
  onUpdateLpaInventory,
  activeSmsOrders,
  activeESimOrders,
  onAdminCancelOrder,
  onAdminCompleteSmsOrder,
  cmsConfig,
  onUpdateCmsConfig,
  activityLogs,
  supabaseConfig,
  onUpdateSupabaseConfig,
  onTriggerFullSupabaseSync,
  syncingSupabase,
  onExportBackup,
  onImportBackup,
}) => {
  const isSuperAdmin = userRole === 'ADMIN';
  const [activeSection, setActiveSection] = useState<AdminSectionId>('analytics');

  useEffect(() => {
    const moderatorAllowed: AdminSectionId[] = ['analytics', 'support', 'orders', 'payments'];
    if (!isSuperAdmin && !moderatorAllowed.includes(activeSection)) {
      setActiveSection('analytics');
    }
  }, [isSuperAdmin, activeSection]);
  const [isPinLocked, setIsPinLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showSqlHubModal, setShowSqlHubModal] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  // Numbered Pagination state (10 items per page across ALL Admin tables & logs)
  const PAGE_SIZE = 10;
  const [logsPage, setLogsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);
  const [overridesPage, setOverridesPage] = useState(1);
  const [topupsPage, setTopupsPage] = useState(1);
  const [vouchersPage, setVouchersPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [resellersPage, setResellersPage] = useState(1);
  const [riskPage, setRiskPage] = useState(1);
  const [fraudPage, setFraudPage] = useState(1);

  // Resellers & Distributors Program state (Super Admin only)
  const [resellerCfg, setResellerCfg] = useState<ResellerProgramConfig>({
    silverDiscountPercent: 8,
    goldDiscountPercent: 14,
    minDepositUsd: 25,
    minMonthlySpendUsd: 50,
    requireCleanSecurityRecord: true,
  });
  const [resellerApps, setResellerApps] = useState<ResellerApplication[]>([]);
  const [activeResellers, setActiveResellers] = useState<ManagedUserAccount[]>([]);
  const [loadingResellers, setLoadingResellers] = useState(false);
  const [savingResellerCfg, setSavingResellerCfg] = useState(false);
  const [appReviewTier, setAppReviewTier] = useState<Record<string, ResellerTier>>({});
  const [appReviewDiscount, setAppReviewDiscount] = useState<Record<string, string>>({});
  const [appRejectReason, setAppRejectReason] = useState<Record<string, string>>({});

  // Security & Anti-Fraud Control Center state (Super Admin only)
  const [securityPolicy, setSecurityPolicy] = useState<SecurityPolicyConfig>({
    strictAutoPayments: true,
    autoPaymentsPanicStop: false,
    enforceEmailWhitelist: true,
    allowedEmailDomains: [
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
    ],
    autoRestrictScoreThreshold: 60,
    autoSuspendScoreThreshold: 100,
  });
  const [riskProfiles, setRiskProfiles] = useState<UserRiskProfile[]>([]);
  const [fraudEvents, setFraudEvents] = useState<FraudEventEntry[]>([]);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [newAllowedDomain, setNewAllowedDomain] = useState('');

  // Users & Moderators Management state
  const [userSearch, setUserSearch] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserContact, setNewUserContact] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('MODERATOR');
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [walletAdjAmount, setWalletAdjAmount] = useState<Record<string, string>>({});
  const [walletAdjReason, setWalletAdjReason] = useState<Record<string, string>>({});

  // Orders Management state
  const [adminOrderType, setAdminOrderType] = useState<'SMS' | 'ESIM'>('SMS');
  const [adminOrderSearch, setAdminOrderSearch] = useState('');

  // Pricing & Currencies state
  const [smsMarkup, setSmsMarkup] = useState(String(settings.smsMarkupPercent));
  const [esimMarkup, setEsimMarkup] = useState(String(settings.esimMarkupPercent));
  const [usdToSyp, setUsdToSyp] = useState(String(settings.usdToSypRate));
  const [usdToTry, setUsdToTry] = useState(String(settings.usdToTryRate || 34.5));
  const [usdToUsdt, setUsdToUsdt] = useState(String(settings.usdToUsdtRate || 1.0));
  const [rubToUsd, setRubToUsd] = useState(String(settings.rubToUsdRate));
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState(
    String(settings.lowProviderBalanceThresholdUsd ?? 10)
  );
  const [binancePayIdInput, setBinancePayIdInput] = useState(settings.binancePayId || '1073784382');
  const [usdtTrc20Input, setUsdtTrc20Input] = useState(
    settings.binanceUsdtTrc20 || 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE'
  );
  const [usdtBep20Input, setUsdtBep20Input] = useState(
    settings.binanceUsdtBep20 || '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18'
  );
  const [savingAutoPayAddrs, setSavingAutoPayAddrs] = useState(false);
  const [syncingSyriaToday, setSyncingSyriaToday] = useState(false);

  useEffect(() => {
    if (settings.binancePayId) setBinancePayIdInput(settings.binancePayId);
    if (settings.binanceUsdtTrc20) setUsdtTrc20Input(settings.binanceUsdtTrc20);
    if (settings.binanceUsdtBep20) setUsdtBep20Input(settings.binanceUsdtBep20);
  }, [settings.binancePayId, settings.binanceUsdtTrc20, settings.binanceUsdtBep20]);

  // Gift Cards / Vouchers state (Super Admin only)
  const [vouchers, setVouchers] = useState<VoucherCodeItem[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [voucherAmountUsd, setVoucherAmountUsd] = useState('5');
  const [voucherQuantity, setVoucherQuantity] = useState('1');
  const [voucherMaxUses, setVoucherMaxUses] = useState('1');
  const [voucherExpiryDays, setVoucherExpiryDays] = useState('30');
  const [voucherCustomCode, setVoucherCustomCode] = useState('');
  const [voucherPrefix, setVoucherPrefix] = useState('ALIS');
  const [voucherNote, setVoucherNote] = useState('');
  const [creatingVoucher, setCreatingVoucher] = useState(false);
  const [copiedVoucherKey, setCopiedVoucherKey] = useState<string | null>(null);

  // Staff Audit Trail state (Super Admin only)
  const [auditLogs, setAuditLogs] = useState<StaffAuditLogEntry[]>([]);
  const [staffDailySummary, setStaffDailySummary] = useState<StaffDailySummaryItem[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditActorFilter, setAuditActorFilter] = useState<string>('ALL');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');

  const [ovrTargetType, setOvrTargetType] = useState<'service' | 'country'>('service');
  const [ovrTargetCode, setOvrTargetCode] = useState('wa');
  const [ovrCustomMarkup, setOvrCustomMarkup] = useState('');
  const [ovrFixedUsd, setOvrFixedUsd] = useState('');

  // Payments, Receipts Lightbox & Advanced Gateway Builder state
  const [rejectReasonById, setRejectReasonById] = useState<Record<string, string>>({});
  const [receiptLightbox, setReceiptLightbox] = useState<{ src: string; title: string } | null>(null);
  const [newGwName, setNewGwName] = useState('');
  const [newGwAddress, setNewGwAddress] = useState('');
  const [newGwHolder, setNewGwHolder] = useState('');
  const [newGwMin, setNewGwMin] = useState('5');
  const [newGwCurrency, setNewGwCurrency] = useState<SupportedCurrency>('USD');
  const [newGwInstructions, setNewGwInstructions] = useState('');
  const [newGwIconUrl, setNewGwIconUrl] = useState('');
  const [newGwQrImageUrl, setNewGwQrImageUrl] = useState('');
  const [newGwAllowReceipt, setNewGwAllowReceipt] = useState(true);
  const [newGwRequireReceipt, setNewGwRequireReceipt] = useState(true);
  const [newGwFields, setNewGwFields] = useState<PaymentGatewayCustomField[]>([]);
  const [draftFieldLabel, setDraftFieldLabel] = useState('');
  const [draftFieldPlaceholder, setDraftFieldPlaceholder] = useState('');
  const [draftFieldType, setDraftFieldType] = useState<'text' | 'number' | 'tel'>('text');
  const [draftFieldRequired, setDraftFieldRequired] = useState(true);
  const [editingGwFieldLabel, setEditingGwFieldLabel] = useState<Record<string, string>>({});
  const [editingGwFieldRequired, setEditingGwFieldRequired] = useState<Record<string, boolean>>({});
  const [expandedGwId, setExpandedGwId] = useState<string | null>(null);

  // CMS & eSIM inventory state
  const [newPlanCountryAr, setNewPlanCountryAr] = useState('تركيا (Turkey Fast)');
  const [newPlanIso2, setNewPlanIso2] = useState('TR');
  const [newPlanDataGb, setNewPlanDataGb] = useState('10');
  const [newPlanValidity, setNewPlanValidity] = useState('30');
  const [newPlanBaseUsd, setNewPlanBaseUsd] = useState('6.50');
  const [newLpaCountryAr, setNewLpaCountryAr] = useState('تركيا');
  const [newLpaIso2, setNewLpaIso2] = useState('TR');
  const [newLpaDataLabel, setNewLpaDataLabel] = useState('10 جيجابايت');
  const [newLpaSmdp, setNewLpaSmdp] = useState('rsp.truphone.com');
  const [newLpaCode, setNewLpaCode] = useState('');
  const [newLpaIccid, setNewLpaIccid] = useState('');

  // Hero Slider Manager state (image from device OR URL + optional text/CTA)
  const [slideImageUrl, setSlideImageUrl] = useState('');
  const [slideTitleAr, setSlideTitleAr] = useState('');
  const [slideSubtitleAr, setSlideSubtitleAr] = useState('');
  const [slideCtaLabelAr, setSlideCtaLabelAr] = useState('');
  const [slideCtaAction, setSlideCtaAction] = useState<NonNullable<HeroSlideItem['ctaAction']>>('none');
  const [slideCtaExternalUrl, setSlideCtaExternalUrl] = useState('');
  const slideFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const handleSiteLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showSavedFeedback('يرجى اختيار ملف صورة صالح للشعار (PNG / JPG / WebP / SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showSavedFeedback('الحد الأقصى لحجم صورة الشعار هو 2 ميجابايت.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateCmsConfig({ ...cmsConfig, siteLogoUrl: reader.result });
        showSavedFeedback('تم تحديث شعار الموقع والتطبيق بنجاح.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSlideImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showSavedFeedback('يرجى اختيار ملف صورة صالح فقط (JPG/PNG/WebP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showSavedFeedback('الحد الأقصى لحجم صورة السلايدر هو 2 ميجابايت.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSlideImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddHeroSlide = () => {
    if (!slideImageUrl.trim()) {
      showSavedFeedback('يرجى رفع صورة من جهازك أو لصق رابط الصورة أولاً.');
      return;
    }
    const currentSlides = cmsConfig.heroSlides || [];
    const newSlide: HeroSlideItem = {
      id: `slide-${Date.now()}`,
      imageUrl: slideImageUrl.trim(),
      titleAr: slideTitleAr.trim() || undefined,
      subtitleAr: slideSubtitleAr.trim() || undefined,
      ctaLabelAr: slideCtaLabelAr.trim() || undefined,
      ctaAction: slideCtaAction,
      ctaExternalUrl: slideCtaAction === 'external' ? slideCtaExternalUrl.trim() || undefined : undefined,
      isEnabled: true,
      order: currentSlides.length,
    };
    onUpdateCmsConfig({
      ...cmsConfig,
      heroSlides: [...currentSlides, newSlide],
    });
    setSlideImageUrl('');
    setSlideTitleAr('');
    setSlideSubtitleAr('');
    setSlideCtaLabelAr('');
    setSlideCtaAction('none');
    setSlideCtaExternalUrl('');
    showSavedFeedback('تمت إضافة الشريحة إلى السلايدر الرئيسي بنجاح!');
  };

  const handleMoveHeroSlide = (index: number, direction: -1 | 1) => {
    const list = [...(cmsConfig.heroSlides || [])];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    onUpdateCmsConfig({
      ...cmsConfig,
      heroSlides: list.map((s, idx) => ({ ...s, order: idx })),
    });
  };

  // API & Cloud state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [syriaTodayKeyInput, setSyriaTodayKeyInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedMethodKey, setSelectedMethodKey] = useState('getBalance');
  const [testParams, setTestParams] = useState<Record<string, string>>({
    service: 'wa',
    country: '16',
  });
  const [testingApi, setTestingApi] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Support Center state
  const [supportThreads, setSupportThreads] = useState<SupportConversation[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showAdminEmoji, setShowAdminEmoji] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [adminRecording, setAdminRecording] = useState(false);
  const [adminRecordSec, setAdminRecordSec] = useState(0);
  const adminMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const adminAudioChunksRef = useRef<Blob[]>([]);
  const adminRecordTimerRef = useRef<number | null>(null);
  const adminImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUsdToSyp(String(settings.usdToSypRate));
    setUsdToTry(String(settings.usdToTryRate || 34.5));
    if (settings.lowProviderBalanceThresholdUsd !== undefined) {
      setLowBalanceThreshold(String(settings.lowProviderBalanceThresholdUsd));
    }
  }, [settings.usdToSypRate, settings.usdToTryRate, settings.lowProviderBalanceThresholdUsd]);

  const fetchVouchersList = async () => {
    if (!authToken || !isSuperAdmin) return;
    setLoadingVouchers(true);
    try {
      const res = await fetch('/api/admin/vouchers', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVouchers(data.vouchers || []);
      }
    } finally {
      setLoadingVouchers(false);
    }
  };

  const fetchAuditLogsList = async () => {
    if (!authToken || !isSuperAdmin) return;
    setLoadingAudit(true);
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
        setStaffDailySummary(data.dailySummary || []);
      }
    } finally {
      setLoadingAudit(false);
    }
  };

  const fetchResellersData = async () => {
    if (!authToken || !isSuperAdmin) return;
    setLoadingResellers(true);
    try {
      const res = await fetch('/api/admin/resellers', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) setResellerCfg(data.config);
        setResellerApps(data.applications || []);
        setActiveResellers(data.activeResellers || []);
      }
    } finally {
      setLoadingResellers(false);
    }
  };

  const fetchSecurityData = async () => {
    if (!authToken || !isSuperAdmin) return;
    setLoadingSecurity(true);
    try {
      const res = await fetch('/api/admin/security/overview', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.policy) setSecurityPolicy(data.policy);
        setRiskProfiles(data.riskProfiles || []);
        setFraudEvents(data.events || []);
      }
    } finally {
      setLoadingSecurity(false);
    }
  };

  const handleSaveResellerConfig = async () => {
    if (!authToken || !isSuperAdmin) return;
    setSavingResellerCfg(true);
    try {
      const res = await fetch('/api/admin/resellers/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(resellerCfg),
      });
      const data = await res.json();
      if (res.ok && data.config) {
        setResellerCfg(data.config);
        showSavedFeedback('تم حفظ شروط ونسب خصم برنامج البائعين بنجاح!');
      } else {
        showSavedFeedback(data.error || 'تعذر حفظ إعدادات برنامج البائعين.');
      }
    } finally {
      setSavingResellerCfg(false);
    }
  };

  const handleReviewResellerApp = async (appId: string, action: 'APPROVE' | 'REJECT') => {
    if (!authToken || !isSuperAdmin) return;
    const tier: ResellerTier = appReviewTier[appId] || 'SILVER';
    const customDisc = appReviewDiscount[appId] ? Number(appReviewDiscount[appId]) : undefined;
    const res = await fetch(`/api/admin/resellers/${encodeURIComponent(appId)}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        action,
        tier,
        discountPercent: customDisc,
        reason: appRejectReason[appId] || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showSavedFeedback(data.error || 'تعذر معالجة طلب البائع.');
      return;
    }
    showSavedFeedback(
      action === 'APPROVE'
        ? 'تم اعتماد البائع وتفعيل خصم الجملة وشارة البائع المعتمد!'
        : 'تم رفض طلب الانضمام.'
    );
    fetchResellersData();
  };

  const handleSaveSecurityPolicy = async (patch?: Partial<SecurityPolicyConfig>) => {
    if (!authToken || !isSuperAdmin) return;
    const payload = { ...securityPolicy, ...(patch || {}) };
    setSavingSecurity(true);
    try {
      const res = await fetch('/api/admin/security/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.policy) {
        setSecurityPolicy(data.policy);
        showSavedFeedback('تم تحديث سياسة الأمان ومكافحة الاحتيال بنجاح!');
      } else {
        showSavedFeedback(data.error || 'تعذر حفظ سياسة الأمان.');
      }
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleSecurityUserAction = async (
    userId: string,
    action: 'UNBAN_RESET' | 'RESTRICT_24H' | 'PERMA_BAN'
  ) => {
    if (!authToken || !isSuperAdmin) return;
    const res = await fetch(`/api/admin/security/users/${encodeURIComponent(userId)}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      showSavedFeedback(data.error || 'تعذر تنفيذ الإجراء الأمني.');
      return;
    }
    showSavedFeedback(
      action === 'UNBAN_RESET'
        ? 'تم فك التقييد وتصفير نقاط المخاطر للحساب.'
        : action === 'RESTRICT_24H'
        ? 'تم فرض تقييد 24 ساعة على الحساب.'
        : 'تم حظر الحساب نهائياً.'
    );
    fetchSecurityData();
  };

  useEffect(() => {
    if (isSuperAdmin && authToken) {
      fetchResellersData();
      fetchSecurityData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, authToken]);

  useEffect(() => {
    if (activeSection === 'vouchers' && isSuperAdmin) {
      fetchVouchersList();
    } else if (activeSection === 'audit' && isSuperAdmin) {
      fetchAuditLogsList();
    } else if (activeSection === 'resellers' && isSuperAdmin) {
      fetchResellersData();
    } else if (activeSection === 'security' && isSuperAdmin) {
      fetchSecurityData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, isSuperAdmin, authToken]);

  const handleOpenArchivedReceipt = async (reqItem: TopUpOrderRequest) => {
    const title = `إشعار دفع ${reqItem.userNameAr} — #${reqItem.referenceId}`;
    if (reqItem.receiptImageUrl) {
      setReceiptLightbox({ src: reqItem.receiptImageUrl, title });
      return;
    }
    if (reqItem.receiptArchiveId && authToken) {
      try {
        const res = await fetch(`/api/topups/receipt/${encodeURIComponent(reqItem.receiptArchiveId)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          setReceiptLightbox({ src: url, title });
        }
      } catch {
        showSavedFeedback('تعذر تحميل صورة الإشعار من الأرشيف المحمي.');
      }
    }
  };

  const handleCreateVouchers = async () => {
    if (!authToken || !isSuperAdmin) return;
    const amt = Number(voucherAmountUsd);
    if (!Number.isFinite(amt) || amt <= 0) {
      showSavedFeedback('يرجى إدخال قيمة صحيحة للقسيمة بالدولار.');
      return;
    }
    setCreatingVoucher(true);
    try {
      const res = await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          amountUsd: amt,
          quantity: voucherCustomCode.trim() ? 1 : Number(voucherQuantity) || 1,
          maxUses: Number(voucherMaxUses) || 1,
          expiryDays: Number(voucherExpiryDays) || 0,
          customCode: voucherCustomCode.trim() || undefined,
          prefix: voucherPrefix.trim() || 'ALIS',
          note: voucherNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showSavedFeedback(data.error || 'تعذر إنشاء القسيمة.');
        return;
      }
      setVouchers(data.vouchers || []);
      setVoucherCustomCode('');
      setVoucherNote('');
      const createdCount = Array.isArray(data.created) ? data.created.length : 1;
      showSavedFeedback(`تم توليد ${createdCount} قسيمة شحن بنجاح!`);
    } finally {
      setCreatingVoucher(false);
    }
  };

  const handleToggleVoucher = async (v: VoucherCodeItem) => {
    if (!authToken || !isSuperAdmin) return;
    const res = await fetch(`/api/admin/vouchers/${encodeURIComponent(v.id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ isActive: !v.isActive }),
    });
    if (res.ok) {
      setVouchers((prev) =>
        prev.map((item) => (item.id === v.id ? { ...item, isActive: !v.isActive } : item))
      );
      showSavedFeedback(`تم ${!v.isActive ? 'تفعيل' : 'إيقاف'} القسيمة ${v.code}.`);
    }
  };

  const handleDeleteVoucher = async (v: VoucherCodeItem) => {
    if (!authToken || !isSuperAdmin) return;
    const res = await fetch(`/api/admin/vouchers/${encodeURIComponent(v.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      setVouchers((prev) => prev.filter((item) => item.id !== v.id));
      showSavedFeedback(`تم حذف القسيمة ${v.code}.`);
    }
  };

  const copyVoucherCode = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVoucherKey(key);
    setTimeout(() => setCopiedVoucherKey(null), 1500);
  };

  // Load support threads & subscribe to WebSocket for real-time updates
  useEffect(() => {
    if (!authToken) return;
    fetch('/api/support/admin/conversations', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.conversations)) {
          setSupportThreads(data.conversations);
          if (!selectedThreadId && data.conversations[0]) {
            setSelectedThreadId(data.conversations[0].id);
          }
        }
      })
      .catch(() => {});

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/support?token=${encodeURIComponent(
      authToken
    )}`;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          if (payload.type === 'chat:message' && payload.message && payload.conversationId) {
            const msg: SupportChatMessage = payload.message;
            setSupportThreads((prev) => {
              const exists = prev.some((c) => c.id === payload.conversationId);
              if (!exists) {
                if (payload.conversation) {
                  return [payload.conversation as SupportConversation, ...prev];
                }
                fetch('/api/support/admin/conversations', {
                  headers: { Authorization: `Bearer ${authToken}` },
                })
                  .then((r) => (r.ok ? r.json() : null))
                  .then((d) => {
                    if (Array.isArray(d?.conversations)) setSupportThreads(d.conversations);
                  })
                  .catch(() => {});
                return prev;
              }
              return prev.map((c) => {
                if (c.id !== payload.conversationId) return c;
                if (c.messages.some((m) => m.id === msg.id)) return c;
                return {
                  ...c,
                  messages: [...c.messages, msg],
                  updatedAt: msg.createdAt,
                };
              });
            });
          } else if (payload.type === 'chat:status' && payload.conversationId) {
            setSupportThreads((prev) =>
              prev.map((c) =>
                c.id === payload.conversationId ? { ...c, status: payload.status } : c
              )
            );
          } else if (payload.type === 'chat:deleted' && payload.conversationId) {
            setSupportThreads((prev) => prev.filter((c) => c.id !== payload.conversationId));
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }
    return () => {
      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, [authToken]);

  const showSavedFeedback = (msg: string) => {
    setSavedBanner(msg);
    setTimeout(() => setSavedBanner(null), 3500);
  };

  const selectedThread =
    supportThreads.find((t) => t.id === selectedThreadId) || supportThreads[0] || null;

  const sendAdminReply = async (payload: {
    type: 'text' | 'image' | 'audio';
    text?: string;
    mediaDataUrl?: string;
    audioDurationSec?: number;
  }) => {
    if (!selectedThread || !authToken) return;
    setSendingReply(true);
    try {
      const res = await fetch('/api/support/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          conversationId: selectedThread.id,
          adminDisplayName: cmsConfig.supportAdminDisplayName,
          ...payload,
        }),
      });
      const data = await res.json();
      if (res.ok && data.conversation) {
        setSupportThreads((prev) =>
          prev.map((t) => (t.id === data.conversation.id ? data.conversation : t))
        );
        setReplyText('');
        setShowAdminEmoji(false);
      }
    } finally {
      setSendingReply(false);
    }
  };

  const handleAdminImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      showSavedFeedback('يرجى اختيار صورة صالحة بحجم أقل من 2 ميجابايت.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        sendAdminReply({ type: 'image', mediaDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const startAdminRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      adminAudioChunksRef.current = [];
      let sec = 0;
      setAdminRecordSec(0);
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) adminAudioChunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (adminRecordTimerRef.current) {
          window.clearInterval(adminRecordTimerRef.current);
          adminRecordTimerRef.current = null;
        }
        const blob = new Blob(adminAudioChunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            sendAdminReply({
              type: 'audio',
              mediaDataUrl: reader.result,
              audioDurationSec: Math.max(1, sec),
            });
          }
        };
        reader.readAsDataURL(blob);
      };
      adminMediaRecorderRef.current = rec;
      rec.start();
      setAdminRecording(true);
      adminRecordTimerRef.current = window.setInterval(() => {
        sec += 1;
        setAdminRecordSec(sec);
        if (sec >= 60) {
          rec.stop();
          setAdminRecording(false);
        }
      }, 1000);
    } catch {
      showSavedFeedback('تعذر الوصول للميكروفون.');
    }
  };

  const stopAdminRecording = () => {
    if (adminMediaRecorderRef.current && adminRecording) {
      adminMediaRecorderRef.current.stop();
      setAdminRecording(false);
    }
  };

  const handleToggleThreadStatus = async (thread: SupportConversation) => {
    const nextStatus = thread.status === 'OPEN' ? 'RESOLVED' : 'OPEN';
    const res = await fetch('/api/support/admin/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ conversationId: thread.id, status: nextStatus }),
    });
    if (res.ok) {
      setSupportThreads((prev) =>
        prev.map((t) => (t.id === thread.id ? { ...t, status: nextStatus } : t))
      );
      showSavedFeedback(nextStatus === 'RESOLVED' ? 'تم إغلاق التذكرة كمكتملة.' : 'تم إعادة فتح التذكرة.');
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    const res = await fetch(`/api/support/admin/${encodeURIComponent(threadId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      setSupportThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (selectedThreadId === threadId) setSelectedThreadId(null);
      showSavedFeedback('تم حذف محادثة الدعم.');
    }
  };

  // KPIs
  const completedSms = activeSmsOrders.filter(
    (o) => o.status === 'SMS_RECEIVED' || o.status === 'COMPLETED'
  );
  const activeSms = activeSmsOrders.filter((o) =>
    ['WAITING_SMS', 'READY_SENT', 'WAIT_RETRY', 'WAIT_RESEND'].includes(o.status)
  );
  const validESims = activeESimOrders.filter((e) => e.status !== 'CANCELLED');
  const pendingTopUps = topUpRequests.filter((r) => r.status === 'PENDING');
  const openSupportCount = supportThreads.filter((t) => t.status === 'OPEN').length;

  const totalSalesUsd =
    completedSms.reduce((acc, o) => acc + o.priceUsd, 0) +
    validESims.reduce((acc, e) => acc + e.priceUsd, 0);

  const netProfitUsd =
    completedSms.reduce((acc, o) => {
      const base = o.baseCostUsd ?? o.priceUsd / (1 + settings.smsMarkupPercent / 100);
      return acc + Math.max(0, o.priceUsd - base);
    }, 0) +
    validESims.reduce((acc, e) => {
      const base = e.baseCostUsd ?? e.priceUsd / (1 + settings.esimMarkupPercent / 100);
      return acc + Math.max(0, e.priceUsd - base);
    }, 0);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return managedUsers;
    return managedUsers.filter(
      (u) =>
        u.nameAr.toLowerCase().includes(q) ||
        u.emailOrPhone.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [managedUsers, userSearch]);

  const filteredAdminSms = useMemo(() => {
    const q = adminOrderSearch.trim().toLowerCase();
    if (!q) return activeSmsOrders;
    return activeSmsOrders.filter(
      (o) =>
        o.phoneNumber.toLowerCase().includes(q) ||
        o.serviceNameAr.toLowerCase().includes(q) ||
        o.activationId.toLowerCase().includes(q)
    );
  }, [activeSmsOrders, adminOrderSearch]);

  const filteredAdminESim = useMemo(() => {
    const q = adminOrderSearch.trim().toLowerCase();
    if (!q) return activeESimOrders;
    return activeESimOrders.filter(
      (e) =>
        e.countryNameAr.toLowerCase().includes(q) ||
        e.iccid.toLowerCase().includes(q)
    );
  }, [activeESimOrders, adminOrderSearch]);

  const handleSaveGlobalPricingOrApi = async () => {
    setSavingSettings(true);
    try {
      await onSaveSettings({
        grizzlyApiKey: apiKeyInput.trim() || undefined,
        syriaTodayApiKey: syriaTodayKeyInput.trim() || undefined,
        smsMarkupPercent: Number(smsMarkup),
        esimMarkupPercent: Number(esimMarkup),
        usdToSypRate: Number(usdToSyp),
        usdToTryRate: Number(usdToTry),
        usdToUsdtRate: Number(usdToUsdt),
        rubToUsdRate: Number(rubToUsd),
        lowProviderBalanceThresholdUsd: Number(lowBalanceThreshold) || 10,
      });
      setApiKeyInput('');
      setSyriaTodayKeyInput('');
      showSavedFeedback('تم حفظ الإعدادات وتحديث الأسعار ومفاتيح الربط بنجاح!');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveAutoPayAddresses = async () => {
    const cleanPayId = binancePayIdInput.trim();
    const cleanTrc20 = usdtTrc20Input.trim();
    const cleanBep20 = usdtBep20Input.trim();
    if (!cleanPayId || !cleanTrc20 || !cleanBep20) return;

    setSavingAutoPayAddrs(true);
    try {
      await onSaveSettings({
        binancePayId: cleanPayId,
        binanceUsdtTrc20: cleanTrc20,
        binanceUsdtBep20: cleanBep20,
      });
      onUpdatePaymentGateways(
        paymentGateways.map((g) => {
          if (g.code === 'binance') {
            return { ...g, accountAddress: cleanPayId, qrCodeText: `BINANCEPAY:${cleanPayId}` };
          }
          if (g.code === 'usdt_trc20') {
            return { ...g, accountAddress: cleanTrc20, qrCodeText: cleanTrc20 };
          }
          if (g.code === 'usdt_bep20') {
            return { ...g, accountAddress: cleanBep20, qrCodeText: cleanBep20 };
          }
          return g;
        })
      );
      showSavedFeedback('تم تحديث عناوين الاستلام التلقائي (Binance Pay و TRC20 و BEP20) بنجاح!');
    } finally {
      setSavingAutoPayAddrs(false);
    }
  };

  const handleFetchSyriaToday = async () => {
    setSyncingSyriaToday(true);
    try {
      const res = await onSyncSyriaTodayRates();
      if (res.usdToSypRate) setUsdToSyp(String(res.usdToSypRate));
      if (res.usdToTryRate) setUsdToTry(String(res.usdToTryRate));
      showSavedFeedback(res.message);
    } finally {
      setSyncingSyriaToday(false);
    }
  };

  const handleAddPricingOverride = () => {
    const targetName =
      ovrTargetType === 'service'
        ? services.find((s) => s.code === ovrTargetCode)?.nameAr || ovrTargetCode
        : countries.find((c) => c.id === ovrTargetCode)?.nameAr || ovrTargetCode;

    const newRule: PricingOverrideRule = {
      id: `ovr-${Date.now()}`,
      targetType: ovrTargetType,
      targetCode: ovrTargetCode,
      targetNameAr: targetName,
      customMarkupPercent: ovrCustomMarkup ? Number(ovrCustomMarkup) : null,
      fixedPriceUsd: ovrFixedUsd ? Number(ovrFixedUsd) : null,
      isHidden: false,
      updatedAt: Date.now(),
    };

    const filtered = pricingOverrides.filter(
      (r) => !(r.targetType === ovrTargetType && r.targetCode === ovrTargetCode)
    );
    onUpdatePricingOverrides([newRule, ...filtered]);
    setOvrCustomMarkup('');
    setOvrFixedUsd('');
    showSavedFeedback(`تم حفظ قاعدة التسعير المخصصة لـ ${targetName}.`);
  };

  const handleImageFileToDataUrl = (
    file: File | undefined,
    maxBytes: number,
    onLoaded: (dataUrl: string) => void
  ) => {
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      showSavedFeedback('يرجى اختيار صورة بصيغة PNG أو JPG أو WEBP فقط.');
      return;
    }
    if (file.size > maxBytes) {
      showSavedFeedback(`حجم الصورة كبير جداً (الحد الأقصى ${Math.round(maxBytes / 1024)}KB).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onLoaded(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddUser = async () => {
    if (!isSuperAdmin) return;
    if (!newUserName.trim() || !newUserContact.trim()) {
      showSavedFeedback('يرجى إدخال الاسم والبريد الإلكتروني.');
      return;
    }

    // If a valid email & password are provided, create a genuine server-backed account so Moderator/Admin can sign in!
    if (newUserContact.includes('@') && newUserPassword.trim().length >= 6) {
      setCreatingStaff(true);
      try {
        const res = await fetch('/api/admin/staff', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            nameAr: newUserName.trim(),
            email: newUserContact.trim().toLowerCase(),
            password: newUserPassword.trim(),
            role: newUserRole,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showSavedFeedback(data.error || 'تعذر إنشاء الحساب على الخادم.');
          return;
        }
        const created: ManagedUserAccount = {
          ...data.user,
          isCurrentSession: false,
        };
        onUpdateManagedUsers([
          created,
          ...managedUsers.filter(
            (u) => u.emailOrPhone.toLowerCase() !== created.emailOrPhone.toLowerCase()
          ),
        ]);
        setNewUserName('');
        setNewUserContact('');
        setNewUserPassword('');
        showSavedFeedback(
          `تم إنشاء حساب ${
            newUserRole === 'MODERATOR' ? 'المشرف' : newUserRole === 'ADMIN' ? 'المدير' : 'العضو'
          } بنجاح ويمكنه تسجيل الدخول فوراً!`
        );
        return;
      } catch {
        showSavedFeedback('تعذر الاتصال بالخادم لإنشاء الحساب.');
        return;
      } finally {
        setCreatingStaff(false);
      }
    }

    if (newUserRole !== 'USER' && newUserPassword.trim().length < 6) {
      showSavedFeedback('لإضافة مشرف أو مدير، أدخل بريداً إلكترونياً وكلمة مرور (6 محارف على الأقل) ليتمكن من تسجيل الدخول.');
      return;
    }

    const newUser: ManagedUserAccount = {
      id: `usr-${Date.now()}`,
      nameAr: newUserName.trim(),
      emailOrPhone: newUserContact.trim() || 'user@alisms.io',
      balanceUsd: 0,
      totalSpentUsd: 0,
      ordersCount: 0,
      role: newUserRole,
      isCurrentSession: false,
      lastActiveAt: Date.now(),
    };
    onUpdateManagedUsers([newUser, ...managedUsers]);
    setNewUserName('');
    setNewUserContact('');
    setNewUserPassword('');
    showSavedFeedback('تم إضافة الحساب الجديد إلى قائمة المستخدمين.');
  };

  const handleUpdateUserRole = async (u: ManagedUserAccount, role: UserRole) => {
    if (!isSuperAdmin) return;
    if (u.role === 'ADMIN' || u.isProtectedAdmin) {
      showSavedFeedback('حساب المدير العام محمي بشكل دائم ولا يمكن تغيير دوره.');
      return;
    }
    try {
      const res = await fetch(`/api/admin/staff/${encodeURIComponent(u.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showSavedFeedback(err.error || 'تعذر تحديث الدور على الخادم.');
        return;
      }
      const data = await res.json().catch(() => ({}));
      const updatedUser = data?.user;
      onUpdateManagedUsers(
        managedUsers.map((usr) =>
          usr.id === u.id
            ? {
                ...usr,
                role,
                resellerTier: updatedUser?.resellerTier ?? (role === 'RESELLER' ? 'SILVER' : null),
                resellerDiscountPercent:
                  updatedUser?.resellerDiscountPercent ??
                  (role === 'RESELLER' ? resellerCfg.silverDiscountPercent : 0),
              }
            : usr
        )
      );
    } catch {
      onUpdateManagedUsers(managedUsers.map((usr) => (usr.id === u.id ? { ...usr, role } : usr)));
    }
    showSavedFeedback(
      `تم تحديث دور ${u.nameAr} إلى ${
        role === 'ADMIN'
          ? 'مدير عام'
          : role === 'MODERATOR'
          ? 'مشرف'
          : role === 'RESELLER'
          ? 'بائع معتمد'
          : 'عضو'
      }.`
    );
  };

  const handleAddDraftField = () => {
    if (!draftFieldLabel.trim()) return;
    const item: PaymentGatewayCustomField = {
      id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      labelAr: draftFieldLabel.trim(),
      placeholder: draftFieldPlaceholder.trim() || undefined,
      type: draftFieldType,
      required: draftFieldRequired,
    };
    setNewGwFields((prev) => [...prev, item]);
    setDraftFieldLabel('');
    setDraftFieldPlaceholder('');
  };

  const handleAddGateway = () => {
    if (!isSuperAdmin || !newGwName.trim() || !newGwAddress.trim()) return;
    const gw: PaymentGatewayConfig = {
      id: `gw-${Date.now()}`,
      code: newGwName.toLowerCase().replace(/\s+/g, '_'),
      nameAr: newGwName.trim(),
      accountAddress: newGwAddress.trim(),
      accountHolder: newGwHolder.trim() || cmsConfig.platformName,
      qrCodeText: newGwAddress.trim(),
      iconUrl: newGwIconUrl.trim() || undefined,
      qrImageUrl: newGwQrImageUrl.trim() || undefined,
      minTopUpAmount: Number(newGwMin) || 1,
      currency: newGwCurrency,
      isEnabled: true,
      isAutomated: false,
      allowReceiptUpload: newGwAllowReceipt,
      requireReceiptUpload: newGwRequireReceipt,
      customFields: newGwFields,
      instructionsAr:
        newGwInstructions.trim() ||
        `قم بالتحويل إلى ${newGwAddress.trim()} ثم أدخل رقم الإشعار وارفع صورة التحويل.`,
    };
    onUpdatePaymentGateways([...paymentGateways, gw]);
    setNewGwName('');
    setNewGwAddress('');
    setNewGwHolder('');
    setNewGwInstructions('');
    setNewGwIconUrl('');
    setNewGwQrImageUrl('');
    setNewGwFields([]);
    showSavedFeedback('تمت إضافة طريقة الشحن الجديدة مع الأيقونة والـ QR والخانات المطلوبة بنجاح!');
  };

  const handleAddCustomPlan = () => {
    const baseUsd = Number(newPlanBaseUsd) || 5;
    const dataGb = Number(newPlanDataGb) || 10;
    const finalUsd = Number((baseUsd * (1 + settings.esimMarkupPercent / 100)).toFixed(2));
    const plan: ESimPlan = {
      id: `custom-esim-${Date.now()}`,
      nameEn: `${newPlanCountryAr} ${dataGb}GB`,
      countryId: newPlanIso2,
      countryNameAr: newPlanCountryAr,
      countryNameEn: newPlanIso2,
      iso2: newPlanIso2.toUpperCase(),
      region: 'local',
      countriesCount: 1,
      coveredCountries: [
        { iso2: newPlanIso2.toUpperCase(), nameAr: newPlanCountryAr, nameEn: newPlanIso2 },
      ],
      dataAmountGb: dataGb,
      dataLabelAr: `${dataGb} جيجابايت`,
      validityDays: Number(newPlanValidity) || 30,
      networkType: '5G',
      tetheringAllowed: true,
      providerName: `${cmsConfig.platformName} Direct`,
      baseCostUsd: baseUsd,
      finalPriceUsd: finalUsd,
      finalPriceSyp: Math.round(finalUsd * settings.usdToSypRate),
      stockCount: 50,
      isCustomAdminPlan: true,
      isAvailable: true,
    };
    onUpdateCustomESimPlans([plan, ...customESimPlans]);
    showSavedFeedback('تم نشر باقة الـ eSIM المخصصة في المتجر.');
  };

  const handleAddLpaItem = () => {
    if (!newLpaCode.trim()) return;
    const item: ESimLpaInventoryItem = {
      id: `lpa-${Date.now()}`,
      planId: `esim-${newLpaIso2.toLowerCase()}`,
      countryNameAr: newLpaCountryAr,
      iso2: newLpaIso2.toUpperCase(),
      dataLabelAr: newLpaDataLabel,
      smdpAddress: newLpaSmdp.trim(),
      activationCode: newLpaCode.trim(),
      lpaString: `LPA:1$${newLpaSmdp.trim()}$${newLpaCode.trim()}`,
      iccid: newLpaIccid.trim() || `89900${Date.now().toString().slice(-12)}`,
      isUsed: false,
      addedAt: Date.now(),
    };
    onUpdateLpaInventory([item, ...lpaInventory]);
    setNewLpaCode('');
    setNewLpaIccid('');
    showSavedFeedback('تمت إضافة كود LPA إلى مخزون الشرائح الفوري.');
  };

  const handleRunApiTest = async () => {
    setTestingApi(true);
    try {
      const res = await fetch('/api/grizzly/docs-tester', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ methodKey: selectedMethodKey, params: testParams }),
      });
      setTestResult(await res.json());
    } finally {
      setTestingApi(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as FullPlatformBackupPayload;
        onImportBackup(parsed);
      } catch {
        showSavedFeedback('ملف النسخة الاحتياطية غير صالح.');
      }
    };
    reader.readAsText(file);
  };

  if (isPinLocked) {
    return (
      <div className="cyber-glass rounded-2xl p-8 max-w-md mx-auto my-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-black text-white">لوحة الإدارة مقفلة مؤقتاً</h2>
        <input
          type="password"
          value={pinInput}
          onChange={(e) => {
            setPinInput(e.target.value);
            setPinError('');
          }}
          placeholder="أدخل رمز الـ PIN"
          className="w-full px-4 py-2.5 text-center font-mono rounded-xl bg-[#070A12] border border-white/10 text-white focus:outline-none focus:border-cyan-400"
        />
        {pinError && <p className="text-xs text-rose-400 font-bold">{pinError}</p>}
        <button
          type="button"
          onClick={() => {
            if (pinInput === (cmsConfig.adminPin || '1234')) {
              setIsPinLocked(false);
              setPinInput('');
            } else {
              setPinError('رمز الـ PIN غير صحيح');
            }
          }}
          className="w-full py-2.5 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 text-white text-xs font-extrabold cursor-pointer flex items-center justify-center gap-2"
        >
          <Unlock className="w-4 h-4" />
          <span>فتح لوحة الإدارة</span>
        </button>
      </div>
    );
  }

  const pendingResellerAppsCount = resellerApps.filter((a) => a.status === 'PENDING').length;

  const allNavSections: {
    id: AdminSectionId;
    label: string;
    icon: React.ElementType;
    badge?: number;
    moderatorAllowed?: boolean;
  }[] = [
    { id: 'analytics', label: 'المراقبة والأرباح', icon: BarChart3, moderatorAllowed: true },
    {
      id: 'support',
      label: 'الدعم الفني المباشر',
      icon: Headphones,
      badge: openSupportCount > 0 ? openSupportCount : undefined,
      moderatorAllowed: true,
    },
    {
      id: 'users',
      label: 'المستخدمون والمشرفون',
      icon: Users,
      badge: managedUsers.length,
      moderatorAllowed: false,
    },
    {
      id: 'resellers',
      label: 'البائعون والموزعون',
      icon: Store,
      badge: pendingResellerAppsCount > 0 ? pendingResellerAppsCount : activeResellers.length || undefined,
      moderatorAllowed: false,
    },
    {
      id: 'security',
      label: 'الأمان ومكافحة الاحتيال',
      icon: ShieldAlert,
      badge: riskProfiles.length > 0 ? riskProfiles.length : undefined,
      moderatorAllowed: false,
    },
    {
      id: 'orders',
      label: 'الطلبات الشاملة',
      icon: ShoppingBag,
      badge: activeSmsOrders.length + activeESimOrders.length,
      moderatorAllowed: true,
    },
    { id: 'pricing', label: 'التسعير والعملات', icon: Sliders, moderatorAllowed: false },
    {
      id: 'payments',
      label: isSuperAdmin ? 'الدفع وطلبات الشحن' : 'مراجعة طلبات الشحن',
      icon: CreditCard,
      badge: pendingTopUps.length > 0 ? pendingTopUps.length : undefined,
      moderatorAllowed: true,
    },
    {
      id: 'vouchers',
      label: 'قسائم الشحن',
      icon: Ticket,
      badge: vouchers.filter((v) => v.isActive && v.usedCount < v.maxUses).length || undefined,
      moderatorAllowed: false,
    },
    {
      id: 'audit',
      label: 'سجل تدقيق المشرفين',
      icon: ClipboardList,
      moderatorAllowed: false,
    },
    { id: 'cms_esim', label: 'الإعلانات والروابط وeSIM', icon: Layout, moderatorAllowed: false },
    { id: 'api_cloud', label: 'API وSupabase والنسخ', icon: Database, moderatorAllowed: false },
  ];

  const navSections = isSuperAdmin
    ? allNavSections
    : allNavSections.filter((s) => s.moderatorAllowed);

  const activeMethodObj =
    OFFICIAL_GRIZZLY_METHODS.find((m) => m.key === selectedMethodKey) || OFFICIAL_GRIZZLY_METHODS[0];

  return (
    <div className="space-y-4">
      {/* Receipt / QR Lightbox Modal */}
      {receiptLightbox && (
        <div
          onClick={() => setReceiptLightbox(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cyber-glass rounded-2xl p-4 max-w-lg w-full space-y-3 border border-cyan-500/40"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-white">{receiptLightbox.title}</h4>
              <button
                type="button"
                onClick={() => setReceiptLightbox(null)}
                className="p-1.5 rounded-lg bg-white/10 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-black/60 rounded-xl p-2 flex items-center justify-center">
              <img
                src={receiptLightbox.src}
                alt={receiptLightbox.title}
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      <div className="cyber-glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl text-white flex items-center justify-center ${
              isSuperAdmin
                ? 'bg-gradient-to-br from-indigo-600 to-cyan-500'
                : 'bg-gradient-to-br from-emerald-600 to-teal-500'
            }`}
          >
            {isSuperAdmin ? <Shield className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-white">
                {isSuperAdmin ? 'مركز الإدارة والتحكم الشامل' : 'لوحة المشرف (صلاحيات محدودة)'}
              </h2>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                  isSuperAdmin
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                }`}
              >
                {isSuperAdmin ? 'ADMIN' : 'MODERATOR'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isSuperAdmin
                ? 'تحكم كامل بالمستخدمين، المشرفين، الدعم الفني، الطلبات، التسعير، وبوابات الشحن'
                : 'صلاحيات الإشراف: الرد على الدعم الفني، متابعة الطلبات، ومراجعة إشعارات الشحن اليدوي'}
            </p>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSqlHubModal(true)}
              className="px-3 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>مركز SQL Migration</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPinLocked(true)}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>قفل</span>
            </button>
          </div>
        )}
      </div>

      {savedBanner && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* Low Upstream Provider Balance Alert Banner (Super Admin) */}
      {isSuperAdmin && settings.isProviderBalanceLow && settings.providerBalanceUsd !== null && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/45 text-rose-200 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-500/25 text-rose-300 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-black text-rose-200">
                تنبيه حرج: انخفاض رصيد مزود الأرقام (API) تحت الحد الآمن!
              </div>
              <div className="text-[11px] text-rose-300/90 mt-0.5 font-mono">
                الرصيد الحالي: ${settings.providerBalanceUsd.toFixed(2)} USD · الحد التنبيهي المضبوط: $
                {(settings.lowProviderBalanceThresholdUsd ?? 10).toFixed(2)} USD — يرجى شحن حساب المزود لتفادي توقف شراء الأرقام.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveSection('api_cloud')}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold cursor-pointer shrink-0 btn-solid-white"
          >
            ضبط حد التنبيه / API
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <aside className="lg:col-span-3 cyber-glass rounded-2xl p-2 flex lg:flex-col gap-1.5 overflow-x-auto lg:sticky lg:top-20">
          {navSections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-l from-indigo-600 to-cyan-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{sec.label}</span>
                </span>
                {sec.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] ${
                      isActive ? 'bg-black/25 text-white' : 'bg-white/10 text-cyan-300'
                    }`}
                  >
                    {sec.badge}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        <div className="lg:col-span-9 space-y-4">
          {/* 1. ANALYTICS */}
          {activeSection === 'analytics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="cyber-glass rounded-2xl p-4">
                  <div className="text-[11px] text-slate-400">رصيد مزود الأرقام (API)</div>
                  <div className="text-xl font-black font-mono text-cyan-300 mt-1">
                    {settings.providerBalanceUsd !== null
                      ? `$${settings.providerBalanceUsd.toFixed(2)}`
                      : 'غير متصل'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {settings.isLiveMode ? 'ربط مباشر فعّال 🟢' : 'أدخل مفتاح API في التبويب الأخير'}
                  </div>
                </div>

                <div className="cyber-glass rounded-2xl p-4">
                  <div className="text-[11px] text-slate-400">إجمالي المبيعات</div>
                  <div className="text-xl font-black font-mono text-white mt-1">
                    ${totalSalesUsd.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-indigo-300 mt-1">
                    {completedSms.length} SMS · {validESims.length} eSIM
                  </div>
                </div>

                <div className="cyber-glass rounded-2xl p-4">
                  <div className="text-[11px] text-slate-400">صافي الأرباح المقدّر</div>
                  <div className="text-xl font-black font-mono text-emerald-400 mt-1">
                    +${netProfitUsd.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">فارق الربح المضاف تلقائياً</div>
                </div>

                <div className="cyber-glass rounded-2xl p-4">
                  <div className="text-[11px] text-slate-400">نشط / شحن / دعم</div>
                  <div className="text-xl font-black font-mono text-amber-300 mt-1">
                    {activeSms.length + pendingTopUps.length + openSupportCount}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {activeSms.length} رقم · {pendingTopUps.length} شحن · {openSupportCount} دعم
                  </div>
                </div>
              </div>

              <div className="cyber-glass rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-black text-white">
                  سجل المراقبة الحي للعمليات ({activityLogs.length})
                </h3>
                <div className="space-y-2">
                  {activityLogs
                    .slice((logsPage - 1) * PAGE_SIZE, logsPage * PAGE_SIZE)
                    .map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-[#070A12] border border-white/10 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{log.titleAr}</div>
                          <div className="text-[11px] text-slate-400 truncate">{log.detailsAr}</div>
                        </div>
                        <div className="text-left shrink-0">
                          {log.amountUsd !== undefined && (
                            <div className="text-xs font-mono font-bold text-cyan-300">
                              ${log.amountUsd.toFixed(2)}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 font-mono">
                            {new Date(log.createdAt).toLocaleTimeString('ar-SY')}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
                <AdminPagination
                  currentPage={logsPage}
                  totalItems={activityLogs.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setLogsPage}
                  itemLabel="عملية"
                />
              </div>
            </div>
          )}

          {/* 2. LIVE SUPPORT CENTER & SETTINGS */}
          {activeSection === 'support' && (
            <div className="space-y-4">
              {/* Support System Settings (Super Admin only) */}
              {isSuperAdmin && (
                <div className="cyber-glass rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <span>إعدادات نظام الدعم الفني وهوية المدير</span>
                    </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-300">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cmsConfig.supportChatEnabled !== false}
                        onChange={(e) =>
                          onUpdateCmsConfig({ ...cmsConfig, supportChatEnabled: e.target.checked })
                        }
                      />
                      <span>تفعيل الدعم</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cmsConfig.supportAllowVoice !== false}
                        onChange={(e) =>
                          onUpdateCmsConfig({ ...cmsConfig, supportAllowVoice: e.target.checked })
                        }
                      />
                      <span>السماح بالصوت</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cmsConfig.supportAllowImages !== false}
                        onChange={(e) =>
                          onUpdateCmsConfig({ ...cmsConfig, supportAllowImages: e.target.checked })
                        }
                      />
                      <span>السماح بالصور</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">اسم المدير الظاهر في المحادثة</label>
                    <input
                      type="text"
                      value={cmsConfig.supportAdminDisplayName || ''}
                      onChange={(e) =>
                        onUpdateCmsConfig({ ...cmsConfig, supportAdminDisplayName: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">اللقب المميز للمدير</label>
                    <input
                      type="text"
                      value={cmsConfig.supportAdminBadgeTitle || ''}
                      onChange={(e) =>
                        onUpdateCmsConfig({ ...cmsConfig, supportAdminBadgeTitle: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] text-slate-400 block mb-1">رسالة الترحيب التلقائية</label>
                    <input
                      type="text"
                      value={cmsConfig.supportWelcomeMessage || ''}
                      onChange={(e) =>
                        onUpdateCmsConfig({ ...cmsConfig, supportWelcomeMessage: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                </div>
              </div>
              )}

              {/* Conversations Inbox + Live Reply Panel */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4 cyber-glass rounded-2xl p-3 space-y-2 max-h-[480px] overflow-y-auto">
                  <div className="text-xs font-black text-white px-1 pb-1 border-b border-white/10">
                    محادثات الزبائن ({supportThreads.length})
                  </div>
                  {supportThreads.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      لا توجد رسائل دعم واردة حتى الآن.
                    </div>
                  ) : (
                    supportThreads.map((t) => {
                      const isSel = selectedThread?.id === t.id;
                      const lastMsg = t.messages[t.messages.length - 1];
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedThreadId(t.id)}
                          className={`w-full p-2.5 rounded-xl border text-right transition-colors cursor-pointer space-y-1 ${
                            isSel
                              ? 'bg-indigo-600/25 border-cyan-400 text-white'
                              : 'bg-[#070A12] border-white/10 text-slate-300 hover:border-white/25'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold truncate">{t.userName}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                t.status === 'OPEN'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-slate-600/40 text-slate-300'
                              }`}
                            >
                              {t.status === 'OPEN' ? 'مفتوحة' : 'مغلقة'}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            {t.userEmail}
                          </div>
                          {lastMsg && (
                            <div className="text-[11px] text-slate-400 truncate">
                              {lastMsg.text || (lastMsg.type === 'audio' ? '🎤 رسالة صوتية' : '🖼️ صورة')}
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="md:col-span-8 cyber-glass rounded-2xl overflow-hidden flex flex-col h-[480px]">
                  {!selectedThread ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-400 p-6 text-center">
                      اختر محادثة من القائمة للرد على العميل بالصوت أو الصور أو النص مباشرة.
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-3 bg-[#070A12] border-b border-white/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                            {selectedThread.userName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-white truncate">
                              {selectedThread.userName}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 truncate">
                              {selectedThread.userEmail}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleThreadStatus(selectedThread)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-cyan-300 cursor-pointer"
                          >
                            {selectedThread.status === 'OPEN' ? 'إغلاق التذكرة' : 'إعادة فتح'}
                          </button>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteThread(selectedThread.id)}
                              className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 cursor-pointer"
                              title="حذف المحادثة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
                        {selectedThread.messages.map((msg) => {
                          const isAdmin = msg.senderRole === 'ADMIN';
                          return (
                            <div
                              key={msg.id}
                              className={`flex items-start gap-2 ${isAdmin ? 'flex-row-reverse' : ''}`}
                            >
                              {isAdmin ? (
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shrink-0">
                                  <Crown className="w-3.5 h-3.5" />
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-slate-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                  {msg.senderName.charAt(0)}
                                </div>
                              )}
                              <div
                                className={`max-w-[78%] p-2.5 rounded-2xl space-y-1 ${
                                  isAdmin
                                    ? 'bg-amber-500/15 border border-amber-400/40'
                                    : 'bg-[#070A12] border border-white/10'
                                }`}
                              >
                                <div className="flex items-center gap-1 text-[10px] font-bold">
                                  <span className={isAdmin ? 'text-amber-300' : 'text-cyan-300'}>
                                    {msg.senderName}
                                  </span>
                                  {isAdmin && <BadgeCheck className="w-3 h-3 text-amber-400" />}
                                </div>
                                {msg.text && <p className="text-xs text-white">{msg.text}</p>}
                                {msg.type === 'image' && msg.mediaDataUrl && (
                                  <img
                                    src={msg.mediaDataUrl}
                                    alt="مرفق"
                                    className="rounded-lg max-h-44 object-contain"
                                  />
                                )}
                                {msg.type === 'audio' && msg.mediaDataUrl && (
                                  <audio controls src={msg.mediaDataUrl} className="h-8 max-w-[210px]" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {showAdminEmoji && (
                        <div className="px-3 py-2 bg-[#070A12] border-t border-white/10 flex flex-wrap gap-1.5">
                          {ADMIN_EMOJIS.map((em) => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => setReplyText((p) => `${p}${em}`)}
                              className="w-8 h-8 rounded-lg hover:bg-white/10 text-base cursor-pointer"
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      )}

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (replyText.trim()) sendAdminReply({ type: 'text', text: replyText.trim() });
                        }}
                        className="p-2.5 bg-[#070A12] border-t border-white/10 flex items-center gap-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => setShowAdminEmoji((v) => !v)}
                          className="w-8 h-8 rounded-lg bg-white/5 text-amber-400 flex items-center justify-center cursor-pointer"
                        >
                          <Smile className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => adminImageInputRef.current?.click()}
                          className="w-8 h-8 rounded-lg bg-white/5 text-cyan-400 flex items-center justify-center cursor-pointer"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                        <input
                          ref={adminImageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAdminImagePick}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={adminRecording ? stopAdminRecording : startAdminRecording}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer ${
                            adminRecording ? 'bg-rose-600 text-white' : 'bg-white/5 text-emerald-400'
                          }`}
                        >
                          {adminRecording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-4 h-4" />}
                        </button>

                        {adminRecording ? (
                          <div className="flex-1 px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 text-xs font-mono font-bold">
                            تسجيل رد صوتي... 00:{String(adminRecordSec).padStart(2, '0')}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="اكتب رد الإدارة للعميل..."
                            className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-[#0B0F1A] border border-white/10 text-white"
                          />
                        )}

                        <button
                          type="submit"
                          disabled={sendingReply || adminRecording || !replyText.trim()}
                          className="px-3.5 h-9 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>إرسال</span>
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. USERS & MODERATORS MANAGEMENT (ADMIN ONLY) */}
          {activeSection === 'users' && isSuperAdmin && (
            <div className="space-y-4">
              <div className="cyber-glass rounded-2xl p-4 space-y-3 border border-emerald-500/25">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-400" />
                    <span>إضافة مشرف جديد (Moderator) أو مستخدم</span>
                  </h3>
                  <span className="text-[10px] text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-md font-bold">
                    يمكنك إضافة عدد غير محدود من المشرفين
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  المشرف يملك صلاحية الرد على الدعم الفني، متابعة الطلبات، ومراجعة إشعارات الشحن اليدوي فقط — دون الوصول لمفاتيح API أو التسعير أو إعدادات الموقع.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="الاسم الكامل"
                    className="px-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                  />
                  <input
                    type="email"
                    value={newUserContact}
                    onChange={(e) => setNewUserContact(e.target.value)}
                    placeholder="البريد الإلكتروني للدخول"
                    className="px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    dir="ltr"
                  />
                  <input
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="كلمة المرور (6+ محارف)"
                    className="px-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                    dir="ltr"
                  />
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="px-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                  >
                    <option value="MODERATOR">مشرف (MODERATOR)</option>
                    <option value="RESELLER">بائع معتمد (RESELLER)</option>
                    <option value="USER">عضو (USER)</option>
                  </select>
                  <button
                    type="button"
                    disabled={creatingStaff}
                    onClick={handleAddUser}
                    className="px-4 py-2 rounded-xl bg-gradient-to-l from-emerald-600 to-cyan-600 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 btn-solid-white"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{creatingStaff ? 'جاري الإنشاء...' : 'إضافة الحساب'}</span>
                  </button>
                </div>
              </div>

              <div className="cyber-glass rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-white">
                    قائمة المستخدمين والمشرفين والبائعين ({filteredUsers.length})
                  </h3>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setUsersPage(1);
                      }}
                      placeholder="ابحث بالاسم أو البريد..."
                      className="w-full pr-8 pl-3 py-1.5 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredUsers
                    .slice((usersPage - 1) * PAGE_SIZE, usersPage * PAGE_SIZE)
                    .map((u) => {
                      const isLockedSuperAdmin = u.role === 'ADMIN' || Boolean(u.isProtectedAdmin);
                      return (
                        <div
                          key={u.id}
                          className={`p-3.5 rounded-xl border space-y-3 ${
                            u.isSuspended
                              ? 'bg-rose-950/15 border-rose-500/40'
                              : isLockedSuperAdmin
                              ? 'bg-amber-950/15 border-amber-500/35'
                              : 'bg-[#070A12] border-white/10'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-xs sm:text-sm font-extrabold text-white flex items-center flex-wrap gap-2">
                                <span>{u.nameAr}</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                                    u.role === 'ADMIN'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                                      : u.role === 'MODERATOR'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : u.role === 'RESELLER'
                                      ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                                      : 'bg-cyan-500/15 text-cyan-300'
                                  }`}
                                >
                                  {u.role === 'ADMIN' && <Lock className="w-2.5 h-2.5" />}
                                  {u.role === 'RESELLER' && <Award className="w-2.5 h-2.5" />}
                                  <span>
                                    {u.role === 'ADMIN'
                                      ? 'مدير عام محمي'
                                      : u.role === 'MODERATOR'
                                      ? 'مشرف'
                                      : u.role === 'RESELLER'
                                      ? `بائع معتمد (${u.resellerTier === 'GOLD' ? 'ذهبي' : 'فضي'}${
                                          u.resellerDiscountPercent ? ` -${u.resellerDiscountPercent}%` : ''
                                        })`
                                      : 'عضو'}
                                  </span>
                                </span>
                                {u.isSuspended && (
                                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px]">
                                    موقوف
                                  </span>
                                )}
                                {(u.fraudScore || 0) > 0 && (
                                  <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 font-mono text-[10px]">
                                    نقاط المخاطر: {u.fraudScore}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                {u.emailOrPhone} · الإنفاق: ${u.totalSpentUsd.toFixed(2)} · الطلبات:{' '}
                                {u.ordersCount}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="text-left">
                                <div className="text-[10px] text-slate-400">رصيد المحفظة</div>
                                <div className="text-base font-black font-mono text-emerald-400">
                                  ${u.balanceUsd.toFixed(2)}
                                </div>
                              </div>

                              {isLockedSuperAdmin ? (
                                <span
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/35 text-amber-300 text-[10px] font-extrabold flex items-center gap-1"
                                  title="دور المدير العام غير قابل للتعديل أو الحذف أمنياً"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>حساب محمي</span>
                                </span>
                              ) : (
                                !u.isCurrentSession && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const nextSusp = !u.isSuspended;
                                        try {
                                          await fetch(`/api/admin/staff/${encodeURIComponent(u.id)}`, {
                                            method: 'PATCH',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              Authorization: `Bearer ${authToken}`,
                                            },
                                            body: JSON.stringify({ isSuspended: nextSusp }),
                                          });
                                        } catch {
                                          // ignore
                                        }
                                        onUpdateManagedUsers(
                                          managedUsers.map((usr) =>
                                            usr.id === u.id ? { ...usr, isSuspended: nextSusp } : usr
                                          )
                                        );
                                        showSavedFeedback(
                                          u.isSuspended ? 'تم تفعيل الحساب.' : 'تم إيقاف الحساب مؤقتاً.'
                                        );
                                      }}
                                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-amber-300 cursor-pointer"
                                      title={u.isSuspended ? 'تفعيل الحساب' : 'إيقاف الحساب'}
                                    >
                                      <Ban className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(
                                            `/api/admin/staff/${encodeURIComponent(u.id)}`,
                                            {
                                              method: 'DELETE',
                                              headers: { Authorization: `Bearer ${authToken}` },
                                            }
                                          );
                                          if (!res.ok) {
                                            const d = await res.json().catch(() => ({}));
                                            showSavedFeedback(d.error || 'تعذر حذف الحساب.');
                                            return;
                                          }
                                        } catch {
                                          // ignore
                                        }
                                        onUpdateManagedUsers(
                                          managedUsers.filter((usr) => usr.id !== u.id)
                                        );
                                        showSavedFeedback('تم حذف الحساب.');
                                      }}
                                      className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer"
                                      title="حذف الحساب"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-white/10">
                            {isLockedSuperAdmin ? (
                              <div className="sm:col-span-3 px-2.5 py-2 text-[11px] font-bold rounded-lg bg-amber-500/10 border border-amber-400/30 text-amber-300 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 shrink-0" />
                                <span>مدير عام (غير قابل للتغيير)</span>
                              </div>
                            ) : (
                              <select
                                value={u.role}
                                onChange={(e) => handleUpdateUserRole(u, e.target.value as UserRole)}
                                className="sm:col-span-3 px-2.5 py-2 text-xs rounded-lg bg-[#0B0F1A] border border-white/10 text-white"
                              >
                                <option value="USER">عضو (USER)</option>
                                <option value="RESELLER">بائع معتمد (RESELLER)</option>
                                <option value="MODERATOR">مشرف (MODERATOR)</option>
                              </select>
                            )}

                            <input
                              type="number"
                              value={walletAdjAmount[u.id] || ''}
                              onChange={(e) =>
                                setWalletAdjAmount((prev) => ({ ...prev, [u.id]: e.target.value }))
                              }
                              placeholder="المبلغ ($)"
                              className="sm:col-span-3 px-2.5 py-2 text-xs font-mono rounded-lg bg-[#0B0F1A] border border-white/10 text-white"
                            />

                            <input
                              type="text"
                              value={walletAdjReason[u.id] || ''}
                              onChange={(e) =>
                                setWalletAdjReason((prev) => ({ ...prev, [u.id]: e.target.value }))
                              }
                              placeholder="السبب (تعويض / تسوية)"
                              className="sm:col-span-3 px-2.5 py-2 text-xs rounded-lg bg-[#0B0F1A] border border-white/10 text-white"
                            />

                            <div className="sm:col-span-3 grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const amt = Number(walletAdjAmount[u.id] || 0);
                                  if (amt > 0) {
                                    onAdjustUserWallet(
                                      u.id,
                                      amt,
                                      walletAdjReason[u.id] || 'إضافة رصيد إدارية'
                                    );
                                    setWalletAdjAmount((p) => ({ ...p, [u.id]: '' }));
                                    showSavedFeedback(`تمت إضافة $${amt.toFixed(2)} إلى ${u.nameAr}`);
                                  }
                                }}
                                className="py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                              >
                                + إضافة
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const amt = Number(walletAdjAmount[u.id] || 0);
                                  if (amt > 0) {
                                    onAdjustUserWallet(
                                      u.id,
                                      -amt,
                                      walletAdjReason[u.id] || 'خصم رصيد إداري'
                                    );
                                    setWalletAdjAmount((p) => ({ ...p, [u.id]: '' }));
                                    showSavedFeedback(`تم خصم $${amt.toFixed(2)} من ${u.nameAr}`);
                                  }
                                }}
                                className="py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                              >
                                - خصم
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <AdminPagination
                  currentPage={usersPage}
                  totalItems={filteredUsers.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setUsersPage}
                  itemLabel="مستخدم"
                />
              </div>
            </div>
          )}

          {/* 4. COMPREHENSIVE ORDERS CONTROL (Max 10 + Show More) */}
          {activeSection === 'orders' && (
            <div className="cyber-glass rounded-2xl p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 p-1 rounded-xl bg-[#070A12] border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminOrderType('SMS');
                      setOrdersPage(1);
                    }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${
                      adminOrderType === 'SMS' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    طلبات أرقام SMS ({activeSmsOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminOrderType('ESIM');
                      setOrdersPage(1);
                    }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${
                      adminOrderType === 'ESIM' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    طلبات شرائح eSIM ({activeESimOrders.length})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={adminOrderSearch}
                    onChange={(e) => {
                      setAdminOrderSearch(e.target.value);
                      setOrdersPage(1);
                    }}
                    placeholder="ابحث بالرقم أو الخدمة أو ICCID..."
                    className="w-full pr-8 pl-3 py-1.5 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                  />
                </div>
              </div>

              {adminOrderType === 'SMS' ? (
                <div className="space-y-2.5">
                  {filteredAdminSms.length === 0 ? (
                    <p className="py-10 text-center text-xs text-slate-400">لا توجد طلبات أرقام.</p>
                  ) : (
                    <>
                      {filteredAdminSms
                        .slice((ordersPage - 1) * PAGE_SIZE, ordersPage * PAGE_SIZE)
                        .map((o) => {
                          const canCancel = ![
                            'CANCELLED',
                            'EXPIRED',
                            'COMPLETED',
                            'SMS_RECEIVED',
                          ].includes(o.status);
                          return (
                            <div
                              key={o.id}
                              className="p-3 rounded-xl bg-[#070A12] border border-white/10 flex flex-wrap items-center justify-between gap-2"
                            >
                              <div>
                                <div className="text-xs font-extrabold text-white">
                                  {o.serviceNameAr} ({o.countryNameAr}) —{' '}
                                  <span className="font-mono text-cyan-300" dir="ltr">
                                    {o.phoneNumber}
                                  </span>
                                </div>
                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  #{o.activationId} · الحالة: {o.status} · السعر: $
                                  {o.priceUsd.toFixed(2)}
                                  {o.smsCode ? ` · OTP: ${o.smsCode}` : ''}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {onAdminCompleteSmsOrder && o.status === 'SMS_RECEIVED' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onAdminCompleteSmsOrder(o.id);
                                      showSavedFeedback('تم إنهاء التفعيل إدارياً بنجاح.');
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                                  >
                                    تأكيد الإنهاء
                                  </button>
                                )}
                                {canCancel && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onAdminCancelOrder('SMS', o.id, true);
                                      showSavedFeedback('تم إلغاء الرقم واسترداد قيمته لمحفظة العميل.');
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/40 text-rose-300 text-[11px] font-bold cursor-pointer"
                                  >
                                    إلغاء واسترداد
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      <AdminPagination
                        currentPage={ordersPage}
                        totalItems={filteredAdminSms.length}
                        pageSize={PAGE_SIZE}
                        onPageChange={setOrdersPage}
                        itemLabel="طلب"
                      />
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredAdminESim.length === 0 ? (
                    <p className="py-10 text-center text-xs text-slate-400">لا توجد طلبات eSIM.</p>
                  ) : (
                    <>
                      {filteredAdminESim
                        .slice((ordersPage - 1) * PAGE_SIZE, ordersPage * PAGE_SIZE)
                        .map((e) => (
                          <div
                            key={e.id}
                            className="p-3 rounded-xl bg-[#070A12] border border-white/10 flex flex-wrap items-center justify-between gap-2"
                          >
                            <div>
                              <div className="text-xs font-extrabold text-white">
                                {e.countryNameAr} ({e.dataLabelAr}) — ICCID:{' '}
                                <span className="font-mono text-cyan-300">{e.iccid}</span>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                الحالة: {e.status} · السعر: ${e.priceUsd.toFixed(2)}
                              </div>
                            </div>
                            {e.status !== 'CANCELLED' && (
                              <button
                                type="button"
                                onClick={() => {
                                  onAdminCancelOrder('ESIM', e.id, true);
                                  showSavedFeedback('تم إلغاء الشريحة وإرجاع رصيدها للمحفظة.');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/40 text-rose-300 text-[11px] font-bold cursor-pointer"
                              >
                                إلغاء واسترداد للعميل
                              </button>
                            )}
                          </div>
                        ))}
                      <AdminPagination
                        currentPage={ordersPage}
                        totalItems={filteredAdminESim.length}
                        pageSize={PAGE_SIZE}
                        onPageChange={setOrdersPage}
                        itemLabel="شريحة"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 5. PRICING & SYRIA TODAY LIVE EXCHANGE RATES */}
          {activeSection === 'pricing' && isSuperAdmin && (
            <div className="space-y-4">
              <div className="cyber-glass rounded-2xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-white">
                    نسب الربح العامة وأسعار الصرف (سوريا اليوم API)
                  </h3>
                  <button
                    type="button"
                    onClick={handleFetchSyriaToday}
                    disabled={syncingSyriaToday}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <TrendingUp className={`w-3.5 h-3.5 ${syncingSyriaToday ? 'animate-spin' : ''}`} />
                    <span>
                      {syncingSyriaToday
                        ? 'جاري الجلب من سوريا اليوم...'
                        : 'جلب أسعار الصرف تلقائياً (سوريا اليوم)'}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">ربح أرقام SMS (%)</label>
                    <input
                      type="number"
                      value={smsMarkup}
                      onChange={(e) => setSmsMarkup(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">ربح شرائح eSIM (%)</label>
                    <input
                      type="number"
                      value={esimMarkup}
                      onChange={(e) => setEsimMarkup(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">سعر USD مقابل SYP</label>
                    <input
                      type="number"
                      value={usdToSyp}
                      onChange={(e) => setUsdToSyp(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">سعر USD مقابل TRY</label>
                    <input
                      type="number"
                      step="0.1"
                      value={usdToTry}
                      onChange={(e) => setUsdToTry(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">سعر USD مقابل USDT</label>
                    <input
                      type="number"
                      step="0.01"
                      value={usdToUsdt}
                      onChange={(e) => setUsdToUsdt(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">سعر صرف RUB إلى USD</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={rubToUsd}
                      onChange={(e) => setRubToUsd(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveGlobalPricingOrApi}
                  disabled={savingSettings}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingSettings ? 'جاري التحديث...' : 'حفظ وتطبيق الأسعار لحظياً'}</span>
                </button>
              </div>

              <div className="cyber-glass rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-black text-white">تخصيص سعر أو إخفاء تطبيق / دولة</h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  <select
                    value={ovrTargetType}
                    onChange={(e) => {
                      const t = e.target.value as 'service' | 'country';
                      setOvrTargetType(t);
                      setOvrTargetCode(t === 'service' ? 'wa' : '16');
                    }}
                    className="px-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                  >
                    <option value="service">تطبيق / خدمة</option>
                    <option value="country">دولة</option>
                  </select>

                  <select
                    value={ovrTargetCode}
                    onChange={(e) => setOvrTargetCode(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                  >
                    {ovrTargetType === 'service'
                      ? services.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.nameAr} ({s.code})
                          </option>
                        ))
                      : countries.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nameAr} ({c.dialCode})
                          </option>
                        ))}
                  </select>

                  <input
                    type="number"
                    value={ovrCustomMarkup}
                    onChange={(e) => setOvrCustomMarkup(e.target.value)}
                    placeholder="نسبة ربح % (اختياري)"
                    className="px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={ovrFixedUsd}
                    onChange={(e) => setOvrFixedUsd(e.target.value)}
                    placeholder="سعر ثابت $ (اختياري)"
                    className="px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddPricingOverride}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-extrabold cursor-pointer"
                  >
                    + حفظ التخصيص
                  </button>
                </div>

                <div className="space-y-2 pt-2">
                  {pricingOverrides
                    .slice((overridesPage - 1) * PAGE_SIZE, overridesPage * PAGE_SIZE)
                    .map((rule) => (
                      <div
                        key={rule.id}
                        className="p-2.5 rounded-xl bg-[#070A12] border border-white/10 flex items-center justify-between gap-2"
                      >
                        <div className="text-xs">
                          <span className="font-extrabold text-white">{rule.targetNameAr}</span>
                          <span className="text-slate-400 font-mono mr-2">
                            {rule.fixedPriceUsd !== null
                              ? `سعر ثابت $${rule.fixedPriceUsd}`
                              : rule.customMarkupPercent !== null
                              ? `نسبة ربح ${rule.customMarkupPercent}%`
                              : 'نسبة عامة'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdatePricingOverrides(
                                pricingOverrides.map((r) =>
                                  r.id === rule.id ? { ...r, isHidden: !r.isHidden } : r
                                )
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                              rule.isHidden
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {rule.isHidden ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                            <span>{rule.isHidden ? 'مخفي' : 'ظاهر'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdatePricingOverrides(
                                pricingOverrides.filter((r) => r.id !== rule.id)
                              )
                            }
                            className="p-1.5 rounded-lg bg-white/5 text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  <AdminPagination
                    currentPage={overridesPage}
                    totalItems={pricingOverrides.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setOverridesPage}
                    itemLabel="قاعدة"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 6. PAYMENTS, RECEIPT REVIEW & ADVANCED GATEWAY BUILDER */}
          {activeSection === 'payments' && (
            <div className="space-y-4">
              {/* Top-Up Queue (Accessible to BOTH Admin & Moderators) */}
              <div className="cyber-glass rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-black text-white">
                  طلبات شحن الرصيد وإشعارات الدفع الواردة ({topUpRequests.length})
                </h3>
                <div className="space-y-3">
                  {topUpRequests
                    .slice((topupsPage - 1) * PAGE_SIZE, topupsPage * PAGE_SIZE)
                    .map((req) => (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-xl bg-[#070A12] border border-white/10 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {req.receiptImageUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setReceiptLightbox({
                                  src: req.receiptImageUrl!,
                                  title: `إشعار دفع ${req.userNameAr} — #${req.referenceId}`,
                                })
                              }
                              className="group relative w-16 h-16 rounded-xl overflow-hidden border border-cyan-400/50 shrink-0 cursor-pointer bg-black"
                              title="اضغط لتكبير صورة إشعار الدفع"
                            >
                              <img
                                src={req.receiptImageUrl}
                                alt="إشعار الدفع"
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <ZoomIn className="w-4 h-4" />
                              </span>
                            </button>
                          )}

                          <div className="min-w-0 space-y-1">
                            <div className="text-xs font-extrabold text-white">
                              {req.userNameAr} — {req.gatewayNameAr}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              رقم الإشعار: <span className="text-cyan-300">{req.referenceId}</span> ·
                              المبلغ:{' '}
                              <span className="text-emerald-400 font-bold">
                                {req.amountOriginal.toLocaleString('en-US')} {req.currencyOriginal} (≈ $
                                {req.equivalentUsd.toFixed(2)})
                              </span>
                            </div>

                            {req.customFieldValues &&
                              Object.keys(req.customFieldValues).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {Object.entries(req.customFieldValues).map(([k, v]) => (
                                    <span
                                      key={k}
                                      className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-400/30 text-[10px] text-slate-200"
                                    >
                                      <strong className="text-cyan-300">{k}:</strong> {v}
                                    </span>
                                  ))}
                                </div>
                              )}

                            {req.receiptDuplicateWarning && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/45 text-rose-300 text-[10px] font-black mt-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>تحذير أمني: صورة إشعار مطابقة تماماً لصورة رُفعت مسبقاً (احتمال تكرار)!</span>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              {req.receiptArchiveId && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-mono text-emerald-300">
                                  <Archive className="w-3 h-3" />
                                  <span>
                                    أرشيف محمي
                                    {req.receiptSizeBytes
                                      ? ` · ${Math.max(1, Math.round(req.receiptSizeBytes / 1024))}KB`
                                      : ''}
                                  </span>
                                </span>
                              )}

                              {req.reviewedBy && (
                                <span className="text-[10px] text-slate-400">
                                  المراجع: <strong className="text-slate-200">{req.reviewedBy}</strong>
                                </span>
                              )}
                            </div>

                            {(req.receiptImageUrl || req.receiptArchiveId) && (
                              <button
                                type="button"
                                onClick={() => handleOpenArchivedReceipt(req)}
                                className="text-[11px] text-cyan-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <ZoomIn className="w-3.5 h-3.5" />
                                <span>عرض صورة إشعار الدفع بالحجم الكامل</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : req.status === 'REJECTED'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {req.status === 'PENDING'
                            ? 'بانتظار المراجعة'
                            : req.status === 'APPROVED'
                            ? 'تم القبول والشحن ✓'
                            : `مرفوض: ${req.rejectionReason || ''}`}
                        </span>
                      </div>

                      {req.status === 'PENDING' && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => {
                              onProcessTopUpRequest(req.id, 'APPROVE');
                              showSavedFeedback('تم اعتماد طلب الشحن وإضافة الرصيد للمحفظة.');
                            }}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer btn-solid-white"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>قبول وشحن الرصيد</span>
                          </button>

                          <input
                            type="text"
                            value={rejectReasonById[req.id] || ''}
                            onChange={(e) =>
                              setRejectReasonById((p) => ({ ...p, [req.id]: e.target.value }))
                            }
                            placeholder="سبب الرفض (اختياري)"
                            className="flex-1 min-w-[160px] px-3 py-1.5 text-xs rounded-lg bg-[#0B0F1A] border border-white/10 text-white"
                          />

                          <button
                            type="button"
                            onClick={() => {
                              onProcessTopUpRequest(
                                req.id,
                                'REJECT',
                                rejectReasonById[req.id] || 'رقم الإشعار أو الصورة غير مطابقة'
                              );
                              showSavedFeedback('تم رفض طلب الشحن.');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>رفض</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <AdminPagination
                    currentPage={topupsPage}
                    totalItems={topUpRequests.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setTopupsPage}
                    itemLabel="طلب شحن"
                  />
                </div>
              </div>

              {/* Advanced Payment Gateway Builder (Strictly ADMIN ONLY) */}
              {isSuperAdmin && (
                <div className="cyber-glass rounded-2xl p-4 space-y-4 border border-cyan-500/25">
                  <div>
                    <h3 className="text-sm font-black text-white">
                      باني طرق الشحن المتقدم (أيقونة + صورة QR + تعليمات + خانات مخصصة + رفع الإشعار)
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      أضف أو عدّل أي طريقة شحن، ارفع أيقونتها وصورة الـ QR الخاصة بها، وحدد الخانات المطلوبة من العميل.
                    </p>
                  </div>

                  {/* New Gateway Creator Form */}
                  <div className="p-3.5 rounded-xl bg-[#070A12] border border-white/10 space-y-3">
                    <div className="text-xs font-extrabold text-cyan-300">+ إضافة طريقة شحن جديدة</div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={newGwName}
                        onChange={(e) => setNewGwName(e.target.value)}
                        placeholder="اسم طريقة الشحن *"
                        className="px-3 py-2 text-xs rounded-xl bg-[#0B0F1A] border border-white/10 text-white"
                      />
                      <input
                        type="text"
                        value={newGwAddress}
                        onChange={(e) => setNewGwAddress(e.target.value)}
                        placeholder="عنوان المحفظة / IBAN / الرقم *"
                        className="px-3 py-2 text-xs font-mono rounded-xl bg-[#0B0F1A] border border-white/10 text-white"
                        dir="ltr"
                      />
                      <input
                        type="text"
                        value={newGwHolder}
                        onChange={(e) => setNewGwHolder(e.target.value)}
                        placeholder="اسم المستفيد"
                        className="px-3 py-2 text-xs rounded-xl bg-[#0B0F1A] border border-white/10 text-white"
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={newGwCurrency}
                          onChange={(e) => setNewGwCurrency(e.target.value as SupportedCurrency)}
                          className="px-2 py-2 text-xs rounded-xl bg-[#0B0F1A] border border-white/10 text-white"
                        >
                          <option value="USD">USD</option>
                          <option value="USDT">USDT</option>
                          <option value="SYP">SYP</option>
                          <option value="TRY">TRY</option>
                        </select>
                        <input
                          type="number"
                          value={newGwMin}
                          onChange={(e) => setNewGwMin(e.target.value)}
                          placeholder="الحد الأدنى"
                          className="px-2 py-2 text-xs font-mono rounded-xl bg-[#0B0F1A] border border-white/10 text-white"
                        />
                      </div>
                    </div>

                    {/* Icon Upload + QR Image Upload */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="p-2.5 rounded-xl bg-[#0B0F1A] border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                            <span>أيقونة طريقة الشحن (اختياري)</span>
                          </span>
                          <label className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-cyan-300 text-[10px] font-bold cursor-pointer">
                            رفع أيقونة
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                handleImageFileToDataUrl(e.target.files?.[0], 512 * 1024, setNewGwIconUrl);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          {newGwIconUrl && (
                            <img
                              src={newGwIconUrl}
                              alt="Icon"
                              className="w-9 h-9 rounded-lg object-cover border border-white/15 shrink-0"
                            />
                          )}
                          <input
                            type="text"
                            value={newGwIconUrl}
                            onChange={(e) => setNewGwIconUrl(e.target.value)}
                            placeholder="أو الصق رابط أيقونة https://..."
                            className="flex-1 px-2.5 py-1.5 text-[11px] font-mono rounded-lg bg-[#070A12] border border-white/10 text-white"
                            dir="ltr"
                          />
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#0B0F1A] border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                            <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                            <span>صورة رمز QR للدفع (تعرض للزبون)</span>
                          </span>
                          <label className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-[10px] font-bold cursor-pointer">
                            رفع صورة QR
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                handleImageFileToDataUrl(
                                  e.target.files?.[0],
                                  1500 * 1024,
                                  setNewGwQrImageUrl
                                );
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          {newGwQrImageUrl && (
                            <img
                              src={newGwQrImageUrl}
                              alt="QR"
                              className="w-9 h-9 rounded-lg object-cover bg-white p-0.5 shrink-0"
                            />
                          )}
                          <input
                            type="text"
                            value={newGwQrImageUrl}
                            onChange={(e) => setNewGwQrImageUrl(e.target.value)}
                            placeholder="أو الصق رابط صورة QR https://..."
                            className="flex-1 px-2.5 py-1.5 text-[11px] font-mono rounded-lg bg-[#070A12] border border-white/10 text-white"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Instructions */}
                    <textarea
                      rows={2}
                      value={newGwInstructions}
                      onChange={(e) => setNewGwInstructions(e.target.value)}
                      placeholder="تعليمات الشحن للزبون (تظهر بوضوح أعلى نموذج التحويل)..."
                      className="w-full px-3 py-2 text-xs rounded-xl bg-[#0B0F1A] border border-white/10 text-white"
                    />

                    {/* Receipt Upload Toggles */}
                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-300">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newGwAllowReceipt}
                          onChange={(e) => setNewGwAllowReceipt(e.target.checked)}
                        />
                        <span>السماح برفع صورة إشعار الدفع</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newGwRequireReceipt}
                          disabled={!newGwAllowReceipt}
                          onChange={(e) => setNewGwRequireReceipt(e.target.checked)}
                        />
                        <span>إلزام العميل برفع إشعار الدفع</span>
                      </label>
                    </div>

                    {/* Custom Customer Fields Builder for New Gateway */}
                    <div className="p-2.5 rounded-xl bg-[#0B0F1A] border border-white/10 space-y-2">
                      <div className="text-[11px] font-extrabold text-cyan-300">
                        خانات مطلوبة من العميل (مثل: اسم المحوّل، رقم الهاتف، تاريخ التحويل)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center">
                        <input
                          type="text"
                          value={draftFieldLabel}
                          onChange={(e) => setDraftFieldLabel(e.target.value)}
                          placeholder="اسم الخانة (مثال: اسم المرسل)"
                          className="sm:col-span-4 px-2.5 py-1.5 text-xs rounded-lg bg-[#070A12] border border-white/10 text-white"
                        />
                        <input
                          type="text"
                          value={draftFieldPlaceholder}
                          onChange={(e) => setDraftFieldPlaceholder(e.target.value)}
                          placeholder="نص توضيحي (اختياري)"
                          className="sm:col-span-3 px-2.5 py-1.5 text-xs rounded-lg bg-[#070A12] border border-white/10 text-white"
                        />
                        <select
                          value={draftFieldType}
                          onChange={(e) => setDraftFieldType(e.target.value as 'text' | 'number' | 'tel')}
                          className="sm:col-span-2 px-2 py-1.5 text-xs rounded-lg bg-[#070A12] border border-white/10 text-white"
                        >
                          <option value="text">نص</option>
                          <option value="tel">هاتف</option>
                          <option value="number">رقم</option>
                        </select>
                        <label className="sm:col-span-1 flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={draftFieldRequired}
                            onChange={(e) => setDraftFieldRequired(e.target.checked)}
                          />
                          <span>مطلوب</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleAddDraftField}
                          className="sm:col-span-2 py-1.5 px-2.5 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer btn-solid-white"
                        >
                          + إضافة خانة
                        </button>
                      </div>

                      {newGwFields.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {newGwFields.map((f) => (
                            <span
                              key={f.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/35 text-[11px] text-white font-bold"
                            >
                              <span>
                                {f.labelAr} {f.required ? '*' : ''}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setNewGwFields((prev) => prev.filter((x) => x.id !== f.id))
                                }
                                className="text-rose-400 hover:text-rose-300 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddGateway}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 text-white text-xs font-extrabold cursor-pointer btn-solid-white"
                    >
                      + حفظ وإضافة طريقة الشحن الجديدة
                    </button>
                  </div>

                  {/* Existing Gateways List with Full Editing (Icon, QR Image, Instructions, Custom Fields, Receipt Toggle) */}
                  <div className="space-y-3 pt-1">
                    {paymentGateways.map((gw) => {
                      const isExpanded = expandedGwId === gw.id;
                      const gwFields = gw.customFields || [];
                      return (
                        <div
                          key={gw.id}
                          className="p-3.5 rounded-xl bg-[#070A12] border border-white/10 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {gw.iconUrl ? (
                                <img
                                  src={gw.iconUrl}
                                  alt={gw.nameAr}
                                  className="w-9 h-9 rounded-lg object-cover border border-white/15 shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-indigo-600/25 text-cyan-300 flex items-center justify-center shrink-0">
                                  <CreditCard className="w-4 h-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-xs font-extrabold text-white truncate">
                                  {gw.nameAr}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400">
                                  {gw.currency} · {gwFields.length} خانات مخصصة ·{' '}
                                  {gw.qrImageUrl ? 'صورة QR مرفوعة ✓' : 'QR تلقائي'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setExpandedGwId(isExpanded ? null : gw.id)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-cyan-300 text-[11px] font-bold cursor-pointer"
                              >
                                {isExpanded ? 'إخفاء التعديل' : 'تخصيص (أيقونة / QR / خانات)'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdatePaymentGateways(
                                    paymentGateways.map((g) =>
                                      g.id === gw.id ? { ...g, isEnabled: !g.isEnabled } : g
                                    )
                                  )
                                }
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                                  gw.isEnabled
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {gw.isEnabled ? 'مفعلة ✓' : 'متوقفة'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdatePaymentGateways(
                                    paymentGateways.filter((g) => g.id !== gw.id)
                                  )
                                }
                                className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <input
                            type="text"
                            value={gw.accountAddress}
                            onChange={(e) =>
                              onUpdatePaymentGateways(
                                paymentGateways.map((g) =>
                                  g.id === gw.id ? { ...g, accountAddress: e.target.value } : g
                                )
                              )
                            }
                            className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-[#0B0F1A] border border-white/10 text-cyan-300"
                            dir="ltr"
                          />

                          {isExpanded && (
                            <div className="pt-2.5 border-t border-white/10 space-y-3">
                              {/* Edit Instructions */}
                              <div>
                                <label className="text-[10px] text-slate-400 block mb-1">
                                  تعليمات الشحن
                                </label>
                                <textarea
                                  rows={2}
                                  value={gw.instructionsAr}
                                  onChange={(e) =>
                                    onUpdatePaymentGateways(
                                      paymentGateways.map((g) =>
                                        g.id === gw.id
                                          ? { ...g, instructionsAr: e.target.value }
                                          : g
                                      )
                                    )
                                  }
                                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0B0F1A] border border-white/10 text-white"
                                />
                              </div>

                              {/* Upload / Clear Icon & QR Image */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div className="p-2 rounded-lg bg-[#0B0F1A] border border-white/10 flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-bold text-slate-300">
                                    أيقونة الطريقة:
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <label className="px-2.5 py-1 rounded-md bg-indigo-600/30 text-cyan-300 text-[10px] font-bold cursor-pointer">
                                      رفع أيقونة
                                      <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        className="hidden"
                                        onChange={(e) => {
                                          handleImageFileToDataUrl(
                                            e.target.files?.[0],
                                            512 * 1024,
                                            (url) =>
                                              onUpdatePaymentGateways(
                                                paymentGateways.map((g) =>
                                                  g.id === gw.id ? { ...g, iconUrl: url } : g
                                                )
                                              )
                                          );
                                          e.target.value = '';
                                        }}
                                      />
                                    </label>
                                    {gw.iconUrl && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onUpdatePaymentGateways(
                                            paymentGateways.map((g) =>
                                              g.id === gw.id ? { ...g, iconUrl: undefined } : g
                                            )
                                          )
                                        }
                                        className="text-rose-400 text-[10px] font-bold cursor-pointer"
                                      >
                                        حذف
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="p-2 rounded-lg bg-[#0B0F1A] border border-white/10 flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-bold text-slate-300">
                                    صورة QR مخصصة:
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {gw.qrImageUrl && (
                                      <img
                                        src={gw.qrImageUrl}
                                        alt="QR"
                                        className="w-7 h-7 rounded bg-white p-0.5 object-contain"
                                      />
                                    )}
                                    <label className="px-2.5 py-1 rounded-md bg-emerald-600/30 text-emerald-300 text-[10px] font-bold cursor-pointer">
                                      رفع QR
                                      <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        className="hidden"
                                        onChange={(e) => {
                                          handleImageFileToDataUrl(
                                            e.target.files?.[0],
                                            1500 * 1024,
                                            (url) =>
                                              onUpdatePaymentGateways(
                                                paymentGateways.map((g) =>
                                                  g.id === gw.id ? { ...g, qrImageUrl: url } : g
                                                )
                                              )
                                          );
                                          e.target.value = '';
                                        }}
                                      />
                                    </label>
                                    {gw.qrImageUrl && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onUpdatePaymentGateways(
                                            paymentGateways.map((g) =>
                                              g.id === gw.id ? { ...g, qrImageUrl: undefined } : g
                                            )
                                          )
                                        }
                                        className="text-rose-400 text-[10px] font-bold cursor-pointer"
                                      >
                                        حذف
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Receipt Upload Settings */}
                              <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-300">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={gw.allowReceiptUpload !== false}
                                    onChange={(e) =>
                                      onUpdatePaymentGateways(
                                        paymentGateways.map((g) =>
                                          g.id === gw.id
                                            ? { ...g, allowReceiptUpload: e.target.checked }
                                            : g
                                        )
                                      )
                                    }
                                  />
                                  <span>السماح برفع إشعار الدفع</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(gw.requireReceiptUpload)}
                                    onChange={(e) =>
                                      onUpdatePaymentGateways(
                                        paymentGateways.map((g) =>
                                          g.id === gw.id
                                            ? { ...g, requireReceiptUpload: e.target.checked }
                                            : g
                                        )
                                      )
                                    }
                                  />
                                  <span>إشعار الدفع إلزامي</span>
                                </label>
                              </div>

                              {/* Add / Delete Custom Customer Fields */}
                              <div className="space-y-2">
                                <div className="text-[11px] font-bold text-cyan-300">
                                  الخانات المطلوبة من العميل ({gwFields.length}):
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {gwFields.map((f) => (
                                    <span
                                      key={f.id}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white"
                                    >
                                      <span>
                                        {f.labelAr} {f.required ? '(مطلوب)' : '(اختياري)'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onUpdatePaymentGateways(
                                            paymentGateways.map((g) =>
                                              g.id === gw.id
                                                ? {
                                                    ...g,
                                                    customFields: (g.customFields || []).filter(
                                                      (x) => x.id !== f.id
                                                    ),
                                                  }
                                                : g
                                            )
                                          )
                                        }
                                        className="text-rose-400 hover:text-rose-300 cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={editingGwFieldLabel[gw.id] || ''}
                                    onChange={(e) =>
                                      setEditingGwFieldLabel((p) => ({
                                        ...p,
                                        [gw.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="أضف خانة جديدة للعميل (مثلاً: رقم الهاتف)"
                                    className="flex-1 min-w-[160px] px-2.5 py-1.5 text-xs rounded-lg bg-[#0B0F1A] border border-white/10 text-white"
                                  />
                                  <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editingGwFieldRequired[gw.id] ?? true}
                                      onChange={(e) =>
                                        setEditingGwFieldRequired((p) => ({
                                          ...p,
                                          [gw.id]: e.target.checked,
                                        }))
                                      }
                                    />
                                    <span>مطلوبة</span>
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const lbl = (editingGwFieldLabel[gw.id] || '').trim();
                                      if (!lbl) return;
                                      const newF: PaymentGatewayCustomField = {
                                        id: `cf-${Date.now()}`,
                                        labelAr: lbl,
                                        type: 'text',
                                        required: editingGwFieldRequired[gw.id] ?? true,
                                      };
                                      onUpdatePaymentGateways(
                                        paymentGateways.map((g) =>
                                          g.id === gw.id
                                            ? {
                                                ...g,
                                                customFields: [...(g.customFields || []), newF],
                                              }
                                            : g
                                        )
                                      );
                                      setEditingGwFieldLabel((p) => ({ ...p, [gw.id]: '' }));
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer btn-solid-white"
                                  >
                                    + إضافة
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. CMS, SOCIAL LINKS (SHOW/HIDE ON EMPTY) & ESIM */}
          {activeSection === 'cms_esim' && isSuperAdmin && (
            <div className="space-y-4">
              <div className="cyber-glass rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-black text-white">
                      التحكم الكامل بشريط الإعلانات المتحرك نحو اليمين
                    </h3>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cmsConfig.announcementEnabled}
                      onChange={(e) =>
                        onUpdateCmsConfig({ ...cmsConfig, announcementEnabled: e.target.checked })
                      }
                    />
                    <span>تفعيل الشريط</span>
                  </label>
                </div>

                <textarea
                  rows={2}
                  value={cmsConfig.announcementText}
                  onChange={(e) =>
                    onUpdateCmsConfig({ ...cmsConfig, announcementText: e.target.value })
                  }
                  placeholder="أدخل نص الإعلان الذي سيتحرك نحو اليمين في أعلى المنصة..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-bold">سرعة الحركة:</span>
                    {[
                      { id: 'slow', label: 'بطيء' },
                      { id: 'normal', label: 'متوسط' },
                      { id: 'fast', label: 'سريع' },
                    ].map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() =>
                          onUpdateCmsConfig({
                            ...cmsConfig,
                            announcementSpeed: sp.id as 'slow' | 'normal' | 'fast',
                          })
                        }
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                          (cmsConfig.announcementSpeed || 'normal') === sp.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-[#070A12] text-slate-400 border border-white/10'
                        }`}
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateCmsConfig({
                        ...cmsConfig,
                        announcementPaused: !cmsConfig.announcementPaused,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      cmsConfig.announcementPaused
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {cmsConfig.announcementPaused ? 'استئناف الحركة ▶' : 'إيقاف الحركة مؤقتاً ⏸'}
                  </button>
                </div>
              </div>

              {/* HERO SLIDER FULL ADMIN CONTROL */}
              <div className="cyber-glass rounded-2xl p-4 space-y-4 border border-cyan-500/30">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-cyan-400" />
                    <div>
                      <h3 className="text-sm font-black text-white">
                        التحكم الكامل بالسلايدر الرئيسي ({(cmsConfig.heroSlides || []).length} شرائح)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        ارفع صورة من جهازك أو الصق رابطاً — جميع النصوص والأزرار اختيارية تماماً.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cmsConfig.sliderAutoPlay !== false}
                        onChange={(e) =>
                          onUpdateCmsConfig({ ...cmsConfig, sliderAutoPlay: e.target.checked })
                        }
                      />
                      <span>تشغيل تلقائي</span>
                    </label>

                    <select
                      value={cmsConfig.sliderAutoPlayMs || 5500}
                      onChange={(e) =>
                        onUpdateCmsConfig({ ...cmsConfig, sliderAutoPlayMs: Number(e.target.value) })
                      }
                      className="px-2.5 py-1 text-xs rounded-lg bg-[#070A12] border border-white/10 text-white"
                    >
                      <option value={3500}>سريع (3.5 ث)</option>
                      <option value={5500}>متوسط (5.5 ث)</option>
                      <option value={8000}>بطيء (8 ث)</option>
                    </select>

                    <select
                      value={cmsConfig.sliderTransitionStyle || 'cube3d'}
                      onChange={(e) => {
                        onUpdateCmsConfig({
                          ...cmsConfig,
                          sliderTransitionStyle: e.target.value as NonNullable<
                            SiteCmsConfig['sliderTransitionStyle']
                          >,
                        });
                        showSavedFeedback('تم تحديث نمط الانتقال ثلاثي الأبعاد (3D) للسلايدر.');
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#070A12] border border-cyan-500/40 text-cyan-300"
                      title="نمط انتقال السلايدر 3D"
                    >
                      <option value="cube3d">3D مكعب دوّار (Cube)</option>
                      <option value="coverflow3d">3D كفر فلو (Coverflow)</option>
                      <option value="flip3d">3D قلب بطاقة (Flip)</option>
                      <option value="depthZoom3d">3D عمق وتكبير (Depth Zoom)</option>
                      <option value="tiltSlide3d">3D انزلاق مائل (Tilt Slide)</option>
                    </select>
                  </div>
                </div>

                {/* Add New Slide Form */}
                <div className="p-3.5 rounded-xl bg-[#070A12] border border-white/10 space-y-3">
                  <div className="text-xs font-extrabold text-cyan-300">
                    + إضافة شريحة جديدة إلى السلايدر
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-8">
                      <input
                        type="text"
                        value={slideImageUrl}
                        onChange={(e) => setSlideImageUrl(e.target.value)}
                        placeholder="رابط الصورة (https://...) أو ارفع صورة من جهازك ←"
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#0B0F1A] border border-white/10 text-white"
                        dir="ltr"
                      />
                    </div>
                    <div className="sm:col-span-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => slideFileInputRef.current?.click()}
                        className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-cyan-400/40 text-cyan-300 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 shrink-0" />
                        <span>رفع من الجهاز</span>
                      </button>
                      <input
                        ref={slideFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSlideImageUpload}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {slideImageUrl && (
                    <div className="relative h-24 rounded-xl overflow-hidden border border-white/10 bg-black/40">
                      <img
                        src={slideImageUrl}
                        alt="معاينة الشريحة"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setSlideImageUrl('')}
                        className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-black/70 text-[10px] text-rose-300 font-bold cursor-pointer"
                      >
                        إزالة الصورة
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={slideTitleAr}
                      onChange={(e) => setSlideTitleAr(e.target.value)}
                      placeholder="عنوان الشريحة (اختياري — اتركه فارغاً للصورة فقط)"
                      className="px-3 py-2 text-xs rounded-xl bg-[#0B0F1A] border border-white/10 text-white"
                    />
                    <input
                      type="text"
                      value={slideSubtitleAr}
                      onChange={(e) => setSlideSubtitleAr(e.target.value)}
                      placeholder="وصف مختصر (اختياري)"
                      className="px-3 py-2 text-xs rounded-xl bg-[#0B0F1A] border border-white/10 text-white"
                    />
                    <input
                      type="text"
                      value={slideCtaLabelAr}
                      onChange={(e) => setSlideCtaLabelAr(e.target.value)}
                      placeholder="نص الزر (اختياري — مثلاً: اشحن الآن)"
                      className="px-3 py-2 text-xs rounded-xl bg-[#0B0F1A] border border-white/10 text-white"
                    />
                    <select
                      value={slideCtaAction}
                      onChange={(e) =>
                        setSlideCtaAction(e.target.value as NonNullable<HeroSlideItem['ctaAction']>)
                      }
                      className="px-3 py-2 text-xs rounded-xl bg-[#0B0F1A] border border-white/10 text-white"
                    >
                      <option value="none">بدون زر / صورة فقط</option>
                      <option value="sms">الانتقال إلى أرقام SMS</option>
                      <option value="esim">الانتقال إلى شرائح eSIM</option>
                      <option value="wallet">الانتقال إلى المحفظة والشحن</option>
                      <option value="history">الانتقال إلى سجل الطلبات</option>
                      <option value="external">فتح رابط خارجي (https://)</option>
                    </select>
                  </div>

                  {slideCtaAction === 'external' && (
                    <input
                      type="url"
                      value={slideCtaExternalUrl}
                      onChange={(e) => setSlideCtaExternalUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#0B0F1A] border border-white/10 text-white"
                      dir="ltr"
                    />
                  )}

                  <button
                    type="button"
                    onClick={handleAddHeroSlide}
                    className="px-4 py-2 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer btn-solid-white"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة الشريحة للسلايدر</span>
                  </button>
                </div>

                {/* Existing Slides Management List */}
                <div className="space-y-2.5">
                  {(cmsConfig.heroSlides || []).map((slide, idx, arr) => (
                    <div
                      key={slide.id}
                      className="p-3 rounded-xl bg-[#070A12] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-3"
                    >
                      <img
                        src={slide.imageUrl}
                        alt={slide.titleAr || `شريحة ${idx + 1}`}
                        className="w-full sm:w-32 h-20 rounded-lg object-cover border border-white/10 shrink-0"
                      />

                      <div className="flex-1 min-w-0 w-full space-y-1.5">
                        <input
                          type="text"
                          value={slide.titleAr || ''}
                          onChange={(e) =>
                            onUpdateCmsConfig({
                              ...cmsConfig,
                              heroSlides: (cmsConfig.heroSlides || []).map((s) =>
                                s.id === slide.id ? { ...s, titleAr: e.target.value } : s
                              ),
                            })
                          }
                          placeholder="عنوان الشريحة (اختياري — اتركه فارغاً لإخفائه)"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0B0F1A] border border-white/10 text-white"
                        />
                        <input
                          type="text"
                          value={slide.subtitleAr || ''}
                          onChange={(e) =>
                            onUpdateCmsConfig({
                              ...cmsConfig,
                              heroSlides: (cmsConfig.heroSlides || []).map((s) =>
                                s.id === slide.id ? { ...s, subtitleAr: e.target.value } : s
                              ),
                            })
                          }
                          placeholder="وصف مختصر (اختياري)"
                          className="w-full px-2.5 py-1.5 text-[11px] rounded-lg bg-[#0B0F1A] border border-white/10 text-slate-300"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveHeroSlide(idx, -1)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-slate-300 cursor-pointer"
                          title="تحريك للأعلى"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === arr.length - 1}
                          onClick={() => handleMoveHeroSlide(idx, 1)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-slate-300 cursor-pointer"
                          title="تحريك للأسفل"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateCmsConfig({
                              ...cmsConfig,
                              heroSlides: (cmsConfig.heroSlides || []).map((s) =>
                                s.id === slide.id ? { ...s, isEnabled: !s.isEnabled } : s
                              ),
                            })
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                            slide.isEnabled
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {slide.isEnabled ? 'ظاهرة' : 'مخفية'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateCmsConfig({
                              ...cmsConfig,
                              heroSlides: (cmsConfig.heroSlides || []).filter(
                                (s) => s.id !== slide.id
                              ),
                            })
                          }
                          className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 cursor-pointer"
                          title="حذف الشريحة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin-Only Site & App Branding + Conditional Social Links */}
              {isSuperAdmin && (
                <div className="cyber-glass rounded-2xl p-4 space-y-4 border border-amber-500/25">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                    <div>
                      <h3 className="text-sm font-black text-white flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-400" />
                        <span>هوية وشعار الموقع والتطبيق (تحكم حصري للمدير العام)</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        غيّر اسم الموقع، اسم التطبيق، وشعار الموقع/التطبيق مباشرة. أي نص عربي تدخله هنا يُترجم تلقائياً للتركية والإنجليزية حسب لغة المستخدم.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-[10px] font-bold text-cyan-300">
                      <Globe className="w-3.5 h-3.5" />
                      <span>الترجمة التلقائية مفعّلة (AR → TR / EN)</span>
                    </span>
                  </div>

                  {/* Site & App Logo Uploader / Preview */}
                  <div className="p-3.5 rounded-xl bg-[#070A12] border border-white/10 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 shrink-0">
                      <img
                        src={cmsConfig.siteLogoUrl || '/pwa-192x192.png'}
                        alt={cmsConfig.platformName || 'Logo'}
                        className="w-16 h-16 rounded-2xl object-cover border border-cyan-400/40 bg-white/5 shadow-md"
                      />
                      <div className="space-y-1">
                        <div className="text-xs font-extrabold text-white">شعار الموقع والتطبيق</div>
                        <div className="text-[10px] text-slate-400">
                          يظهر في أيقونة المتصفح وتثبيت التطبيق والفوتر
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 space-y-2">
                      <input
                        ref={logoFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleSiteLogoUpload}
                        className="hidden"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer btn-solid-white"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>رفع شعار من الجهاز</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onUpdateCmsConfig({ ...cmsConfig, siteLogoUrl: '/pwa-192x192.png' });
                            showSavedFeedback('تم استعادة شعار alisim ثلاثي الأبعاد الافتراضي.');
                          }}
                          className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>استعادة الافتراضي</span>
                        </button>
                      </div>

                      <input
                        type="text"
                        value={cmsConfig.siteLogoUrl || ''}
                        onChange={(e) =>
                          onUpdateCmsConfig({ ...cmsConfig, siteLogoUrl: e.target.value })
                        }
                        placeholder="أو الصق رابط صورة الشعار (https://... أو /pwa-192x192.png)"
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#0B0F1A] border border-white/10 text-white"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">اسم الموقع (Platform Name)</label>
                      <input
                        type="text"
                        value={cmsConfig.platformName}
                        onChange={(e) =>
                          onUpdateCmsConfig({ ...cmsConfig, platformName: e.target.value })
                        }
                        placeholder="alisim"
                        className="w-full px-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">اسم التطبيق المختصر (App Name)</label>
                      <input
                        type="text"
                        value={cmsConfig.appShortName ?? cmsConfig.platformName}
                        onChange={(e) =>
                          onUpdateCmsConfig({ ...cmsConfig, appShortName: e.target.value })
                        }
                        placeholder="alisim"
                        className="w-full px-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">رمز PIN للأدمن</label>
                      <input
                        type="text"
                        value={cmsConfig.adminPin}
                        onChange={(e) =>
                          onUpdateCmsConfig({ ...cmsConfig, adminPin: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-400">رابط تيليجرام (اتركه فارغاً للإخفاء)</label>
                        {cmsConfig.supportTelegram && (
                          <button
                            type="button"
                            onClick={() => onUpdateCmsConfig({ ...cmsConfig, supportTelegram: '' })}
                            className="text-[10px] font-bold text-rose-400 hover:underline cursor-pointer"
                          >
                            حذف الرابط
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={cmsConfig.supportTelegram}
                        onChange={(e) =>
                          onUpdateCmsConfig({ ...cmsConfig, supportTelegram: e.target.value })
                        }
                        placeholder="https://t.me/username"
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-400">رقم/رابط واتساب (اتركه فارغاً للإخفاء)</label>
                        {cmsConfig.supportWhatsapp && (
                          <button
                            type="button"
                            onClick={() => onUpdateCmsConfig({ ...cmsConfig, supportWhatsapp: '' })}
                            className="text-[10px] font-bold text-rose-400 hover:underline cursor-pointer"
                          >
                            حذف الرابط
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={cmsConfig.supportWhatsapp}
                        onChange={(e) =>
                          onUpdateCmsConfig({ ...cmsConfig, supportWhatsapp: e.target.value })
                        }
                        placeholder="+963900000000"
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">رسالة وضع الصيانة (تُترجم تلقائياً)</label>
                      <input
                        type="text"
                        value={cmsConfig.maintenanceMessage}
                        onChange={(e) =>
                          onUpdateCmsConfig({ ...cmsConfig, maintenanceMessage: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <label className="flex items-center gap-2 text-xs font-bold text-amber-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cmsConfig.maintenanceMode}
                        onChange={(e) =>
                          onUpdateCmsConfig({ ...cmsConfig, maintenanceMode: e.target.checked })
                        }
                      />
                      <AlertTriangle className="w-4 h-4" />
                      <span>تفعيل وضع الصيانة المؤقت للمستخدمين</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="cyber-glass rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-cyan-400" />
                  <span>
                    باقات eSIM المخصصة ({customESimPlans.length}) ومخزون LPA ({lpaInventory.length})
                  </span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  <input
                    type="text"
                    value={newPlanCountryAr}
                    onChange={(e) => setNewPlanCountryAr(e.target.value)}
                    placeholder="الدولة"
                    className="px-2.5 py-2 text-xs rounded-lg bg-[#070A12] border border-white/10 text-white"
                  />
                  <input
                    type="text"
                    value={newPlanIso2}
                    onChange={(e) => setNewPlanIso2(e.target.value)}
                    placeholder="ISO2"
                    className="px-2.5 py-2 text-xs font-mono rounded-lg bg-[#070A12] border border-white/10 text-white"
                  />
                  <input
                    type="number"
                    value={newPlanDataGb}
                    onChange={(e) => setNewPlanDataGb(e.target.value)}
                    placeholder="GB"
                    className="px-2.5 py-2 text-xs font-mono rounded-lg bg-[#070A12] border border-white/10 text-white"
                  />
                  <input
                    type="number"
                    value={newPlanValidity}
                    onChange={(e) => setNewPlanValidity(e.target.value)}
                    placeholder="الأيام"
                    className="px-2.5 py-2 text-xs font-mono rounded-lg bg-[#070A12] border border-white/10 text-white"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={newPlanBaseUsd}
                    onChange={(e) => setNewPlanBaseUsd(e.target.value)}
                    placeholder="التكلفة $"
                    className="px-2.5 py-2 text-xs font-mono rounded-lg bg-[#070A12] border border-white/10 text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomPlan}
                    className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-extrabold cursor-pointer"
                  >
                    + نشر باقة
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 pt-2 border-t border-white/10">
                  <input
                    type="text"
                    value={newLpaCountryAr}
                    onChange={(e) => setNewLpaCountryAr(e.target.value)}
                    placeholder="دولة الـ LPA"
                    className="px-2.5 py-2 text-xs rounded-lg bg-[#070A12] border border-white/10 text-white"
                  />
                  <input
                    type="text"
                    value={newLpaIso2}
                    onChange={(e) => setNewLpaIso2(e.target.value)}
                    placeholder="ISO2"
                    className="px-2.5 py-2 text-xs font-mono rounded-lg bg-[#070A12] border border-white/10 text-white"
                  />
                  <input
                    type="text"
                    value={newLpaDataLabel}
                    onChange={(e) => setNewLpaDataLabel(e.target.value)}
                    placeholder="السعة (10GB)"
                    className="px-2.5 py-2 text-xs rounded-lg bg-[#070A12] border border-white/10 text-white"
                  />
                  <input
                    type="text"
                    value={newLpaSmdp}
                    onChange={(e) => setNewLpaSmdp(e.target.value)}
                    placeholder="SM-DP+"
                    className="px-2.5 py-2 text-xs font-mono rounded-lg bg-[#070A12] border border-white/10 text-white"
                  />
                  <input
                    type="text"
                    value={newLpaCode}
                    onChange={(e) => setNewLpaCode(e.target.value)}
                    placeholder="Activation Code"
                    className="px-2.5 py-2 text-xs font-mono rounded-lg bg-[#070A12] border border-white/10 text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddLpaItem}
                    className="px-3 py-2 rounded-lg bg-cyan-600 text-white text-xs font-extrabold cursor-pointer"
                  >
                    + إضافة LPA
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 8. API KEYS & SUPABASE (Server-Side Secrets Only — Zero Client Exposure) */}
          {activeSection === 'api_cloud' && isSuperAdmin && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="cyber-glass rounded-2xl p-4 space-y-3 border border-cyan-500/20">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Lock className="w-4 h-4 text-cyan-400" />
                      <span>حالة الربط البرمجي على الخادم (Server Secrets)</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-[10px] font-bold text-emerald-300">
                      مفاتيح محمية في الخادم فقط
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#070A12] border border-white/10 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-white">مزود الأرقام الافتراضية (SMS API)</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {settings.hasApiKey
                            ? `مربوط (${settings.maskedApiKey}) · الرصيد: ${
                                settings.providerBalanceRub !== null
                                  ? `${settings.providerBalanceRub} ₽ (≈ $${settings.providerBalanceUsd ?? '0.00'})`
                                  : 'جاري المزامنة'
                              }`
                            : 'غير مضبوط في متغيرات البيئة'}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                          settings.isLiveMode
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {settings.isLiveMode ? 'متصل مباشر ✓' : 'غير متصل'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#070A12] border border-white/10 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-white">أسعار الصرف المباشرة (سوريا اليوم)</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          1 USD = {Number(settings.usdToSypRate || 0).toLocaleString('en-US')} ل.س ·{' '}
                          {settings.usdToTryRate || 50.5} ₺
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                          settings.hasSyriaTodayKey
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {settings.hasSyriaTodayKey ? 'متصل مباشر ✓' : 'تلقائي عام'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 space-y-1.5">
                    <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>حد تنبيه انخفاض رصيد مزود الأرقام ($ USD)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={lowBalanceThreshold}
                      onChange={(e) => setLowBalanceThreshold(e.target.value)}
                      placeholder="20"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                      dir="ltr"
                    />
                    <p className="text-[10px] text-slate-400">
                      سيظهر تنبيه أحمر وإشعار فوري للمدير العام فور هبوط رصيد المزود تحت هذا المبلغ.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveGlobalPricingOrApi}
                    disabled={savingSettings}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 text-white text-xs font-extrabold cursor-pointer"
                  >
                    حفظ حد التنبيه وتحديث بيانات المزود
                  </button>
                </div>

                <div className="cyber-glass rounded-2xl p-4 space-y-3 border border-emerald-500/25">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-400" />
                      <span>قاعدة البيانات السحابية Supabase</span>
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                        settings.supabaseTablesReady
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : settings.hasSupabaseConfig
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {settings.supabaseTablesReady
                        ? 'متصل وجاهز ✓'
                        : settings.hasSupabaseConfig
                        ? 'متصل — بانتظار SQL'
                        : 'غير مضبوط'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#070A12] border border-white/10 text-[11px] text-slate-300 leading-relaxed space-y-1.5">
                    <div>
                      <strong className="text-white">حالة الاتصال السحابي:</strong>{' '}
                      <span className="text-cyan-300">
                        {settings.supabaseStatusMessage || supabaseConfig.syncStatusText}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      مفاتيح <code className="text-emerald-300">SUPABASE_URL</code> و{' '}
                      <code className="text-emerald-300">SUPABASE_ANON_KEY</code> محفوظة بأمان تام على الخادم فقط ولا تُرسل للمتصفح إطلاقاً.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSqlHubModal(true)}
                      className="py-2.5 px-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Database className="w-4 h-4" />
                      <span>أكواد إنشاء الجداول (SQL)</span>
                    </button>

                    <button
                      type="button"
                      onClick={onTriggerFullSupabaseSync}
                      disabled={syncingSupabase}
                      className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingSupabase ? 'animate-spin' : ''}`} />
                      <span>مزامنة فورية مع Supabase</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Automated Binance Pay & On-Chain Blockchain Receiving Addresses */}
              <div className="cyber-glass rounded-2xl p-4 space-y-3 border border-amber-500/25">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      <span>إعدادات الشحن التلقائي (Binance Pay & البلوكشين)</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      عناوين الاستلام العامة المستخدمة في الإشعارات المؤقتة والتحقق الفوري عبر البلوكشين
                    </p>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold border ${
                      settings.hasBinanceApiKeys
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    }`}
                  >
                    {settings.hasBinanceApiKeys
                      ? 'Binance Read-Only API: متصل عبر الخادم ✓'
                      : 'Binance API: أضف المفاتيح في Settings → Secrets'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-[#070A12] border border-white/10 text-[11px] text-slate-300 leading-relaxed">
                  لحماية أموالك، لا تُحفظ مفاتيح <code className="text-cyan-300">BINANCE_API_KEY</code> و{' '}
                  <code className="text-cyan-300">BINANCE_API_SECRET</code> في المتصفح أبداً؛ أضفها حصراً في{' '}
                  <strong className="text-white">Settings → Secrets</strong> بصلاحية القراءة فقط (<strong className="text-emerald-300">Enable Reading</strong>) ودون تفعيل السحب أو التداول.
                  أما التحقق عبر البلوكشين (<strong className="text-emerald-300">USDT-TRC20</strong> و{' '}
                  <strong className="text-amber-300">USDT-BEP20</strong>) فيعمل مباشرة وفوراً دون الحاجة لأي مفاتيح!
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      معرّف Binance Pay ID
                    </label>
                    <input
                      type="text"
                      value={binancePayIdInput}
                      onChange={(e) => setBinancePayIdInput(e.target.value)}
                      placeholder="1073784382"
                      dir="ltr"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-emerald-300 block mb-1">
                      عنوان محفظة USDT (TRC20 — TRON)
                    </label>
                    <input
                      type="text"
                      value={usdtTrc20Input}
                      onChange={(e) => setUsdtTrc20Input(e.target.value)}
                      placeholder="T..."
                      dir="ltr"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-amber-300 block mb-1">
                      عنوان محفظة USDT (BEP20 — BSC)
                    </label>
                    <input
                      type="text"
                      value={usdtBep20Input}
                      onChange={(e) => setUsdtBep20Input(e.target.value)}
                      placeholder="0x..."
                      dir="ltr"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveAutoPayAddresses}
                  disabled={savingAutoPayAddrs}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  {savingAutoPayAddrs ? 'جاري الحفظ...' : 'حفظ ومزامنة عناوين الاستلام التلقائي'}
                </button>
              </div>

              <div className="cyber-glass rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span>مختبر نقاط النهاية الحية لـ SMS API</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onExportBackup}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تصدير JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>استعادة JSON</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/json"
                      onChange={handleImportFile}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedMethodKey}
                    onChange={(e) => setSelectedMethodKey(e.target.value)}
                    className="flex-1 min-w-[220px] px-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                  >
                    {OFFICIAL_GRIZZLY_METHODS.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>

                  {activeMethodObj.params.map((p) => (
                    <input
                      key={p.name}
                      type="text"
                      value={testParams[p.name] ?? p.defaultVal}
                      onChange={(e) =>
                        setTestParams((prev) => ({ ...prev, [p.name]: e.target.value }))
                      }
                      placeholder={p.label}
                      className="w-32 px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  ))}

                  <button
                    type="button"
                    onClick={handleRunApiTest}
                    disabled={testingApi}
                    className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{testingApi ? 'جاري الفحص...' : 'تشغيل الاختبار'}</span>
                  </button>
                </div>

                {testResult && (
                  <pre
                    className="p-3 rounded-xl bg-[#05070C] border border-white/10 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-56"
                    dir="ltr"
                  >
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* 9. GIFT CARDS / VOUCHER CODES MANAGEMENT (Super Admin Only) */}
          {activeSection === 'vouchers' && isSuperAdmin && (
            <div className="space-y-4">
              <div className="cyber-glass rounded-2xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center">
                      <Ticket className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">
                        مولّد قسائم الشحن وبطاقات الهدايا (Gift Vouchers)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        توليد أكواد شحن فورية للعملاء أو للوكلاء مع تحديد القيمة وعدد الاستخدامات وتاريخ الانتهاء
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={fetchVouchersList}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-cyan-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingVouchers ? 'animate-spin' : ''}`} />
                    <span>تحديث</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">القيمة ($ USD) *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.1"
                      value={voucherAmountUsd}
                      onChange={(e) => setVoucherAmountUsd(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">عدد القسائم (1-50)</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      disabled={Boolean(voucherCustomCode.trim())}
                      value={voucherQuantity}
                      onChange={(e) => setVoucherQuantity(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white disabled:opacity-50"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">مرات الاستخدام</label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={voucherMaxUses}
                      onChange={(e) => setVoucherMaxUses(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">الصلاحية (أيام / 0=دائم)</label>
                    <input
                      type="number"
                      min="0"
                      value={voucherExpiryDays}
                      onChange={(e) => setVoucherExpiryDays(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">بادئة الكود</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={voucherPrefix}
                      onChange={(e) => setVoucherPrefix(e.target.value.toUpperCase())}
                      placeholder="ALIS"
                      className="w-full px-3 py-2 text-xs font-mono uppercase rounded-xl bg-[#070A12] border border-white/10 text-white"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">كود مخصص (اختياري)</label>
                    <input
                      type="text"
                      value={voucherCustomCode}
                      onChange={(e) => setVoucherCustomCode(e.target.value.toUpperCase())}
                      placeholder="VIP-2026"
                      className="w-full px-3 py-2 text-xs font-mono uppercase rounded-xl bg-[#070A12] border border-white/10 text-white"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={voucherNote}
                    onChange={(e) => setVoucherNote(e.target.value)}
                    placeholder="ملاحظة للقسيمة (مثال: دفعة وكيل إسطنبول / عرض رمضان)..."
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                  />
                  <button
                    type="button"
                    disabled={creatingVoucher}
                    onClick={handleCreateVouchers}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{creatingVoucher ? 'جاري التوليد...' : 'توليد القسائم الآن'}</span>
                  </button>
                </div>
              </div>

              <div className="cyber-glass rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-black text-white">
                    سجل القسائم المُصدرة ({vouchers.length})
                  </h4>
                  {vouchers.some((v) => v.isActive && v.usedCount < v.maxUses) && (
                    <button
                      type="button"
                      onClick={() => {
                        const activeCodes = vouchers
                          .filter((v) => v.isActive && v.usedCount < v.maxUses)
                          .map((v) => `${v.code} ($${v.amountUsd.toFixed(2)})`)
                          .join('\n');
                        copyVoucherCode(activeCodes, 'ALL_ACTIVE');
                        showSavedFeedback('تم نسخ جميع القسائم الفعّالة إلى الحافظة.');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/35 text-cyan-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedVoucherKey === 'ALL_ACTIVE' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>نسخ كل الأكواد الفعّالة</span>
                    </button>
                  )}
                </div>

                {vouchers.length === 0 ? (
                  <p className="py-10 text-center text-xs text-slate-400">
                    لم يتم إنشاء أي قسائم شحن بعد. استخدم النموذج أعلاه لتوليد أول دفعة.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {vouchers
                      .slice((vouchersPage - 1) * PAGE_SIZE, vouchersPage * PAGE_SIZE)
                      .map((v) => {
                      const isExhausted = v.usedCount >= v.maxUses;
                      const isExpired = Boolean(v.expiresAt && Date.now() > v.expiresAt);
                      return (
                        <div
                          key={v.id}
                          className="p-3 rounded-xl bg-[#070A12] border border-white/10 flex flex-wrap items-center justify-between gap-2.5"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center flex-wrap gap-2">
                              <code
                                dir="ltr"
                                className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/35 text-amber-300 font-mono text-xs font-black tracking-wider"
                              >
                                {v.code}
                              </code>
                              <span className="font-mono text-xs font-black text-emerald-400">
                                ${v.amountUsd.toFixed(2)}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-mono text-slate-300">
                                استخدام: {v.usedCount}/{v.maxUses}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  isExhausted
                                    ? 'bg-slate-700/60 text-slate-300'
                                    : isExpired
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : v.isActive
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {isExhausted
                                  ? 'مستخدمة بالكامل'
                                  : isExpired
                                  ? 'منتهية الصلاحية'
                                  : v.isActive
                                  ? 'فعّالة ✓'
                                  : 'موقوفة'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 flex flex-wrap gap-2">
                              {v.note && <span className="text-slate-300">{v.note}</span>}
                              {v.expiresAt && (
                                <span className="font-mono">
                                  تنتهي: {new Date(v.expiresAt).toLocaleDateString('ar-SY')}
                                </span>
                              )}
                              {v.redemptions.length > 0 && (
                                <span className="text-cyan-300">
                                  آخر من فعلها: {v.redemptions[0].userNameAr}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => copyVoucherCode(v.code, v.id)}
                              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-300 cursor-pointer"
                              title="نسخ الكود"
                            >
                              {copiedVoucherKey === v.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleVoucher(v)}
                              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-200 cursor-pointer"
                            >
                              {v.isActive ? 'إيقاف' : 'تفعيل'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteVoucher(v)}
                              className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <AdminPagination
                      currentPage={vouchersPage}
                      totalItems={vouchers.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setVouchersPage}
                      itemLabel="قسيمة"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 10. STAFF AUDIT TRAIL (Super Admin Only) */}
          {activeSection === 'audit' && isSuperAdmin && (
            <div className="space-y-4">
              {/* Today's Staff Performance Summary */}
              <div className="cyber-glass rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white flex items-center justify-center">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">
                        سجل تدقيق حركات المشرفين والإدارة (Staff Audit Trail)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        توثيق غير قابل للتعديل لكل قبول/رفض شحن، تعديل رصيد، إلغاء طلب، أو إصدار قسيمة
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={fetchAuditLogsList}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-cyan-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
                    <span>تحديث السجل</span>
                  </button>
                </div>

                {staffDailySummary.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {staffDailySummary.map((st) => (
                      <div
                        key={st.actorId}
                        className="p-3 rounded-xl bg-[#070A12] border border-cyan-500/25 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-white truncate">
                            {st.actorName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              st.actorRole === 'ADMIN'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {st.actorRole === 'ADMIN' ? 'مدير' : 'مشرف'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
                          <div className="p-1.5 rounded-lg bg-emerald-500/10">
                            <div className="text-[10px] text-slate-400">شحن مقبول</div>
                            <div className="text-xs font-mono font-black text-emerald-400">
                              {st.approvedCount} (${st.approvedUsd.toFixed(0)})
                            </div>
                          </div>
                          <div className="p-1.5 rounded-lg bg-rose-500/10">
                            <div className="text-[10px] text-slate-400">مرفوض</div>
                            <div className="text-xs font-mono font-black text-rose-300">
                              {st.rejectedCount}
                            </div>
                          </div>
                          <div className="p-1.5 rounded-lg bg-indigo-500/15">
                            <div className="text-[10px] text-slate-400">إجمالي اليوم</div>
                            <div className="text-xs font-mono font-black text-cyan-300">
                              {st.totalActions}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chronological Audit Log with Filters */}
              <div className="cyber-glass rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-black text-white">
                    سجل الحركات التفصيلي ({auditLogs.length})
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={auditActorFilter}
                      onChange={(e) => {
                        setAuditActorFilter(e.target.value);
                        setAuditPage(1);
                      }}
                      className="px-2.5 py-1.5 text-xs rounded-lg bg-[#070A12] border border-white/10 text-white"
                    >
                      <option value="ALL">كل المشرفين والمدراء</option>
                      {Array.from(new Set(auditLogs.map((l) => l.actorName))).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={auditActionFilter}
                      onChange={(e) => {
                        setAuditActionFilter(e.target.value);
                        setAuditPage(1);
                      }}
                      className="px-2.5 py-1.5 text-xs rounded-lg bg-[#070A12] border border-white/10 text-white"
                    >
                      <option value="ALL">جميع العمليات</option>
                      <option value="TOPUP_APPROVE">قبول شحن</option>
                      <option value="TOPUP_REJECT">رفض شحن</option>
                      <option value="WALLET_ADJUST">تعديل رصيد</option>
                      <option value="ORDER_CANCEL">إلغاء طلب</option>
                      <option value="VOUCHER_CREATE">توليد قسيمة</option>
                      <option value="STAFF_CREATE">إضافة مشرف</option>
                      <option value="SETTINGS_UPDATE">تعديل إعدادات</option>
                    </select>
                  </div>
                </div>

                {(() => {
                  const filteredAudit = auditLogs.filter(
                    (l) =>
                      (auditActorFilter === 'ALL' || l.actorName === auditActorFilter) &&
                      (auditActionFilter === 'ALL' || l.actionType === auditActionFilter)
                  );
                  if (filteredAudit.length === 0) {
                    return (
                      <p className="py-10 text-center text-xs text-slate-400">
                        لا توجد حركات مسجلة ضمن هذا الفلتر بعد.
                      </p>
                    );
                  }
                  const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
                    TOPUP_APPROVE: { label: 'قبول شحن', cls: 'bg-emerald-500/20 text-emerald-300' },
                    TOPUP_REJECT: { label: 'رفض شحن', cls: 'bg-rose-500/20 text-rose-300' },
                    WALLET_ADJUST: { label: 'تعديل رصيد', cls: 'bg-amber-500/20 text-amber-300' },
                    ORDER_CANCEL: { label: 'إلغاء طلب', cls: 'bg-rose-500/20 text-rose-300' },
                    ORDER_COMPLETE: { label: 'إنهاء طلب', cls: 'bg-emerald-500/20 text-emerald-300' },
                    VOUCHER_CREATE: { label: 'توليد قسيمة', cls: 'bg-indigo-500/20 text-indigo-300' },
                    VOUCHER_TOGGLE: { label: 'حالة قسيمة', cls: 'bg-cyan-500/20 text-cyan-300' },
                    VOUCHER_DELETE: { label: 'حذف قسيمة', cls: 'bg-rose-500/20 text-rose-300' },
                    STAFF_CREATE: { label: 'إضافة مشرف', cls: 'bg-cyan-500/20 text-cyan-300' },
                    STAFF_UPDATE: { label: 'تعديل صلاحية', cls: 'bg-amber-500/20 text-amber-300' },
                    STAFF_DELETE: { label: 'حذف مشرف', cls: 'bg-rose-500/20 text-rose-300' },
                    SETTINGS_UPDATE: { label: 'إعدادات المنصة', cls: 'bg-purple-500/20 text-purple-300' },
                  };
                  return (
                    <div className="space-y-2">
                      {filteredAudit
                        .slice((auditPage - 1) * PAGE_SIZE, auditPage * PAGE_SIZE)
                        .map((entry) => {
                          const badge = ACTION_LABELS[entry.actionType] || {
                            label: entry.actionType,
                            cls: 'bg-white/10 text-slate-300',
                          };
                          return (
                            <div
                              key={entry.id}
                              className="p-3 rounded-xl bg-[#070A12] border border-white/10 flex flex-wrap items-center justify-between gap-2"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center flex-wrap gap-1.5">
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${badge.cls}`}>
                                    {badge.label}
                                  </span>
                                  <span className="text-xs font-extrabold text-white">
                                    {entry.actorName}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    ({entry.actorRole === 'ADMIN' ? 'مدير' : 'مشرف'})
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-300 break-words">
                                  {entry.targetLabel}
                                  {entry.reason ? ` — السبب: ${entry.reason}` : ''}
                                </div>
                              </div>
                              <div className="text-left shrink-0">
                                {entry.amountUsd !== undefined && (
                                  <div className="text-xs font-mono font-bold text-cyan-300">
                                    ${entry.amountUsd.toFixed(2)}
                                  </div>
                                )}
                                <div className="text-[10px] font-mono text-slate-500">
                                  {new Date(entry.createdAt).toLocaleTimeString('ar-SY', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}{' '}
                                  · {new Date(entry.createdAt).toLocaleDateString('ar-SY')}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      <AdminPagination
                        currentPage={auditPage}
                        totalItems={filteredAudit.length}
                        pageSize={PAGE_SIZE}
                        onPageChange={setAuditPage}
                        itemLabel="سجل"
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 11. RESELLERS & DISTRIBUTORS PROGRAM (Super Admin Only) */}
          {activeSection === 'resellers' && isSuperAdmin && (
            <div className="space-y-4">
              {/* Program Terms & Discounts Config */}
              <div className="cyber-glass rounded-2xl p-4 space-y-4 border border-purple-500/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-500 text-white flex items-center justify-center">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">
                        برنامج البائعين والموزعين المعتمدين (Reseller Program)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        حدد شروط الانضمام ونسب الخصم الخاصة لحسابات البائعين (تُطبق تلقائياً على أسعار SMS و eSIM)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={fetchResellersData}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-cyan-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingResellers ? 'animate-spin' : ''}`} />
                    <span>تحديث</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">خصم الفئة الفضية (%)</label>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={resellerCfg.silverDiscountPercent}
                      onChange={(e) =>
                        setResellerCfg((p) => ({
                          ...p,
                          silverDiscountPercent: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">خصم الفئة الذهبية (%)</label>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={resellerCfg.goldDiscountPercent}
                      onChange={(e) =>
                        setResellerCfg((p) => ({
                          ...p,
                          goldDiscountPercent: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">حد الإيداع الأولي ($)</label>
                    <input
                      type="number"
                      min={0}
                      value={resellerCfg.minDepositUsd}
                      onChange={(e) =>
                        setResellerCfg((p) => ({
                          ...p,
                          minDepositUsd: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">المسحوبات الشهرية ($)</label>
                    <input
                      type="number"
                      min={0}
                      value={resellerCfg.minMonthlySpendUsd}
                      onChange={(e) =>
                        setResellerCfg((p) => ({
                          ...p,
                          minMonthlySpendUsd: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resellerCfg.requireCleanSecurityRecord}
                      onChange={(e) =>
                        setResellerCfg((p) => ({
                          ...p,
                          requireCleanSecurityRecord: e.target.checked,
                        }))
                      }
                    />
                    <span>اشتراط سجل أمان نظيف (خالي من مخالفات الاحتيال) لقبول طلبات البائعين</span>
                  </label>
                  <button
                    type="button"
                    disabled={savingResellerCfg}
                    onClick={handleSaveResellerConfig}
                    className="px-4 py-2 rounded-xl bg-gradient-to-l from-purple-600 to-indigo-600 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 btn-solid-white"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingResellerCfg ? 'جاري الحفظ...' : 'حفظ شروط البائعين'}</span>
                  </button>
                </div>
              </div>

              {/* Active Resellers Strip */}
              <div className="cyber-glass rounded-2xl p-4 space-y-3">
                <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>البائعون المعتمدون النشطون ({activeResellers.length})</span>
                </h4>
                {activeResellers.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    لا يوجد بائعون معتمدون حالياً. يمكنك قبول طلبات الانضمام أدناه أو ترقية أي حساب من تبويب المستخدمين.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {activeResellers.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 rounded-xl bg-[#070A12] border border-purple-500/30 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-white truncate">{r.nameAr}</span>
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                            {r.resellerTier === 'GOLD' ? 'ذهبي' : 'فضي'} (-{r.resellerDiscountPercent || 0}%)
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 truncate" dir="ltr">
                          {r.emailOrPhone}
                        </div>
                        <div className="text-[11px] font-mono text-emerald-400">
                          الرصيد: ${Number(r.balanceUsd || 0).toFixed(2)} · الإنفاق: $
                          {Number(r.totalSpentUsd || 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reseller Applications Queue (Paginated 10/page) */}
              <div className="cyber-glass rounded-2xl p-4 space-y-3">
                <h4 className="text-xs sm:text-sm font-black text-white">
                  طلبات الانضمام لبرنامج البائعين ({resellerApps.length})
                </h4>
                {resellerApps.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">
                    لا توجد طلبات انضمام واردة من العملاء بعد.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {resellerApps
                      .slice((resellersPage - 1) * PAGE_SIZE, resellersPage * PAGE_SIZE)
                      .map((appItem) => (
                        <div
                          key={appItem.id}
                          className="p-3.5 rounded-xl bg-[#070A12] border border-white/10 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0">
                              <div className="text-xs font-extrabold text-white flex items-center gap-2 flex-wrap">
                                <span>{appItem.userNameAr}</span>
                                <span className="text-[10px] font-mono text-slate-400" dir="ltr">
                                  ({appItem.userEmail})
                                </span>
                              </div>
                              <div className="text-[11px] text-cyan-300 font-mono">
                                التواصل: {appItem.contactHandle} · الحجم الشهري المتوقع: $
                                {appItem.expectedMonthlyVolumeUsd} · الرصيد الحالي: $
                                {appItem.currentBalanceUsd.toFixed(2)} · نقاط المخاطر: {appItem.fraudScore}
                              </div>
                              {appItem.businessNote && (
                                <p className="text-[11px] text-slate-300">{appItem.businessNote}</p>
                              )}
                            </div>

                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                                appItem.status === 'APPROVED'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : appItem.status === 'REJECTED'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {appItem.status === 'PENDING'
                                ? 'بانتظار موافقة المدير'
                                : appItem.status === 'APPROVED'
                                ? `مقبول (${appItem.assignedTier} -${appItem.assignedDiscountPercent}%)`
                                : `مرفوض: ${appItem.rejectionReason || ''}`}
                            </span>
                          </div>

                          {appItem.status === 'PENDING' && (
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                              <select
                                value={appReviewTier[appItem.id] || 'SILVER'}
                                onChange={(e) =>
                                  setAppReviewTier((p) => ({
                                    ...p,
                                    [appItem.id]: e.target.value as ResellerTier,
                                  }))
                                }
                                className="px-2.5 py-1.5 text-xs rounded-lg bg-[#0B0F1A] border border-white/10 text-white"
                              >
                                <option value="SILVER">
                                  بائع فضي (-{resellerCfg.silverDiscountPercent}%)
                                </option>
                                <option value="GOLD">
                                  بائع ذهبي (-{resellerCfg.goldDiscountPercent}%)
                                </option>
                              </select>
                              <input
                                type="number"
                                min={1}
                                max={40}
                                value={appReviewDiscount[appItem.id] || ''}
                                onChange={(e) =>
                                  setAppReviewDiscount((p) => ({
                                    ...p,
                                    [appItem.id]: e.target.value,
                                  }))
                                }
                                placeholder="خصم مخصص % (اختياري)"
                                className="w-40 px-2.5 py-1.5 text-xs font-mono rounded-lg bg-[#0B0F1A] border border-white/10 text-white"
                              />
                              <button
                                type="button"
                                onClick={() => handleReviewResellerApp(appItem.id, 'APPROVE')}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer btn-solid-white"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>اعتماد كبائع</span>
                              </button>
                              <input
                                type="text"
                                value={appRejectReason[appItem.id] || ''}
                                onChange={(e) =>
                                  setAppRejectReason((p) => ({
                                    ...p,
                                    [appItem.id]: e.target.value,
                                  }))
                                }
                                placeholder="سبب الرفض"
                                className="flex-1 min-w-[140px] px-2.5 py-1.5 text-xs rounded-lg bg-[#0B0F1A] border border-white/10 text-white"
                              />
                              <button
                                type="button"
                                onClick={() => handleReviewResellerApp(appItem.id, 'REJECT')}
                                className="px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-300 text-xs font-bold cursor-pointer"
                              >
                                رفض
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    <AdminPagination
                      currentPage={resellersPage}
                      totalItems={resellerApps.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setResellersPage}
                      itemLabel="طلب بائع"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 12. SECURITY & ANTI-FRAUD CONTROL CENTER (Super Admin Only) */}
          {activeSection === 'security' && isSuperAdmin && (
            <div className="space-y-4">
              {/* Emergency Panic Switch & Strict Auto-Payments Protection */}
              <div
                className={`cyber-glass rounded-2xl p-4 space-y-4 border ${
                  securityPolicy.autoPaymentsPanicStop
                    ? 'border-rose-500/60 bg-rose-950/20'
                    : 'border-cyan-500/35'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
                        securityPolicy.autoPaymentsPanicStop
                          ? 'bg-rose-600'
                          : 'bg-gradient-to-br from-rose-600 to-amber-500'
                      }`}
                    >
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">
                        مركز الأمان، حماية الدفع التلقائي، ومكافحة الاحتيال
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        منع التسجيل بالإيميلات المؤقتة، نظام النقاط والتقييد التلقائي، وزر الإيقاف الطارئ للشحن التلقائي
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={savingSecurity}
                    onClick={() =>
                      handleSaveSecurityPolicy({
                        autoPaymentsPanicStop: !securityPolicy.autoPaymentsPanicStop,
                      })
                    }
                    className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer btn-solid-white ${
                      securityPolicy.autoPaymentsPanicStop
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-rose-600 hover:bg-rose-500 text-white'
                    }`}
                  >
                    <Power className="w-4 h-4" />
                    <span>
                      {securityPolicy.autoPaymentsPanicStop
                        ? 'إلغاء الإيقاف الطارئ وإعادة الدفع التلقائي'
                        : 'إيقاف طارئ (Panic Switch): تحويل كل الشحن للمراجعة اليدوية'}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="p-3 rounded-xl bg-[#070A12] border border-white/10 flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={securityPolicy.strictAutoPayments}
                      onChange={(e) =>
                        setSecurityPolicy((p) => ({ ...p, strictAutoPayments: e.target.checked }))
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="text-xs font-extrabold text-white">
                        الوضع الصارم للدفع التلقائي (Strict Fail-Closed)
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        يمنع شحن الرصيد تلقائياً أبداً ما لم يرد تأكيد حقيقي من API باينانس أو Webhook موقّع لشام كاش، ويحول الطلب فوراً للمراجعة اليدوية مع الإشعار.
                      </div>
                    </div>
                  </label>

                  <label className="p-3 rounded-xl bg-[#070A12] border border-white/10 flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={securityPolicy.enforceEmailWhitelist}
                      onChange={(e) =>
                        setSecurityPolicy((p) => ({ ...p, enforceEmailWhitelist: e.target.checked }))
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="text-xs font-extrabold text-white">
                        قائمة البريد الموثوقة فقط + منع حيل نقاط Gmail
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        يمنع التسجيل بالإيميلات المؤقتة والعشوائية، ويمنع إنشاء حسابات متعددة بنفس إيميل Gmail عبر النقاط أو علامة (+).
                      </div>
                    </div>
                  </label>
                </div>

                {/* Thresholds & Allowed Email Domains */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      حد نقاط المخاطر للتقييد المؤقت 30 دقيقة (المستوى 1)
                    </label>
                    <input
                      type="number"
                      min={20}
                      max={200}
                      value={securityPolicy.autoRestrictScoreThreshold}
                      onChange={(e) =>
                        setSecurityPolicy((p) => ({
                          ...p,
                          autoRestrictScoreThreshold: Number(e.target.value) || 60,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      حد نقاط المخاطر للتعليق التلقائي 24 ساعة (المستوى 2)
                    </label>
                    <input
                      type="number"
                      min={40}
                      max={300}
                      value={securityPolicy.autoSuspendScoreThreshold}
                      onChange={(e) =>
                        setSecurityPolicy((p) => ({
                          ...p,
                          autoSuspendScoreThreshold: Number(e.target.value) || 100,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-300">
                    نطاقات البريد الإلكتروني المسموح بها عند التسجيل ({securityPolicy.allowedEmailDomains.length}):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {securityPolicy.allowedEmailDomains.map((dom) => (
                      <span
                        key={dom}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-400/30 text-[11px] font-mono text-cyan-200"
                        dir="ltr"
                      >
                        <span>@{dom}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setSecurityPolicy((p) => ({
                              ...p,
                              allowedEmailDomains: p.allowedEmailDomains.filter((d) => d !== dom),
                            }))
                          }
                          className="text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newAllowedDomain}
                      onChange={(e) => setNewAllowedDomain(e.target.value)}
                      placeholder="أضف نطاقاً موثوقاً (مثال: zoho.com)"
                      dir="ltr"
                      className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const clean = newAllowedDomain.trim().toLowerCase().replace(/^@/, '');
                        if (clean.includes('.') && !securityPolicy.allowedEmailDomains.includes(clean)) {
                          setSecurityPolicy((p) => ({
                            ...p,
                            allowedEmailDomains: [...p.allowedEmailDomains, clean],
                          }));
                          setNewAllowedDomain('');
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white cursor-pointer"
                    >
                      + إضافة نطاق
                    </button>
                    <button
                      type="button"
                      disabled={savingSecurity}
                      onClick={() => handleSaveSecurityPolicy()}
                      className="px-4 py-2 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 btn-solid-white"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingSecurity ? 'جاري الحفظ...' : 'حفظ سياسة الأمان'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Flagged & Auto-Restricted Accounts (Paginated 10/page) */}
              <div className="cyber-glass rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-black text-white">
                    الحسابات المقيدة تلقائياً أو ذات المخاطر ({riskProfiles.length})
                  </h4>
                  <button
                    type="button"
                    onClick={fetchSecurityData}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingSecurity ? 'animate-spin' : ''}`} />
                    <span>تحديث</span>
                  </button>
                </div>

                {riskProfiles.length === 0 ? (
                  <p className="py-6 text-center text-xs text-emerald-300">
                    لا توجد حسابات مقيّدة أو مشبوهة حالياً — الوضع الأمني مستقر ✓
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {riskProfiles
                      .slice((riskPage - 1) * PAGE_SIZE, riskPage * PAGE_SIZE)
                      .map((rp) => (
                        <div
                          key={rp.userId}
                          className="p-3 rounded-xl bg-[#070A12] border border-rose-500/30 flex flex-wrap items-center justify-between gap-2.5"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="text-xs font-extrabold text-white">{rp.userNameAr}</span>
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px] font-black">
                                النقاط: {rp.riskScore} · المخالفات: {rp.strikesCount}
                              </span>
                              {rp.isSuspended && (
                                <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold">
                                  محظور
                                </span>
                              )}
                              {!rp.isSuspended && rp.restrictedUntil && rp.restrictedUntil > Date.now() && (
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                  تقييد مؤقت حتى {new Date(rp.restrictedUntil).toLocaleTimeString('ar-SY')}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400" dir="ltr">
                              {rp.userEmail}
                            </div>
                            {rp.restrictionReason && (
                              <div className="text-[11px] text-rose-200">{rp.restrictionReason}</div>
                            )}
                          </div>

                          <div className="flex items-center flex-wrap gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSecurityUserAction(rp.userId, 'UNBAN_RESET')}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold cursor-pointer"
                            >
                              فك التقييد وتصفير النقاط
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSecurityUserAction(rp.userId, 'RESTRICT_24H')}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold cursor-pointer"
                            >
                              تقييد 24س
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSecurityUserAction(rp.userId, 'PERMA_BAN')}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600/25 hover:bg-rose-600/40 border border-rose-500/40 text-rose-300 text-[11px] font-bold cursor-pointer"
                            >
                              حظر دائم
                            </button>
                          </div>
                        </div>
                      ))}
                    <AdminPagination
                      currentPage={riskPage}
                      totalItems={riskProfiles.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setRiskPage}
                      itemLabel="حساب"
                    />
                  </div>
                )}
              </div>

              {/* Fraud & Suspicious Events Log (Paginated 10/page) */}
              <div className="cyber-glass rounded-2xl p-4 space-y-3">
                <h4 className="text-xs sm:text-sm font-black text-white">
                  سجل محاولات الاحتيال والتقييد التلقائي ({fraudEvents.length})
                </h4>
                {fraudEvents.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">
                    لم يتم رصد أي محاولات مشبوهة حتى الآن.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {fraudEvents
                      .slice((fraudPage - 1) * PAGE_SIZE, fraudPage * PAGE_SIZE)
                      .map((ev) => (
                        <div
                          key={ev.id}
                          className="p-3 rounded-xl bg-[#070A12] border border-white/10 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center flex-wrap gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold">
                                +{ev.pointsAdded} نقطة
                              </span>
                              <span className="text-xs font-extrabold text-white">
                                {ev.userNameAr}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400" dir="ltr">
                                ({ev.userEmail}) · IP: {ev.ipAddress}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-300">{ev.details}</div>
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 shrink-0">
                            {new Date(ev.createdAt).toLocaleTimeString('ar-SY')} ·{' '}
                            {new Date(ev.createdAt).toLocaleDateString('ar-SY')}
                          </div>
                        </div>
                      ))}
                    <AdminPagination
                      currentPage={fraudPage}
                      totalItems={fraudEvents.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setFraudPage}
                      itemLabel="حدث أمني"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showSqlHubModal && (
        <SupabaseSqlHubModal
          isOpen={showSqlHubModal}
          onClose={() => setShowSqlHubModal(false)}
          completedPatches={supabaseConfig.completedPatches}
          onTogglePatchCompleted={(ver) =>
            onUpdateSupabaseConfig({
              ...supabaseConfig,
              completedPatches: {
                ...supabaseConfig.completedPatches,
                [ver]: !supabaseConfig.completedPatches[ver],
              },
            })
          }
        />
      )}
    </div>
  );
};
