import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Wifi,
  Wallet,
  History,
  BookOpen,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { AppLanguage } from '../types';
import { t } from '../i18n';

interface SiteFooterProps {
  platformName: string;
  platformLogoUrl?: string;
  lang?: AppLanguage;
  onNavigate: (section: 'sms' | 'esim' | 'wallet' | 'history') => void;
  onOpenGuides: (tab: 'sms' | 'esim' | 'disclaimer') => void;
}

export const SiteFooter: React.FC<SiteFooterProps> = ({
  platformName,
  platformLogoUrl = '/pwa-192x192.png',
  lang = 'ar',
  onNavigate,
  onOpenGuides,
}) => {
  const [isMobileStandalonePwa, setIsMobileStandalonePwa] = useState(false);

  useEffect(() => {
    const check = () => {
      const standalone =
        window.matchMedia?.('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      // Hide in standalone PWA strictly on mobile screens (< 768px), ALWAYS show on desktop!
      setIsMobileStandalonePwa(standalone && window.innerWidth < 768);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isMobileStandalonePwa) return null;

  return (
    <footer className="hidden md:block mt-6 cyber-glass rounded-2xl border border-white/10 overflow-hidden">
      <div className="p-5 sm:p-6 space-y-6">
        {/* Top Row: Brand + Quick Links + Guides */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Brand Summary with 3D alisim SIM Icon */}
          <div className="md:col-span-5 space-y-2.5">
            <div className="flex items-center gap-3">
              <img
                src={platformLogoUrl || '/pwa-192x192.png'}
                alt={platformName || 'alisim'}
                className="w-11 h-11 rounded-xl object-cover border border-cyan-400/35 shadow-md shrink-0"
              />
              <div>
                <h3 className="text-sm sm:text-base font-black text-white leading-tight">
                  {platformName || 'alisim'}
                </h3>
                <p className="text-[11px] text-cyan-400 font-bold">
                  {lang === 'tr'
                    ? 'Global Sanal Numaralar ve Anlık eSIM'
                    : lang === 'en'
                    ? 'Global Virtual SMS Numbers & Instant eSIM'
                    : 'تفعيل الأرقام الافتراضية وشرائح eSIM العالمية'}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              {lang === 'tr'
                ? 'Tüm uygulamalar için anlık SMS doğrulama numaraları ve global 5G eSIM veri paketleri, canlı döviz kurları ve güvenilir ödeme yöntemleriyle 7/24 hizmetinizde.'
                : lang === 'en'
                ? 'Instant SMS verification numbers for global apps and 5G eSIM data plans with live exchange rates and fast, secure top-up gateways 24/7.'
                : 'منصة متكاملة لتفعيل الأرقام الفورية لجميع التطبيقات وإصدار شرائح البيانات الإلكترونية eSIM مع تحديث آلي لأسعار الصرف وبوابات شحن موثوقة وسريعة على مدار الساعة.'}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'tr'
                  ? 'Kod ulaşmadan iptal edilen her numara için anında bakiye iadesi'
                  : lang === 'en'
                  ? 'Full balance protection with instant refund if cancelled before OTP arrival'
                  : 'حماية كاملة للرصيد واسترداد فوري عند إلغاء أي رقم قبل وصول الكود'}
              </span>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="md:col-span-3 space-y-2.5">
            <h4 className="text-xs font-black text-white border-b border-white/10 pb-1.5">
              {t(lang, 'quick_links')}
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('sms')}
                  className="hover:text-cyan-400 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t(lang, 'nav_sms')}</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('esim')}
                  className="hover:text-cyan-400 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t(lang, 'nav_esim')}</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('wallet')}
                  className="hover:text-cyan-400 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t(lang, 'nav_wallet_full')}</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('history')}
                  className="hover:text-cyan-400 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <History className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t(lang, 'nav_history')}</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Guides & Policies */}
          <div className="md:col-span-4 space-y-2.5">
            <h4 className="text-xs font-black text-white border-b border-white/10 pb-1.5">
              {t(lang, 'guides_policies')}
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenGuides('sms')}
                  className="hover:text-cyan-400 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {lang === 'tr'
                      ? 'SMS Numara Doğrulama Rehberi'
                      : lang === 'en'
                      ? 'Virtual SMS Activation Guide'
                      : 'دليل تفعيل الأرقام المؤقتة (SMS)'}
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenGuides('esim')}
                  className="hover:text-cyan-400 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {lang === 'tr'
                      ? 'eSIM Kurulum Rehberi'
                      : lang === 'en'
                      ? 'eSIM Setup Guide'
                      : 'دليل تثبيت شرائح eSIM على الهاتف'}
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenGuides('disclaimer')}
                  className="hover:text-amber-400 transition-colors flex items-center gap-2 font-bold cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t(lang, 'guides_disclaimer')}</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Accepted Payment Methods Strip — Clean localized method names only */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-black text-white">{t(lang, 'accepted_payments')}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {/* 1. ShamCash */}
            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              className="p-2.5 rounded-xl bg-[#070A12] border border-white/10 hover:border-emerald-400/50 transition-all flex items-center gap-2.5 text-start cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="6" width="18" height="12" rx="2.5" />
                  <circle cx="12" cy="12" r="2.5" />
                  <path d="M6.5 12h.01M17.5 12h.01" />
                </svg>
              </div>
              <span className="text-xs font-black text-white truncate">
                {lang === 'ar' ? 'شام كاش' : 'ShamCash'}
              </span>
            </button>

            {/* 2. Binance Pay */}
            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              className="p-2.5 rounded-xl bg-[#070A12] border border-white/10 hover:border-amber-400/50 transition-all flex items-center gap-2.5 text-start cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-[#F3BA2F] text-slate-950 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M12 3l3.3 3.3-1.6 1.6L12 6.2 10.3 7.9 8.7 6.3 12 3zm6.7 6.7L21 12l-2.3 2.3-2.3-2.3 2.3-2.3zM5.3 9.7L7.6 12l-2.3 2.3L3 12l2.3-2.3zm6.7 0l2.3 2.3-2.3 2.3-2.3-2.3L12 9.7zm0 8.1l1.7-1.7 1.6 1.6L12 21l-3.3-3.3 1.6-1.6 1.7 1.7z" />
                </svg>
              </div>
              <span className="text-xs font-black text-white truncate">
                {lang === 'ar' ? 'باينانس باي' : 'Binance Pay'}
              </span>
            </button>

            {/* 3. Electronic Wallets */}
            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              className="p-2.5 rounded-xl bg-[#070A12] border border-white/10 hover:border-cyan-400/50 transition-all flex items-center gap-2.5 text-start cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v2h-4.5a2.5 2.5 0 0 0 0 5H19v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />
                  <path d="M19 9h1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1" />
                  <circle cx="15" cy="12" r="0.8" fill="currentColor" />
                </svg>
              </div>
              <span className="text-xs font-black text-white truncate">
                {lang === 'tr' ? 'Dijital Cüzdanlar' : lang === 'en' ? 'E-Wallets' : 'محافظ إلكترونية'}
              </span>
            </button>

            {/* 4. Syriatel Cash */}
            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              className="p-2.5 rounded-xl bg-[#070A12] border border-white/10 hover:border-rose-400/50 transition-all flex items-center gap-2.5 text-start cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-600 to-red-600 text-white flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 17a7 7 0 0 1 14 0" />
                  <path d="M8.5 17a3.5 3.5 0 0 1 7 0" />
                  <circle cx="12" cy="17" r="1" fill="currentColor" />
                  <path d="M12 5v4" />
                </svg>
              </div>
              <span className="text-xs font-black text-white truncate">
                {lang === 'ar' ? 'سيرياتيل كاش' : 'Syriatel Cash'}
              </span>
            </button>

            {/* 5. Turkish Bank */}
            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-[#070A12] border border-white/10 hover:border-sky-400/50 transition-all flex items-center gap-2.5 text-start cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-600 to-blue-700 text-white flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 10h18L12 4 3 10z" />
                  <path d="M5 10v7M10 10v7M14 10v7M19 10v7M3 19h18" />
                </svg>
              </div>
              <span className="text-xs font-black text-white truncate">
                {lang === 'tr' ? 'Türk Bankası' : lang === 'en' ? 'Turkish Bank' : 'بنك تركي'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Copyright Bar */}
      <div className="px-5 py-3 bg-[#070A12] border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>
          © {new Date().getFullYear()} {platformName || 'alisim'} — {t(lang, 'all_rights_reserved')}
        </span>
        <span className="font-mono text-[10px] text-slate-500">
          24/7 Instant SMS &amp; eSIM Delivery
        </span>
      </div>
    </footer>
  );
};
