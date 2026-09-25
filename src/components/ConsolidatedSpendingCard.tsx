import React from 'react';
import { Transaction, FxRates } from '../types';
import { DEFAULT_FX_RATES, getCurrencySymbol } from '../utils';

interface ConsolidatedSpendingCardProps {
  transactions: Transaction[];
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  currencySymbol?: string;
  fxRates?: FxRates;
  isStealth?: boolean;
  theme?: 'light' | 'dark';
}

export const ConsolidatedSpendingCard: React.FC<ConsolidatedSpendingCardProps> = ({
  totalIncome,
  totalExpense,
  netBalance,
  currencySymbol = 'KRW',
  isStealth = false,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const currSymbol = getCurrencySymbol(currencySymbol);

  return (
    <section 
      id="consolidated-spending-card"
      className={`p-5 sm:p-6 rounded-2xl transition-all ${
        isLight 
          ? 'bg-white/80 backdrop-blur-xl border border-slate-200/80 text-slate-900 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.04)]' 
          : 'bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] text-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)]'
      }`}
    >
      {/* Top Header: Label */}
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-light tracking-wide ${
          isLight ? 'text-slate-500' : 'text-slate-400'
        }`}>
          이번 달 총 지출
        </span>
      </div>

      {/* Hero Number: Light, Sharp & Tabular Numbers */}
      <div className="my-2">
        <div className={`text-3xl md:text-4xl font-light tracking-tight tabular-nums transition-all ${
          isLight ? 'text-slate-900' : 'text-white'
        } ${isStealth ? 'blur-md select-none' : ''}`}>
          {currSymbol}{totalExpense.toLocaleString()}
        </div>
      </div>

      {/* Sub-metrics: Income & Net Balance with hairline border */}
      <div className={`grid grid-cols-2 gap-4 mt-4 pt-3.5 border-t ${
        isLight ? 'border-slate-200/60' : 'border-white/[0.04]'
      }`}>
        {/* Total Income */}
        <div className="flex flex-col">
          <span className={`text-xs font-light mb-0.5 ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}>
            총 수입
          </span>
          <span className={`text-sm sm:text-base font-normal tabular-nums transition-all ${
            isLight ? 'text-emerald-700' : 'text-emerald-300'
          } ${isStealth ? 'blur-xs select-none' : ''}`}>
            +{currSymbol}{totalIncome.toLocaleString()}
          </span>
        </div>

        {/* Net Balance */}
        <div className="flex flex-col">
          <span className={`text-xs font-light mb-0.5 ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}>
            순잔액
          </span>
          <span className={`text-sm sm:text-base font-normal tabular-nums transition-all ${
            netBalance >= 0 
              ? isLight ? 'text-slate-800' : 'text-slate-200' 
              : isLight ? 'text-rose-700' : 'text-rose-400'
          } ${isStealth ? 'blur-xs select-none' : ''}`}>
            {netBalance >= 0 ? '+' : '-'}{currSymbol}{Math.abs(netBalance).toLocaleString()}
          </span>
        </div>
      </div>
    </section>
  );
};
