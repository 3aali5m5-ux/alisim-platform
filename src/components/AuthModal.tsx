import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  KeyRound,
  LogIn,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { AppLanguage, ManagedUserAccount } from '../types';

interface AuthModalProps {
  lang?: AppLanguage;
  isOpen: boolean;
  onClose: () => void;
  platformName: string;
  platformLogoUrl?: string;
  onAuthSuccess: (token: string, user: ManagedUserAccount) => void;
  initialMode?: 'login' | 'register' | 'forgot';
}

const AUTH_COPY: Record<
  AppLanguage,
  {
    loginTitle: (brand: string) => string;
    registerTitle: string;
    forgotTitle: string;
    resetTitle: string;
    subtitle: string;
    tabLogin: string;
    tabRegister: string;
    adminNoticeTitle: string;
    adminNoticeBody1: string;
    adminNoticeBody2: string;
    continueGoogle: string;
    googleQuickTitle: string;
    back: string;
    gmailPh: string;
    fullNameOptPh: string;
    verifying: string;
    confirmGoogle: string;
    orEmail: string;
    emailLabel: string;
    passwordLabel: string;
    forgotLink: string;
    submitLogin: string;
    fullNameLabel: string;
    fullNamePh: string;
    passwordMinLabel: string;
    creatingAccount: string;
    submitRegister: string;
    forgotDesc: string;
    sendingCode: string;
    sendCode: string;
    backToLogin: string;
    resetCodeLabel: string;
    newPasswordLabel: string;
    updating: string;
    saveNewPassword: string;
    errInvalid: string;
    errRegister: string;
    errForgot: string;
    errReset: string;
    errGoogle: string;
    errNetwork: string;
    resetSuccess: string;
  }
