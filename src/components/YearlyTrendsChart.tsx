import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid
} from 'recharts';
import { Transaction, ChartPaletteType } from '../types';
import { 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  format, 
  parseISO, 
  isSameMonth, 
  isSameYear 
} from 'date-fns';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CalendarRange, 
  Wallet,
  CheckCircle2
} from 'lucide-react';
import { getChartPalette } from '../themePalettes';

interface YearlyTrendsChartProps {
  transactions: Transaction[];
  currencySymbol?: string;
  isStealth?: boolean;
  theme?: 'light' | 'dark';
  embedded?: boolean;
  chartPalette?: ChartPaletteType;
}

export const YearlyTrendsChart: React.FC<YearlyTrendsChartProps> = ({
  transactions,
  currencySymbol = 'KRW',
  isStealth = false,
  theme = 'dark',
  embedded = false,
  chartPalette = 'default',
}) => {
  const isLight = theme === 'light';
  const palette = getChartPalette(chartPalette);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  const currSymbol = currencySymbol === 'KRW' ? '₩' : currencySymbol === 'USD' ? '$' : `${currencySymbol} `;

  // Generate trailing 12 months data
  const { 
    chartData, 
    total12mIncome, 
    total12mExpense, 
    net12mSavings, 
    avgMonthlyIncome, 
    avgMonthlyExpense,
    savingsRate 
  } = useMemo(() => {
    const now = new Date();
    const monthsList: Date[] = [];
    for (let i = 11; i >= 0; i--) {
      monthsList.push(subMonths(now, i));
    }

    let sumIncome = 0;
    let sumExpense = 0;
    let activeMonthsCount = 0;

    const data = monthsList.map((mDate) => {
      const monthKey = format(mDate, 'yyyy-MM');
      const monthLabel = format(mDate, 'M월');
      const yearMonthLabel = format(mDate, 'yyyy.MM');
      const fullLabel = format(mDate, 'yyyy년 M월');
      const isCurrent = isSameMonth(now, mDate) && isSameYear(now, mDate);

      // Filter transactions for this specific month
      const monthTxs = transactions.filter((t) => {
        try {
          const d = parseISO(t.date);
          return isSameMonth(d, mDate) && isSameYear(d, mDate);
        } catch {
          return false;
        }
      });

      const income = monthTxs
        .filter((t) => t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);

      const expense = monthTxs
        .filter((t) => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);

      const net = income - expense;
      const count = monthTxs.length;

      sumIncome += income;
      sumExpense += expense;
      if (count > 0) activeMonthsCount++;

      return {
        monthKey,
        label: monthLabel,
        yearMonthLabel,
        fullLabel,
        income,
        expense,
        net,
        count,
        isCurrent,
      };
    });

    const netSavings = sumIncome - sumExpense;
    const rate = sumIncome > 0 ? Math.round((netSavings / sumIncome) * 100) : 0;
    const effectiveDivisor = Math.max(1, activeMonthsCount > 0 ? activeMonthsCount : 12);

    return {
      chartData: data,
      total12mIncome: sumIncome,
      total12mExpense: sumExpense,
      net12mSavings: netSavings,
      avgMonthlyIncome: Math.round(sumIncome / 12),
      avgMonthlyExpense: Math.round(sumExpense / 12),
      savingsRate: rate,
    };
  }, [transactions]);

  const selectedMonthData = useMemo(() => {
    if (!selectedMonthKey) return null;
    return chartData.find((d) => d.monthKey === selectedMonthKey) || null;
  }, [selectedMonthKey, chartData]);

  // Custom Tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isPositiveNet = data.net >= 0;
      return (
        <div className={`border rounded-2xl p-3 shadow-2xl text-xs backdrop-blur-xl pointer-events-none z-50 min-w-44 ${
          isLight 
            ? 'bg-white/95 border-slate-300 text-slate-900 shadow-slate-300/60' 
            : 'bg-[#0E1524]/95 border-white/10 text-white shadow-black/80'
        }`}>
          <div className={`flex items-center justify-between gap-3 pb-1.5 border-b ${
            isLight ? 'border-slate-200' : 'border-white/10'
          }`}>
            <span className="font-bold">{data.fullLabel}</span>
            {data.isCurrent && (
              <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-[#00F5A0]/20 text-[#00F5A0]'
              }`}>
                이번 달
              </span>
            )}
          </div>

          <div className="pt-2 space-y-1.5">
            {/* Income */}
            <div className="flex items-center justify-between gap-4">
              <span className={`flex items-center gap-1.5 ${isLight ? 'text-slate-600' : 'text-[#94A3B8]'}`}>
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> 수입
              </span>
              <span className={`font-bold text-emerald-600 ${isStealth ? 'blur-xs select-none' : ''}`}>
                +{currSymbol}{data.income.toLocaleString()}
              </span>
            </div>

            {/* Expense */}
            <div className="flex items-center justify-between gap-4">
              <span className={`flex items-center gap-1.5 ${isLight ? 'text-slate-600' : 'text-[#94A3B8]'}`}>
                <span className="w-2 h-2 rounded-full bg-rose-500" /> 지출
              </span>
              <span className={`font-bold text-rose-500 ${isStealth ? 'blur-xs select-none' : ''}`}>
                -{currSymbol}{data.expense.toLocaleString()}
              </span>
            </div>

            {/* Net Cash Flow */}
            <div className={`pt-1 border-t flex items-center justify-between gap-4 ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              <span className={`font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                순수익
              </span>
              <span className={`font-extrabold ${isPositiveNet ? (isLight ? 'text-emerald-700' : 'text-[#00F5A0]') : 'text-rose-500'} ${
                isStealth ? 'blur-xs select-none' : ''
              }`}>
                {isPositiveNet ? '+' : ''}{currSymbol}{data.net.toLocaleString()}
              </span>
            </div>

            {/* Transaction count */}
            <div className={`text-[10px] flex items-center justify-between pt-0.5 ${
              isLight ? 'text-slate-500' : 'text-[#94A3B8]/70'
            }`}>
              <span>총 거래 건수</span>
              <span>{data.count}건</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={embedded ? "space-y-3" : "p-4 rounded-3xl border shadow-xl backdrop-blur-xl transition-all"}>
      {/* 12-Month Micro Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Total Income */}
        <div className={`p-2.5 rounded-2xl border flex flex-col justify-between ${
          isLight ? 'bg-emerald-50/60 border-emerald-200' : 'bg-emerald-950/20 border-emerald-500/20'
        }`}>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className={`flex items-center gap-1 font-medium ${isLight ? 'text-emerald-800' : 'text-emerald-400'}`}>
              <ArrowUpRight size={13} /> 최근 1년 수입
            </span>
          </div>
          <span className={`text-sm font-extrabold ${isLight ? 'text-emerald-700' : 'text-[#00F5A0]'} ${
            isStealth ? 'blur-xs select-none' : ''
          }`}>
            +{currSymbol}{total12mIncome.toLocaleString()}
          </span>
          <span className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#94A3B8]'}`}>
            월평균 {currSymbol}{avgMonthlyIncome.toLocaleString()}
          </span>
        </div>

        {/* Total Expense */}
        <div className={`p-2.5 rounded-2xl border flex flex-col justify-between ${
          isLight ? 'bg-rose-50/60 border-rose-200' : 'bg-rose-950/20 border-rose-500/20'
        }`}>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className={`flex items-center gap-1 font-medium ${isLight ? 'text-rose-800' : 'text-rose-400'}`}>
              <ArrowDownLeft size={13} /> 최근 1년 지출
            </span>
          </div>
          <span className={`text-sm font-extrabold text-rose-500 ${isStealth ? 'blur-xs select-none' : ''}`}>
            -{currSymbol}{total12mExpense.toLocaleString()}
          </span>
          <span className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#94A3B8]'}`}>
            월평균 {currSymbol}{avgMonthlyExpense.toLocaleString()}
          </span>
        </div>

        {/* Net Savings */}
        <div className={`p-2.5 rounded-2xl border flex flex-col justify-between ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/10'
        }`}>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className={`flex items-center gap-1 font-medium ${isLight ? 'text-slate-600' : 'text-[#94A3B8]'}`}>
              <Wallet size={13} className="text-indigo-400" /> 순수익 (저축)
            </span>
          </div>
          <span className={`text-sm font-extrabold ${
            net12mSavings >= 0 
              ? (isLight ? 'text-indigo-600' : 'text-indigo-400') 
              : 'text-rose-500'
          } ${isStealth ? 'blur-xs select-none' : ''}`}>
            {net12mSavings >= 0 ? '+' : ''}{currSymbol}{net12mSavings.toLocaleString()}
          </span>
          <span className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#94A3B8]'}`}>
            저축률 {savingsRate}%
          </span>
        </div>

        {/* Trend Verdict */}
        <div className={`p-2.5 rounded-2xl border flex flex-col justify-between ${
          isLight ? 'bg-indigo-50/50 border-indigo-200' : 'bg-indigo-950/20 border-indigo-500/20'
        }`}>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className={`flex items-center gap-1 font-medium ${isLight ? 'text-indigo-800' : 'text-indigo-300'}`}>
              <CalendarRange size={13} /> 집계 기간
            </span>
          </div>
          <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            최근 12개월
          </span>
          <span className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#94A3B8]'}`}>
            {chartData[0]?.yearMonthLabel} ~ {chartData[11]?.yearMonthLabel}
          </span>
        </div>
      </div>

      {/* Bar Chart: Income vs. Expense */}
      <div className={`p-3 rounded-2xl border ${
        isLight ? 'bg-slate-50/60 border-slate-200' : 'bg-white/[0.01] border-white/5'
      }`}>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              월별 수입 vs 지출 비교
            </span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded border ${
              isLight ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-white/10 text-slate-300 border-white/10'
            }`}>
              최근 12개월
            </span>
          </div>

          {/* Chart Legend */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: palette.income }} />
              <span className={`text-[11px] font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>수입</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: palette.expense }} />
              <span className={`text-[11px] font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>지출</span>
            </div>
          </div>
        </div>

        {/* Responsive Bar Chart */}
        <div className="w-full h-44 relative pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 6, left: -22, bottom: 0 }}
              onClick={(e: any) => {
                if (e && e.activePayload && e.activePayload.length) {
                  const p = e.activePayload[0].payload;
                  setSelectedMonthKey(selectedMonthKey === p.monthKey ? null : p.monthKey);
                }
              }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                vertical={false} 
                stroke={isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'} 
              />
              <XAxis
                dataKey="label"
                stroke={isLight ? '#64748B' : '#94A3B8'}
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }}
              />
              <YAxis
                stroke={isLight ? '#64748B' : '#94A3B8'}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => {
                  if (val >= 10000000) return `${(val / 10000000).toFixed(0)}천만`;
                  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}백만`;
                  if (val >= 10000) return `${Math.round(val / 10000)}만`;
                  if (val >= 1000) return `${Math.round(val / 1000)}k`;
                  return `${val}`;
                }}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.05)', radius: 6 }}
              />
              {/* Income Bar */}
              <Bar 
                dataKey="income" 
                name="수입" 
                fill={palette.income} 
                radius={[4, 4, 0, 0]} 
                maxBarSize={12} 
              />
              {/* Expense Bar */}
              <Bar 
                dataKey="expense" 
                name="지출" 
                fill={palette.expense} 
                radius={[4, 4, 0, 0]} 
                maxBarSize={12} 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Selected Month Inspector / Hint */}
        <div className={`mt-2 pt-2 border-t flex items-center justify-between text-[11px] ${
          isLight ? 'border-slate-200 text-slate-600' : 'border-white/10 text-[#94A3B8]'
        }`}>
          {selectedMonthData ? (
            <div className="flex items-center gap-3 flex-wrap animate-in fade-in duration-150">
              <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                📌 {selectedMonthData.fullLabel}:
              </span>
              <span className="text-emerald-500 font-semibold">
                수입 +{currSymbol}{selectedMonthData.income.toLocaleString()}
              </span>
              <span className="text-rose-500 font-semibold">
                지출 -{currSymbol}{selectedMonthData.expense.toLocaleString()}
              </span>
              <span className={`font-bold ${
                selectedMonthData.net >= 0 ? (isLight ? 'text-emerald-700' : 'text-[#00F5A0]') : 'text-rose-400'
              }`}>
                순수익 {selectedMonthData.net >= 0 ? '+' : ''}{currSymbol}{selectedMonthData.net.toLocaleString()}
              </span>
              <span className="opacity-75">({selectedMonthData.count}건)</span>
            </div>
          ) : (
            <span className="text-[10px] opacity-70">
              💡 막대를 클릭하면 해당 월의 수입, 지출, 순수익 상세 내역을 바로 확인할 수 있습니다.
            </span>
          )}

          {selectedMonthData && (
            <button
              type="button"
              onClick={() => setSelectedMonthKey(null)}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 ml-2"
            >
              선택 해제
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
