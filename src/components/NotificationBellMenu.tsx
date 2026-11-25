import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Volume2,
  VolumeX,
  CheckCheck,
  Trash2,
  KeyRound,
  Wallet,
  Headphones,
  ShoppingBag,
  Megaphone,
  X,
  BellRing,
  BellOff,
} from 'lucide-react';
import { AppLanguage, PlatformNotification } from '../types';
import { useAutoTranslateBatch } from '../services/dynamicTranslator';
import {
  getWebPushPermissionState,
  isWebPushEnabledLocally,
  requestAndEnableWebPush,
  disableWebPush,
  dispatchSystemPushNotification,
} from '../services/webPushService';

interface NotificationBellMenuProps {
  lang?: AppLanguage;
  authToken?: string | null;
  notifications: PlatformNotification[];
  isMuted: boolean;
  onToggleMute: () => void;
  onMarkAllRead: () => void;
  onMarkOneRead: (id: string) => void;
  onClearAll: () => void;
}

const NOTIF_COPY: Record<
  AppLanguage,
  {
    title: string;
    newBadge: string;
    unmuteTitle: string;
    muteTitle: string;
    markAllTitle: string;
    clearAllTitle: string;
    soundLabel: string;
    muted: string;
    enabled: string;
    readAll: string;
    emptyTitle: string;
    emptyDesc: string;
    pushLabel: string;
    pushOn: string;
    pushEnable: string;
    pushDenied: string;
    pushUnsupported: string;
    pushTestTitle: string;
    pushTestBody: string;
  }
> = {
  ar: {
    title: 'الإشعارات',
    newBadge: 'جديد',
    unmuteTitle: 'تفعيل صوت التنبيهات',
    muteTitle: 'كتم صوت التنبيهات',
    markAllTitle: 'تحديد الكل كمقروء',
    clearAllTitle: 'مسح جميع الإشعارات',
    soundLabel: 'صوت التنبيهات:',
    muted: 'مكتوم 🔇',
    enabled: 'مفعّل 🔔',
    readAll: 'قراءة الكل',
    emptyTitle: 'لا توجد إشعارات بعد',
    emptyDesc: 'ستظهر هنا جميع تنبيهات وصول الأكواد، شحن الرصيد، وردود الدعم الفني فورياً.',
    pushLabel: 'إشعارات الدفع الفوري (Push):',
    pushOn: 'مفعّلة ✓',
    pushEnable: 'تفعيل Push',
    pushDenied: 'محظورة من المتصفح',
    pushUnsupported: 'غير مدعوم',
    pushTestTitle: 'تم تفعيل الإشعارات الفورية بنجاح',
    pushTestBody: 'ستصلك تنبيهات وصول الأكواد وشحن الرصيد والردود حتى في الخلفية.',
  },
  tr: {
    title: 'Bildirimler',
    newBadge: 'yeni',
    unmuteTitle: 'Bildirim sesini aç',
    muteTitle: 'Bildirim sesini kapat',
    markAllTitle: 'Tümünü okundu işaretle',
    clearAllTitle: 'Tüm bildirimleri temizle',
    soundLabel: 'Bildirim sesi:',
    muted: 'Sessiz 🔇',
    enabled: 'Açık 🔔',
    readAll: 'Tümünü Oku',
    emptyTitle: 'Henüz bildirim yok',
    emptyDesc: 'Gelen OTP kodları, bakiye yüklemeleri ve destek yanıtları anında burada görünür.',
    pushLabel: 'Anlık Bildirimler (Push):',
    pushOn: 'Aktif ✓',
    pushEnable: 'Push Aç',
    pushDenied: 'Tarayıcıda engelli',
    pushUnsupported: 'Desteklenmiyor',
    pushTestTitle: 'Anlık Bildirimler Etkinleştirildi',
    pushTestBody: 'OTP kodları, bakiye onayları ve destek mesajları anında cihazınıza ulaşacak.',
  },
  en: {
    title: 'Notifications',
    newBadge: 'new',
    unmuteTitle: 'Unmute alert sounds',
    muteTitle: 'Mute alert sounds',
    markAllTitle: 'Mark all as read',
    clearAllTitle: 'Clear all notifications',
    soundLabel: 'Alert sound:',
    muted: 'Muted 🔇',
    enabled: 'On 🔔',
    readAll: 'Read All',
    emptyTitle: 'No notifications yet',
    emptyDesc: 'All incoming OTP codes, wallet top-ups, and support replies appear here instantly.',
    pushLabel: 'Web Push Alerts:',
    pushOn: 'Active ✓',
    pushEnable: 'Enable Push',
    pushDenied: 'Blocked in browser',
    pushUnsupported: 'Unsupported',
    pushTestTitle: 'Push Notifications Enabled',
    pushTestBody: 'You will now receive instant OTP, wallet, and support alerts even in background.',
  },
};

