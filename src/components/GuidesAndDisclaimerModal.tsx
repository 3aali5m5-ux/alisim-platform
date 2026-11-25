import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  MessageSquare,
  Wifi,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { AppLanguage, GrizzlyGuideItem } from '../types';

interface GuidesAndDisclaimerModalProps {
  lang?: AppLanguage;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'sms' | 'esim' | 'disclaimer';
}

const LOCALIZED_GUIDES: Record<AppLanguage, GrizzlyGuideItem[]> = {
  ar: [
    {
      id: 'sms-guide',
      category: 'sms',
      titleAr: 'دليل تفعيل الأرقام المؤقتة (SMS) خطوة بخطوة',
      summaryAr: 'التعليمات المعتمدة لضمان وصول كود التفعيل بنجاح وبأعلى سرعة.',
      stepsAr: [
        'اختر الدولة والتطبيق المطلوب بدقة، حيث يرتبط كل رقم بخدمة محددة فقط.',
        'انسخ الرقم الظاهر في لوحة التفعيل وأدخله في التطبيق المستهدف لطلب رمز التحقق.',
        'تبقى نافذة الاستقبال فعالة لمدة 20 دقيقة ويستخرج النظام الكود تلقائياً فور وصوله.',
        'إذا لم تصل الرسالة خلال الدقائق الأولى يمكنك إلغاء الرقم لاسترداد كامل الرصيد لمحفظتك فوراً.',
        'بعد استلام أول كود، يمكنك طلب رسالة إضافية لنفس الرقم إن توفرت، أو إنهاء الجلسة بعد إتمام التفعيل.',
      ],
    },
    {
      id: 'esim-guide',
      category: 'esim',
      titleAr: 'دليل تثبيت وتفعيل شرائح البيانات الإلكترونية (eSIM)',
      summaryAr: 'طريقة التثبيت الآمن على أجهزة iPhone و Android.',
      stepsAr: [
        'تحقق من دعم جهازك للـ eSIM بطلب الرمز *#06# والتأكد من ظهور معرف EID.',
        'تأكد من اتصال الجهاز بشبكة Wi-Fi مستقرة أثناء مسح رمز QR أو إدخال SM-DP+ وكود التفعيل.',
        'لا تحذف ملف الشريحة من الهاتف بعد التثبيت؛ رمز الـ QR يُستخدم لمرة واحدة فقط.',
        'قم بتفعيل خيار التجوال الدولي (Data Roaming) على الشريحة الجديدة لبدء الاتصال.',
      ],
    },
    {
      id: 'disclaimer',
      category: 'disclaimer',
      titleAr: 'إخلاء المسؤولية وشروط الاستخدام',
      summaryAr: 'سياسة الاستخدام القانوني وإخلاء المسؤولية المعتمدة.',
      stepsAr: [
        'تُستخدم الأرقام المؤقتة لتفعيل الحسابات الشخصية والتجارية المشروعة فقط، ويُحظر أي استخدام غير قانوني.',
        'تفعيل المصادقة الثنائية (2FA) وكلمة مرور إضافية داخل التطبيقات مسؤولية المستخدم المباشرة.',
        'يتم استرداد الرصيد تلقائياً للرقم فقط في حال عدم وصول أي رسالة نصية قبل إلغاء الرقم.',
        'شرائح eSIM الرقمية غير قابلة للإلغاء بعد إصدار كود الـ QR وتثبيته على جهاز المستخدم.',
      ],
    },
  ],
  tr: [
    {
      id: 'sms-guide',
      category: 'sms',
      titleAr: 'Sanal Numara (SMS) Aktivasyon Rehberi',
      summaryAr: 'Doğrulama kodunuzu en hızlı ve sorunsuz şekilde almak için onaylı adımlar.',
      stepsAr: [
        'Ülke ve hedef uygulamayı doğru seçin; her numara yalnızca seçilen hizmet için tahsis edilir.',
        'Aktivasyon panelinde görünen numarayı kopyalayın ve ilgili uygulamada doğrulama kodu isteyin.',
        'Aktivasyon penceresi 20 dakika açıktır ve gelen SMS kodu otomatik olarak ekranda görünür.',
        'İlk dakikalarda SMS gelmezse numarayı iptal ederek tutarın tamamını anında cüzdanınıza iade alabilirsiniz.',
        'İlk kod geldikten sonra destekleniyorsa aynı numaraya ek mesaj isteyebilir veya aktivasyonu tamamlayabilirsiniz.',
      ],
    },
    {
      id: 'esim-guide',
      category: 'esim',
      titleAr: 'eSIM Kurulum ve Aktivasyon Rehberi',
      summaryAr: 'iPhone ve Android cihazlarda güvenli eSIM kurulum adımları.',
      stepsAr: [
        'Telefonunuzdan *#06# tuşlayarak EID kodunun göründüğünü ve cihazınızın eSIM desteklediğini doğrulayın.',
        'QR kodu tararken veya SM-DP+ bilgilerini girerken kararlı bir Wi-Fi ağına bağlı olun.',
        'Kurulum tamamlandıktan sonra eSIM profilini cihazdan silmeyin; QR kod tek kullanımlıktır.',
        'Bağlantının başlaması için yeni eSIM hattında Veri Dolaşımı (Data Roaming) seçeneğini açın.',
      ],
    },
    {
      id: 'disclaimer',
      category: 'disclaimer',
      titleAr: 'Kullanım Koşulları ve Yasal Uyarı',
      summaryAr: 'Yasal kullanım politikası ve platform sorumluluk reddi.',
      stepsAr: [
        'Sanal numaralar yalnızca yasal kişisel ve ticari hesap doğrulamaları içindir.',
        'Uygulamalarda iki aşamalı doğrulama (2FA) ve ek şifre ayarlamak kullanıcının sorumluluğundadır.',
        'SMS kodu gelmeden iptal edilen numaraların ücreti otomatik olarak cüzdana iade edilir.',
        'QR kodu oluşturulup cihaza tanımlanan dijital eSIM paketleri iade edilemez.',
      ],
    },
  ],
  en: [
    {
      id: 'sms-guide',
      category: 'sms',
      titleAr: 'Step-by-Step Virtual SMS Activation Guide',
      summaryAr: 'Recommended instructions for fast and reliable OTP code delivery.',
      stepsAr: [
        'Select the exact country and target app — each virtual number is dedicated to one service.',
        'Copy the assigned phone number from the Live OTP panel and request the verification code in your app.',
        'The listening window stays active for 20 minutes and extracts your OTP automatically upon arrival.',
        'If no SMS arrives within the first few minutes, cancel the number to receive an instant full wallet refund.',
        'After receiving the first code, you may request an additional SMS if supported or complete the activation.',
      ],
    },
    {
      id: 'esim-guide',
      category: 'esim',
      titleAr: 'eSIM Installation & Activation Guide',
      summaryAr: 'Safe setup instructions for iPhone (iOS) and Android devices.',
      stepsAr: [
        'Verify eSIM compatibility by dialing *#06# and confirming an EID number appears on your device.',
        'Ensure a stable Wi-Fi connection while scanning the QR code or entering SM-DP+ credentials manually.',
        'Do not delete the installed eSIM profile after setup; each QR code can only be installed once.',
        'Enable Data Roaming on your new eSIM line to connect immediately to local 5G/LTE networks.',
      ],
    },
    {
      id: 'disclaimer',
      category: 'disclaimer',
      titleAr: 'Terms of Use & Legal Disclaimer',
      summaryAr: 'Official acceptable use and refund policy.',
      stepsAr: [
        'Virtual numbers are strictly for legitimate personal and business account verification.',
        'Enabling Two-Factor Authentication (2FA) and recovery credentials inside your apps is your responsibility.',
        'Wallet refunds are automatic only when no SMS code has been received prior to cancellation.',
        'Digital eSIM profiles are non-refundable once the QR / LPA profile has been provisioned.',
      ],
    },
  ],
};

