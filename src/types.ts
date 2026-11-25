export type SupportedCurrency = 'USD' | 'USDT' | 'SYP' | 'TRY';
export type AppLanguage = 'ar' | 'tr' | 'en';
export type UserRole = 'ADMIN' | 'MODERATOR' | 'RESELLER' | 'USER';
export type ResellerTier = 'SILVER' | 'GOLD';

export interface GrizzlyCountry {
  id: string;
  nameAr: string;
  nameEn: string;
  nameTr?: string;
  iso2: string;
  dialCode: string;
  region: 'arab' | 'europe' | 'asia' | 'americas';
}

export interface ServicePriceTier {
  providerId: string;
  providerLabelAr: string;
  deliveryRate: number;
  count: number;
  baseCostRub: number;
  baseCostUsd: number;
  finalPriceUsd: number;
  finalPriceSyp: number;
}

export interface GrizzlyServiceItem {
  code: string;
  nameAr: string;
  nameEn: string;
  nameTr?: string;
  category: 'social' | 'messaging' | 'finance' | 'shopping' | 'tech' | 'other';
  count: number;
  baseCostRub: number;
  baseCostUsd: number;
  finalPriceUsd: number;
  finalPriceSyp: number;
  priceTiers: ServicePriceTier[];
  successRate?: number;
  successBadge?: 'excellent' | 'good' | 'moderate';
  successSampleCount?: number;
}

export interface GrizzlyBuyOptions {
  countryId: string;
  serviceCode: string;
  useV2?: boolean;
  selectedTierPriceUsd?: number;
  selectedTierPriceRub?: number;
  maxPrice?: string;
  minPrice?: string;
  providerIds?: string;
  exceptProviderIds?: string;
  phoneException?: string;
  forceSuccessAfterUpgrade?: boolean;
}

export interface ESimCoveredCountry {
  iso2: string;
  nameAr: string;
  nameEn: string;
  iconUrl?: string;
}

export interface ESimPlan {
  id: string;
  rawPlanId?: number;
  nameEn: string;
  countryId: string;
  countryNameAr: string;
  countryNameEn: string;
  iso2: string;
  iconUrl?: string;
  region: 'local' | 'regional' | 'global';
  countriesCount: number;
  coveredCountries: ESimCoveredCountry[];
  dataAmountGb: number | 'unlimited';
  dataLabelAr: string;
  validityDays: number;
  networkType: '4G/LTE' | '5G';
  tetheringAllowed: boolean;
  providerName: string;
  baseCostUsd: number;
  finalPriceUsd: number;
  finalPriceSyp: number;
  stockCount: number;
  isLiveGrizzlyCatalog?: boolean;
  isCustomAdminPlan?: boolean;
  isAvailable?: boolean;
}

export interface ActiveSmsOrder {
  id: string;
  activationId: string;
  serviceCode: string;
  serviceNameAr: string;
  countryId: string;
  countryNameAr: string;
  iso2: string;
  phoneNumber: string;
  baseCostUsd?: number;
  priceUsd: number;
  priceSyp: number;
  activationCostOrigin?: number;
  currencyIso?: number;
  canGetAnotherSms?: boolean;
  verificationType?: number;
  status:
    | 'WAITING_SMS'
    | 'READY_SENT'
    | 'WAIT_RETRY'
    | 'WAIT_RESEND'
    | 'SMS_RECEIVED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'EXPIRED';
  smsCode: string | null;
  fullSmsText: string | null;
  smsDateTime?: string | null;
  smsHistory?: { code: string; text: string; receivedAt: number }[];
  retriedAt?: number;
  createdAt: number;
  expiresAt: number;
  cancelAvailableAt?: number;
  cancelLockSec?: number;
  isLiveApi: boolean;
}

export interface ActiveESimOrder {
  id: string;
  iccid: string;
  planId: string;
  countryNameAr: string;
  iso2: string;
  dataLabelAr: string;
  totalDataMb: number;
  usedDataMb: number;
  validityDays: number;
  networkType: string;
  smdpAddress: string;
  activationCode: string;
  lpaString: string;
  status: 'READY_TO_INSTALL' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  baseCostUsd?: number;
  priceUsd: number;
  priceSyp: number;
  purchasedAt: number;
  expiresAt: number;
}

export interface PaymentTransaction {
  id: string;
  gateway: string;
  gatewayLabelAr: string;
  referenceId: string;
  amountOriginal: number;
  currencyOriginal: SupportedCurrency;
  creditedUsd: number;
  creditedSyp: number;
  status: 'VERIFIED' | 'PENDING' | 'REJECTED';
  createdAt: number;
  note: string;
}

