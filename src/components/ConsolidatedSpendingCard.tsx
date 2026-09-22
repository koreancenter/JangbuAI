import React, { useMemo } from 'react';
import { Transaction, FxRates } from '../types';
import { subMonths, isSameMonth, isSameYear, parseISO, format } from 'date-fns';
import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';
import { convertCurrency, DEFAULT_FX_RATES, getCurrencySymbol } from '../utils';

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
  transactions,
  totalIncome,
  totalExpense,
  netBalance,
  currencySymbol = 'KRW',
  fxRates = DEFAULT_FX_RATES,
  isStealth = false,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const currSymbol = getCurrencySymbol(currencySymbol);

  const momMetrics = useMemo(() => {
    const now = new Date();
    const prevMonthDate = subMonths(now, 1);

    const getAmountInTarget = (t: Transaction) => {
      const fromCurr = t.currency || 'KRW';
      return convertCurrency(t.amount, fromCurr, currencySymbol, fxRates);
    };

    // Current month expenses
    const currentMonthExpenses = transactions.filter((t) => {
      try {
        const d = parseISO(t.date);
        return t.type === 'EXPENSE' && isSameMonth(d, now) && isSameYear(d, now);
      } catch {
        return false;
      }
    });
    const currentSpending = currentMonthExpenses.reduce((acc, t) => acc + getAmountInTarget(t), 0);

    // Previous month expenses
    const prevMonthExpenses = transactions.filter((t) => {
      try {
        const d = parseISO(t.date);
        return t.type === 'EXPENSE' && isSameMonth(d, prevMonthDate) && isSameYear(d, prevMonthDate);
      } catch {
        return false;
      }
    });
    const prevSpending = prevMonthExpenses.reduce((acc, t) => acc + getAmountInTarget(t), 0);

    const diff = currentSpending - prevSpending;

    let status: 'better' | 'worse' | 'neutral' = 'neutral';
    let percentChange = 0;

    if (prevSpending === 0 && currentSpending === 0) {
      status = 'neutral';
      percentChange = 0;
    } else if (prevSpending === 0) {
      status = 'worse';
      percentChange = 100;
    } else {
      percentChange = Math.round((Math.abs(diff) / prevSpending) * 100);
      if (diff < 0) {
        status = 'better'; // Spent less than previous month
      } else if (diff > 0) {
        status = 'worse'; // Spent more than previous month
      } else {
        status = 'neutral';
      }
    }

    return {
      status,
      diff,
      percentChange,
    };
  }, [transactions, currencySymbol, fxRates]);

  const { status, diff, percentChange } = momMetrics;

  return (
    <section 
      id="consolidated-spending-card"
      className={`p-4 sm:p-5 rounded-3xl transition-all ${
        isLight 
          ? 'bg-slate-50/80 border border-slate-200/80 text-slate-900 shadow-xs' 
          : 'bg-white/[0.03] border border-white/10 text-white'
      }`}
    >
      {/* Top Header: Label & MoM Pill Badge */}
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-semibold flex items-center gap-1.5 ${
          isLight ? 'text-slate-600' : 'text-[#94A3B8]'
        }`}>
          <span>이번 달 총 지출</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
            isLight ? 'bg-slate-200/60 text-slate-600' : 'bg-white/5 text-[#94A3B8]'
          }`}>
            {format(new Date(), 'M월')}
          </span>
        </span>

        {/* Sleek MoM Pill Badge */}
        {status === 'better' && (
          <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
            isLight 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60' 
              : 'bg-[#00F5A0]/15 text-[#00F5A0] border border-[#00F5A0]/30'
          }`}>
            <span>-{percentChange}%</span>
            <span className="text-[10px] font-medium opacity-80">vs 지난달</span>
          </div>
        )}

        {status === 'worse' && (
          <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            isLight 
              ? 'bg-rose-50 text-rose-700 border border-rose-200/60' 
              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
          }`}>
            <span>+{percentChange}%</span>
            <span className="text-[10px] font-medium opacity-80">vs 지난달</span>
          </div>
        )}

        {status === 'neutral' && (
          <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
            isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-slate-300'
          }`}>
            <span>0% vs 지난달</span>
          </div>
        )}
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
          <span className={`text-[11px] font-medium flex items-center gap-1 mb-0.5 ${
            isLight ? 'text-slate-500' : 'text-[#94A3B8]'
          }`}>
            <ArrowUpRight size={13} className={isLight ? 'text-emerald-600' : 'text-[#00F5A0]'} />
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
          <span className={`text-[11px] font-medium flex items-center gap-1 mb-0.5 ${
            isLight ? 'text-slate-500' : 'text-[#94A3B8]'
          }`}>
            <Scale size={13} className={isLight ? 'text-slate-600' : 'text-slate-400'} />
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
