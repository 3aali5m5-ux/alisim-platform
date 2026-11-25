import React from 'react';
import { X } from 'lucide-react';
import { ActiveSmsOrder, AppLanguage, SupportedCurrency } from '../types';
import { ExchangeRatesConfig } from '../services/hybridSyncEngine';
import { LiveOtpPanel } from './LiveOtpPanel';

interface OtpActivationModalProps {
  lang?: AppLanguage;
  isOpen: boolean;
  onClose: () => void;
  orders: ActiveSmsOrder[];
  currency: SupportedCurrency;
  rates: ExchangeRatesConfig;
  onOrderAction: (
    orderId: string,
    action: 'READY_1' | 'RETRY_3' | 'COMPLETE_6' | 'CANCEL_8' | 'SIMULATE_SMS'
  ) => Promise<void>;
  onSyncActiveFromGrizzly: () => Promise<void>;
  onOpenGuides?: () => void;
}

export const OtpActivationModal: React.FC<OtpActivationModalProps> = ({
  lang = 'ar',
  isOpen,
  onClose,
  orders,
  currency,
  rates,
  onOrderAction,
  onSyncActiveFromGrizzly,
  onOpenGuides,
}) => {
  if (!isOpen) return null;

  const isRtl = lang === 'ar';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl cyber-glass border border-cyan-500/45 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        <button
          type="button"
          onClick={onClose}
          aria-label={lang === 'tr' ? 'Kapat' : lang === 'en' ? 'Close' : 'إغلاق'}
          className={`absolute ${
            isRtl ? 'left-3' : 'right-3'
          } top-3 z-20 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center cursor-pointer`}
        >
          <X className="w-4 h-4" />
        </button>

        <div
          className={`flex-1 overflow-hidden flex flex-col ${
            isRtl ? '[&>div>div:first-child]:pl-12' : '[&>div>div:first-child]:pr-12'
          }`}
        >
          <LiveOtpPanel
            lang={lang}
            orders={orders}
            currency={currency}
            rates={rates}
            onOrderAction={onOrderAction}
            onSyncActiveFromGrizzly={onSyncActiveFromGrizzly}
            onOpenGuides={onOpenGuides}
          />
        </div>
      </div>
    </div>
  );
};