const MODAL_LABELS: Record<
  AppLanguage,
  {
    headerTitle: string;
    sourceLabel: string;
    tabSms: string;
    tabEsim: string;
    tabDisclaimer: string;
    confirmBtn: string;
  }
> = {
  ar: {
    headerTitle: 'الأدلة الإرشادية وإخلاء المسؤولية',
    sourceLabel: 'دليل alisim الرسمي',
    tabSms: 'دليل الأرقام SMS',
    tabEsim: 'دليل eSIM',
    tabDisclaimer: 'إخلاء المسؤولية',
    confirmBtn: 'فهمت وأوافق',
  },
  tr: {
    headerTitle: 'Kullanım Rehberleri ve Yasal Uyarı',
    sourceLabel: 'alisim Resmi Rehberi',
    tabSms: 'SMS Rehberi',
    tabEsim: 'eSIM Rehberi',
    tabDisclaimer: 'Yasal Uyarı',
    confirmBtn: 'Anladım ve Onaylıyorum',
  },
  en: {
    headerTitle: 'Activation Guides & Disclaimer',
    sourceLabel: 'Official alisim Guide',
    tabSms: 'SMS Guide',
    tabEsim: 'eSIM Guide',
    tabDisclaimer: 'Disclaimer',
    confirmBtn: 'I Understand & Agree',
  },
};

