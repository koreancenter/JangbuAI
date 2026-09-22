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
      className={`p-4 sm:p-5 rounded-3xl transition-all ${
        isLight 
          ? 'bg-slate-50/80 border border-slate-200/80 text-slate-900 shadow-xs' 
          : 'bg-white/[0.03] border border-white/10 text-white'
      }`}
    >
      {/* Top Header: Label */}
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-semibold ${
          isLight ? 'text-slate-600' : 'text-[#94A3B8]'
        }`}>
          이번 달 총 지출
        </span>
      </div>

      {/* Hero Number: Prominent Monthly Expense */}
      <div className="my-1.5">
        <div className={`text-3xl sm:text-4xl font-black tracking-tight transition-all ${
          isLight ? 'text-slate-950' : 'text-white'
        } ${isStealth ? 'blur-md select-none' : ''}`}>
          {currSymbol}{totalExpense.toLocaleString()}
        </div>
      </div>

      {/* Sub-metrics: Income & Net Balance (Merged clean row) */}
      <div className={`grid grid-cols-2 gap-3 mt-3 pt-3 border-t ${
        isLight ? 'border-slate-200/70' : 'border-white/5'
      }`}>
        {/* Total Income */}
        <div className="flex flex-col">
          <span className={`text-[11px] font-medium mb-0.5 ${
            isLight ? 'text-slate-500' : 'text-[#94A3B8]'
          }`}>
            총 수입
          </span>
          <span className={`text-sm sm:text-base font-bold transition-all ${
            isLight ? 'text-emerald-700' : 'text-[#00F5A0]'
          } ${isStealth ? 'blur-xs select-none' : ''}`}>
            +{currSymbol}{totalIncome.toLocaleString()}
          </span>
        </div>

        {/* Net Balance */}
        <div className="flex flex-col">
          <span className={`text-[11px] font-medium mb-0.5 ${
            isLight ? 'text-slate-500' : 'text-[#94A3B8]'
          }`}>
            순잔액
          </span>
          <span className={`text-sm sm:text-base font-bold transition-all ${
            netBalance >= 0 
              ? isLight ? 'text-slate-900' : 'text-white' 
              : isLight ? 'text-rose-600' : 'text-rose-400'
          } ${isStealth ? 'blur-xs select-none' : ''}`}>
            {netBalance >= 0 ? '+' : '-'}{currSymbol}{Math.abs(netBalance).toLocaleString()}
          </span>
        </div>
      </div>
    </section>
  );
};
