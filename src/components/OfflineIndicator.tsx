import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { AppLanguage } from '../types';

interface OfflineIndicatorProps {
  lang?: AppLanguage;
}

const OFFLINE_TEXT: Record<AppLanguage, string> = {
  ar: 'أنت غير متصل بالإنترنت — يتم عرض البيانات المخزّنة محلياً',
  tr: 'İnternet bağlantısı yok — önbelleğe alınmış veriler gösteriliyor',
  en: 'You are offline — showing locally cached data',
};

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ lang = 'ar' }) => {
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-xl bg-amber-600 text-white shadow-2xl border border-amber-400/60 flex items-center gap-2 text-xs font-extrabold btn-solid-white"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>{OFFLINE_TEXT[lang]}</span>
    </div>
  );
};
