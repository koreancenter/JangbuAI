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
  }, [transactions]);

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
      className={`relative transition-all py-1 ${
        isLight ? 'text-slate-900' : 'text-white'
      }`}
    >
      {/* Top Header: Title & Better/Worse Status Badge */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2.5">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className={`text-xs font-bold tracking-tight ${
                isLight ? 'text-slate-900' : 'text-slate-100'
              }`}>
                재무 요약
              </h3>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-[#94A3B8]'
              }`}>
                월별 지출 비교
              </span>
            </div>
            <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#94A3B8]'}`}>
              {prevMonthName} 대비 {currentMonthName} 지출 증감
            </p>
          </div>
        </div>

        {/* Quick 'Better' or 'Worse' Indicator Pill */}
        <div id="financial-status-indicator">
          {status === 'better' && (
            <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
              isLight 
                ? 'bg-emerald-50 text-emerald-800' 
                : 'bg-[#00F5A0]/15 text-[#00F5A0]'
            }`}>
              <span>절약</span>
              <span className="text-[10px] font-semibold opacity-90">(-{percentChange}%)</span>
            </div>
          )}

          {status === 'worse' && (
            <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              isLight 
                ? 'bg-slate-100 text-slate-700' 
                : 'bg-slate-800 text-slate-300'
            }`}>
              <span>초과</span>
              <span className="text-[10px] font-semibold opacity-90">(+{percentChange}%)</span>
            </div>
          )}

          {status === 'neutral' && (
            <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              isLight 
                ? 'bg-slate-100 text-slate-600' 
                : 'bg-white/10 text-slate-300'
            }`}>
              <span>동일</span>
            </div>
          )}
        </div>
      </div>

      {/* Flat Single-Surface Comparison Metrics without box-in-box and horizontal divider lines */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
        {/* Previous Month Spending */}
        <div className="flex flex-col justify-between">
          <span className={`text-[11px] font-medium ${
            isLight ? 'text-slate-500' : 'text-[#94A3B8]'
          }`}>
            지난달 ({prevMonthName})
          </span>
          <span className={`text-base font-bold mt-1 ${
            isLight ? 'text-slate-800' : 'text-slate-200'
          } ${isStealth ? 'blur-xs select-none' : ''}`}>
            {currSymbol}{prevSpending.toLocaleString()}
          </span>
        </div>

        {/* Current Month Spending */}
        <div className="flex flex-col justify-between">
          <span className={`text-[11px] font-medium ${
            isLight ? 'text-slate-500' : 'text-[#94A3B8]'
          }`}>
            이번 달 ({currentMonthName})
          </span>
          <span className={`text-base font-bold mt-1 ${
            status === 'better'
              ? isLight ? 'text-emerald-700' : 'text-[#00F5A0]'
              : status === 'worse'
              ? isLight ? 'text-slate-900' : 'text-white'
              : isLight ? 'text-slate-900' : 'text-white'
          } ${isStealth ? 'blur-xs select-none' : ''}`}>
            {currSymbol}{currentSpending.toLocaleString()}
          </span>
        </div>

        {/* Difference Amount */}
        <div className="col-span-2 sm:col-span-1 flex flex-col justify-between">
          <span className={`text-[11px] font-medium ${
            status === 'better'
              ? isLight ? 'text-emerald-800' : 'text-emerald-400'
              : status === 'worse'
              ? isLight ? 'text-slate-600' : 'text-slate-300'
              : isLight ? 'text-slate-500' : 'text-[#94A3B8]'
          }`}>
            전월 대비 변동
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className={`text-base font-bold ${
              status === 'better'
                ? isLight ? 'text-emerald-700' : 'text-[#00F5A0]'
                : status === 'worse'
                ? isLight ? 'text-slate-800' : 'text-slate-200'
                : isLight ? 'text-slate-800' : 'text-white'
            } ${isStealth ? 'blur-xs select-none' : ''}`}>
              {diff > 0 ? '+' : diff < 0 ? '-' : ''}{currSymbol}{Math.abs(diff).toLocaleString()}
            </span>
            {percentChange > 0 && (
              <span className={`text-[11px] font-medium ${
                status === 'better' ? (isLight ? 'text-emerald-700' : 'text-[#00F5A0]') : 'text-slate-500'
              }`}>
                ({diff < 0 ? '▼' : '▲'}{percentChange}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Insight Statement */}
      <div className="mt-2.5 flex items-center gap-2 text-xs">
        <ArrowRight size={12} className={`shrink-0 ${
          status === 'better' 
            ? isLight ? 'text-emerald-600' : 'text-[#00F5A0]' 
            : 'text-slate-400'
        }`} />
        <p className={`text-[11px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#94A3B8]'}`}>
          {status === 'better' && (
            <span>
              지난달보다 <strong className="text-emerald-600 font-bold">{currSymbol}{Math.abs(diff).toLocaleString()}</strong> 절약하여 안정적으로 예산을 유지하고 있습니다.
            </span>
          )}
          {status === 'worse' && (
            <span>
              지난달 대비 <strong className="font-semibold text-slate-800 dark:text-slate-200">{currSymbol}{Math.abs(diff).toLocaleString()}</strong> 지출이 늘었습니다. 고정비와 외식 지출 내역을 확인해보세요.
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