> = {
  ar: {
    loginTitle: (brand) => `تسجيل الدخول إلى ${brand}`,
    registerTitle: 'إنشاء حساب جديد',
    forgotTitle: 'استعادة كلمة المرور',
    resetTitle: 'تعيين كلمة مرور جديدة',
    subtitle: 'حساب واحد لإدارة أرقامك، شرائح eSIM، والمحفظة والدعم المباشر',
    tabLogin: 'تسجيل الدخول',
    tabRegister: 'حساب جديد',
    adminNoticeTitle: 'تفعيل حساب المدير لأول مرة:',
    adminNoticeBody1: 'سجّل الدخول بالبريد',
    adminNoticeBody2: 'مع كلمة المرور التي تختارها (8 محارف على الأقل) ليتم اعتمادها تلقائياً.',
    continueGoogle: 'المتابعة باستخدام حساب Google',
    googleQuickTitle: 'تسجيل الدخول السريع عبر Google',
    back: 'رجوع',
    gmailPh: 'بريدك على Gmail (مثال: name@gmail.com)',
    fullNameOptPh: 'اسمك الكامل (اختياري)',
    verifying: 'جاري التحقق...',
    confirmGoogle: 'تأكيد الدخول بحساب Google',
    orEmail: 'أو عبر البريد الإلكتروني',
    emailLabel: 'البريد الإلكتروني',
    passwordLabel: 'كلمة المرور',
    forgotLink: 'نسيت كلمة المرور؟',
    submitLogin: 'دخول إلى الحساب',
    fullNameLabel: 'الاسم الكامل',
    fullNamePh: 'الاسم الذي يظهر في حسابك والدعم',
    passwordMinLabel: 'كلمة المرور (8 محارف على الأقل)',
    creatingAccount: 'جاري إنشاء الحساب...',
    submitRegister: 'إنشاء الحساب والبدء فوراً',
    forgotDesc: 'أدخل بريدك الإلكتروني المسجّل لدينا لإصدار رمز استعادة آمن صالح لمدة 15 دقيقة.',
    sendingCode: 'جاري إرسال الرمز...',
    sendCode: 'إرسال رمز الاستعادة',
    backToLogin: 'العودة لتسجيل الدخول',
    resetCodeLabel: 'رمز الاستعادة (6 أرقام)',
    newPasswordLabel: 'كلمة المرور الجديدة (8 محارف على الأقل)',
    updating: 'جاري التحديث...',
    saveNewPassword: 'حفظ كلمة المرور الجديدة',
    errInvalid: 'بيانات الدخول غير صحيحة',
    errRegister: 'تعذر إنشاء الحساب',
    errForgot: 'تعذر إرسال رمز الاستعادة',
    errReset: 'تعذر تحديث كلمة المرور',
    errGoogle: 'تعذر تسجيل الدخول بحساب Google',
    errNetwork: 'تعذر الاتصال بالخادم، حاول مجدداً.',
    resetSuccess: 'تم تحديث كلمة المرور بنجاح! يمكنك تسجيل الدخول الآن.',
  },
  tr: {
    loginTitle: (brand) => `${brand} Hesabına Giriş`,
    registerTitle: 'Yeni Hesap Oluştur',
    forgotTitle: 'Şifre Kurtarma',
    resetTitle: 'Yeni Şifre Belirle',
    subtitle: 'Numaralarınız, eSIM kartlarınız, cüzdan ve canlı destek için tek hesap',
    tabLogin: 'Giriş Yap',
    tabRegister: 'Kayıt Ol',
    adminNoticeTitle: 'İlk Yönetici Kurulumu:',
    adminNoticeBody1: 'Yönetici şifresini tanımlamak için',
    adminNoticeBody2: 'adresiyle en az 8 karakterli bir şifre belirleyerek giriş yapın.',
    continueGoogle: 'Google Hesabı ile Devam Et',
    googleQuickTitle: 'Google ile Hızlı Giriş',
    back: 'Geri',
    gmailPh: 'Gmail adresiniz (ör: name@gmail.com)',
    fullNameOptPh: 'Adınız Soyadınız (isteğe bağlı)',
    verifying: 'Doğrulanıyor...',
    confirmGoogle: 'Google ile Girişi Onayla',
    orEmail: 'veya E-posta ile',
    emailLabel: 'E-posta Adresi',
    passwordLabel: 'Şifre',
    forgotLink: 'Şifremi unuttum?',
    submitLogin: 'Hesaba Giriş Yap',
    fullNameLabel: 'Ad Soyad',
    fullNamePh: 'Hesabınızda görünecek adınız',
    passwordMinLabel: 'Şifre (en az 8 karakter)',
    creatingAccount: 'Hesap oluşturuluyor...',
    submitRegister: 'Hesap Oluştur ve Başla',
    forgotDesc: '15 dakika geçerli güvenli kurtarma kodu almak için kayıtlı e-postanızı girin.',
    sendingCode: 'Kod gönderiliyor...',
    sendCode: 'Kurtarma Kodu Gönder',
    backToLogin: 'Giriş ekranına dön',
    resetCodeLabel: 'Kurtarma Kodu (6 haneli)',
    newPasswordLabel: 'Yeni Şifre (en az 8 karakter)',
    updating: 'Güncelleniyor...',
    saveNewPassword: 'Yeni Şifreyi Kaydet',
    errInvalid: 'Giriş bilgileri hatalı',
    errRegister: 'Hesap oluşturulamadı',
    errForgot: 'Kurtarma kodu gönderilemedi',
    errReset: 'Şifre güncellenemedi',
    errGoogle: 'Google ile giriş başarısız',
    errNetwork: 'Sunucuya bağlanılamadı, tekrar deneyin.',
    resetSuccess: 'Şifreniz güncellendi! Şimdi giriş yapabilirsiniz.',
  },
  en: {
    loginTitle: (brand) => `Sign In to ${brand}`,
    registerTitle: 'Create New Account',
    forgotTitle: 'Reset Password',
    resetTitle: 'Set New Password',
    subtitle: 'One account for virtual numbers, eSIM profiles, wallet, and live support',
    tabLogin: 'Sign In',
    tabRegister: 'Sign Up',
    adminNoticeTitle: 'First-Time Admin Setup:',
    adminNoticeBody1: 'Sign in with',
    adminNoticeBody2: 'and choose a password (8+ chars) to claim the admin account.',
    continueGoogle: 'Continue with Google',
    googleQuickTitle: 'Quick Google Sign-In',
    back: 'Back',
    gmailPh: 'Your Gmail address (e.g. name@gmail.com)',
    fullNameOptPh: 'Full name (optional)',
    verifying: 'Verifying...',
    confirmGoogle: 'Confirm Google Sign-In',
    orEmail: 'or continue with email',
    emailLabel: 'Email Address',
    passwordLabel: 'Password',
    forgotLink: 'Forgot password?',
    submitLogin: 'Sign In',
    fullNameLabel: 'Full Name',
    fullNamePh: 'Name shown in your profile & support',
    passwordMinLabel: 'Password (min 8 characters)',
    creatingAccount: 'Creating account...',
    submitRegister: 'Create Account & Start',
    forgotDesc: 'Enter your registered email to receive a 15-minute password recovery code.',
    sendingCode: 'Sending code...',
    sendCode: 'Send Recovery Code',
    backToLogin: 'Back to Sign In',
    resetCodeLabel: 'Recovery Code (6 digits)',
    newPasswordLabel: 'New Password (min 8 characters)',
    updating: 'Updating...',
    saveNewPassword: 'Save New Password',
    errInvalid: 'Invalid login credentials',
    errRegister: 'Could not create account',
    errForgot: 'Could not send recovery code',
    errReset: 'Could not update password',
    errGoogle: 'Google sign-in failed',
    errNetwork: 'Could not connect to server, please try again.',
    resetSuccess: 'Password updated successfully! You can sign in now.',
  },
};