export interface PlatformSettings {
  hasApiKey: boolean;
  maskedApiKey: string;
  hasSyriaTodayKey?: boolean;
  maskedSyriaTodayKey?: string;
  isLiveMode: boolean;
  apiStatusError?: string | null;
  providerBalanceRub: number | null;
  providerBalanceUsd: number | null;
  staticCryptoWalletTrx?: string | null;
  lastSyncAt: number;
  smsMarkupPercent: number;
  esimMarkupPercent: number;
  usdToSypRate: number;
  usdToTryRate?: number;
  usdToUsdtRate?: number;
  rubToUsdRate: number;
  syriatelMerchantCode: string;
  syriatelMerchantName: string;
  shamcashWalletAddress: string;
  shamcashAccountHolder: string;
  binancePayId: string;
  binanceUsdtTrc20: string;
  binanceUsdtBep20?: string;
  hasBinanceApiKeys?: boolean;
  hasSupabaseConfig?: boolean;
  supabaseTablesReady?: boolean;
  supabaseStatusMessage?: string;
  autoVerifyPayments: boolean;
  lowProviderBalanceThresholdUsd?: number;
  isProviderBalanceLow?: boolean;
}

// ============================================================================
// 7-Tab Super Admin Command Center & Hybrid Supabase Sync Engine Types
// ============================================================================

export interface PricingOverrideRule {
  id: string;
  targetType: 'service' | 'country';
  targetCode: string; // e.g., 'wa', 'tg', '16', '22'
  targetNameAr: string;
  customMarkupPercent: number | null; // null means use global markup unless fixedPriceUsd is set
  fixedPriceUsd: number | null; // null means use markup calculation
  isHidden: boolean; // if true, hide this service or country from customers
  updatedAt: number;
}

export interface PaymentGatewayCustomField {
  id: string;
  labelAr: string;
  labelTr?: string;
  labelEn?: string;
  placeholder?: string;
  type: 'text' | 'number' | 'tel';
  required: boolean;
}

export interface PaymentGatewayConfig {
  id: string;
  code: string;
  nameAr: string;
  accountAddress: string;
  accountHolder: string;
  qrCodeText: string;
  iconUrl?: string;
  qrImageUrl?: string;
  minTopUpAmount: number;
  currency: SupportedCurrency;
  isEnabled: boolean;
  isAutomated?: boolean;
  allowReceiptUpload?: boolean;
  requireReceiptUpload?: boolean;
  customFields?: PaymentGatewayCustomField[];
  instructionsAr: string;
}

export interface TopUpOrderRequest {
  id: string;
  userId: string;
  userNameAr: string;
  gatewayId: string;
  gatewayNameAr: string;
  referenceId: string;
  amountOriginal: number;
  currencyOriginal: SupportedCurrency;
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

export interface ManagedUserAccount {
  id: string;
  nameAr: string;
  emailOrPhone: string;
  avatarUrl?: string;
  balanceUsd: number;
  totalSpentUsd: number;
  ordersCount: number;
  role: UserRole;
  isProtectedAdmin?: boolean;
  resellerTier?: ResellerTier;
  resellerDiscountPercent?: number;
  resellerApprovedAt?: number;
  transferMemoTag?: string;
  fraudScore?: number;
  restrictedUntil?: number | null;
  restrictionReason?: string | null;
  authProvider?: 'email' | 'google';
  isCurrentSession?: boolean;
  isSuspended?: boolean;
  lastActiveAt: number;
}

export interface AuthUserSession {
  token: string;
  user: ManagedUserAccount;
}

export interface SupportChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderAvatarUrl?: string;
  type: 'text' | 'image' | 'audio';
  text?: string;
  mediaDataUrl?: string;
  audioDurationSec?: number;
  createdAt: number;
}

export interface SupportConversation {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
  status: 'OPEN' | 'RESOLVED';
  unreadForAdmin: number;
  unreadForUser: number;
  updatedAt: number;
  messages: SupportChatMessage[];
}

export interface SyriaTodayRateStatus {
  hasKey: boolean;
  maskedKey: string;
  source: string;
  usdToSypRate: number;
  usdToTryRate: number;
  lastUpdatedAt: number | null;
  error?: string | null;
}

export interface GrizzlyGuideItem {
  id: string;
  category: 'sms' | 'esim' | 'disclaimer';
  titleAr: string;
  summaryAr: string;
  stepsAr: string[];
  warningAr?: string;
}

export interface ESimLpaInventoryItem {
  id: string;
  planId: string;
  countryNameAr: string;
  iso2: string;
  dataLabelAr: string;
  smdpAddress: string;
  activationCode: string;
  lpaString: string;
  iccid: string;
  isUsed: boolean;
  assignedOrderId?: string;
  addedAt: number;
}

export interface HeroSlideItem {
  id: string;
  imageUrl: string;
  titleAr?: string;
  subtitleAr?: string;
  ctaLabelAr?: string;
  ctaAction?: 'none' | 'sms' | 'esim' | 'wallet' | 'history' | 'external';
  ctaExternalUrl?: string;
  order?: number;
  isEnabled: boolean;
}

export interface PlatformNotification {
  id: string;
  category: 'otp' | 'wallet' | 'support' | 'order' | 'announcement' | 'system';
  titleAr: string;
  bodyAr: string;
  createdAt: number;
  isRead: boolean;
}

