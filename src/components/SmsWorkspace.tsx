import React, { useState, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  Star,
  ArrowUpDown,
  Globe2,
  Radio,
  ShoppingCart,
} from 'lucide-react';
import {
  GrizzlyCountry,
  GrizzlyServiceItem,
  GrizzlyBuyOptions,
  SupportedCurrency,
  PricingOverrideRule,
  ActiveSmsOrder,
  AppLanguage,
} from '../types';
import { CountryFlagSvg, ServiceBrandIcon } from './BrandVisuals';
import { NumberSearchModal } from './NumberSearchModal';
import { LiveOtpPanel } from './LiveOtpPanel';
import {
  formatCurrencyAmount,
  ExchangeRatesConfig,
  calculateEffectiveSmsPriceUsd,
} from '../services/hybridSyncEngine';
import { t, getLocalizedCountryName, getLocalizedServiceName } from '../i18n';

interface SmsWorkspaceProps {
  lang?: AppLanguage;
  countries: GrizzlyCountry[];
  selectedCountryId: string;
  onSelectCountry: (id: string) => void;
  services: GrizzlyServiceItem[];
  sourceMode: 'LIVE_GRIZZLY_API' | 'SIMULATED_CATALOG';
  loadingCatalog: boolean;
  onRefreshCatalog: () => void;
  currency: SupportedCurrency;
  rates: ExchangeRatesConfig;
  globalSmsMarkupPercent: number;
  pricingOverrides: PricingOverrideRule[];
  pinnedCountries: string[];
  onTogglePinCountry: (countryId: string) => void;
  pinnedServices: string[];
  onTogglePinService: (serviceCode: string) => void;
  activeLiveOtpCount: number;
  onOpenOtpModal: () => void;
  onBuyNumber: (options: GrizzlyBuyOptions) => Promise<{
    success: boolean;
    error?: string;
    code?: string;
  }>;
  buyingCode: string | null;
  activeSmsOrders: ActiveSmsOrder[];
  onSmsOrderAction: (
    orderId: string,
    action: 'READY_1' | 'RETRY_3' | 'COMPLETE_6' | 'CANCEL_8' | 'SIMULATE_SMS'
  ) => Promise<void>;
  onSyncActiveFromGrizzly: () => Promise<void>;
  onOpenGuides?: () => void;
}