export const AuthModal: React.FC<AuthModalProps> = ({
  lang = 'ar',
  isOpen,
  onClose,
  platformName,
  platformLogoUrl = '/pwa-192x192.png',
  onAuthSuccess,
  initialMode = 'login',
}) => {
  const c = AUTH_COPY[lang];
  const isRtl = lang === 'ar';
  const iconPos = isRtl ? 'right-3' : 'left-3';
  const inputPad = isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3';

  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(initialMode);
  const [nameAr, setNameAr] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [showGoogleBox, setShowGoogleBox] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [needsAdminSetup, setNeedsAdminSetup] = useState(false);
  const [ownerEmailHint, setOwnerEmailHint] = useState('3lishops@gmail.com');

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setErrorMsg(null);
    setInfoMsg(null);
    setShowGoogleBox(false);
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data) => {
        setNeedsAdminSetup(!data.adminClaimed);
        if (data.adminEmail) setOwnerEmailHint(data.adminEmail);
      })
      .catch(() => {});
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || c.errInvalid);
        return;
      }
      onAuthSuccess(data.token, data.user);
      onClose();
    } catch {
      setErrorMsg(c.errNetwork);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameAr: nameAr.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || c.errRegister);
        return;
      }
      onAuthSuccess(data.token, data.user);
      onClose();
    } catch {
      setErrorMsg(c.errNetwork);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || c.errForgot);
        return;
      }
      setInfoMsg(
        data.previewResetCode ? `${data.message} — ${data.previewResetCode}` : data.message
      );
      if (data.previewResetCode) {
        setResetCode(data.previewResetCode);
      }
      setMode('reset');
    } catch {
      setErrorMsg(c.errNetwork);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: resetCode.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || c.errReset);
        return;
      }
      setInfoMsg(c.resetSuccess);
      setPassword('');
      setNewPassword('');
      setMode('login');
    } catch {
      setErrorMsg(c.errNetwork);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: googleEmail.trim(),
          nameAr: googleName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || c.errGoogle);
        return;
      }
      onAuthSuccess(data.token, data.user);
      onClose();
    } catch {
      setErrorMsg(c.errNetwork);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl cyber-glass border border-cyan-500/40 shadow-2xl overflow-hidden my-6">
        {/* Header with 3D alisim Brand Icon */}
        <div className="px-5 py-4 bg-[#070A12] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={platformLogoUrl || '/pwa-192x192.png'}
              alt={platformName || 'alisim'}
              className="w-10 h-10 rounded-xl object-cover border border-cyan-400/50 shadow-sm shrink-0"
            />
            <div>
              <h2 className="text-sm sm:text-base font-black text-white">
                {mode === 'login'
                  ? c.loginTitle(platformName)
                  : mode === 'register'
                  ? c.registerTitle
                  : mode === 'forgot'
                  ? c.forgotTitle
                  : c.resetTitle}
              </h2>
              <p className="text-[11px] text-slate-400">{c.subtitle}</p>
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

        <div className="p-5 space-y-4">
          {(mode === 'login' || mode === 'register') && (
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#070A12] border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setShowGoogleBox(false);
                }}
                className={`py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'login'
                    ? 'bg-gradient-to-l from-indigo-600 to-cyan-600 text-white btn-solid-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{c.tabLogin}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                  setShowGoogleBox(false);
                }}
                className={`py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'register'
                    ? 'bg-gradient-to-l from-indigo-600 to-cyan-600 text-white btn-solid-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{c.tabRegister}</span>
              </button>
            </div>
          )}

          {needsAdminSetup && (mode === 'login' || mode === 'register') && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] leading-relaxed">
              <strong>{c.adminNoticeTitle}</strong> {c.adminNoticeBody1}{' '}
              <span className="font-mono font-bold" dir="ltr">
                {ownerEmailHint}
              </span>{' '}
              {c.adminNoticeBody2}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{infoMsg}</span>
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <div className="space-y-2.5">
              {!showGoogleBox ? (
                <button
                  type="button"
                  onClick={() => setShowGoogleBox(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 text-xs font-extrabold flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                    />
                    <path
                      fill="#34A853"
                      d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                    />
                  </svg>
                  <span>{c.continueGoogle}</span>
                </button>
              ) : (
                <form
                  onSubmit={handleGoogleSignIn}
                  className="p-3.5 rounded-xl bg-[#070A12] border border-cyan-500/35 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-white">{c.googleQuickTitle}</span>
                    <button
                      type="button"
                      onClick={() => setShowGoogleBox(false)}
                      className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                    >
                      {c.back}
                    </button>
                  </div>
                  <input
                    type="email"
                    required
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    placeholder={c.gmailPh}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[#0B0F1A] border border-white/10 text-white"
                    dir="ltr"
                  />
                  <input
                    type="text"
                    value={googleName}
                    onChange={(e) => setGoogleName(e.target.value)}
                    placeholder={c.fullNameOptPh}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#0B0F1A] border border-white/10 text-white"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 rounded-lg bg-gradient-to-l from-indigo-600 to-cyan-600 text-white text-xs font-extrabold cursor-pointer btn-solid-white"
                  >
                    {loading ? c.verifying : c.confirmGoogle}
                  </button>
                </form>
              )}

              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <div className="h-px bg-white/10 flex-1" />
                <span>{c.orEmail}</span>
                <div className="h-px bg-white/10 flex-1" />
              </div>
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  {c.emailLabel}
                </label>
                <div className="relative">
                  <Mail className={`w-4 h-4 text-slate-400 absolute ${iconPos} top-1/2 -translate-y-1/2`} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className={`w-full ${inputPad} py-2.5 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white focus:outline-none focus:border-cyan-400`}
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-300">{c.passwordLabel}</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    className="text-[11px] font-bold text-cyan-400 hover:underline cursor-pointer"
                  >
                    {c.forgotLink}
                  </button>
                </div>
                <div className="relative">
                  <Lock className={`w-4 h-4 text-slate-400 absolute ${iconPos} top-1/2 -translate-y-1/2`} />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full ${inputPad} py-2.5 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white focus:outline-none focus:border-cyan-400`}
                    dir="ltr"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer btn-solid-white"
              >
                {loading ? c.verifying : c.submitLogin}
              </button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  {c.fullNameLabel}
                </label>
                <div className="relative">
                  <User className={`w-4 h-4 text-slate-400 absolute ${iconPos} top-1/2 -translate-y-1/2`} />
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder={c.fullNamePh}
                    className={`w-full ${inputPad} py-2.5 text-xs rounded-xl bg-[#070A12] border border-white/10 text-white focus:outline-none focus:border-cyan-400`}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  {c.emailLabel}
                </label>
                <div className="relative">
                  <Mail className={`w-4 h-4 text-slate-400 absolute ${iconPos} top-1/2 -translate-y-1/2`} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className={`w-full ${inputPad} py-2.5 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white focus:outline-none focus:border-cyan-400`}
                    dir="ltr"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {lang === 'tr'
                    ? 'Yalnızca güvenilir e-posta sağlayıcıları kabul edilir (Gmail, Hotmail, Outlook, iCloud, Yahoo, Proton).'
                    : lang === 'en'
                    ? 'Only trusted email providers are accepted (Gmail, Hotmail, Outlook, iCloud, Yahoo, Proton).'
                    : 'يُقبل التسجيل بالبريد الموثوق فقط (Gmail، Hotmail، Outlook، iCloud، Yahoo، Proton) وتُمنع الإيميلات المؤقتة.'}
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  {c.passwordMinLabel}
                </label>
                <div className="relative">
                  <Lock className={`w-4 h-4 text-slate-400 absolute ${iconPos} top-1/2 -translate-y-1/2`} />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full ${inputPad} py-2.5 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white focus:outline-none focus:border-cyan-400`}
                    dir="ltr"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer btn-solid-white"
              >
                {loading ? c.creatingAccount : c.submitRegister}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">{c.forgotDesc}</p>
              <div className="relative">
                <Mail className={`w-4 h-4 text-slate-400 absolute ${iconPos} top-1/2 -translate-y-1/2`} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className={`w-full ${inputPad} py-2.5 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white focus:outline-none focus:border-cyan-400`}
                  dir="ltr"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 text-white text-xs font-extrabold cursor-pointer btn-solid-white"
              >
                {loading ? c.sendingCode : c.sendCode}
              </button>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full py-2 text-xs font-bold text-slate-400 hover:text-white flex items-center justify-center gap-1 cursor-pointer"
              >
                <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? '' : 'rotate-180'}`} />
                <span>{c.backToLogin}</span>
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  {c.resetCodeLabel}
                </label>
                <div className="relative">
                  <KeyRound className={`w-4 h-4 text-slate-400 absolute ${iconPos} top-1/2 -translate-y-1/2`} />
                  <input
                    type="text"
                    required
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="123456"
                    className={`w-full ${inputPad} py-2.5 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white`}
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  {c.newPasswordLabel}
                </label>
                <div className="relative">
                  <Lock className={`w-4 h-4 text-slate-400 absolute ${iconPos} top-1/2 -translate-y-1/2`} />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full ${inputPad} py-2.5 text-xs font-mono rounded-xl bg-[#070A12] border border-white/10 text-white`}
                    dir="ltr"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer btn-solid-white"
              >
                {loading ? c.updating : c.saveNewPassword}
              </button>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full py-2 text-xs font-bold text-slate-400 hover:text-white flex items-center justify-center gap-1 cursor-pointer"
              >
                <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? '' : 'rotate-180'}`} />
                <span>{c.backToLogin}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