export const GuidesAndDisclaimerModal: React.FC<GuidesAndDisclaimerModalProps> = ({
  lang = 'ar',
  isOpen,
  onClose,
  initialTab = 'sms',
}) => {
  const labels = MODAL_LABELS[lang];
  const [activeTab, setActiveTab] = useState<'sms' | 'esim' | 'disclaimer'>(initialTab);
  const [guides, setGuides] = useState<GrizzlyGuideItem[]>(LOCALIZED_GUIDES[lang]);

  useEffect(() => {
    setGuides(LOCALIZED_GUIDES[lang]);
  }, [lang]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    if (lang === 'ar') {
      fetch('/api/grizzly/guides')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.guides) && data.guides.length > 0) {
            setGuides(data.guides);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, initialTab, lang]);

  if (!isOpen) return null;

  const filtered = guides.filter((g) => g.category === activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl cyber-glass border border-cyan-500/40 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[86vh]">
        <div className="px-5 py-4 bg-[#070A12] border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white">
                {labels.headerTitle}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">{labels.sourceLabel}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-white/10 shrink-0">
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#070A12] border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('sms')}
              className={`py-2 px-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'sms'
                  ? 'bg-gradient-to-l from-indigo-600 to-cyan-600 text-white btn-solid-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span>{labels.tabSms}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('esim')}
              className={`py-2 px-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'esim'
                  ? 'bg-gradient-to-l from-indigo-600 to-cyan-600 text-white btn-solid-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wifi className="w-3.5 h-3.5 shrink-0" />
              <span>{labels.tabEsim}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('disclaimer')}
              className={`py-2 px-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'disclaimer'
                  ? 'bg-amber-600 text-white btn-solid-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>{labels.tabDisclaimer}</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-[#070A12] border border-white/10 space-y-3"
            >
              <div>
                <h4 className="text-sm font-black text-white">{item.titleAr}</h4>
                <p className="text-xs text-slate-400 mt-1">{item.summaryAr}</p>
              </div>
              <ul className="space-y-2">
                {item.stepsAr.map((step, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-slate-200 leading-relaxed"
                  >
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 bg-[#070A12] border-t border-white/10 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 text-white text-xs font-extrabold cursor-pointer btn-solid-white"
          >
            {labels.confirmBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