export const SmsWorkspace: React.FC<SmsWorkspaceProps> = ({
  lang = 'ar',
  countries,
  selectedCountryId,
  onSelectCountry,
  services,
  sourceMode,
  loadingCatalog,
  onRefreshCatalog,
  currency,
  rates,
  globalSmsMarkupPercent,
  pricingOverrides,
  pinnedCountries,
  onTogglePinCountry,
  pinnedServices,
  onTogglePinService,
  activeLiveOtpCount,
  onOpenOtpModal,
  onBuyNumber,
  activeSmsOrders,
  onSmsOrderAction,
  onSyncActiveFromGrizzly,
  onOpenGuides,
}) => {
  const [countrySearch, setCountrySearch] = useState('');
  const [mobileCountryDrawerOpen, setMobileCountryDrawerOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [sortBy, setSortBy] = useState<'recommended' | 'lowest_price' | 'highest_stock'>('recommended');
  const [expandedServiceCode, setExpandedServiceCode] = useState<string | null>('wa');
  const [selectedTierByService, setSelectedTierByService] = useState<Record<string, number>>({});

  const [searchModalState, setSearchModalState] = useState<{
    isOpen: boolean;
    service: GrizzlyServiceItem | null;
    initialTierIdx: number;
  }>({
    isOpen: false,
    service: null,
    initialTierIdx: 0,
  });

  const selectedCountry = useMemo(
    () => countries.find((c) => c.id === selectedCountryId) || countries[0],
    [countries, selectedCountryId]
  );

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    const visible = countries.filter((c) => {
      const rule = pricingOverrides.find(
        (r) => r.targetType === 'country' && r.targetCode === String(c.id)
      );
      if (rule?.isHidden) return false;
      if (!q) return true;
      return (
        c.nameAr.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        (c.nameTr || '').toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.iso2.toLowerCase().includes(q)
      );
    });

    return [...visible].sort((a, b) => {
      const aPinned = pinnedCountries.includes(a.id) ? 1 : 0;
      const bPinned = pinnedCountries.includes(b.id) ? 1 : 0;
      return bPinned - aPinned;
    });
  }, [countries, countrySearch, pricingOverrides, pinnedCountries]);

  const enrichedServices = useMemo(() => {
    return services
      .filter((s) => {
        const rule = pricingOverrides.find(
          (r) => r.targetType === 'service' && r.targetCode.toLowerCase() === s.code.toLowerCase()
        );
        return !rule?.isHidden;
      })
      .map((s) => {
        const effectiveBase = calculateEffectiveSmsPriceUsd({
          baseCostUsd: s.baseCostUsd,
          serviceCode: s.code,
          countryId: selectedCountryId,
          globalSmsMarkupPercent,
          overrides: pricingOverrides,
        });

        const updatedTiers = (s.priceTiers || []).map((t) => {
          const effTier = calculateEffectiveSmsPriceUsd({
            baseCostUsd: t.baseCostUsd,
            serviceCode: s.code,
            countryId: selectedCountryId,
            globalSmsMarkupPercent,
            overrides: pricingOverrides,
          });
          return {
            ...t,
            finalPriceUsd: effTier.finalUsd,
            finalPriceSyp: Math.round(effTier.finalUsd * rates.usdToSypRate),
          };
        });

        return {
          ...s,
          finalPriceUsd: effectiveBase.finalUsd,
          finalPriceSyp: Math.round(effectiveBase.finalUsd * rates.usdToSypRate),
          priceTiers: updatedTiers,
          hasCustomOverride: effectiveBase.hasCustomOverride,
        };
      });
  }, [services, pricingOverrides, selectedCountryId, globalSmsMarkupPercent, rates.usdToSypRate]);

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    const list = enrichedServices.filter((s) => {
      if (!q) return true;
      return (
        s.nameAr.toLowerCase().includes(q) ||
        s.nameEn.toLowerCase().includes(q) ||
        (s.nameTr || '').toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      const aPin = pinnedServices.includes(a.code) ? 1 : 0;
      const bPin = pinnedServices.includes(b.code) ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;

      if (sortBy === 'lowest_price') {
        return a.finalPriceUsd - b.finalPriceUsd;
      }
      if (sortBy === 'highest_stock') {
        return b.count - a.count;
      }
      return 0;
    });
  }, [enrichedServices, serviceSearch, pinnedServices, sortBy]);

  const formatPrice = (usd: number) => formatCurrencyAmount(usd, currency, rates);

  const openBuySearchModal = (service: GrizzlyServiceItem, tierIdx: number) => {
    setSearchModalState({
      isOpen: true,
      service,
      initialTierIdx: tierIdx,
    });
  };

  const handleConfirmPurchaseAndOpenOtp = async (options: GrizzlyBuyOptions) => {
    const result = await onBuyNumber(options);
    // On mobile (< lg), automatically open the OTP activation popup; on desktop (>= lg), it appears immediately in Column 3!
    if (result.success && typeof window !== 'undefined' && window.innerWidth < 1024) {
      onOpenOtpModal();
    }
    return result;
  };

  return (
    <>
      <div className="space-y-4">
        {/* Mobile-only Active OTP Popup Trigger Banner (desktop already has Column 3 live!) */}
        {activeLiveOtpCount > 0 && (
          <button
            type="button"
            onClick={onOpenOtpModal}
            className="lg:hidden w-full p-3.5 rounded-2xl android-card cyber-glass border border-cyan-500/45 flex items-center justify-between gap-2.5 cursor-pointer hover:border-cyan-400 active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
                <Radio className="w-4 h-4 text-cyan-400" />
              </span>
              <div className="min-w-0 text-start">
                <div className="text-xs font-black text-white truncate">
                  {t(lang, 'active_otp_banner_prefix')} {activeLiveOtpCount}{' '}
                  {t(lang, 'active_otp_banner_suffix')}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {t(lang, 'tap_to_open_otp')}
                </div>
              </div>
            </div>
            <span className="px-3 py-2 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 text-white text-xs font-extrabold shrink-0 btn-solid-white">
              {t(lang, 'open_otp_window')}
            </span>
          </button>
        )}

        {/* 3-Column Equal-Height Desktop Layout (Countries 3 + Services 5 + Live OTP Panel 4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 lg:gap-4 lg:items-stretch">
          {/* COLUMN 1: Countries (3 cols on Desktop, fixed equal height with internal vertical scroll) */}
          <div className="lg:col-span-3 lg:h-[680px] cyber-glass android-card rounded-2xl overflow-hidden flex flex-col">
            {/* Mobile Compact Country Selector Bar */}
            <div className="lg:hidden p-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMobileCountryDrawerOpen((v) => !v)}
                className="flex-1 flex items-center justify-between gap-2 text-start cursor-pointer active:opacity-80"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                    1
                  </span>
                  {selectedCountry && (
                    <CountryFlagSvg
                      iso2={selectedCountry.iso2}
                      className="w-7 h-5 rounded-[3px] shadow-xs shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-white truncate flex items-center gap-1.5">
                      <span>
                        {selectedCountry
                          ? getLocalizedCountryName(selectedCountry, lang)
                          : t(lang, 'select_country')}
                      </span>
                      <span
                        className="text-[11px] font-mono text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded"
                        dir="ltr"
                      >
                        {selectedCountry?.dialCode}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {t(lang, 'tap_change_country')} ({filteredCountries.length})
                    </div>
                  </div>
                </div>

                <span className="px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-cyan-300 text-xs font-bold flex items-center gap-1 shrink-0">
                  <Globe2 className="w-3.5 h-3.5" />
                  <span>{t(lang, 'change_country')}</span>
                  {mobileCountryDrawerOpen ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>
              </button>
            </div>

            {/* Desktop Country Header */}
            <div className="hidden lg:block p-3.5 border-b border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 text-white text-xs font-extrabold flex items-center justify-center">
                    1
                  </span>
                  <h2 className="text-xs sm:text-sm font-extrabold text-white">
                    {t(lang, 'countries')} ({filteredCountries.length})
                  </h2>
                </div>
                <span className="text-[10px] text-amber-400 font-semibold">
                  ★ {t(lang, 'favorites')}
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder={t(lang, 'search_country')}
                  className="w-full ps-8 pe-2.5 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {mobileCountryDrawerOpen && (
              <div className="lg:hidden px-3 pb-2 pt-1 border-t border-white/10">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder={t(lang, 'search_country')}
                    className="w-full ps-9 pe-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            )}

            <div
              className={`${
                mobileCountryDrawerOpen
                  ? 'block max-h-[340px]'
                  : 'hidden lg:block lg:flex-1 lg:min-h-0'
              } p-2 space-y-1 overflow-y-auto overscroll-auto`}
            >
              {filteredCountries.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  {t(lang, 'no_countries_found')}
                </div>
              ) : (
                filteredCountries.map((country) => {
                  const isSelected = country.id === selectedCountryId;
                  const isPinned = pinnedCountries.includes(country.id);
                  return (
                    <div
                      key={country.id}
                      onClick={() => {
                        onSelectCountry(country.id);
                        setMobileCountryDrawerOpen(false);
                      }}
                      className={`w-full p-2 rounded-xl flex items-center justify-between gap-1.5 transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-indigo-600/20 border-cyan-400/60 text-white'
                          : 'border-transparent hover:bg-white/5 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePinCountry(country.id);
                          }}
                          className={`p-1 rounded hover:bg-white/10 transition-colors cursor-pointer shrink-0 ${
                            isPinned ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title={t(lang, 'favorites')}
                        >
                          <Star className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-400' : ''}`} />
                        </button>
                        <CountryFlagSvg
                          iso2={country.iso2}
                          className="w-6 h-4 rounded-[3px] shadow-xs shrink-0"
                        />
                        <div className="text-start min-w-0">
                          <div className="text-xs font-bold truncate">
                            {getLocalizedCountryName(country, lang)}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                          isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-slate-400'
                        }`}
                        dir="ltr"
                      >
                        {country.dialCode}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMN 2: Services Catalog (5 cols on Desktop, fixed equal height with internal vertical scroll) */}
          <div className="lg:col-span-5 lg:h-[680px] cyber-glass android-card rounded-2xl overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-white/10 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-xs sm:text-sm font-extrabold text-white truncate">
                      {t(lang, 'choose_app')} (
                      {selectedCountry ? getLocalizedCountryName(selectedCountry, lang) : ''})
                    </h2>
                    <p className="text-[11px] text-slate-400 truncate">
                      {sourceMode === 'LIVE_GRIZZLY_API'
                        ? t(lang, 'live_catalog_desc')
                        : t(lang, 'multi_tier_desc')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onRefreshCatalog}
                  disabled={loadingCatalog}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-400 border border-white/10 transition-colors cursor-pointer shrink-0"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingCatalog ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="relative sm:col-span-7">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder={t(lang, 'search_app')}
                    className="w-full ps-8 pe-3 py-2 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="sm:col-span-5 grid grid-cols-3 gap-1 bg-[#070A12] border border-white/10 rounded-xl p-1">
                  {[
                    { id: 'recommended', label: t(lang, 'sort_fav') },
                    { id: 'lowest_price', label: t(lang, 'sort_cheap') },
                    { id: 'highest_stock', label: t(lang, 'sort_stock') },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSortBy(opt.id as typeof sortBy)}
                      className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-0.5 whitespace-nowrap ${
                        sortBy === opt.id
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {opt.id === 'recommended' && <ArrowUpDown className="w-3 h-3 shrink-0" />}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 space-y-2 max-h-[600px] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto overscroll-auto">
              {filteredServices.length === 0 && (
                <div className="py-10 text-center text-xs text-slate-400">
                  {t(lang, 'no_services_found')}
                </div>
              )}
              {filteredServices.map((service) => {
                const tiers = service.priceTiers || [];
                const activeTierIdx = selectedTierByService[service.code] ?? 0;
                const currentTier = tiers[activeTierIdx] || tiers[0];
                const isExpanded = expandedServiceCode === service.code;
                const isPinned = pinnedServices.includes(service.code);
                const localizedSvcName = getLocalizedServiceName(service, lang);

                return (
                  <div
                    key={service.code}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isExpanded
                        ? 'bg-[#0D1322] border-cyan-400/60'
                        : 'bg-[#090D18]/90 border-white/10 hover:border-indigo-500/40'
                    }`}
                  >
                    <div className="p-2.5 sm:p-3 flex items-center justify-between gap-2">
                      <div
                        onClick={() => setExpandedServiceCode(isExpanded ? null : service.code)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePinService(service.code);
                          }}
                          className={`p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0 ${
                            isPinned ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-400' : ''}`} />
                        </button>

                        <ServiceBrandIcon
                          code={service.code}
                          className="w-9 h-9 rounded-xl shrink-0 shadow-xs"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-xs sm:text-sm font-extrabold text-white truncate">
                              {localizedSvcName}
                            </h3>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedServiceCode(isExpanded ? null : service.code);
                              }}
                              className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] font-bold text-cyan-300 flex items-center gap-0.5 shrink-0 cursor-pointer"
                            >
                              <Layers className="w-2.5 h-2.5" />
                              <span>{tiers.length}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-2.5 h-2.5" />
                              ) : (
                                <ChevronDown className="w-2.5 h-2.5" />
                              )}
                            </button>
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 flex items-center flex-wrap gap-1.5 font-mono tabular-nums">
                            <span className="text-emerald-400 font-semibold">
                              {(currentTier ? currentTier.count : service.count).toLocaleString(
                                'en-US'
                              )}{' '}
                              {t(lang, 'available')}
                            </span>
                            <span>·</span>
                            {(() => {
                              const rate =
                                typeof service.successRate === 'number'
                                  ? service.successRate
                                  : currentTier?.deliveryRate || 95;
                              const badgeLevel =
                                service.successBadge ||
                                (rate >= 92 ? 'excellent' : rate >= 82 ? 'good' : 'moderate');
                              const badgeCls =
                                badgeLevel === 'excellent'
                                  ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-300'
                                  : badgeLevel === 'good'
                                  ? 'bg-cyan-500/15 border-cyan-400/35 text-cyan-300'
                                  : 'bg-amber-500/15 border-amber-400/35 text-amber-300';
                              const badgeLabel =
                                badgeLevel === 'excellent'
                                  ? lang === 'tr'
                                    ? 'Yüksek'
                                    : lang === 'en'
                                    ? 'High'
                                    : 'ممتاز'
                                  : badgeLevel === 'good'
                                  ? lang === 'tr'
                                    ? 'İyi'
                                    : lang === 'en'
                                    ? 'Good'
                                    : 'جيد'
                                  : lang === 'tr'
                                  ? 'Orta'
                                  : lang === 'en'
                                  ? 'Fair'
                                  : 'متوسط';
                              const sampleNote =
                                service.successSampleCount && service.successSampleCount > 0
                                  ? lang === 'tr'
                                    ? `${service.successSampleCount} gerçek doğrulamaya göre`
                                    : lang === 'en'
                                    ? `Based on ${service.successSampleCount} live activations`
                                    : `بناءً على ${service.successSampleCount} عملية تفعيل فعلية`
                                  : lang === 'tr'
                                  ? 'Anlık kod ulaşım başarı oranı'
                                  : lang === 'en'
                                  ? 'Smart OTP delivery success indicator'
                                  : 'مؤشر نسبة نجاح وصول الكود الذكي';
                              return (
                                <span
                                  title={sampleNote}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${badgeCls}`}
                                >
                                  <span>{rate}%</span>
                                  <span className="font-sans opacity-90">{badgeLabel}</span>
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Price + Compact Icon Buy Button */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-end">
                          <div className="text-xs sm:text-sm font-black font-mono tabular-nums text-cyan-300">
                            {currentTier
                              ? formatPrice(currentTier.finalPriceUsd)
                              : formatPrice(service.finalPriceUsd)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => openBuySearchModal(service, activeTierIdx)}
                          aria-label={localizedSvcName}
                          title={localizedSvcName}
                          className="w-10 h-10 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 shrink-0 cursor-pointer btn-solid-white"
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && tiers.length > 0 && (
                      <div className="px-3 pb-3 pt-2 bg-[#060911] border-t border-white/10 space-y-2">
                        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                          <span className="font-bold text-slate-300 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span>
                              {t(lang, 'price_tiers_for')} ({localizedSvcName} · {tiers.length}{' '}
                              {t(lang, 'tiers_count_label')}):
                            </span>
                          </span>
                          <span className="hidden sm:inline">{t(lang, 'higher_price_faster')}</span>
                        </div>

                        {/* Dynamic unlimited tiers container (cleanly scrollable when 6+ tiers arrive) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[260px] overflow-y-auto pe-0.5">
                          {tiers.map((tier, idx) => {
                            const isTierSelected = activeTierIdx === idx;
                            const tierDisplayLabel =
                              lang === 'ar'
                                ? tier.providerLabelAr
                                : lang === 'tr'
                                ? `Sağlayıcı #${tier.providerId} (Seçenek ${idx + 1})`
                                : `Provider #${tier.providerId} (Tier ${idx + 1})`;
                            return (
                              <div
                                key={`${service.code}-tier-${idx}`}
                                onClick={() =>
                                  setSelectedTierByService((prev) => ({
                                    ...prev,
                                    [service.code]: idx,
                                  }))
                                }
                                className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                  isTierSelected
                                    ? 'bg-indigo-500/20 border-cyan-400 text-white'
                                    : 'bg-[#0B0F1A] border-white/10 text-slate-300 hover:border-indigo-500/40'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="text-[11px] font-bold truncate">
                                    {tierDisplayLabel}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">
                                    {tier.count} {t(lang, 'available')} · {tier.deliveryRate}%
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-xs font-black font-mono tabular-nums text-cyan-300">
                                    {formatPrice(tier.finalPriceUsd)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTierByService((prev) => ({
                                        ...prev,
                                        [service.code]: idx,
                                      }));
                                      openBuySearchModal(service, idx);
                                    }}
                                    aria-label={tierDisplayLabel}
                                    className="w-8 h-8 rounded-lg bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white flex items-center justify-center cursor-pointer transition-transform active:scale-95 btn-solid-white"
                                  >
                                    <ShoppingCart className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
          </div>

          {/* COLUMN 3: Desktop Live OTP Activation Panel (4 cols on Desktop — Equal Height) */}
          <aside className="hidden lg:flex lg:col-span-4 lg:h-[680px] cyber-glass rounded-2xl overflow-hidden flex-col">
            <LiveOtpPanel
              lang={lang}
              orders={activeSmsOrders}
              currency={currency}
              rates={rates}
              onOrderAction={onSmsOrderAction}
              onSyncActiveFromGrizzly={onSyncActiveFromGrizzly}
              onOpenGuides={onOpenGuides}
              compact
            />
          </aside>
        </div>
      </div>

      {/* Multi-Price Purchase & Search Popup Modal */}
      {searchModalState.isOpen && searchModalState.service && selectedCountry && (
        <NumberSearchModal
          lang={lang}
          isOpen={searchModalState.isOpen}
          onClose={() => setSearchModalState((s) => ({ ...s, isOpen: false }))}
          country={selectedCountry}
          service={searchModalState.service}
          initialTierIndex={searchModalState.initialTierIdx}
          currency={currency}
          rates={rates}
          onConfirmPurchaseWithTier={handleConfirmPurchaseAndOpenOtp}
        />
      )}
    </>
  );
};