export type SliderTransitionStyle =
  | 'cube3d'
  | 'coverflow3d'
  | 'flip3d'
  | 'depthZoom3d'
  | 'tiltSlide3d';

export interface SiteCmsConfig {
  platformName: string;
  appShortName?: string;
  siteLogoUrl?: string;
  heroWelcomeTitle: string;
  heroWelcomeSubtitle: string;
  heroSlides?: HeroSlideItem[];
  sliderAutoPlay?: boolean;
  sliderAutoPlayMs?: number;
  sliderTransitionStyle?: SliderTransitionStyle;
  announcementEnabled: boolean;
  announcementText: string;
  announcementSpeed?: 'slow' | 'normal' | 'fast';
  announcementPaused?: boolean;
  supportWhatsapp: string;
  supportTelegram: string;
  supportChatEnabled: boolean;
  supportAllowVoice: boolean;
  supportAllowImages: boolean;
  supportAdminDisplayName: string;
  supportAdminBadgeTitle: string;
  supportWelcomeMessage: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  adminPin: string;
  esimDeliveryMode: 'AUTO_GENERATE' | 'INVENTORY_FIRST';
  corsProxyUrl: string;
}

export interface ActivityLogEntry {
  id: string;
  type:
    | 'SMS_BUY'
    | 'SMS_OTP'
    | 'SMS_CANCEL'
    | 'ESIM_BUY'
    | 'ESIM_CANCEL'
    | 'TOPUP_REQUEST'
    | 'TOPUP_APPROVE'
    | 'TOPUP_REJECT'
    | 'WALLET_ADJUST'
    | 'ADMIN_UPDATE'
    | 'SUPABASE_SYNC';
  titleAr: string;
  detailsAr: string;
  amountUsd?: number;
  netProfitUsd?: number;
  createdAt: number;
}

export interface SupabaseConfigState {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isConnected: boolean;
  lastSyncAt: number | null;
  syncStatusText: string;
  completedPatches: Record<string, boolean>;
}

export interface SqlMigrationPatch {
  version: string;
  titleAr: string;
  badgeTextAr: string;
  descriptionAr: string;
  tablesIncluded: string[];
  sqlCode: string;
}

export interface VoucherRedemptionEntry {
  userId: string;
  userNameAr: string;
  redeemedAt: number;
}

export interface VoucherCodeItem {
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
  redemptions: VoucherRedemptionEntry[];
}

export type StaffAuditActionType =
  | 'TOPUP_APPROVE'
  | 'TOPUP_REJECT'
  | 'WALLET_ADJUST'
  | 'ORDER_CANCEL'
  | 'ORDER_COMPLETE'
  | 'VOUCHER_CREATE'
  | 'VOUCHER_TOGGLE'
  | 'VOUCHER_DELETE'
  | 'STAFF_CREATE'
  | 'STAFF_UPDATE'
  | 'STAFF_DELETE'
  | 'SETTINGS_UPDATE';

export interface StaffAuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: 'ADMIN' | 'MODERATOR';
  actionType: StaffAuditActionType;
  targetLabel: string;
  amountUsd?: number;
  reason?: string;
  createdAt: number;
}

export interface StaffDailySummaryItem {
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

export interface ResellerProgramConfig {
  silverDiscountPercent: number;
  goldDiscountPercent: number;
  minDepositUsd: number;
  minMonthlySpendUsd: number;
  requireCleanSecurityRecord: boolean;
}

export interface ResellerApplication {
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
  assignedTier?: ResellerTier;
  assignedDiscountPercent?: number;
  rejectionReason?: string;
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
}

export interface SecurityPolicyConfig {
  strictAutoPayments: boolean;
  autoPaymentsPanicStop: boolean;
  enforceEmailWhitelist: boolean;
  allowedEmailDomains: string[];
  autoRestrictScoreThreshold: number;
  autoSuspendScoreThreshold: number;
}

export type FraudEventType =
  | 'DUPLICATE_REF_ATTEMPT'
  | 'DUPLICATE_RECEIPT_IMAGE'
  | 'FAKE_TOPUP_REJECTED'
  | 'VOUCHER_BRUTEFORCE'
  | 'EXCESSIVE_CANCEL_ABUSE'
  | 'MULTI_ACCOUNT_IP'
  | 'BLOCKED_DISPOSABLE_EMAIL'
  | 'AUTO_RESTRICTED'
  | 'AUTO_SUSPENDED';

export interface FraudEventEntry {
  id: string;
  userId: string;
  userNameAr: string;
  userEmail?: string;
  ipAddress: string;
  eventType: FraudEventType;
  pointsAdded: number;
  totalScoreAfter: number;
  details: string;
  createdAt: number;
}

export interface UserRiskProfile {
  userId: string;
  userNameAr: string;
  userEmail: string;
  riskScore: number;
  strikesCount: number;
  restrictedUntil: number | null;
  isSuspended: boolean;
  restrictionReason: string | null;
  lastEventAt: number;
}

export type AutomatedInvoiceGateway = 'binance' | 'usdt_trc20' | 'usdt_bep20';

export interface PaymentInvoice {
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
}