export const NotificationBellMenu: React.FC<NotificationBellMenuProps> = ({
  lang = 'ar',
  authToken,
  notifications,
  isMuted,
  onToggleMute,
  onMarkAllRead,
  onMarkOneRead,
  onClearAll,
}) => {
  const c = NOTIF_COPY[lang];
  const isRtl = lang === 'ar';
  const locale = lang === 'ar' ? 'ar-SY' : lang === 'tr' ? 'tr-TR' : 'en-US';
  const [open, setOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => isWebPushEnabledLocally());
  const [pushPerm, setPushPerm] = useState(() => getWebPushPermissionState());
  const [togglingPush, setTogglingPush] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const translateNotif = useAutoTranslateBatch(
    notifications.slice(0, 40).flatMap((n) => [n.titleAr, n.bodyAr]),
    lang
  );

  const handleToggleWebPush = async () => {
    setTogglingPush(true);
    try {
      if (pushEnabled) {
        await disableWebPush(authToken);
        setPushEnabled(false);
      } else {
        const res = await requestAndEnableWebPush(authToken);
        setPushPerm(res.permission);
        setPushEnabled(res.ok);
        if (res.ok) {
          dispatchSystemPushNotification({
            title: c.pushTestTitle,
            body: c.pushTestBody,
            tag: 'alisim-push-welcome',
          });
        }
      }
    } finally {
      setTogglingPush(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const renderCategoryIcon = (category: PlatformNotification['category']) => {
    switch (category) {
      case 'otp':
        return (
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <KeyRound className="w-4 h-4" />
          </div>
        );
      case 'wallet':
        return (
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
        );
      case 'support':
        return (
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Headphones className="w-4 h-4" />
          </div>
        );
      case 'order':
        return (
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <Megaphone className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-200 hover:text-cyan-400 transition-colors cursor-pointer"
        title={c.title}
        aria-label={c.title}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white font-mono text-[10px] font-black flex items-center justify-center ring-2 ring-[#06080E]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`fixed sm:absolute left-3 right-3 ${
            isRtl ? 'sm:right-auto sm:left-0' : 'sm:left-auto sm:right-0'
          } top-16 sm:top-full sm:mt-2 sm:w-[360px] dropdown-solid rounded-2xl border border-cyan-500/35 shadow-2xl z-50 overflow-hidden flex flex-col max-h-[75vh]`}
        >
          {/* Header */}
          <div className="px-3.5 py-3 bg-[#070A12] border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-black text-white">{c.title}</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-black">
                  {unreadCount} {c.newBadge}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleMute}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isMuted
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                    : 'bg-white/5 border-white/10 text-emerald-400 hover:bg-white/10'
                }`}
                title={isMuted ? c.unmuteTitle : c.muteTitle}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-400 cursor-pointer"
                  title={c.markAllTitle}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 border border-white/10 text-slate-400 hover:text-rose-400 cursor-pointer"
                  title={c.clearAllTitle}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="sm:hidden p-1.5 rounded-lg bg-white/5 text-slate-400 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Sound & Web Push Status Strip */}
          <div className="px-3.5 py-2 bg-[#090D18]/85 border-b border-white/5 space-y-1.5 text-[10px] text-slate-400">
            <div className="flex items-center justify-between gap-2">
              <span>
                {c.soundLabel} {isMuted ? c.muted : c.enabled}
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="text-cyan-400 hover:underline font-bold cursor-pointer"
                >
                  {c.readAll}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
              <span className="flex items-center gap-1 text-slate-300 font-semibold">
                {pushEnabled ? (
                  <BellRing className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : (
                  <BellOff className="w-3 h-3 text-slate-400 shrink-0" />
                )}
                <span>{c.pushLabel}</span>
              </span>

              {pushPerm === 'unsupported' ? (
                <span className="text-slate-500">{c.pushUnsupported}</span>
              ) : pushPerm === 'denied' ? (
                <span className="text-rose-400 font-bold">{c.pushDenied}</span>
              ) : (
                <button
                  type="button"
                  disabled={togglingPush}
                  onClick={handleToggleWebPush}
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold transition-colors cursor-pointer ${
                    pushEnabled
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-400/40'
                      : 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/30'
                  }`}
                >
                  {pushEnabled ? c.pushOn : c.pushEnable}
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-2">
                <Bell className="w-7 h-7 text-slate-500 mx-auto opacity-60" />
                <div className="text-xs font-bold text-slate-300">{c.emptyTitle}</div>
                <p className="text-[11px] text-slate-400">{c.emptyDesc}</p>
              </div>
            ) : (
              notifications.slice(0, 40).map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => onMarkOneRead(notif.id)}
                  className={`p-3 flex items-start gap-2.5 transition-colors cursor-pointer ${
                    notif.isRead ? 'hover:bg-white/5' : 'bg-indigo-500/10 hover:bg-indigo-500/15'
                  }`}
                >
                  {renderCategoryIcon(notif.category)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-extrabold text-white truncate">
                        {translateNotif(notif.titleAr)}
                      </div>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5 break-words">
                      {translateNotif(notif.bodyAr)}
                    </p>
                    <div className="text-[10px] font-mono text-slate-500 mt-1">
                      {new Date(notif.createdAt).toLocaleTimeString(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {new Date(notif.createdAt).toLocaleDateString(locale)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
