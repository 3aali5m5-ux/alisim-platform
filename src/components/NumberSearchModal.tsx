import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  ArrowUpCircle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import {
  GrizzlyCountry,
  GrizzlyServiceItem,
  ServicePriceTier,
  GrizzlyBuyOptions,
  SupportedCurrency,
  AppLanguage,
} from '../types';
import { CountryFlagSvg, ServiceBrandIcon } from './BrandVisuals';
import { formatCurrencyAmount, ExchangeRatesConfig } from '../services/hybridSyncEngine';
import { getLocalizedCountryName, getLocalizedServiceName } from '../i18n';

interface NumberSearchModalProps {
  lang?: AppLanguage;
  isOpen: boolean;
  onClose: () => void;
  country: GrizzlyCountry;
  service: GrizzlyServiceItem;
  initialTierIndex: number;
  currency: SupportedCurrency;
  rates: ExchangeRatesConfig;
  onConfirmPurchaseWithTier: (options: GrizzlyBuyOptions) => Promise<{
    success: boolean;
    error?: string;
    code?: string;
  }>;
}

export const NumberSearchModal: React.FC<NumberSearchModalProps> = ({
  lang = 'ar',
  isOpen,
  onClose,
  country,
  service,
  initialTierIndex,
  currency,
  rates,
  onConfirmPurchaseWithTier,
}) => {
  const tiers = service.priceTiers || [];
  const localizedSvcName = getLocalizedServiceName(service, lang);
  const localizedCountryName = getLocalizedCountryName(country, lang);
  const [selectedTierIdx, setSelectedTierIdx] = useState<number>(initialTierIndex);
  const [phase, setPhase] = useState<'SEARCHING' | 'SCARCITY_PROMPT' | 'FOUND' | 'ERROR'>('SEARCHING');
  const [searchStepText, setSearchStepText] = useState<string>('جاري الاتصال بمزود الشبكة وفحص الأرقام المتاحة...');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  const activeTier: ServicePriceTier = tiers[selectedTierIdx] || tiers[0];

  const formatPrice = (usd: number) => formatCurrencyAmount(usd, currency, rates);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedTierIdx(initialTierIndex);
    setElapsedSec(0);
    setErrorMessage('');

    setPhase('SEARCHING');
    setSearchStepText(`جاري البحث عن رقم ${service.nameAr} في ${country.nameAr} بالسعر المحدد...`);

    const interval = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    const timer = setTimeout(async () => {
      if (initialTierIndex === 0 && tiers.length > 1) {
        setPhase('SCARCITY_PROMPT');
      } else {
        await executePurchase(tiers[initialTierIndex] || tiers[0]);
      }
    }, 1800);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [isOpen, service.code, country.id, initialTierIndex]);

  const executePurchase = async (tierToUse: ServicePriceTier) => {
    setPhase('SEARCHING');
    setSearchStepText(
      `جاري حجز رقم من (${tierToUse.providerLabelAr}) بسعر ${formatPrice(tierToUse.finalPriceUsd)}...`
    );

    const result = await onConfirmPurchaseWithTier({
      countryId: country.id,
      serviceCode: service.code,
      useV2: true,
      selectedTierPriceUsd: tierToUse.finalPriceUsd,
      selectedTierPriceRub: tierToUse.baseCostRub,
      maxPrice: String(Math.ceil(tierToUse.baseCostRub * 1.05)),
      providerIds: tierToUse.providerId,
    });

    if (result.success) {
      setPhase('FOUND');
      setTimeout(() => {
        onClose();
      }, 650);
    } else if (result.code === 'NO_NUMBERS') {
      setErrorMessage(result.error || 'لم يتم العثور على رقم بهذا السعر، يرجى رفع السعر من القائمة أدناه.');
      setPhase('SCARCITY_PROMPT');
    } else {
      setErrorMessage(result.error || 'تعذر إتمام الطلب');
      setPhase('ERROR');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-lg rounded-2xl cyber-glass border border-cyan-500/30 shadow-2xl shadow-indigo-950/80 overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#080B14] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ServiceBrandIcon code={service.code} className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>{localizedSvcName}</span>
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <CountryFlagSvg iso2={country.iso2} className="w-4 h-3 rounded-[2px]" />
                <span>{localizedCountryName}</span>
                <span>·</span>
                <span className="font-mono text-cyan-400" dir="ltr">{country.dialCode}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5">
          {phase === 'SEARCHING' && (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/25" />
                <div className="absolute inset-0 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
                <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-bold text-white">
                  {searchStepText}
                </div>
                <div className="text-xs text-slate-400 font-mono tabular-nums">
                  وقت البحث: {elapsedSec} ثانية · السعر المحدد: {formatPrice(activeTier.finalPriceUsd)}
                </div>
              </div>
            </div>
          )}

          {phase === 'FOUND' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="text-base font-bold text-white">
                تم العثور على الرقم وتخصيصه لك بنجاح!
              </div>
              <p className="text-xs text-slate-400">
                تمت إضافته إلى وحدة الـ OTP الحية بانتظار وصول رسالة التفعيل.
              </p>
            </div>
          )}

          {phase === 'ERROR' && (
            <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          )}

          {(phase === 'SCARCITY_PROMPT' || phase === 'SEARCHING') && (
            <div className="space-y-3.5 pt-2 border-t border-white/10">
              {phase === 'SCARCITY_PROMPT' && (
                <div className="p-3.5 rounded-xl bg-indigo-500/15 border border-cyan-500/30 text-xs space-y-1">
                  <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <ArrowUpCircle className="w-4 h-4 shrink-0" />
                    <span>تعدد الأسعار التلقائي لخدمة {service.nameAr} (رفع أولوية العثور على رقم)</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {errorMessage ||
                      'الأرقام بالسعر الأدنى عليها ضغط عالٍ حالياً. يمكنك تغيير السعر من الفئات المكتوبة تلقائياً أدناه والضغط على «تغيير السعر والبحث فوراً» للحصول على رقم أسرع وبنسبة وصول كود أعلى (حتى 99%):'}
                  </p>
                </div>
              )}

              <div className="text-xs font-bold text-slate-300">
                اختر فئة السعر ومزود الشبكة المطلوب (Multi-Price Tiers):
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pl-1">
                {tiers.map((tier, idx) => {
                  const isSelected = selectedTierIdx === idx;
                  return (
                    <button
                      key={`${tier.providerId}-${idx}`}
                      type="button"
                      onClick={() => setSelectedTierIdx(idx)}
                      className={`w-full p-3 rounded-xl border text-right transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-500/20 border-cyan-400 text-white shadow-md shadow-indigo-950/50'
                          : 'bg-[#090D18] border-white/10 text-slate-300 hover:border-indigo-500/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-cyan-400' : 'border-slate-500'
                            }`}
                          >
                            {isSelected && <span className="w-2 h-2 rounded-full bg-cyan-400" />}
                          </span>
                          <span className="text-xs font-bold truncate">
                            {tier.providerLabelAr}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 mr-6 font-mono tabular-nums">
                          <span>متاح: {tier.count} رقم</span>
                          <span>·</span>
                          <span className="text-emerald-400 font-semibold">
                            نسبة وصول الكود: {tier.deliveryRate}%
                          </span>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <div className="text-sm font-bold font-mono tabular-nums text-cyan-300">
                          {formatPrice(tier.finalPriceUsd)}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          maxPrice: {tier.baseCostRub} RUB
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => executePurchase(activeTier)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[42px]"
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  <span>
                    تغيير السعر إلى {formatPrice(activeTier.finalPriceUsd)} والبحث فوراً
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer min-h-[42px]"
                >
                  إلغاء الانتظار
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
