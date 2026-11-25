/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Wifi,
  MessageSquare,
  Wallet,
  History,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  ShieldAlert,
  Send,
  Phone,
  Shield,
  Sun,
  Moon,
  LogOut,
  UserCog,
  ChevronDown,
  Coins,
  X,
  LogIn,
  BookOpen,
  User,
  Crown,
  ShieldCheck,
  Languages,
  Headphones,
  Award,
  Store,
} from 'lucide-react';
import {
  AppLanguage,
  GrizzlyCountry,
  GrizzlyServiceItem,
  ESimPlan,
  ActiveSmsOrder,
  ActiveESimOrder,
  PaymentTransaction,
  PlatformSettings,
  GrizzlyBuyOptions,
  SupportedCurrency,
  PricingOverrideRule,
  PaymentGatewayConfig,
  TopUpOrderRequest,
  ManagedUserAccount,
  ESimLpaInventoryItem,
  SiteCmsConfig,
  ActivityLogEntry,
  SupabaseConfigState,
  PlatformNotification,
  SupportChatMessage,
  ResellerProgramConfig,
  ResellerApplication,
} from './types';
import { LANGUAGE_META, getDirForLang, t } from './i18n';
import { SmsWorkspace } from './components/SmsWorkspace';
import { ESimWorkspace } from './components/ESimWorkspace';
import { WalletWorkspace } from './components/WalletWorkspace';
import { AdminWorkspace } from './components/AdminWorkspace';
import { OrdersHistoryWorkspace } from './components/OrdersHistoryWorkspace';
import { PWAInstallModalAndButton } from './components/PWAInstallModalAndButton';
import { HeroSlider } from './components/HeroSlider';
import { SiteFooter } from './components/SiteFooter';
import { NotificationBellMenu } from './components/NotificationBellMenu';
import { OfflineIndicator } from './components/OfflineIndicator';
import { getAllCodesForOrder } from './components/LiveOtpPanel';
import { OtpActivationModal } from './components/OtpActivationModal';
import { AuthModal } from './components/AuthModal';
import { SupportChatWidget } from './components/SupportChatWidget';
import { GuidesAndDisclaimerModal } from './components/GuidesAndDisclaimerModal';
import {
  STORAGE_KEYS,
  loadFromStorage,
  saveToStorage,
  DEFAULT_CMS_CONFIG,
  DEFAULT_PAYMENT_GATEWAYS,
  DEFAULT_MANAGED_USERS,
  DEFAULT_PRICING_OVERRIDES,
  DEFAULT_LPA_INVENTORY,
  DEFAULT_TOPUP_REQUESTS,
  DEFAULT_ACTIVITY_LOGS,
  formatCurrencyAmount,
  convertCurrencyToUsd,
  playCyberChime,
  extractOtpFromText,
  syncWithSupabaseCloud,
  FullPlatformBackupPayload,
} from './services/hybridSyncEngine';
import { useAutoTranslate } from './services/dynamicTranslator';
import { dispatchSystemPushNotification } from './services/webPushService';

