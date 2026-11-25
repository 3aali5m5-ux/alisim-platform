import React, { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { AppLanguage } from '../types';

interface PWAInstallModalAndButtonProps {
  lang?: AppLanguage;
  platformName?: string;
  platformLogoUrl?: string;
}

const PWA_COPY: Record<
  AppLanguage,
  {
    btnLabel: string;
    btnTitle: string;
    modalTitle: string;
    modalSub: string;
    iosHeading: string;
    iosStep1: string;
    iosStep2: string;
    androidHeading: string;
    androidStep1: string;
    androidStep2: string;
    previewNote: string;
    closeBtn: string;
  }
> = {
  ar: {
    btnLabel: 'تثبيت التطبيق',
    btnTitle: 'تثبيت تطبيق alisim على هاتفك',
    modalTitle: 'تثبيت تطبيق alisim على هاتفك',
    modalSub: 'يعمل كتطبيق أصلي بملء الشاشة وبدون متصفح',
    iosHeading: 'خطوات التثبيت على آيفون / آيباد (Safari):',
    iosStep1: '1. اضغط على زر المشاركة (Share) في شريط متصفح سفاري السفلي.',
    iosStep2: '2. اختر إضافة إلى الشاشة الرئيسية (Add to Home Screen) ثم اضغط إضافة.',
    androidHeading: 'خطوات التثبيت المباشر (Android / Chrome):',
    androidStep1: '1. افتح قائمة المتصفح العلوية (النقاط الثلاث ⋮ في كروم أو سفاري).',
    androidStep2: '2. اضغط على «تثبيت التطبيق» (Install App) أو «إضافة إلى الشاشة الرئيسية».',
    previewNote:
      'ملاحظة: إذا كنت تتصفح داخل نافذة المعاينة، افتح الرابط في تبويب مستقل ليظهر لك زر التثبيت الفوري بضغطة واحدة.',
    closeBtn: 'حسناً، فهمت',
  },
  tr: {
    btnLabel: 'Uygulamayı Kur',
    btnTitle: 'alisim uygulamasını telefonunuza kurun',
    modalTitle: 'alisim Uygulamasını Kurun',
    modalSub: 'Tam ekran yerel mobil uygulama deneyimi ile çalışır',
    iosHeading: 'iPhone / iPad Kurulum Adımları (Safari):',
    iosStep1: '1. Safari alt çubuğundaki Paylaş (Share) düğmesine dokunun.',
    iosStep2: '2. Ana Ekrana Ekle (Add to Home Screen) seçeneğine dokunup onaylayın.',
    androidHeading: 'Doğrudan Kurulum Adımları (Android / Chrome):',
    androidStep1: '1. Tarayıcı üst menüsünü açın (Chrome sağ üstteki üç nokta ⋮).',
    androidStep2: '2. «Uygulamayı Yükle» (Install App) veya «Ana Ekrana Ekle» seçeneğine dokunun.',
    previewNote:
      'Not: Önizleme penceresindeyseniz tek tıkla kurulum için bağlantıyı yeni sekmede açın.',
    closeBtn: 'Anladım',
  },
  en: {
    btnLabel: 'Install App',
    btnTitle: 'Install alisim app on your device',
    modalTitle: 'Install alisim App',
    modalSub: 'Runs as a full-screen native app without browser bars',
    iosHeading: 'iPhone / iPad Steps (Safari):',
    iosStep1: '1. Tap the Share button in the Safari bottom toolbar.',
    iosStep2: '2. Choose Add to Home Screen and tap Add.',
    androidHeading: 'Direct Install Steps (Android / Chrome):',
    androidStep1: '1. Open the browser menu (three dots ⋮ in Chrome).',
    androidStep2: '2. Tap "Install App" or "Add to Home Screen".',
    previewNote:
      'Note: If you are inside an embedded preview, open the link in a standalone tab for one-tap installation.',
    closeBtn: 'Got it',
  },
};

export const PWAInstallModalAndButton: React.FC<PWAInstallModalAndButtonProps> = ({
  lang = 'ar',
  platformName = 'alisim',
  platformLogoUrl = '/pwa-192x192.png',
}) => {
  const c = PWA_COPY[lang];
  const displayBrand = platformName?.trim() || 'alisim';
  const modalTitleText =
    lang === 'tr'
      ? `${displayBrand} Uygulamasını Kurun`
      : lang === 'en'
      ? `Install ${displayBrand} App`
      : `تثبيت تطبيق ${displayBrand} على هاتفك`;
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white w-9 h-9 md:w-auto md:px-3 text-xs font-extrabold transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-sm btn-solid-white"
        title={c.btnTitle}
        aria-label={c.btnLabel}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span className="hidden md:inline">{c.btnLabel}</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl cyber-glass border border-cyan-500/30 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <img
                  src={platformLogoUrl || '/pwa-192x192.png'}
                  alt={displayBrand}
                  className="w-11 h-11 rounded-xl object-cover border border-cyan-400/50 shadow-md shrink-0"
                />
                <div>
                  <h3 className="text-base font-extrabold text-white">{modalTitleText}</h3>
                  <p className="text-xs text-slate-400">{c.modalSub}</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm text-slate-300">
              {isIOS ? (
                <div className="space-y-3">
                  <p className="font-bold text-white">{c.iosHeading}</p>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-[#070A12] border border-white/10 text-xs">
                    <Share className="w-5 h-5 text-cyan-400 shrink-0" />
                    <span>{c.iosStep1}</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-[#070A12] border border-white/10 text-xs">
                    <PlusSquare className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{c.iosStep2}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="font-bold text-white">{c.androidHeading}</p>
                  <div className="p-3.5 rounded-xl bg-[#070A12] border border-white/10 space-y-2 text-xs leading-relaxed">
                    <p>{c.androidStep1}</p>
                    <p>{c.androidStep2}</p>
                    <p className="text-cyan-400 font-semibold">{c.previewNote}</p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="mt-6 w-full py-2.5 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 text-white text-sm font-extrabold hover:opacity-95 transition-opacity cursor-pointer btn-solid-white"
            >
              {c.closeBtn}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
