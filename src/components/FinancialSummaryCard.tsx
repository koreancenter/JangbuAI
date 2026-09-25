import React, { useMemo } from 'react';
import { Transaction, FxRates } from '../types';
import { subMonths, isSameMonth, isSameYear, parseISO, format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { convertCurrency, DEFAULT_FX_RATES, getCurrencySymbol } from '../utils';

interface FinancialSummaryCardProps {
  transactions: Transaction[];
  currencySymbol?: string;
  fxRates?: FxRates;
  isStealth?: boolean;
  theme?: 'light' | 'dark';
}

export const FinancialSummaryCard: React.FC<FinancialSummaryCardProps> = ({
  transactions,
  currencySymbol = 'KRW',
  fxRates = DEFAULT_FX_RATES,
  isStealth = false,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const currSymbol = getCurrencySymbol(currencySymbol);

  const summary = useMemo(() => {
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
      now,
      prevMonthDate,
      currentSpending,
      prevSpending,
      diff,
      status,
      percentChange,
      currentCount: currentMonthExpenses.length,
      prevCount: prevMonthExpenses.length,
    };
  }, [transactions, currencySymbol, fxRates]);

  const {
    now,
    prevMonthDate,
    currentSpending,
    prevSpending,
    diff,
    status,
    percentChange,
  } = summary;

  const currentMonthName = format(now, 'M월');
  const prevMonthName = format(prevMonthDate, 'M월');

  return (
    <section 
      id="financial-summary-card"
      className={`relative transition-all p-5 sm:p-6 rounded-2xl ${
        isLight 
          ? 'bg-white/80 backdrop-blur-xl border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.04)] text-slate-900' 
          : 'bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] text-white'
      }`}
    >
      {/* Top Header: Title & Subtle Status Badge */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`text-xs font-normal tracking-wide ${
              isLight ? 'text-slate-800' : 'text-slate-200'
            }`}>
              재무 요약
            </h3>
            <span className="text-slate-500 font-light text-xs">·</span>
            <span className={`text-xs font-light ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              월별 지출 비교
            </span>
          </div>
          <p className={`text-xs font-light mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {prevMonthName} 대비 {currentMonthName} 지출 변동
          </p>
        </div>

        {/* Quiet Luxury Status Indicator */}
        <div id="financial-status-indicator">
          {status === 'better' && (
            <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-light border tabular-nums ${
              isLight 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
            }`}>
              <span>절약</span>
              <span className="text-[11px] opacity-80">(-{percentChange}%)</span>
            </div>
          )}

          {status === 'worse' && (
            <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-light border tabular-nums ${
              isLight 
                ? 'bg-rose-50 text-rose-800 border-rose-200' 
                : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
            }`}>
              <span>초과</span>
              <span className="text-[11px] opacity-80">(+{percentChange}%)</span>
            </div>
          )}

          {status === 'neutral' && (
            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-light border ${
              isLight 
                ? 'bg-slate-100 text-slate-600 border-slate-200' 
                : 'bg-white/[0.04] text-slate-400 border-white/[0.06]'
            }`}>
              <span>유지</span>
            </div>
          )}
        </div>
      </div>

      {/* Clean hairline-divided comparison metrics */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t ${
        isLight ? 'border-slate-200/60' : 'border-white/[0.04]'
      }`}>
        {/* Previous Month Spending */}
        <div className="flex flex-col justify-between">
          <span className={`text-xs font-light ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}>
            지난달 ({prevMonthName})
          </span>
          <span className={`text-base font-light mt-1.5 tabular-nums ${
            isLight ? 'text-slate-700' : 'text-slate-300'
          } ${isStealth ? 'blur-xs select-none' : ''}`}>
            {currSymbol}{prevSpending.toLocaleString()}
          </span>
        </div>

        {/* Current Month Spending */}
        <div className="flex flex-col justify-between">
          <span className={`text-xs font-light ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}>
            이번 달 ({currentMonthName})
          </span>
          <span className={`text-base font-normal mt-1.5 tabular-nums ${
            status === 'better'
              ? isLight ? 'text-emerald-700' : 'text-emerald-300'
              : status === 'worse'
              ? isLight ? 'text-rose-700' : 'text-rose-300'
              : isLight ? 'text-slate-900' : 'text-white'
          } ${isStealth ? 'blur-xs select-none' : ''}`}>
            {currSymbol}{currentSpending.toLocaleString()}
          </span>
        </div>

        {/* Difference Amount */}
        <div className="col-span-2 sm:col-span-1 flex flex-col justify-between">
          <span className={`text-xs font-light ${
            status === 'better'
              ? isLight ? 'text-emerald-700' : 'text-emerald-400'
              : status === 'worse'
              ? isLight ? 'text-rose-700' : 'text-rose-400'
              : isLight ? 'text-slate-500' : 'text-slate-400'
          }`}>
            전월 대비 변동
          </span>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className={`text-base font-medium tabular-nums ${
              status === 'better'
                ? isLight ? 'text-emerald-700' : 'text-emerald-300'
                : status === 'worse'
                ? isLight ? 'text-rose-700' : 'text-rose-300'
                : isLight ? 'text-slate-800' : 'text-white'
            } ${isStealth ? 'blur-xs select-none' : ''}`}>
              {diff > 0 ? '+' : diff < 0 ? '-' : ''}{currSymbol}{Math.abs(diff).toLocaleString()}
            </span>
            {percentChange > 0 && (
              <span className={`text-xs font-light tabular-nums ${
                status === 'better' ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : 'text-slate-400'
              }`}>
                ({diff < 0 ? '▼' : '▲'}{percentChange}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Insight Statement */}
      <div className={`mt-3.5 pt-3 border-t flex items-center gap-2 text-xs font-light ${
        isLight ? 'border-slate-200/60 text-slate-600' : 'border-white/[0.04] text-slate-400'
      }`}>
        <ArrowRight size={12} className={`shrink-0 ${
          status === 'better' 
            ? isLight ? 'text-emerald-600' : 'text-emerald-400' 
            : status === 'worse'
            ? isLight ? 'text-rose-600' : 'text-rose-400'
            : 'text-slate-400'
        }`} />
        <p className="leading-relaxed">
          {status === 'better' && (
            <span>
              지난달 대비 <span className="text-emerald-400 font-normal">{currSymbol}{Math.abs(diff).toLocaleString()}</span> 절약하여 안정적인 소비 기조를 유지하고 있습니다.
            </span>
          )}
          {status === 'worse' && (
            <span>
              지난달 대비 <span className="text-rose-400 font-normal">{currSymbol}{Math.abs(diff).toLocaleString()}</span> 지출이 증가했습니다. 고정비 및 식비 내역을 확인해 보세요.
            </span>
          )}
          {status === 'neutral' && (
            <span>
              지난달과 동일하거나 비교 데이터가 축적되는 중입니다.
            </span>
          )}
        </p>
      </div>
    </section>
  );
};
