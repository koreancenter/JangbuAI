import React from 'react';
import { Check, Globe, RefreshCw, X, TrendingUp } from 'lucide-react';
import { SupportedCurrency, FxRates } from '../types';
import { SUPPORTED_CURRENCIES, DEFAULT_FX_RATES } from '../utils';

interface CurrencySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCurrency: SupportedCurrency;
  onSelectCurrency: (code: SupportedCurrency) => void;
  fxRates: FxRates;
  theme?: 'dark' | 'light';
}

export const CurrencySelectorModal: React.FC<CurrencySelectorModalProps> = ({
  isOpen,
  onClose,
  currentCurrency,
  onSelectCurrency,
  fxRates = DEFAULT_FX_RATES,
  theme = 'dark',
}) => {
  if (!isOpen) return null;
  const isLight = theme === 'light';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-sm rounded-3xl border shadow-2xl overflow-hidden transition-all ${
          isLight 
            ? 'bg-white border-slate-200 text-slate-900' 
            : 'bg-[#0E1526] border-white/10 text-white'
        }`}
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between ${
          isLight ? 'border-slate-100' : 'border-white/5'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
              isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-[#00F5A0]/10 border-[#00F5A0]/20 text-[#00F5A0]'
            }`}>
              <Globe size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">통화 선택 (Currency)</h3>
              <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-[#94A3B8]'}`}>
                대시보드 기준 표시 통화를 변경합니다
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`w-7 h-7 flex items-center justify-center rounded-xl transition-colors ${
              isLight ? 'text-slate-400 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Currency List */}
        <div className="p-4 space-y-2">
          {SUPPORTED_CURRENCIES.map((c) => {
            const isSelected = currentCurrency === c.code;
            const rateAgainstBase = fxRates.rates[c.code] || 1;
            
            // Format exchange rate against KRW for contextual reference
            let exchangeInfo = '';
            if (c.code === 'KRW') {
              exchangeInfo = '기준 통화 (Base)';
            } else if (c.code === 'USD') {
              const krwPerUsd = Math.round(1 / (rateAgainstBase || 0.00075));
              exchangeInfo = `1$ ≈ ₩${krwPerUsd.toLocaleString()}`;
            } else if (c.code === 'EUR') {
              const krwPerEur = Math.round(1 / (rateAgainstBase || 0.00069));
              exchangeInfo = `1€ ≈ ₩${krwPerEur.toLocaleString()}`;
            } else if (c.code === 'JPY') {
              const krwPer100Jpy = Math.round(100 / (rateAgainstBase || 0.113));
              exchangeInfo = `100¥ ≈ ₩${krwPer100Jpy.toLocaleString()}`;
            } else if (c.code === 'GBP') {
              const krwPerGbp = Math.round(1 / (rateAgainstBase || 0.00058));
              exchangeInfo = `1£ ≈ ₩${krwPerGbp.toLocaleString()}`;
            }

            return (
              <button
                key={c.code}
                onClick={() => {
                  onSelectCurrency(c.code);
                  onClose();
                }}
                className={`w-full px-3.5 py-3 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-[0.99] ${
                  isSelected
                    ? isLight
                      ? 'bg-emerald-50/80 border-emerald-500/80 text-emerald-950 shadow-sm'
                      : 'bg-white/[0.08] border-[#00F5A0]/50 text-white shadow-sm'
                    : isLight
                      ? 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-800'
                      : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/5 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl select-none">{c.flag}</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold">{c.nameKo}</span>
                      <span className={`text-[10px] font-mono px-1 rounded ${
                        isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-slate-300'
                      }`}>
                        {c.code} ({c.symbol})
                      </span>
                    </div>
                    <span className={`text-[11px] block mt-0.5 ${
                      isSelected
                        ? isLight ? 'text-emerald-700 font-medium' : 'text-[#00F5A0] font-medium'
                        : isLight ? 'text-slate-400' : 'text-[#94A3B8]'
                    }`}>
                      {exchangeInfo}
                    </span>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  isSelected
                    ? isLight ? 'bg-emerald-600 text-white' : 'bg-[#00F5A0] text-slate-950 font-bold'
                    : isLight ? 'border border-slate-200 text-transparent' : 'border border-white/10 text-transparent'
                }`}>
                  <Check size={12} strokeWidth={3} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer with FX rate sync notice */}
        <div className={`px-4 py-3 border-t text-[11px] flex items-center justify-between ${
          isLight ? 'bg-slate-50 border-slate-100 text-slate-500' : 'bg-black/20 border-white/5 text-[#94A3B8]'
        }`}>
          <div className="flex items-center gap-1">
            <RefreshCw size={11} className="text-emerald-500" />
            <span>실시간 환율 변환 적용 중</span>
          </div>
          <span className="font-mono text-[10px] opacity-75">
            {new Date(fxRates.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
};