type ActiveSection = 'sms' | 'esim' | 'wallet' | 'history' | 'admin';

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('sms');
  const [currency, setCurrency] = useState<SupportedCurrency>('USD');
  const [lang, setLang] = useState<AppLanguage>(() => {
    const stored = loadFromStorage<AppLanguage>(STORAGE_KEYS.LANGUAGE, 'ar');
    return stored === 'tr' || stored === 'en' ? stored : 'ar';
  });

  // Auth Session held strictly in React memory (never localStorage)
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<ManagedUserAccount | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Popups: OTP Activation Modal + Official Guides & Disclaimer Modal
  const [otpModalOpen, setOtpModalOpen] = useState<boolean>(false);
  const [guidesModalOpen, setGuidesModalOpen] = useState<boolean>(false);
  const [guidesInitialTab, setGuidesInitialTab] = useState<'sms' | 'esim' | 'disclaimer'>('sms');

  // Core Platform State
  const [walletUsd, setWalletUsd] = useState<number>(14.5);
  const [countries, setCountries] = useState<GrizzlyCountry[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<string>('16');
  const [smsServices, setSmsServices] = useState<GrizzlyServiceItem[]>([]);
  const [smsSourceMode, setSmsSourceMode] = useState<'LIVE_GRIZZLY_API' | 'SIMULATED_CATALOG'>(
    'SIMULATED_CATALOG'
  );

  // Live eSIM State
  const [esimPlans, setEsimPlans] = useState<ESimPlan[]>([]);
  const [totalESimPlans, setTotalESimPlans] = useState<number>(0);
  const [esimSource, setEsimSource] = useState<string>('LIVE_GRIZZLYSMS_ESIM_API');
  const [loadingESim, setLoadingESim] = useState<boolean>(false);
  const [esimCountryFilter, setEsimCountryFilter] = useState<string>('TR');
  const [esimValidityFilter, setEsimValidityFilter] = useState<string>('');

  const [activeSmsOrders, setActiveSmsOrders] = useState<ActiveSmsOrder[]>([]);
  const [activeESimOrders, setActiveESimOrders] = useState<ActiveESimOrder[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentTransaction[]>([]);
  const [settings, setSettings] = useState<PlatformSettings & { apiStatusError?: string | null }>({
    hasApiKey: false,
    maskedApiKey: '',
    hasSyriaTodayKey: false,
    isLiveMode: false,
    apiStatusError: null,
    providerBalanceRub: null,
    providerBalanceUsd: null,
    staticCryptoWalletTrx: null,
    lastSyncAt: Date.now(),
    smsMarkupPercent: 25,
    esimMarkupPercent: 20,
    usdToSypRate: 14800,
    usdToTryRate: 34.5,
    usdToUsdtRate: 1.0,
    rubToUsdRate: 0.0108,
    syriatelMerchantCode: '0933884421 (رمز التاجر: 482910)',
    syriatelMerchantName: 'شركة AliSMS للاتصالات الرقمية',
    shamcashWalletAddress: '67de67e57bdc42690f935bab415e5c6e',
    shamcashAccountHolder: 'AliSMS Telecom Syria',
    binancePayId: '1073784382',
    binanceUsdtTrc20: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
    binanceUsdtBep20: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
    hasBinanceApiKeys: false,
    autoVerifyPayments: true,
  });

  // Dynamic CMS & Platform Slices
  const [cmsConfig, setCmsConfig] = useState<SiteCmsConfig>(() => {
    const stored = loadFromStorage(STORAGE_KEYS.CMS_CFG, DEFAULT_CMS_CONFIG);
    return {
      ...DEFAULT_CMS_CONFIG,
      ...stored,
      heroSlides:
        Array.isArray(stored.heroSlides) && stored.heroSlides.length > 0
          ? stored.heroSlides
          : DEFAULT_CMS_CONFIG.heroSlides,
    };
  });
  const [pricingOverrides, setPricingOverrides] = useState<PricingOverrideRule[]>(() =>
    loadFromStorage(STORAGE_KEYS.PRICING_OVERRIDES, DEFAULT_PRICING_OVERRIDES)
  );
  const [paymentGateways, setPaymentGateways] = useState<PaymentGatewayConfig[]>(() => {
    const stored = loadFromStorage(STORAGE_KEYS.PAYMENT_GATEWAYS, DEFAULT_PAYMENT_GATEWAYS);
    const migrated = stored.map((gw) => {
      if (gw.code === 'binance') {
        return {
          ...gw,
          isAutomated: true,
          accountAddress: gw.accountAddress === '849201928' ? '1073784382' : gw.accountAddress,
          qrCodeText:
            gw.accountAddress === '849201928'
              ? 'BINANCEPAY:1073784382'
              : gw.qrCodeText || `BINANCEPAY:${gw.accountAddress}`,
        };
      }
      if (gw.code === 'shamcash') {
        return {
          ...gw,
          isAutomated: false,
          allowReceiptUpload: true,
          requireReceiptUpload: true,
          accountAddress:
            gw.accountAddress === 'SHAM-8849201-SYR'
              ? '67de67e57bdc42690f935bab415e5c6e'
              : gw.accountAddress,
          qrCodeText:
            gw.accountAddress === 'SHAM-8849201-SYR'
              ? '67de67e57bdc42690f935bab415e5c6e'
              : gw.qrCodeText || gw.accountAddress,
        };
      }
      if (gw.code === 'syriatel') {
        return {
          ...gw,
          isAutomated: false,
          allowReceiptUpload: true,
          requireReceiptUpload: true,
        };
      }
      return gw;
    });

    // Inject USDT-TRC20 and USDT-BEP20 on-chain gateways if missing from older localStorage cache
    const hasTrc20 = migrated.some((g) => g.code === 'usdt_trc20');
    const hasBep20 = migrated.some((g) => g.code === 'usdt_bep20');
    const extras: PaymentGatewayConfig[] = [];
    if (!hasTrc20) {
      const def = DEFAULT_PAYMENT_GATEWAYS.find((g) => g.code === 'usdt_trc20');
      if (def) extras.push(def);
    }
    if (!hasBep20) {
      const def = DEFAULT_PAYMENT_GATEWAYS.find((g) => g.code === 'usdt_bep20');
      if (def) extras.push(def);
    }
    if (extras.length > 0) {
      const binanceIdx = migrated.findIndex((g) => g.code === 'binance');
      if (binanceIdx >= 0) {
        migrated.splice(binanceIdx + 1, 0, ...extras);
      } else {
        migrated.unshift(...extras);
      }
    }
    return migrated;
  });
  const [topUpRequests, setTopUpRequests] = useState<TopUpOrderRequest[]>(() => {
    const stored = loadFromStorage<TopUpOrderRequest[]>(
      STORAGE_KEYS.TOPUP_REQUESTS,
      DEFAULT_TOPUP_REQUESTS
    );
    return stored.filter((r) => r.id !== 'topup-req-101' && r.id !== 'topup-req-102');
  });
  const [managedUsers, setManagedUsers] = useState<ManagedUserAccount[]>(() => {
    const stored = loadFromStorage<ManagedUserAccount[]>(
      STORAGE_KEYS.MANAGED_USERS,
      DEFAULT_MANAGED_USERS
    );
    return stored
      .filter(
        (u) =>
          u.id !== 'usr-client-1' &&
          u.emailOrPhone?.toLowerCase() !== 'ahmad.sh@gmail.com'
      )
      .map((u) => ({
        ...u,
        role:
          u.role === 'ADMIN'
            ? 'ADMIN'
            : u.role === 'MODERATOR'
            ? 'MODERATOR'
            : u.role === 'RESELLER'
            ? 'RESELLER'
            : 'USER',
      }));
  });
  const [customESimPlans, setCustomESimPlans] = useState<ESimPlan[]>(() =>
    loadFromStorage(STORAGE_KEYS.CUSTOM_ESIM_PLANS, [])
  );
  const [lpaInventory, setLpaInventory] = useState<ESimLpaInventoryItem[]>(() => {
    const stored = loadFromStorage<ESimLpaInventoryItem[]>(
      STORAGE_KEYS.LPA_INVENTORY,
      DEFAULT_LPA_INVENTORY
    );
    return stored.filter((i) => i.id !== 'lpa-inv-1' && i.id !== 'lpa-inv-2');
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>(() => {
    const stored = loadFromStorage<ActivityLogEntry[]>(
      STORAGE_KEYS.ACTIVITY_LOGS,
      DEFAULT_ACTIVITY_LOGS
    );
    return stored.filter(
      (a) => a.id !== 'act-1' && a.id !== 'act-2' && a.id !== 'act-3'
    );
  });
  const [pinnedCountries, setPinnedCountries] = useState<string[]>(() =>
    loadFromStorage(STORAGE_KEYS.PINNED_COUNTRIES, ['16', '22', '73'])
  );
  const [pinnedServices, setPinnedServices] = useState<string[]>(() =>
    loadFromStorage(STORAGE_KEYS.PINNED_SERVICES, ['wa', 'tg', 'go', 'oi'])
  );
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfigState>(() => {
    const stored = loadFromStorage<SupabaseConfigState>(STORAGE_KEYS.SUPABASE_CFG, {
      supabaseUrl: '',
      supabaseAnonKey: '',
      isConnected: false,
      lastSyncAt: null,
      syncStatusText: 'يتم الاتصال السحابي بقاعدة Supabase بشكل آمن عبر الخادم فقط',
      completedPatches: {
        'v1.0': true,
        'v1.1': true,
        'v1.2': true,
        'v1.3': false,
        'v1.4': false,
      },
    });
    // Never keep Supabase URL or keys in browser localStorage
    return {
      ...stored,
      supabaseUrl: '',
      supabaseAnonKey: '',
    };
  });

  // UI States
  const [loadingSmsCatalog, setLoadingSmsCatalog] = useState<boolean>(false);
  const [buyingServiceCode, setBuyingServiceCode] = useState<string | null>(null);
  const [buyingPlanId, setBuyingPlanId] = useState<string | null>(null);
  const [syncingSupabase, setSyncingSupabase] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() =>
    loadFromStorage<'dark' | 'light'>('alisms_theme_mode', 'dark')
  );
  const [profileMenuOpen, setProfileMenuOpen] = useState<boolean>(false);
  const [editProfileOpen, setEditProfileOpen] = useState<boolean>(false);
  const [profileNameDraft, setProfileNameDraft] = useState<string>('');
  const [profileAvatarDraft, setProfileAvatarDraft] = useState<string>('');
  const [currencyAnimating, setCurrencyAnimating] = useState<boolean>(false);
  const [supportChatOpen, setSupportChatOpen] = useState<boolean>(false);
  const [supportUnreadCount, setSupportUnreadCount] = useState<number>(0);

  // Reseller Program & Application Modal state
  const [resellerModalOpen, setResellerModalOpen] = useState<boolean>(false);
  const [resellerStatusLoading, setResellerStatusLoading] = useState<boolean>(false);
  const [resellerStatusData, setResellerStatusData] = useState<{
    role: string;
    resellerTier: string | null;
    resellerDiscountPercent: number;
    fraudScore: number;
    balanceUsd: number;
    totalSpentUsd: number;
    config: ResellerProgramConfig;
    latestApplication: ResellerApplication | null;
  } | null>(null);
  const [resellerContactHandle, setResellerContactHandle] = useState<string>('');
  const [resellerMonthlyVol, setResellerMonthlyVol] = useState<string>('100');
  const [resellerBusinessNote, setResellerBusinessNote] = useState<string>('');
  const [submittingResellerApp, setSubmittingResellerApp] = useState<boolean>(false);
  const [resellerFeedback, setResellerFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notifiedOtpIdsRef = useRef<Set<string>>(new Set());

  const isAdmin = authUser?.role === 'ADMIN';
  const isModerator = authUser?.role === 'MODERATOR';
  const isReseller = authUser?.role === 'RESELLER';
  const isStaff = isAdmin || isModerator;

  // Sync HTML dir & lang dynamically for Arabic (RTL), Turkish (LTR), English (LTR)
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.LANGUAGE, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = getDirForLang(lang);
  }, [lang]);

  // Sync Admin-controlled Site Name, App Name, Favicon & Dynamic PWA Manifest
  useEffect(() => {
    const siteName = (cmsConfig.platformName || 'alisim').trim();
    const shortName = (cmsConfig.appShortName || siteName).trim();
    const rawLogo = (cmsConfig.siteLogoUrl || '/pwa-192x192.png').trim() || '/pwa-192x192.png';

    document.title = `${siteName} — أرقام افتراضية فورية وشرائح eSIM عالمية`;

    const setMetaTag = (attr: 'name' | 'property', key: string, value: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.content = value;
    };
    const resolvedSeoLogo =
      rawLogo.startsWith('http://') || rawLogo.startsWith('https://') || rawLogo.startsWith('/')
        ? rawLogo
        : '/pwa-512x512.png';
    setMetaTag('property', 'og:site_name', siteName);
    setMetaTag('property', 'og:title', `${siteName} — أرقام افتراضية فورية وشرائح eSIM عالمية`);
    setMetaTag('name', 'twitter:title', `${siteName} — أرقام افتراضية فورية وشرائح eSIM عالمية`);
    setMetaTag('property', 'og:image', resolvedSeoLogo);
    setMetaTag('name', 'twitter:image', resolvedSeoLogo);
    const jsonLdEl = document.getElementById('alisim-jsonld');
    if (jsonLdEl) {
      try {
        const parsed = JSON.parse(jsonLdEl.textContent || '{}');
        parsed.name = siteName;
        jsonLdEl.textContent = JSON.stringify(parsed);
      } catch {
        // ignore JSON-LD parse failure
      }
    }

    const updateIconLink = (selector: string, rel: string) => {
      let el = document.querySelector<HTMLLinkElement>(selector);
      if (!el) {
        el = document.createElement('link');
        el.rel = rel;
        document.head.appendChild(el);
      }
      el.href = rawLogo;
    };
    updateIconLink('link[rel="icon"]', 'icon');
    updateIconLink('link[rel="apple-touch-icon"]', 'apple-touch-icon');

    const resolvedIconSrc =
      rawLogo.startsWith('data:') || rawLogo.startsWith('http://') || rawLogo.startsWith('https://')
        ? rawLogo
        : `${window.location.origin}${rawLogo.startsWith('/') ? rawLogo : `/${rawLogo}`}`;

    const manifestPayload = {
      name: siteName,
      short_name: shortName,
      start_url: `${window.location.origin}/`,
      display: 'standalone',
      background_color: '#06080E',
      theme_color: '#06080E',
      icons: [
        { src: resolvedIconSrc, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: resolvedIconSrc, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    };

    const blob = new Blob([JSON.stringify(manifestPayload)], { type: 'application/manifest+json' });
    const manifestUrl = URL.createObjectURL(blob);
    let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestUrl;

    return () => {
      URL.revokeObjectURL(manifestUrl);
    };
  }, [cmsConfig.platformName, cmsConfig.appShortName, cmsConfig.siteLogoUrl]);

  // Ensure non-staff never stays on Admin/Moderator section
  useEffect(() => {
    if (activeSection === 'admin' && !isStaff) {
      setActiveSection('sms');
    }
  }, [activeSection, isStaff]);

  useEffect(() => {
    saveToStorage('alisms_theme_mode', themeMode);
    if (themeMode === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [themeMode]);

  // Sync server-backed Top-Up Receipt Queue & Staff accounts when Admin/Moderator logs in
  const syncStaffServerData = useCallback(async (token: string, role: string) => {
    try {
      const topupsRes = await fetch('/api/topups', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (topupsRes.ok) {
        const data = await topupsRes.json();
        const serverReqs: TopUpOrderRequest[] = data.requests || [];
        if (serverReqs.length > 0) {
          setTopUpRequests((prev) => {
            const byId = new Map<string, TopUpOrderRequest>();
            serverReqs.forEach((r) => byId.set(r.id, r));
            prev.forEach((r) => {
              if (!byId.has(r.id)) byId.set(r.id, r);
            });
            return Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
          });
        }
      }
      if (role === 'ADMIN') {
        const staffRes = await fetch('/api/admin/staff', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (staffRes.ok) {
          const staffData = await staffRes.json();
          const serverUsers: ManagedUserAccount[] = (staffData.accounts || []).map(
            (acc: {
              id: string;
              nameAr: string;
              emailOrPhone: string;
              avatarUrl?: string;
              role: 'ADMIN' | 'MODERATOR' | 'RESELLER' | 'USER';
              isProtectedAdmin?: boolean;
              resellerTier?: 'SILVER' | 'GOLD' | null;
              resellerDiscountPercent?: number;
              fraudScore?: number;
              isSuspended?: boolean;
              createdAt?: number;
            }) => ({
              id: acc.id,
              nameAr: acc.nameAr,
              emailOrPhone: acc.emailOrPhone,
              avatarUrl: acc.avatarUrl,
              role: acc.role,
              isProtectedAdmin: acc.isProtectedAdmin,
              resellerTier: acc.resellerTier,
              resellerDiscountPercent: acc.resellerDiscountPercent,
              fraudScore: acc.fraudScore,
              isSuspended: acc.isSuspended,
              balanceUsd: 0,
              totalSpentUsd: 0,
              ordersCount: 0,
              lastActiveAt: acc.createdAt || Date.now(),
            })
          );
          if (serverUsers.length > 0) {
            setManagedUsers((prev) => {
              const merged = [...prev];
              serverUsers.forEach((su) => {
                const idx = merged.findIndex(
                  (m) => m.emailOrPhone.toLowerCase() === su.emailOrPhone.toLowerCase()
                );
                if (idx >= 0) {
                  merged[idx] = {
                    ...merged[idx],
                    id: su.id,
                    role: su.role,
                    nameAr: su.nameAr,
                    isProtectedAdmin: su.isProtectedAdmin,
                    resellerTier: su.resellerTier,
                    resellerDiscountPercent: su.resellerDiscountPercent,
                    fraudScore: su.fraudScore,
                    isSuspended: su.isSuspended,
                  };
                } else {
                  merged.unshift(su);
                }
              });
              return merged;
            });
          }
        }
      }
    } catch {
      // ignore background sync errors
    }
  }, []);

  useEffect(() => {
    if (authToken && isStaff && authUser) {
      syncStaffServerData(authToken, authUser.role);
    }
  }, [authToken, isStaff, authUser, syncStaffServerData]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const [notifications, setNotifications] = useState<PlatformNotification[]>(() =>
    loadFromStorage<PlatformNotification[]>(STORAGE_KEYS.NOTIFICATIONS, [
      {
        id: 'notif-welcome-1',
        category: 'announcement',
        titleAr: 'مرحباً بك في منصة AliSMS',
        bodyAr: 'تم تفعيل نظام الإشعارات الصوتية الفوري لأكواد OTP، شحن المحفظة، وردود الدعم الفني.',
        isRead: false,
        createdAt: Date.now(),
      },
    ])
  );
  const [isNotifMuted, setIsNotifMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.NOTIFICATION_MUTED) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, notifications);
  }, [notifications]);

  const handleToggleNotifMute = useCallback(() => {
    setIsNotifMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.NOTIFICATION_MUTED, String(next));
      } catch {
        // ignore
      }
      if (!next) {
        playCyberChime('notification', true);
      }
      return next;
    });
  }, []);

  const pushNotification = useCallback(
    (
      category: PlatformNotification['category'],
      titleAr: string,
      bodyAr: string,
      chime: 'otp' | 'success' | 'alert' | 'notification' | 'none' = 'notification'
    ) => {
      const item: PlatformNotification = {
        id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category,
        titleAr,
        bodyAr,
        isRead: false,
        createdAt: Date.now(),
      };
      setNotifications((prev) => [item, ...prev].slice(0, 60));
      if (chime !== 'none') {
        playCyberChime(chime);
      }
      if (category === 'otp' || category === 'wallet' || category === 'support' || category === 'system') {
        dispatchSystemPushNotification({
          title: titleAr,
          body: bodyAr,
          tag: `alisim-${category}-${item.id}`,
        });
      }
    },
    []
  );

  // Low Upstream Provider Balance Alert (fires once per low-balance state for Super Admin)
  const lowBalanceNotifiedRef = useRef<boolean>(false);
  useEffect(() => {
    if (isAdmin && settings.isProviderBalanceLow && settings.providerBalanceUsd !== null) {
      if (!lowBalanceNotifiedRef.current) {
        lowBalanceNotifiedRef.current = true;
        pushNotification(
          'system',
          'تنبيه حرج: انخفاض رصيد مزود الأرقام (API)',
          `الرصيد الحالي $${settings.providerBalanceUsd.toFixed(2)} أقل من الحد الآمن ($${(
            settings.lowProviderBalanceThresholdUsd ?? 10
          ).toFixed(2)}). يرجى شحن المزود فوراً.`,
          'alert'
        );
      }
    } else if (!settings.isProviderBalanceLow) {
      lowBalanceNotifiedRef.current = false;
    }
  }, [
    isAdmin,
    settings.isProviderBalanceLow,
    settings.providerBalanceUsd,
    settings.lowProviderBalanceThresholdUsd,
    pushNotification,
  ]);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4200);
  }, []);

  const appendActivityLog = useCallback((entry: Omit<ActivityLogEntry, 'id' | 'createdAt'>) => {
    setActivityLogs((prev) => {
      const next: ActivityLogEntry[] = [
        {
          ...entry,
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: Date.now(),
        },
        ...prev.slice(0, 99),
      ];
      saveToStorage(STORAGE_KEYS.ACTIVITY_LOGS, next);
      return next;
    });
  }, []);

  useEffect(() => saveToStorage(STORAGE_KEYS.CMS_CFG, cmsConfig), [cmsConfig]);
  useEffect(() => saveToStorage(STORAGE_KEYS.PRICING_OVERRIDES, pricingOverrides), [pricingOverrides]);
  useEffect(() => saveToStorage(STORAGE_KEYS.PAYMENT_GATEWAYS, paymentGateways), [paymentGateways]);
  useEffect(() => saveToStorage(STORAGE_KEYS.TOPUP_REQUESTS, topUpRequests), [topUpRequests]);
  useEffect(() => saveToStorage(STORAGE_KEYS.MANAGED_USERS, managedUsers), [managedUsers]);
  useEffect(() => saveToStorage(STORAGE_KEYS.CUSTOM_ESIM_PLANS, customESimPlans), [customESimPlans]);
  useEffect(() => saveToStorage(STORAGE_KEYS.LPA_INVENTORY, lpaInventory), [lpaInventory]);
  useEffect(() => saveToStorage(STORAGE_KEYS.PINNED_COUNTRIES, pinnedCountries), [pinnedCountries]);
  useEffect(() => saveToStorage(STORAGE_KEYS.PINNED_SERVICES, pinnedServices), [pinnedServices]);
  useEffect(() => saveToStorage(STORAGE_KEYS.SUPABASE_CFG, supabaseConfig), [supabaseConfig]);

  const updateCurrentUserWallet = useCallback(
    (newBalanceUsd: number, addedSpendUsd = 0) => {
      setWalletUsd(newBalanceUsd);
      setManagedUsers((prev) =>
        prev.map((u) =>
          u.emailOrPhone.toLowerCase() === authUser?.emailOrPhone.toLowerCase() || u.isCurrentSession
            ? {
                ...u,
                balanceUsd: Number(newBalanceUsd.toFixed(2)),
                totalSpentUsd: Number((u.totalSpentUsd + addedSpendUsd).toFixed(2)),
                ordersCount: addedSpendUsd > 0 ? u.ordersCount + 1 : u.ordersCount,
                lastActiveAt: Date.now(),
              }
            : u
        )
      );
    },
    [authUser?.emailOrPhone]
  );

  const exchangeRates = {
    usdToSypRate: settings.usdToSypRate || 14800,
    usdToTryRate: settings.usdToTryRate || 34.5,
    usdToUsdtRate: settings.usdToUsdtRate || 1.0,
  };

  // Sync Exchange Rates from Syria Today API
  const handleSyncSyriaTodayRates = useCallback(async () => {
    try {
      const res = await fetch('/api/rates/syria-today');
      const data = await res.json();
      if (data.usdToSypRate || data.usdToTryRate) {
        setSettings((prev) => ({
          ...prev,
          usdToSypRate: data.usdToSypRate || prev.usdToSypRate,
          usdToTryRate: data.usdToTryRate || prev.usdToTryRate,
        }));
      }
      return {
        ok: Boolean(data.usdToSypRate) && !data.error,
        message:
          data.source === 'SYRIA_TODAY_LIVE_API'
            ? `تم تحديث أسعار الصرف مباشرة من سوريا اليوم: 1 USD = ${data.usdToSypRate} ل.س · ${data.usdToTryRate} ₺`
            : `تم تحديث أسعار الصرف: 1 USD = ${data.usdToSypRate} ل.س · ${data.usdToTryRate} ₺`,
        usdToSypRate: data.usdToSypRate,
        usdToTryRate: data.usdToTryRate,
      };
    } catch {
      return { ok: false, message: 'تعذر الاتصال بخدمة أسعار الصرف حالياً.' };
    }
  }, []);

  const handleSyncWithSupabase = useCallback(
    async (silentAuto = false) => {
      if (!authToken) {
        if (!silentAuto) {
          showToast('error', 'يرجى تسجيل الدخول بحساب المدير العام لتنفيذ المزامنة السحابية.');
        }
        return;
      }

      setSyncingSupabase(true);
      try {
        const res = await syncWithSupabaseCloud(
          supabaseConfig,
          {
            cmsConfig,
            settings,
            pricingOverrides,
            paymentGateways,
            topUpRequests,
            managedUsers,
            lpaInventory,
            activityLogs,
            activeSmsOrders,
            activeESimOrders,
          },
          authToken
        );

        setSupabaseConfig((prev) => ({
          ...prev,
          isConnected: res.ok,
          lastSyncAt: Date.now(),
          syncStatusText: res.message,
        }));

        if (!silentAuto) {
          if (res.ok) {
            playCyberChime('success');
            showToast('success', res.message);
          } else {
            showToast('error', res.message);
          }
        }
      } finally {
        setSyncingSupabase(false);
      }
    },
    [
      authToken,
      supabaseConfig,
      cmsConfig,
      settings,
      pricingOverrides,
      paymentGateways,
      topUpRequests,
      managedUsers,
      lpaInventory,
      activityLogs,
      activeSmsOrders,
      activeESimOrders,
      showToast,
    ]
  );

  const fetchBootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) return;
      const data = await res.json();
      setWalletUsd(data.walletUsd);
      setCountries(data.countries || []);
      setSettings((prev) => ({
        ...prev,
        ...data.settings,
      }));
      if (data.settings) {
        setPaymentGateways((prev) =>
          prev.map((g) => {
            if (g.code === 'binance' && data.settings.binancePayId) {
              return {
                ...g,
                accountAddress: data.settings.binancePayId,
                qrCodeText: `BINANCEPAY:${data.settings.binancePayId}`,
              };
            }
            if (g.code === 'usdt_trc20' && data.settings.binanceUsdtTrc20) {
              return {
                ...g,
                accountAddress: data.settings.binanceUsdtTrc20,
                qrCodeText: data.settings.binanceUsdtTrc20,
              };
            }
            if (g.code === 'usdt_bep20' && data.settings.binanceUsdtBep20) {
              return {
                ...g,
                accountAddress: data.settings.binanceUsdtBep20,
                qrCodeText: data.settings.binanceUsdtBep20,
              };
            }
            return g;
          })
        );
      }
      setActiveSmsOrders(data.activeSmsOrders || []);
      setActiveESimOrders(data.activeESimOrders || []);
      setPaymentHistory(data.paymentHistory || []);
    } catch {
      // Ignore
    }
  }, []);

  const fetchSmsCatalog = useCallback(
    async (countryId: string) => {
      setLoadingSmsCatalog(true);
      try {
        const res = await fetch(`/api/grizzly/sms/catalog?country=${encodeURIComponent(countryId)}`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        });
        if (!res.ok) return;
        const data = await res.json();
        setSmsServices(data.services || []);
        setSmsSourceMode(data.sourceMode || 'SIMULATED_CATALOG');
      } finally {
        setLoadingSmsCatalog(false);
      }
    },
    [authToken]
  );

  const fetchESimCatalog = useCallback(
    async (countryIso: string, validityDays: string) => {
      setLoadingESim(true);
      try {
        const params = new URLSearchParams({
          country: countryIso,
          validity: validityDays,
          limit: '24',
        });
        const res = await fetch(`/api/grizzly/esim/catalog?${params.toString()}`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        });
        if (!res.ok) return;
        const data = await res.json();
        setEsimPlans(data.plans || []);
        setTotalESimPlans(Number(data.total || 0));
        setEsimSource(data.source || 'LIVE_GRIZZLYSMS_ESIM_API');
      } catch {
        // Ignore
      } finally {
        setLoadingESim(false);
      }
    },
    [authToken]
  );

  useEffect(() => {
    fetchBootstrap();
    handleSyncSyriaTodayRates();
  }, [fetchBootstrap, handleSyncSyriaTodayRates]);

  useEffect(() => {
    fetchSmsCatalog(selectedCountryId);
  }, [selectedCountryId, fetchSmsCatalog]);

  useEffect(() => {
    fetchESimCatalog(esimCountryFilter, esimValidityFilter);
  }, [esimCountryFilter, esimValidityFilter, fetchESimCatalog]);

  // Background polling for active & multi-code SMS orders
  useEffect(() => {
    const hasPollableOrder = activeSmsOrders.some((o) => {
      const notExpired = o.expiresAt > Date.now();
      if (!notExpired) return false;
      if (['WAITING_SMS', 'READY_SENT', 'WAIT_RETRY', 'WAIT_RESEND'].includes(o.status)) {
        return true;
      }
      return o.status === 'SMS_RECEIVED' && o.canGetAnotherSms !== false;
    });
    if (!hasPollableOrder) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/grizzly/sms/poll');
        if (!res.ok) return;
        const data = await res.json();
        const updatedOrders: ActiveSmsOrder[] = data.activeSmsOrders || [];
        setActiveSmsOrders(updatedOrders);
        setWalletUsd(data.walletUsd);

        for (const ord of updatedOrders) {
          const allCodes = getAllCodesForOrder(ord);
          allCodes.forEach((entry, idx) => {
            const notifKey = `${ord.id}-${entry.code}`;
            if (!notifiedOtpIdsRef.current.has(notifKey)) {
              notifiedOtpIdsRef.current.add(notifKey);
              const label =
                allCodes.length > 1
                  ? `وصل الكود #${idx + 1} (${entry.code}) لخدمة ${ord.serviceNameAr}`
                  : `وصل كود التفعيل (${entry.code}) لخدمة ${ord.serviceNameAr}`;
              pushNotification(
                'otp',
                label,
                `الرقم ${ord.phoneNumber} — ${entry.text || 'جاهز للنسخ الفوري'}`,
                'otp'
              );
              showToast('success', `${label} على الرقم ${ord.phoneNumber}!`);
            }
          });
        }
      } catch {
        // Ignore
      }
    }, 3500);

    return () => clearInterval(timer);
  }, [activeSmsOrders, showToast, pushNotification]);

  // Auth Handlers
  const handleAuthSuccess = (token: string, user: ManagedUserAccount) => {
    setAuthToken(token);
    setAuthUser(user);
    setManagedUsers((prev) => {
      const exists = prev.some(
        (u) => u.emailOrPhone.toLowerCase() === user.emailOrPhone.toLowerCase()
      );
      if (exists) {
        return prev.map((u) =>
          u.emailOrPhone.toLowerCase() === user.emailOrPhone.toLowerCase()
            ? {
                ...u,
                nameAr: user.nameAr,
                role: user.role,
                avatarUrl: user.avatarUrl,
                isCurrentSession: true,
              }
            : { ...u, isCurrentSession: false }
        );
      }
      return [
        {
          id: user.id,
          nameAr: user.nameAr,
          emailOrPhone: user.emailOrPhone,
          avatarUrl: user.avatarUrl,
          balanceUsd: walletUsd,
          totalSpentUsd: 0,
          ordersCount: 0,
          role: user.role,
          isCurrentSession: true,
          lastActiveAt: Date.now(),
        },
        ...prev.map((u) => ({ ...u, isCurrentSession: false })),
      ];
    });
    playCyberChime('success');
    showToast(
      'success',
      user.role === 'ADMIN'
        ? `مرحباً بك أيها المدير ${user.nameAr}! تم تفعيل صلاحيات لوحة الإدارة.`
        : user.role === 'MODERATOR'
        ? `مرحباً بك أيها المشرف ${user.nameAr}! تم تفعيل لوحة الإشراف والدعم الفني.`
        : user.role === 'RESELLER'
        ? `مرحباً بك أيها البائع المعتمد ${user.nameAr}! تم تفعيل خصم الجملة الخاص بك (-${
            user.resellerDiscountPercent || 8
          }%).`
        : `أهلاً بك ${user.nameAr}! تم تسجيل الدخول بنجاح.`
    );
  };

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    if (authToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {});
    }
    setAuthToken(null);
    setAuthUser(null);
    if (activeSection === 'admin') {
      setActiveSection('sms');
    }
    showToast('success', 'تم تسجيل الخروج من حسابك بأمان.');
  };

  const handleBuySmsNumber = async (
    options: GrizzlyBuyOptions
  ): Promise<{ success: boolean; error?: string; code?: string }> => {
    setBuyingServiceCode(options.serviceCode);
    try {
      const res = await fetch('/api/grizzly/sms/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(options),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'تعذر شراء الرقم في هذه الفئة السعرية',
          code: data.code || 'NO_NUMBERS',
        };
      }
      const order: ActiveSmsOrder = data.order;
      setActiveSmsOrders((prev) => [order, ...prev]);
      updateCurrentUserWallet(data.walletUsd, order.priceUsd);
      pushNotification(
        'order',
        `تم شراء رقم ${order.serviceNameAr} (${order.countryNameAr})`,
        `الرقم ${order.phoneNumber} جاهز لاستقبال كود التفعيل الآن.`,
        'success'
      );
      showToast('success', `تم تخصيص الرقم ${order.phoneNumber} بنجاح!`);
      appendActivityLog({
        type: 'SMS_BUY',
        titleAr: `شراء رقم ${order.serviceNameAr} (${order.countryNameAr})`,
        detailsAr: `الرقم ${order.phoneNumber} — المعرف #${order.activationId}`,
        amountUsd: order.priceUsd,
      });
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'حدث خطأ أثناء الاتصال بالخادم',
        code: 'NETWORK_ERROR',
      };
    } finally {
      setBuyingServiceCode(null);
    }
  };

  const handleSmsOrderAction = async (
    orderId: string,
    action: 'READY_1' | 'RETRY_3' | 'COMPLETE_6' | 'CANCEL_8' | 'SIMULATE_SMS'
  ) => {
    try {
      const res = await fetch('/api/grizzly/sms/set-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ orderId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'EARLY_CANCEL_DENIED' && typeof data.cancelAvailableAt === 'number') {
          setActiveSmsOrders((prev) =>
            prev.map((o) =>
              o.id === orderId ? { ...o, cancelAvailableAt: data.cancelAvailableAt } : o
            )
          );
        }
        showToast('error', data.error || 'تعذر تنفيذ العملية');
        return;
      }
      setActiveSmsOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
      updateCurrentUserWallet(data.walletUsd);

      if (action === 'CANCEL_8') {
        pushNotification(
          'wallet',
          'تم إلغاء الرقم واسترداد الرصيد',
          `تم استرداد $${Number(data.order?.priceUsd || 0).toFixed(2)} إلى محفظتك فوراً.`,
          'alert'
        );
        showToast('success', 'تم إلغاء الرقم واسترداد كامل المبلغ فوراً.');
      } else if (action === 'READY_1') {
        showToast('success', 'تم إرسال جاهزية الاستلام بنجاح.');
      } else if (action === 'RETRY_3') {
        pushNotification(
          'otp',
          'تم طلب كود إضافي لنفس الرقم',
          `الرقم ${data.order?.phoneNumber} بانتظار الكود الجديد مع حفظ الأكواد السابقة.`,
          'notification'
        );
        showToast('success', 'تم طلب رسالة إضافية لنفس الرقم (الأكواد السابقة محفوظة).');
      } else if (action === 'COMPLETE_6') {
        pushNotification(
          'order',
          'تم إنهاء التفعيل بنجاح',
          `اكتملت جلسة التفعيل للرقم ${data.order?.phoneNumber}.`,
          'success'
        );
        showToast('success', 'تم تأكيد وإنهاء التفعيل بنجاح.');
      } else if (action === 'SIMULATE_SMS') {
        const otp = extractOtpFromText(data.order.fullSmsText) || data.order.smsCode;
        if (otp) notifiedOtpIdsRef.current.add(`${data.order.id}-${otp}`);
        const count = Array.isArray(data.order.smsHistory) ? data.order.smsHistory.length : 1;
        pushNotification(
          'otp',
          `وصل الكود #${count}: ${otp}`,
          `لخدمة ${data.order.serviceNameAr} على الرقم ${data.order.phoneNumber}`,
          'otp'
        );
        showToast('success', `وصل كود التفعيل #${count}: ${otp}`);
      }
    } catch {
      showToast('error', 'حدث خطأ في الاتصال');
    }
  };

  const handleSyncActiveFromGrizzly = async () => {
    try {
      const res = await fetch('/api/grizzly/sms/sync-active', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'تعذر مزامنة التفعيلات النشطة');
        return;
      }
      setActiveSmsOrders(data.activeSmsOrders || []);
      showToast(
        'success',
        `تمت مزامنة التفعيلات النشطة (${data.importedCount || 0} رقم مستورد).`
      );
    } catch {
      showToast('error', 'حدث خطأ أثناء الاتصال بالخادم');
    }
  };

  const handleBuyESim = async (plan: ESimPlan): Promise<ActiveESimOrder | null> => {
    setBuyingPlanId(plan.id);
    try {
      const res = await fetch('/api/grizzly/esim/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'تعذر شراء باقة الـ eSIM');
        return null;
      }
      let esimOrder: ActiveESimOrder = {
        ...data.esimOrder,
        baseCostUsd: plan.baseCostUsd,
      };
      if (cmsConfig.esimDeliveryMode === 'INVENTORY_FIRST') {
        const matchIdx = lpaInventory.findIndex(
          (item) =>
            !item.isUsed &&
            (item.iso2.toUpperCase() === plan.iso2.toUpperCase() || item.planId === plan.id)
        );
        if (matchIdx >= 0) {
          const invItem = lpaInventory[matchIdx];
          esimOrder = {
            ...esimOrder,
            smdpAddress: invItem.smdpAddress,
            activationCode: invItem.activationCode,
            lpaString: invItem.lpaString,
            iccid: invItem.iccid,
          };
          const updatedPool = [...lpaInventory];
          updatedPool[matchIdx] = { ...invItem, isUsed: true, assignedOrderId: esimOrder.id };
          setLpaInventory(updatedPool);
        }
      }
      setActiveESimOrders((prev) => [esimOrder, ...prev]);
      updateCurrentUserWallet(data.walletUsd, esimOrder.priceUsd);
      pushNotification(
        'order',
        `تم إصدار شريحة eSIM (${esimOrder.countryNameAr})`,
        `السعة ${esimOrder.dataLabelAr} — رمز QR وبيانات التثبيت جاهزة الآن.`,
        'otp'
      );
      showToast('success', `تم إصدار شريحة eSIM (${esimOrder.countryNameAr}) بنجاح!`);
      appendActivityLog({
        type: 'ESIM_BUY',
        titleAr: `إصدار شريحة eSIM (${esimOrder.countryNameAr} - ${esimOrder.dataLabelAr})`,
        detailsAr: `ICCID: ${esimOrder.iccid}`,
        amountUsd: esimOrder.priceUsd,
      });
      return esimOrder;
    } catch {
      showToast('error', 'حدث خطأ أثناء إصدار الشريحة');
      return null;
    } finally {
      setBuyingPlanId(null);
    }
  };

  // Automated Verification OR Manual Top-Up Queue with Receipt Image & Custom Fields
  const handleSubmitTopUpRequest = async (params: {
    gateway: PaymentGatewayConfig;
    referenceId: string;
    amountOriginal: number;
    currencyOriginal: SupportedCurrency;
    receiptImageUrl?: string;
    customFieldValues?: Record<string, string>;
  }): Promise<{ ok: boolean; message: string; isAutoVerified?: boolean }> => {
    const {
      gateway,
      referenceId,
      amountOriginal,
      currencyOriginal,
      receiptImageUrl,
      customFieldValues,
    } = params;
    const cleanRef = referenceId.trim();
    if (cleanRef.length < 4) {
      return { ok: false, message: 'يرجى إدخال رقم عملية تحويل صحيح (4 محارف على الأقل).' };
    }
    if (!Number.isFinite(amountOriginal) || amountOriginal <= 0) {
      return { ok: false, message: 'يرجى إدخال مبلغ صحيح أكبر من الصفر.' };
    }

    const equivalentUsd = Number(
      convertCurrencyToUsd(amountOriginal, currencyOriginal, exchangeRates).toFixed(2)
    );
    const equivalentSyp = Math.round(equivalentUsd * exchangeRates.usdToSypRate);

    const isAutoGateway =
      gateway.code !== 'shamcash' &&
      gateway.code !== 'syriatel' &&
      (gateway.isAutomated === true ||
        (gateway.isAutomated === undefined && gateway.code === 'binance'));

    let routedFromStrictAuto = false;

    if (isAutoGateway) {
      try {
        const res = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            gateway: gateway.code,
            referenceId: cleanRef,
            amount: amountOriginal,
            currency: currencyOriginal,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          // Strict Fail-Closed Mode: route seamlessly to Manual Admin Review Queue instead of dead-end
          if (res.status === 422 && data.code === 'MANUAL_REVIEW_REQUIRED') {
            routedFromStrictAuto = true;
          } else {
            return { ok: false, message: data.error || 'تعذر التحقق من رقم العملية' };
          }
        } else {
          if (data.walletUsd !== undefined) {
            updateCurrentUserWallet(data.walletUsd);
          }
          if (data.transaction) {
            setPaymentHistory((prev) => [data.transaction, ...prev]);
          }
          const credited = Number(data.transaction?.creditedUsd || equivalentUsd);
          pushNotification(
            'wallet',
            `تم شحن رصيدك عبر ${gateway.nameAr}`,
            `تمت إضافة $${credited.toFixed(2)} إلى محفظتك فوراً (عملية #${cleanRef}).`,
            'otp'
          );
          appendActivityLog({
            type: 'TOPUP_APPROVE',
            titleAr: `شحن آلي فوري عبر ${gateway.nameAr}`,
            detailsAr: `رقم العملية #${cleanRef} · تمت إضافة $${credited.toFixed(2)}`,
            amountUsd: credited,
          });
          showToast('success', data.message || 'تم شحن الرصيد بنجاح!');
          return {
            ok: true,
            isAutoVerified: true,
            message: data.message || 'تم التحقق وإضافة الرصيد فوراً!',
          };
        }
      } catch {
        return { ok: false, message: 'تعذر الاتصال بخادم التحقق الآلي.' };
      }
    }

    // Manual Gateways -> Submit to Server Review Queue + Local State (with Receipt Image & Custom Fields)
    let createdReq: TopUpOrderRequest = {
      id: `topup-${Date.now()}`,
      userId: authUser?.id || 'guest',
      userNameAr: authUser?.nameAr || 'زائر',
      gatewayId: gateway.id,
      gatewayNameAr: gateway.nameAr,
      referenceId: cleanRef,
      amountOriginal,
      currencyOriginal,
      equivalentUsd,
      equivalentSyp,
      receiptImageUrl,
      customFieldValues,
      status: 'PENDING',
      createdAt: Date.now(),
    };

    try {
      const res = await fetch('/api/topups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          userNameAr: authUser?.nameAr || 'زائر',
          gatewayId: gateway.id,
          gatewayNameAr: gateway.nameAr,
          referenceId: cleanRef,
          amountOriginal,
          currencyOriginal,
          equivalentUsd,
          equivalentSyp,
          receiptImageUrl,
          customFieldValues,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, message: data.error || 'تعذر تسجيل طلب الشحن اليدوي.' };
      }
      if (data.topUp || data.request) {
        createdReq = data.topUp || data.request;
      }
    } catch {
      // Keep local fallback if offline
    }

    setTopUpRequests((prev) => [createdReq, ...prev.filter((r) => r.id !== createdReq.id)]);
    appendActivityLog({
      type: 'TOPUP_REQUEST',
      titleAr: `طلب شحن رصيد عبر ${gateway.nameAr}`,
      detailsAr: `إشعار #${cleanRef} بقيمة $${equivalentUsd.toFixed(2)}${receiptImageUrl ? ' (مرفق صورة إشعار)' : ''}`,
      amountUsd: equivalentUsd,
    });
    pushNotification(
      'wallet',
      `تم إرسال طلب شحن ($${equivalentUsd.toFixed(2)})`,
      `بوابة ${gateway.nameAr} · رقم العملية #${cleanRef} قيد المراجعة.`,
      'success'
    );
    showToast('success', `تم إرسال طلب الشحن ($${equivalentUsd.toFixed(2)}) للمراجعة!`);
    return {
      ok: true,
      isAutoVerified: false,
      message: routedFromStrictAuto
        ? `نظام الحماية الصارم مفعّل — تم تحويل عملية #${cleanRef} بقيمة $${equivalentUsd.toFixed(2)} USD تلقائياً للمراجعة السريعة من الإدارة واعتماد الرصيد بأمان.`
        : `تم تسجيل طلب الشحن (#${cleanRef}) بقيمة $${equivalentUsd.toFixed(2)} USD بنجاح.`,
    };
  };

  const handleProcessTopUpRequest = (
    requestId: string,
    action: 'APPROVE' | 'REJECT',
    rejectionReason?: string
  ) => {
    const target = topUpRequests.find((r) => r.id === requestId);
    if (!target || target.status !== 'PENDING') return;

    const updatedStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    setTopUpRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: updatedStatus,
              rejectionReason: action === 'REJECT' ? rejectionReason : undefined,
              reviewedBy: authUser?.nameAr,
              processedAt: Date.now(),
            }
          : r
      )
    );

    // Persist review decision server-side (supports both Admin & Moderator via Bearer token)
    if (authToken) {
      fetch(`/api/topups/${encodeURIComponent(requestId)}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ action, reason: rejectionReason, rejectionReason }),
      })
        .then(async (r) => {
          if (r.ok) {
            const data = await r.json();
            if (action === 'APPROVE') {
              updateCurrentUserWallet(walletUsd + target.equivalentUsd);
            }
            if (data?.transaction) {
              setPaymentHistory((prev) =>
                prev.some((p) => p.referenceId === data.transaction.referenceId)
                  ? prev
                  : [data.transaction, ...prev]
              );
            }
            return;
          }
          // Fallback credit if this was a local-only topup not yet present on the server
          if (action === 'APPROVE') {
            updateCurrentUserWallet(walletUsd + target.equivalentUsd);
          }
        })
        .catch(() => {
          if (action === 'APPROVE') {
            updateCurrentUserWallet(walletUsd + target.equivalentUsd);
          }
        });
    } else if (action === 'APPROVE') {
      updateCurrentUserWallet(walletUsd + target.equivalentUsd);
    }

    if (action === 'APPROVE') {
      pushNotification(
        'wallet',
        `تم اعتماد شحن الرصيد (+$${target.equivalentUsd.toFixed(2)})`,
        `تم قبول عملية ${target.gatewayNameAr} (#${target.referenceId}) وإضافة الرصيد.`,
        'otp'
      );
    } else {
      pushNotification(
        'wallet',
        'تم رفض طلب الشحن',
        `${target.gatewayNameAr} (#${target.referenceId}) — ${rejectionReason || 'رقم غير مطابق'}`,
        'alert'
      );
    }
  };

  const logStaffAuditEvent = (
    actionType: string,
    targetLabel: string,
    amountUsd?: number,
    reason?: string
  ) => {
    if (!authToken || !isStaff) return;
    fetch('/api/admin/audit-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ actionType, targetLabel, amountUsd, reason }),
    }).catch(() => {});
  };

  const handleRedeemVoucher = async (
    code: string
  ): Promise<{ ok: boolean; message: string; creditedUsd?: number }> => {
    if (!authToken) {
      return { ok: false, message: 'يرجى تسجيل الدخول أولاً لتفعيل قسيمة الشحن.' };
    }
    try {
      const res = await fetch('/api/vouchers/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, message: data.error || 'كود القسيمة غير صالح أو منتهي الصلاحية.' };
      }
      if (typeof data.walletUsd === 'number') {
        updateCurrentUserWallet(data.walletUsd);
      }
      if (data.transaction) {
        setPaymentHistory((prev) => [data.transaction, ...prev]);
      }
      const credited = Number(data.creditedUsd || 0);
      pushNotification(
        'wallet',
        `تم شحن رصيدك عبر قسيمة (+$${credited.toFixed(2)})`,
        `تم تفعيل القسيمة ${code.toUpperCase()} وإضافة الرصيد فوراً إلى محفظتك.`,
        'otp'
      );
      appendActivityLog({
        type: 'TOPUP_APPROVE',
        titleAr: `شحن فوري عبر قسيمة ${code.toUpperCase()}`,
        detailsAr: `تمت إضافة $${credited.toFixed(2)} إلى المحفظة`,
        amountUsd: credited,
      });
      showToast('success', data.message || `تم شحن $${credited.toFixed(2)} عبر القسيمة بنجاح!`);
      return { ok: true, message: data.message, creditedUsd: credited };
    } catch {
      return { ok: false, message: 'تعذر الاتصال بالخادم لتفعيل القسيمة.' };
    }
  };

  const handleAdjustUserWallet = (userId: string, deltaUsd: number, reasonAr: string) => {
    const targetUser = managedUsers.find((u) => u.id === userId);
    setManagedUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        const nextBal = Math.max(0, Number((u.balanceUsd + deltaUsd).toFixed(2)));
        if (u.isCurrentSession) setWalletUsd(nextBal);
        return { ...u, balanceUsd: nextBal };
      })
    );
    logStaffAuditEvent(
      'WALLET_ADJUST',
      `${targetUser?.nameAr || userId} (${deltaUsd >= 0 ? '+' : ''}$${deltaUsd.toFixed(2)})`,
      Math.abs(deltaUsd),
      reasonAr
    );
    pushNotification(
      'wallet',
      deltaUsd >= 0 ? 'تمت إضافة رصيد إدارية' : 'تم خصم رصيد إداري',
      `${reasonAr} (${deltaUsd >= 0 ? '+' : ''}$${deltaUsd.toFixed(2)})`,
      deltaUsd >= 0 ? 'success' : 'alert'
    );
    appendActivityLog({
      type: 'WALLET_ADJUST',
      titleAr: deltaUsd >= 0 ? 'إضافة رصيد إدارية' : 'خصم رصيد إداري',
      detailsAr: `${reasonAr} (${deltaUsd >= 0 ? '+' : ''}$${deltaUsd.toFixed(2)})`,
      amountUsd: Math.abs(deltaUsd),
    });
  };

  const handleAdminCancelOrder = (
    orderType: 'SMS' | 'ESIM',
    orderId: string,
    refundCustomer: boolean
  ) => {
    if (orderType === 'SMS') {
      const ord = activeSmsOrders.find((o) => o.id === orderId);
      handleSmsOrderAction(orderId, 'CANCEL_8');
      logStaffAuditEvent(
        'ORDER_CANCEL',
        `إلغاء رقم SMS ${ord?.phoneNumber || orderId} (${ord?.serviceNameAr || ''})`,
        ord?.priceUsd
      );
    } else {
      const target = activeESimOrders.find((e) => e.id === orderId);
      if (!target || target.status === 'CANCELLED') return;
      setActiveESimOrders((prev) =>
        prev.map((e) => (e.id === orderId ? { ...e, status: 'CANCELLED' } : e))
      );
      if (refundCustomer) updateCurrentUserWallet(walletUsd + target.priceUsd);
      logStaffAuditEvent(
        'ORDER_CANCEL',
        `إلغاء شريحة eSIM ${target.countryNameAr} (ICCID: ${target.iccid})`,
        target.priceUsd
      );
    }
  };

  const handleSaveAdminSettings = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      setSettings((prev) => ({
        ...prev,
        ...data.settings,
        usdToTryRate:
          payload.usdToTryRate !== undefined
            ? Number(payload.usdToTryRate)
            : prev.usdToTryRate || 34.5,
        usdToUsdtRate:
          payload.usdToUsdtRate !== undefined
            ? Number(payload.usdToUsdtRate)
            : prev.usdToUsdtRate || 1.0,
      }));
      await fetchBootstrap();
      await fetchSmsCatalog(selectedCountryId);
      await fetchESimCatalog(esimCountryFilter, esimValidityFilter);
    } else {
      const err = await res.json().catch(() => ({}));
      showToast('error', err.error || 'يرجى تسجيل الدخول بحساب المدير لحفظ الإعدادات.');
    }
  };

  const handleExportFullBackup = () => {
    const backup: FullPlatformBackupPayload = {
      version: '1.5.0',
      exportedAt: new Date().toISOString(),
      cmsConfig,
      pricingOverrides,
      paymentGateways,
      topUpRequests,
      managedUsers,
      customESimPlans,
      lpaInventory,
      activityLogs,
      pinnedCountries,
      pinnedServices,
      activeSmsOrders,
      activeESimOrders,
      paymentHistory,
      supabaseCompletedPatches: supabaseConfig.completedPatches,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alisms-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'تم تصدير النسخة الاحتياطية بنجاح!');
  };

  const handleImportFullBackup = (data: FullPlatformBackupPayload) => {
    if (data.cmsConfig) setCmsConfig({ ...DEFAULT_CMS_CONFIG, ...data.cmsConfig });
    if (data.pricingOverrides) setPricingOverrides(data.pricingOverrides);
    if (data.paymentGateways) setPaymentGateways(data.paymentGateways);
    if (data.topUpRequests) setTopUpRequests(data.topUpRequests);
    if (data.managedUsers) setManagedUsers(data.managedUsers);
    if (data.customESimPlans) setCustomESimPlans(data.customESimPlans);
    if (data.lpaInventory) setLpaInventory(data.lpaInventory);
    if (data.activityLogs) setActivityLogs(data.activityLogs);
    if (data.pinnedCountries) setPinnedCountries(data.pinnedCountries);
    if (data.pinnedServices) setPinnedServices(data.pinnedServices);
    showToast('success', 'تمت استعادة النسخة الاحتياطية بنجاح!');
  };

  const togglePinCountry = (countryId: string) => {
    setPinnedCountries((prev) =>
      prev.includes(countryId) ? prev.filter((id) => id !== countryId) : [countryId, ...prev]
    );
  };

  const togglePinService = (serviceCode: string) => {
    setPinnedServices((prev) =>
      prev.includes(serviceCode)
        ? prev.filter((c) => c !== serviceCode)
        : [serviceCode, ...prev]
    );
  };

  const activeLiveOtpCount = activeSmsOrders.filter((o) => {
    const notExpired = o.expiresAt > Date.now();
    if (!notExpired) return false;
    if (['WAITING_SMS', 'READY_SENT', 'WAIT_RETRY', 'WAIT_RESEND'].includes(o.status)) return true;
    return o.status === 'SMS_RECEIVED' && o.canGetAnotherSms !== false;
  }).length;

  const CURRENCY_ORDER: SupportedCurrency[] = ['USD', 'USDT', 'SYP', 'TRY'];
  const CURRENCY_BADGE: Record<SupportedCurrency, { label: string; symbol: string }> = {
    USD: { label: 'USD', symbol: '$' },
    USDT: { label: 'USDT', symbol: '₮' },
    SYP: { label: 'SYP', symbol: 'ل.س' },
    TRY: { label: 'TRY', symbol: '₺' },
  };

  const handleCycleCurrency = () => {
    const idx = CURRENCY_ORDER.indexOf(currency);
    const nextCurr = CURRENCY_ORDER[(idx + 1) % CURRENCY_ORDER.length];
    setCurrency(nextCurr);
    setCurrencyAnimating(true);
    setTimeout(() => setCurrencyAnimating(false), 320);
  };

  const LANG_ORDER: AppLanguage[] = ['ar', 'tr', 'en'];
  const handleCycleLanguage = () => {
    const idx = LANG_ORDER.indexOf(lang);
    setLang(LANG_ORDER[(idx + 1) % LANG_ORDER.length]);
  };

  const openEditProfileModal = () => {
    if (!authUser) {
      setAuthModalMode('login');
      setAuthModalOpen(true);
      return;
    }
    setProfileNameDraft(authUser.nameAr);
    setProfileAvatarDraft(authUser.avatarUrl || '');
    setProfileMenuOpen(false);
    setEditProfileOpen(true);
  };

  const openResellerModal = async () => {
    if (!authUser || !authToken) {
      setAuthModalMode('login');
      setAuthModalOpen(true);
      return;
    }
    setProfileMenuOpen(false);
    setResellerFeedback(null);
    setResellerModalOpen(true);
    setResellerStatusLoading(true);
    try {
      const res = await fetch('/api/reseller/my-status', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setResellerStatusData(await res.json());
      }
    } finally {
      setResellerStatusLoading(false);
    }
  };

  const handleApplyReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    setSubmittingResellerApp(true);
    setResellerFeedback(null);
    try {
      const res = await fetch('/api/reseller/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          contactHandle: resellerContactHandle.trim(),
          expectedMonthlyVolumeUsd: Number(resellerMonthlyVol) || 100,
          businessNote: resellerBusinessNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResellerFeedback({ type: 'error', text: data.error || 'تعذر إرسال الطلب.' });
        return;
      }
      setResellerFeedback({ type: 'success', text: data.message });
      setResellerContactHandle('');
      setResellerBusinessNote('');
      const st = await fetch('/api/reseller/my-status', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (st.ok) setResellerStatusData(await st.json());
    } catch {
      setResellerFeedback({ type: 'error', text: 'تعذر الاتصال بالخادم حالياً.' });
    } finally {
      setSubmittingResellerApp(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileNameDraft.trim() || !authToken) return;
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          nameAr: profileNameDraft.trim(),
          avatarUrl: profileAvatarDraft.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setAuthUser(data.user);
        setManagedUsers((prev) =>
          prev.map((u) =>
            u.emailOrPhone.toLowerCase() === String(data.user.emailOrPhone || '').toLowerCase()
              ? { ...u, nameAr: data.user.nameAr, avatarUrl: data.user.avatarUrl }
              : u
          )
        );
        setEditProfileOpen(false);
        showToast('success', 'تم تحديث ملفك الشخصي بنجاح!');
      }
    } catch {
      showToast('error', 'تعذر تحديث الملف الشخصي.');
    }
  };

  const speedClass =
    cmsConfig.announcementSpeed === 'slow'
      ? 'marquee-slow'
      : cmsConfig.announcementSpeed === 'fast'
      ? 'marquee-fast'
      : 'marquee-normal';

  const hasTelegramLink = Boolean(cmsConfig.supportTelegram && cmsConfig.supportTelegram.trim());
  const hasWhatsappLink = Boolean(cmsConfig.supportWhatsapp && cmsConfig.supportWhatsapp.trim());
  const translatedAnnouncement = useAutoTranslate(cmsConfig.announcementText, lang);
  const translatedMaintenanceMessage = useAutoTranslate(cmsConfig.maintenanceMessage, lang);
  const resolvedLogoUrl = (cmsConfig.siteLogoUrl || '/pwa-192x192.png').trim() || '/pwa-192x192.png';
  const resolvedAppShortName = (cmsConfig.appShortName || cmsConfig.platformName || 'alisim').trim();

  return (
    <div className="app-shell-bg min-h-screen flex flex-col bg-[#06080E] text-slate-100 pb-20 lg:pb-10">
      {/* Rightward Announcement Bar */}
      {cmsConfig.announcementEnabled && cmsConfig.announcementText && (
        <div
          className="marquee-wrapper overflow-hidden bg-gradient-to-l from-indigo-950/95 via-[#0B132B] to-cyan-950/95 border-b border-cyan-500/25 h-9 flex items-center relative"
          dir="ltr"
        >
          <div
            className={`marquee-track ${speedClass} ${
              cmsConfig.announcementPaused ? 'marquee-paused' : ''
            } gap-3 px-4 text-xs text-cyan-200 font-bold`}
            dir={getDirForLang(lang)}
          >
            <Megaphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{translatedAnnouncement}</span>
          </div>
        </div>
      )}

      {/* PWA Offline Indicator */}
      <OfflineIndicator lang={lang} />

      {/* Structured Top Header — Clean App Bar (No Brand Logo in Header) */}
      <header className="app-header-bar android-app-bar sticky top-0 z-30 h-14 sm:h-16 bg-[#06080E]/95 backdrop-blur-xl border-b border-white/10 px-2.5 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: User Profile Menu (or Login) */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative shrink-0" ref={profileMenuRef}>
          {authUser ? (
            <>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 sm:gap-2 p-1 sm:pr-1.5 sm:pl-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer active:scale-95"
              >
                <div className="relative shrink-0">
                  {authUser.avatarUrl ? (
                    <img
                      src={authUser.avatarUrl}
                      alt={authUser.nameAr}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border border-cyan-400/50"
                    />
                  ) : (
                    <div
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg font-black text-xs sm:text-sm flex items-center justify-center ${
                        isAdmin
                          ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950'
                          : isModerator
                          ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950'
                          : isReseller
                          ? 'bg-gradient-to-br from-purple-500 to-amber-400 text-white'
                          : 'bg-gradient-to-br from-indigo-500 to-cyan-500 text-white'
                      }`}
                    >
                      {isAdmin ? (
                        <Crown className="w-4 h-4" />
                      ) : isModerator ? (
                        <ShieldCheck className="w-4 h-4" />
                      ) : isReseller ? (
                        <Award className="w-4 h-4" />
                      ) : (
                        authUser.nameAr.trim().charAt(0)
                      )}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#06080E]" />
                </div>

                <div className="hidden sm:block text-start min-w-0 max-w-[160px]">
                  <div className="text-xs font-extrabold text-white truncate leading-tight flex items-center gap-1">
                    <span className="truncate">{authUser.nameAr}</span>
                    {isReseller && <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  </div>
                  <div
                    className={`text-[10px] font-bold truncate ${
                      isAdmin
                        ? 'text-amber-400'
                        : isModerator
                        ? 'text-emerald-400'
                        : isReseller
                        ? 'text-purple-300'
                        : 'text-cyan-400'
                    }`}
                  >
                    {isAdmin
                      ? t(lang, 'role_admin')
                      : isModerator
                      ? t(lang, 'role_moderator')
                      : isReseller
                      ? lang === 'tr'
                        ? `Onaylı Bayi (-${authUser.resellerDiscountPercent || 8}%)`
                        : lang === 'en'
                        ? `Verified Reseller (-${authUser.resellerDiscountPercent || 8}%)`
                        : `بائع معتمد (-${authUser.resellerDiscountPercent || 8}%)`
                      : t(lang, 'role_user')}
                  </div>
                </div>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                    profileMenuOpen ? 'rotate-180 text-cyan-400' : ''
                  }`}
                />
              </button>

              {profileMenuOpen && (
                <div
                  className={`absolute ${
                    lang === 'ar' ? 'right-0' : 'left-0'
                  } top-full mt-2 w-64 dropdown-solid rounded-2xl p-2 shadow-2xl border border-cyan-500/35 z-50 space-y-1`}
                >
                  <div className="px-3 py-2 border-b border-white/10">
                    <div className="text-xs font-black text-white flex items-center gap-1.5 flex-wrap">
                      <span className="truncate">{authUser.nameAr}</span>
                      {isReseller && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/25 border border-purple-400/40 text-purple-200 text-[9px] font-extrabold inline-flex items-center gap-0.5">
                          <Award className="w-2.5 h-2.5 text-amber-300" />
                          <span>
                            {lang === 'tr'
                              ? 'Bayi'
                              : lang === 'en'
                              ? 'Reseller'
                              : 'بائع معتمد'}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate" dir="ltr">
                      {authUser.emailOrPhone}
                    </div>
                  </div>

                  {/* Language Picker Row */}
                  <div className="px-2.5 py-2 rounded-xl bg-white/5 space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                      <Languages className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{t(lang, 'language_label')}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {LANG_ORDER.map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setLang(l)}
                          className={`py-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition-colors ${
                            lang === l
                              ? 'bg-indigo-600 text-white btn-solid-white'
                              : 'bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {LANGUAGE_META[l].nativeLabel}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openEditProfileModal}
                    className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-xs font-bold text-slate-200 flex items-center gap-2.5 cursor-pointer"
                  >
                    <UserCog className="w-4 h-4 text-cyan-400" />
                    <span>{t(lang, 'edit_profile')}</span>
                  </button>

                  {!isStaff && (
                    <button
                      type="button"
                      onClick={openResellerModal}
                      className="w-full px-3 py-2 rounded-xl hover:bg-purple-500/15 text-xs font-bold text-purple-300 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <Store className="w-4 h-4 text-purple-400" />
                        <span>
                          {lang === 'tr'
                            ? 'Bayi / Dağıtıcı Programı'
                            : lang === 'en'
                            ? 'Reseller Program'
                            : 'برنامج البائعين والموزعين'}
                        </span>
                      </span>
                      {isReseller && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/25 text-amber-300 font-mono text-[9px] font-black">
                          -{authUser.resellerDiscountPercent || 8}%
                        </span>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'))}
                    className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-xs font-bold text-slate-200 flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      {themeMode === 'dark' ? (
                        <Sun className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Moon className="w-4 h-4 text-indigo-400" />
                      )}
                      <span>
                        {themeMode === 'dark' ? t(lang, 'light_mode') : t(lang, 'dark_mode')}
                      </span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono text-cyan-300">
                      {themeMode === 'dark' ? 'DARK' : 'LIGHT'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setGuidesInitialTab('sms');
                      setGuidesModalOpen(true);
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-xs font-bold text-slate-200 flex items-center gap-2.5 cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    <span>{t(lang, 'guides_disclaimer')}</span>
                  </button>

                  {authToken && cmsConfig.supportChatEnabled !== false && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setSupportChatOpen(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-xs font-bold text-cyan-300 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <Headphones className="w-4 h-4 text-cyan-400" />
                        <span>
                          {lang === 'ar'
                            ? 'الدعم الفني المباشر'
                            : lang === 'tr'
                            ? 'Canlı Destek'
                            : 'Live Support'}
                        </span>
                      </span>
                      {supportUnreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono text-[10px] font-black">
                          {supportUnreadCount}
                        </span>
                      )}
                    </button>
                  )}

                  {isStaff && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setActiveSection('admin');
                      }}
                      className={`w-full px-3 py-2 rounded-xl hover:bg-white/10 text-xs font-bold flex items-center gap-2.5 cursor-pointer ${
                        isAdmin ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {isAdmin ? (
                        <Shield className="w-4 h-4" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                      <span>{isAdmin ? t(lang, 'admin_panel') : t(lang, 'moderator_panel')}</span>
                    </button>
                  )}

                  <div className="pt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full px-3 py-2 rounded-xl hover:bg-rose-500/15 text-xs font-extrabold text-rose-400 flex items-center gap-2.5 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t(lang, 'logout')}</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('login');
                  setAuthModalOpen(true);
                }}
                className="px-2.5 sm:px-3.5 py-2 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-[11px] sm:text-xs font-extrabold flex items-center gap-1.5 cursor-pointer h-9 btn-solid-white active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span>{t(lang, 'login')}</span>
                {t(lang, 'login_account') && (
                  <span className="hidden sm:inline">{t(lang, 'login_account')}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'))}
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center cursor-pointer active:scale-95"
                title={themeMode === 'dark' ? t(lang, 'light_mode') : t(lang, 'dark_mode')}
              >
                {themeMode === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-400" />
                )}
              </button>
            </div>
          )}
          </div>
        </div>

        {/* Zone 2: Desktop Navigation (Admin / Moderator button for Staff; Profile button for Users) */}
        <nav className="hidden lg:flex items-center gap-1 p-1 rounded-xl bg-[#0A0F1C] border border-white/10">
          {[
            { id: 'sms', label: t(lang, 'nav_sms'), icon: MessageSquare },
            { id: 'esim', label: t(lang, 'nav_esim'), icon: Wifi },
            { id: 'wallet', label: t(lang, 'nav_wallet_full'), icon: Wallet },
            { id: 'history', label: t(lang, 'nav_history'), icon: History },
          ].map((navItem) => {
            const Icon = navItem.icon;
            const isActive = activeSection === navItem.id;
            return (
              <button
                key={navItem.id}
                type="button"
                onClick={() => setActiveSection(navItem.id as ActiveSection)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white btn-solid-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{navItem.label}</span>
              </button>
            );
          })}

          {isStaff ? (
            <button
              type="button"
              onClick={() => setActiveSection('admin')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'admin'
                  ? isAdmin
                    ? 'bg-amber-600 text-white btn-solid-white'
                    : 'bg-emerald-600 text-white btn-solid-white'
                  : isAdmin
                  ? 'text-amber-400 hover:bg-white/5'
                  : 'text-emerald-400 hover:bg-white/5'
              }`}
            >
              {isAdmin ? (
                <Shield className="w-4 h-4 shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 shrink-0" />
              )}
              <span>{isAdmin ? t(lang, 'nav_admin') : t(lang, 'nav_moderator')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openEditProfileModal}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold text-slate-400 hover:text-white hover:bg-white/5 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <User className="w-4 h-4 shrink-0" />
              <span>{t(lang, 'nav_profile_full')}</span>
            </button>
          )}
        </nav>

        {/* Zone 3: Language Switcher + Compact Wallet/Currency Capsule + Notification Bell + PWA Install */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Compact Trilingual Language Switcher (AR / TR / EN) */}
          <button
            type="button"
            onClick={handleCycleLanguage}
            className="h-9 px-2 sm:px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] sm:text-[11px] font-black text-cyan-300 flex items-center gap-1 cursor-pointer active:scale-95"
            title={`${t(lang, 'language_label')}: ${LANGUAGE_META[lang].nativeLabel}`}
          >
            <Languages className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-mono">{LANGUAGE_META[lang].shortLabel}</span>
          </button>

          {/* Merged Wallet Balance + Currency Switcher Capsule */}
          <div className="flex items-center h-9 rounded-xl bg-[#0A0F1C] border border-cyan-400/35 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setActiveSection('wallet')}
              className="h-full px-2 sm:px-2.5 flex items-center gap-1 hover:bg-indigo-500/20 text-[11px] sm:text-xs font-extrabold transition-colors cursor-pointer"
              title={t(lang, 'wallet_balance')}
            >
              <Wallet className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="font-mono tabular-nums text-white whitespace-nowrap">
                {formatCurrencyAmount(walletUsd, currency, exchangeRates)}
              </span>
            </button>

            <span className="w-px h-5 bg-white/15 shrink-0" />

            <button
              type="button"
              onClick={handleCycleCurrency}
              className={`h-full px-1.5 sm:px-2 flex items-center gap-1 bg-indigo-500/15 hover:bg-cyan-500/25 text-[10px] sm:text-[11px] font-black text-cyan-300 transition-transform cursor-pointer ${
                currencyAnimating ? 'scale-95' : ''
              }`}
              title="USD / USDT / SYP / TRY"
            >
              <Coins className="w-3 h-3 text-cyan-400 hidden sm:block shrink-0" />
              <span className="font-mono">{CURRENCY_BADGE[currency].label}</span>
            </button>
          </div>

          {/* Non-Intrusive Support Chat Icon Button in Header (Only when logged in & enabled) */}
          {authUser && authToken && cmsConfig.supportChatEnabled !== false && (
            <button
              type="button"
              onClick={() => setSupportChatOpen((v) => !v)}
              className={`relative w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                supportChatOpen
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 hover:text-cyan-400'
              }`}
              title={
                lang === 'ar'
                  ? 'الدعم الفني المباشر'
                  : lang === 'tr'
                  ? 'Canlı Destek'
                  : 'Live Support'
              }
              aria-label="Support Chat"
            >
              <Headphones className="w-4 h-4" />
              {supportUnreadCount > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[17px] h-[17px] px-1 rounded-full bg-amber-400 text-slate-950 font-mono text-[10px] font-black flex items-center justify-center ring-2 ring-[#06080E]">
                  {supportUnreadCount > 9 ? '9+' : supportUnreadCount}
                </span>
              )}
            </button>
          )}

          {/* Notification Bell with Sound, Web Push & Unread Badge */}
          <NotificationBellMenu
            lang={lang}
            authToken={authToken}
            notifications={notifications}
            isMuted={isNotifMuted}
            onToggleMute={handleToggleNotifMute}
            onMarkAllRead={() =>
              setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
            }
            onMarkOneRead={(id) =>
              setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
              )
            }
            onClearAll={() => setNotifications([])}
          />

          <PWAInstallModalAndButton
            lang={lang}
            platformName={resolvedAppShortName}
            platformLogoUrl={resolvedLogoUrl}
          />
        </div>
      </header>

      {/* Edit Profile Modal */}
      {editProfileOpen && authUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProfile}
            className="cyber-glass rounded-2xl p-5 max-w-md w-full space-y-4 border border-cyan-500/40 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <UserCog className="w-4 h-4 text-cyan-400" />
                <span>{t(lang, 'edit_profile')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditProfileOpen(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  {lang === 'ar'
                    ? 'الاسم الظاهر'
                    : lang === 'tr'
                    ? 'Görünen Ad'
                    : 'Display Name'}
                </label>
                <input
                  type="text"
                  required
                  value={profileNameDraft}
                  onChange={(e) => setProfileNameDraft(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  {lang === 'ar'
                    ? 'البريد الإلكتروني'
                    : lang === 'tr'
                    ? 'E-posta Adresi'
                    : 'Email Address'}
                </label>
                <input
                  type="text"
                  disabled
                  value={authUser.emailOrPhone}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-slate-400 opacity-70"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  {lang === 'ar'
                    ? 'رابط الصورة الشخصية (اختياري)'
                    : lang === 'tr'
                    ? 'Profil Resmi URL (isteğe bağlı)'
                    : 'Avatar Image URL (optional)'}
                </label>
                <input
                  type="url"
                  value={profileAvatarDraft}
                  onChange={(e) => setProfileAvatarDraft(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditProfileOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-xs font-bold text-slate-300 cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : lang === 'tr' ? 'İptal' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 text-white text-xs font-extrabold cursor-pointer btn-solid-white"
              >
                {lang === 'ar' ? 'حفظ التغييرات' : lang === 'tr' ? 'Değişiklikleri Kaydet' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reseller / Distributor Program & Application Modal */}
      {resellerModalOpen && authUser && (
        <div
          onClick={() => setResellerModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cyber-glass rounded-2xl p-5 max-w-lg w-full space-y-4 border border-purple-500/40 shadow-2xl my-6"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-amber-500 text-white flex items-center justify-center">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    {lang === 'tr'
                      ? 'Onaylı Bayi ve Dağıtıcı Programı'
                      : lang === 'en'
                      ? 'Verified Reseller & Distributor Program'
                      : 'برنامج البائعين والموزعين المعتمدين'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {lang === 'tr'
                      ? 'Toptan indirimli SMS & eSIM fiyatları ve onaylı bayi rozeti'
                      : lang === 'en'
                      ? 'Wholesale discounts on SMS & eSIM plus a verified badge'
                      : 'أسعار جملة مخفضة لأرقام SMS وشرائح eSIM مع شارة بائع معتمد'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResellerModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resellerStatusLoading ? (
              <div className="py-10 text-center text-xs text-slate-400">جاري تحميل بيانات البرنامج...</div>
            ) : (
              <div className="space-y-4">
                {resellerStatusData?.config && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl bg-[#070A12] border border-white/10">
                      <div className="text-[10px] text-slate-400">خصم الفئة الفضية</div>
                      <div className="text-base font-black font-mono text-cyan-300">
                        -{resellerStatusData.config.silverDiscountPercent}%
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#070A12] border border-amber-500/30">
                      <div className="text-[10px] text-slate-400">خصم الفئة الذهبية</div>
                      <div className="text-base font-black font-mono text-amber-400">
                        -{resellerStatusData.config.goldDiscountPercent}%
                      </div>
                    </div>
                  </div>
                )}

                {resellerStatusData?.config && (
                  <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-400/30 space-y-1.5 text-xs text-slate-200">
                    <div className="font-black text-purple-200 mb-1">شروط الانضمام والاحتفاظ بعضوية البائع:</div>
                    <div>• الحد الأدنى للإيداع/الرصيد التشغيلي: <strong className="font-mono text-white">${resellerStatusData.config.minDepositUsd} USD</strong></div>
                    <div>• هدف المسحوبات الشهرية: <strong className="font-mono text-white">${resellerStatusData.config.minMonthlySpendUsd} USD / شهرياً</strong></div>
                    <div>• سجل أمان نظيف وخالي من محاولات الاحتيال أو الإلغاء العشوائي</div>
                    <div>• رقم واتساب أو معرف تيليجرام موثّق للتواصل السريع مع الإدارة</div>
                  </div>
                )}

                {isReseller ? (
                  <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-center space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-600/30 border border-purple-400/40 text-amber-300 text-xs font-black">
                      <Award className="w-4 h-4" />
                      <span>
                        حسابك مفعّل كبائع معتمد ({authUser.resellerTier === 'GOLD' ? 'ذهبي' : 'فضي'})
                      </span>
                    </div>
                    <p className="text-xs text-emerald-200">
                      يتم تطبيق خصم <strong className="font-mono">{authUser.resellerDiscountPercent || 8}%</strong> تلقائياً على جميع أسعار الأرقام وباقات eSIM المعروضة لك.
                    </p>
                  </div>
                ) : resellerStatusData?.latestApplication?.status === 'PENDING' ? (
                  <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-200 font-bold text-center">
                    طلب انضمامك قيد المراجعة حالياً من قِبل المدير العام. سيتم إشعارك فور التفعيل!
                  </div>
                ) : (
                  <form onSubmit={handleApplyReseller} className="space-y-3">
                    {resellerStatusData?.latestApplication?.status === 'REJECTED' && (
                      <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-300 text-[11px] font-bold">
                        تم رفض طلبك السابق: {resellerStatusData.latestApplication.rejectionReason}. يمكنك التقديم مجدداً بعد استيفاء الشروط.
                      </div>
                    )}
                    <div>
                      <label className="text-[11px] text-slate-300 font-bold block mb-1">
                        رقم واتساب أو معرف تيليجرام للتواصل *
                      </label>
                      <input
                        type="text"
                        required
                        value={resellerContactHandle}
                        onChange={(e) => setResellerContactHandle(e.target.value)}
                        placeholder="@username أو +963..."
                        dir="ltr"
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-300 font-bold block mb-1">
                        حجم المبيعات الشهري المتوقع (بالدولار $)
                      </label>
                      <input
                        type="number"
                        min={10}
                        value={resellerMonthlyVol}
                        onChange={(e) => setResellerMonthlyVol(e.target.value)}
                        dir="ltr"
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-300 font-bold block mb-1">
                        نبذة عن متجرك أو قناتك (اختياري)
                      </label>
                      <textarea
                        rows={2}
                        value={resellerBusinessNote}
                        onChange={(e) => setResellerBusinessNote(e.target.value)}
                        placeholder="مثال: لدي محل اتصالات / قناة تيليجرام لبيع أرقام التفعيل..."
                        className="w-full px-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white"
                      />
                    </div>

                    {resellerFeedback && (
                      <div
                        className={`p-2.5 rounded-xl border text-xs font-bold ${
                          resellerFeedback.type === 'success'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                        }`}
                      >
                        {resellerFeedback.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submittingResellerApp}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-l from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50 btn-solid-white"
                    >
                      {submittingResellerApp ? 'جاري إرسال الطلب...' : 'إرسال طلب الانضمام كبائع معتمد'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 md:left-6 md:right-auto md:max-w-md z-50">
          <div
            className={`p-3.5 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-extrabold ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-400'
                : 'bg-rose-600 text-white border-rose-400'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 pt-4 space-y-4">
        {/* Admin-Controlled 3D Hero Slider */}
        <HeroSlider
          lang={lang}
          slides={cmsConfig.heroSlides || []}
          autoPlay={cmsConfig.sliderAutoPlay !== false}
          autoPlayMs={cmsConfig.sliderAutoPlayMs || 5500}
          transitionStyle={cmsConfig.sliderTransitionStyle || 'cube3d'}
          onQuickNavigate={(sec) => setActiveSection(sec)}
        />

        {cmsConfig.maintenanceMode && activeSection !== 'admin' ? (
          <div className="cyber-glass rounded-2xl p-8 text-center max-w-xl mx-auto my-8 space-y-4 border border-amber-500/40">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-black text-white">{t(lang, 'maintenance_title')}</h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {translatedMaintenanceMessage}
            </p>
            {isStaff && (
              <button
                type="button"
                onClick={() => setActiveSection('admin')}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 text-white text-xs font-extrabold cursor-pointer btn-solid-white"
              >
                {t(lang, 'enter_admin')}
              </button>
            )}
          </div>
        ) : (
          <>
            {activeSection === 'sms' && (
              <SmsWorkspace
                lang={lang}
                countries={countries}
                selectedCountryId={selectedCountryId}
                onSelectCountry={setSelectedCountryId}
                services={smsServices}
                sourceMode={smsSourceMode}
                loadingCatalog={loadingSmsCatalog}
                onRefreshCatalog={() => fetchSmsCatalog(selectedCountryId)}
                currency={currency}
                rates={exchangeRates}
                globalSmsMarkupPercent={settings.smsMarkupPercent}
                pricingOverrides={pricingOverrides}
                pinnedCountries={pinnedCountries}
                onTogglePinCountry={togglePinCountry}
                pinnedServices={pinnedServices}
                onTogglePinService={togglePinService}
                activeLiveOtpCount={activeLiveOtpCount}
                onOpenOtpModal={() => setOtpModalOpen(true)}
                onBuyNumber={handleBuySmsNumber}
                buyingCode={buyingServiceCode}
                activeSmsOrders={activeSmsOrders}
                onSmsOrderAction={handleSmsOrderAction}
                onSyncActiveFromGrizzly={handleSyncActiveFromGrizzly}
                onOpenGuides={() => {
                  setGuidesInitialTab('sms');
                  setGuidesModalOpen(true);
                }}
              />
            )}

            {activeSection === 'esim' && (
              <ESimWorkspace
                lang={lang}
                plans={esimPlans}
                customAdminPlans={customESimPlans}
                totalPlans={totalESimPlans}
                esimSource={esimSource}
                loadingESim={loadingESim}
                selectedCountryFilter={esimCountryFilter}
                onChangeCountryFilter={setEsimCountryFilter}
                selectedValidityFilter={esimValidityFilter}
                onChangeValidityFilter={setEsimValidityFilter}
                activeESims={activeESimOrders}
                currency={currency}
                rates={exchangeRates}
                globalESimMarkupPercent={settings.esimMarkupPercent}
                onBuyESim={handleBuyESim}
                buyingPlanId={buyingPlanId}
              />
            )}

            {activeSection === 'wallet' && (
              <WalletWorkspace
                lang={lang}
                authToken={authToken}
                walletUsd={walletUsd}
                currency={currency}
                rates={exchangeRates}
                settings={settings}
                paymentGateways={paymentGateways}
                topUpRequests={topUpRequests}
                paymentHistory={paymentHistory}
                onSubmitTopUpRequest={handleSubmitTopUpRequest}
                onInvoicePaid={({ transaction, walletUsd: newBal, message }) => {
                  updateCurrentUserWallet(newBal);
                  setPaymentHistory((prev) => [transaction, ...prev]);
                  pushNotification(
                    'wallet',
                    `تم شحن رصيدك عبر ${transaction.gatewayLabelAr}`,
                    `تمت إضافة $${transaction.creditedUsd.toFixed(2)} إلى محفظتك فوراً (عملية #${transaction.referenceId}).`,
                    'otp'
                  );
                  appendActivityLog({
                    type: 'TOPUP_APPROVE',
                    titleAr: `شحن فوري مؤكد عبر ${transaction.gatewayLabelAr}`,
                    detailsAr: `رقم العملية #${transaction.referenceId} · تمت إضافة $${transaction.creditedUsd.toFixed(2)}`,
                    amountUsd: transaction.creditedUsd,
                  });
                  showToast('success', message);
                }}
                onRedeemVoucher={handleRedeemVoucher}
                onRequireAuth={() => setAuthModalOpen(true)}
                transferMemoTag={authUser?.transferMemoTag}
              />
            )}

            {activeSection === 'history' && (
              <OrdersHistoryWorkspace
                lang={lang}
                smsOrders={activeSmsOrders}
                esimOrders={activeESimOrders}
                paymentHistory={paymentHistory}
                currency={currency}
                rates={exchangeRates}
                onOpenOtpModal={() => setOtpModalOpen(true)}
                onSmsOrderAction={handleSmsOrderAction}
              />
            )}

            {activeSection === 'admin' && isStaff && authToken && authUser && (
              <AdminWorkspace
                authToken={authToken}
                userRole={authUser.role as 'ADMIN' | 'MODERATOR'}
                settings={settings}
                onSaveSettings={handleSaveAdminSettings}
                onSyncSyriaTodayRates={handleSyncSyriaTodayRates}
                countries={countries}
                services={smsServices}
                pricingOverrides={pricingOverrides}
                onUpdatePricingOverrides={setPricingOverrides}
                paymentGateways={paymentGateways}
                onUpdatePaymentGateways={setPaymentGateways}
                topUpRequests={topUpRequests}
                onProcessTopUpRequest={handleProcessTopUpRequest}
                managedUsers={managedUsers}
                onUpdateManagedUsers={setManagedUsers}
                onAdjustUserWallet={handleAdjustUserWallet}
                customESimPlans={customESimPlans}
                onUpdateCustomESimPlans={setCustomESimPlans}
                lpaInventory={lpaInventory}
                onUpdateLpaInventory={setLpaInventory}
                activeSmsOrders={activeSmsOrders}
                activeESimOrders={activeESimOrders}
                onAdminCancelOrder={handleAdminCancelOrder}
                onAdminCompleteSmsOrder={(id) => {
                  const ord = activeSmsOrders.find((o) => o.id === id);
                  handleSmsOrderAction(id, 'COMPLETE_6');
                  logStaffAuditEvent(
                    'ORDER_COMPLETE',
                    `إنهاء رقم SMS ${ord?.phoneNumber || id}`,
                    ord?.priceUsd
                  );
                }}
                cmsConfig={cmsConfig}
                onUpdateCmsConfig={setCmsConfig}
                activityLogs={activityLogs}
                supabaseConfig={supabaseConfig}
                onUpdateSupabaseConfig={setSupabaseConfig}
                onTriggerFullSupabaseSync={() => handleSyncWithSupabase(false)}
                syncingSupabase={syncingSupabase}
                onExportBackup={handleExportFullBackup}
                onImportBackup={handleImportFullBackup}
              />
            )}
          </>
        )}

        {/* Desktop-only Footer (Hidden completely on Mobile & Installed PWA Standalone Mode) */}
        <SiteFooter
          lang={lang}
          platformName={cmsConfig.platformName}
          platformLogoUrl={resolvedLogoUrl}
          onNavigate={(sec) => setActiveSection(sec)}
          onOpenGuides={(tab) => {
            setGuidesInitialTab(tab);
            setGuidesModalOpen(true);
          }}
        />
      </main>

      {/* Conditional Floating Social Icons — ONLY shown when links are configured in Admin */}
      {(hasTelegramLink || hasWhatsappLink) && (
        <div className="fixed bottom-20 lg:bottom-6 left-4 z-40 flex flex-col gap-2">
          {hasTelegramLink && (
            <a
              href={cmsConfig.supportTelegram.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105"
              title="تيليجرام"
            >
              <Send className="w-4 h-4" />
            </a>
          )}
          {hasWhatsappLink && (
            <a
              href={`https://wa.me/${cmsConfig.supportWhatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105"
              title="واتساب"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
        </div>
      )}

      {/* Non-Intrusive On-Demand Support Chat Drawer — Opened from Header/Profile Menu */}
      {authUser && authToken && cmsConfig.supportChatEnabled !== false && (
        <SupportChatWidget
          lang={lang}
          isOpen={supportChatOpen}
          onClose={() => setSupportChatOpen(false)}
          onUnreadChange={setSupportUnreadCount}
          authToken={authToken}
          user={authUser}
          cmsConfig={cmsConfig}
          onNewAdminMessage={(msg: SupportChatMessage) => {
            pushNotification(
              'support',
              `رد جديد من ${msg.senderName}`,
              msg.text || (msg.type === 'audio' ? 'رسالة صوتية جديدة' : 'مرفق صورة جديد'),
              'notification'
            );
          }}
        />
      )}

      {/* OTP Activation Popup Modal (eSIM Modal Pattern) */}
      <OtpActivationModal
        lang={lang}
        isOpen={otpModalOpen}
        onClose={() => setOtpModalOpen(false)}
        orders={activeSmsOrders}
        currency={currency}
        rates={exchangeRates}
        onOrderAction={handleSmsOrderAction}
        onSyncActiveFromGrizzly={handleSyncActiveFromGrizzly}
        onOpenGuides={() => {
          setGuidesInitialTab('sms');
          setGuidesModalOpen(true);
        }}
      />

      {/* Official Guides & Disclaimer Modal */}
      <GuidesAndDisclaimerModal
        lang={lang}
        isOpen={guidesModalOpen}
        onClose={() => setGuidesModalOpen(false)}
        initialTab={guidesInitialTab}
      />

      {/* Login / Register / Google / Forgot Password Modal */}
      <AuthModal
        lang={lang}
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        platformName={cmsConfig.platformName}
        platformLogoUrl={resolvedLogoUrl}
        onAuthSuccess={handleAuthSuccess}
        initialMode={authModalMode}
      />

      {/* Luxury Native Android Material 3 Bottom Navigation Bar (Mobile / Installed PWA) */}
      <nav className="app-bottom-nav android-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-40 min-h-[68px] bg-[#070B14]/95 backdrop-blur-2xl border-t border-white/10 grid grid-cols-5 items-center px-1.5">
        {[
          {
            id: 'sms',
            label: t(lang, 'nav_sms'),
            icon: MessageSquare,
            onClick: () => setActiveSection('sms'),
            active: activeSection === 'sms',
            badge: activeLiveOtpCount > 0 ? activeLiveOtpCount : undefined,
          },
          {
            id: 'esim',
            label: t(lang, 'nav_esim'),
            icon: Wifi,
            onClick: () => setActiveSection('esim'),
            active: activeSection === 'esim',
          },
          {
            id: 'wallet',
            label: t(lang, 'nav_wallet'),
            icon: Wallet,
            onClick: () => setActiveSection('wallet'),
            active: activeSection === 'wallet',
          },
          {
            id: 'history',
            label: t(lang, 'nav_history'),
            icon: History,
            onClick: () => setActiveSection('history'),
            active: activeSection === 'history',
          },
          isStaff
            ? {
                id: 'admin',
                label: isAdmin ? t(lang, 'nav_admin') : t(lang, 'nav_moderator'),
                icon: isAdmin ? Shield : ShieldCheck,
                onClick: () => setActiveSection('admin'),
                active: activeSection === 'admin',
              }
            : {
                id: 'profile',
                label: t(lang, 'nav_profile'),
                icon: User,
                onClick: openEditProfileModal,
                active: false,
              },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`relative flex flex-col items-center justify-center py-1.5 transition-all cursor-pointer active:scale-95 ${
                item.active ? 'text-cyan-400 font-extrabold' : 'text-slate-400'
              }`}
            >
              <span
                className={`android-nav-pill relative w-14 h-7 rounded-2xl flex items-center justify-center transition-all ${
                  item.active
                    ? 'bg-gradient-to-l from-indigo-500/25 to-cyan-500/25 text-cyan-300 shadow-inner'
                    : 'bg-transparent'
                }`}
              >
                <Icon className={`w-[19px] h-[19px] transition-transform ${item.active ? 'scale-110' : ''}`} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-400 text-slate-950 font-mono text-[9px] font-black flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] mt-0.5 leading-tight whitespace-nowrap truncate max-w-[66px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
