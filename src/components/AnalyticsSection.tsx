import React, { useState } from 'react';
import { Transaction, ChartPaletteType } from '../types';
import { MonthlyTrendsChart } from './MonthlyTrendsChart';
import { YearlyTrendsChart } from './YearlyTrendsChart';
import { CategoryDonutChart } from './CategoryDonutChart';
import { ChevronDown, ChevronUp, Palette } from 'lucide-react';
import { getCategoryKo } from '../utils';
import { getChartPalette } from '../themePalettes';

interface AnalyticsSectionProps {
  transactions: Transaction[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  currencySymbol: string;
  isStealth: boolean;
  theme?: 'light' | 'dark';
  chartPalette?: ChartPaletteType;
  onOpenThemeSettings?: () => void;
  defaultOpen?: boolean;
}

export type AnalyticsTab = 'trends' | 'yearly' | 'categories';

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
  transactions,
  selectedCategory,
  onSelectCategory,
  currencySymbol,
  isStealth,
  theme = 'dark',
  chartPalette = 'default',
  onOpenThemeSettings,
  defaultOpen = false,
}) => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('trends');
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const isLight = theme === 'light';
  const palette = getChartPalette(chartPalette);

  // If there are no transactions at all, we don't crowd the screen
  const hasData = transactions.length > 0;

  if (!hasData) {
    return null;
  }

  return (
    <section className={`transition-all py-1 ${
      isLight ? 'text-slate-900' : 'text-white'
    }`}>
      {/* Chart Control Header */}
      {!isOpen ? (
        /* Collapsed State: Sleek single pill toggle button aligned to the right */
        <div className="flex items-center justify-end px-1 pb-1">
          <button
            type="button"
            id="toggle-chart-collapse-btn"
            onClick={() => setIsOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold active:scale-95 transition-all ${
              isLight 
                ? 'bg-slate-100 text-slate-700 hover:text-slate-950 hover:bg-slate-200' 
                : 'bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            aria-label="차트 분석"
          >
            <span>📊 차트 분석</span>
            <ChevronDown size={13} />
          </button>
        </div>
      ) : (
        /* Expanded State: Sub-tabs rendered inside expanded container with right-aligned collapse toggle */
        <div className="flex items-center justify-between gap-2 pb-2">
          {/* Sub-tabs: 일별 / 월별 (연간) / 카테고리 */}
          <div className={`inline-flex items-center p-1 rounded-2xl flex-wrap gap-0.5 ${
            isLight ? 'bg-slate-100' : 'bg-white/[0.04]'
          }`}>
            <button
              type="button"
              onClick={() => setActiveTab('trends')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'trends'
                  ? isLight
                    ? 'bg-white text-slate-950 font-bold shadow-xs'
                    : 'bg-white/10 text-white font-bold'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <span>일별</span>
            </button>

            <button
              type="button"
              id="tab-yearly-analytics"
              onClick={() => setActiveTab('yearly')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'yearly'
                  ? isLight
                    ? 'bg-white text-slate-950 font-bold shadow-xs'
                    : 'bg-white/10 text-white font-bold'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <span>월별</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('categories')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'categories'
                  ? isLight
                    ? 'bg-white text-slate-950 font-bold shadow-xs'
                    : 'bg-white/10 text-white font-bold'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <span>카테고리</span>
              {selectedCategory && (
                <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-emerald-600' : 'bg-[#00F5A0]'}`} />
              )}
            </button>
          </div>

          {/* Right Controls: Category reset tag & 차트 접기 toggle */}
          <div className="flex items-center gap-1.5">
            {selectedCategory && (
              <button
                type="button"
                onClick={() => onSelectCategory(null)}
                className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-xl font-semibold active:scale-95 transition-all ${
                  isLight 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-[#00F5A0]/15 text-[#00F5A0] hover:bg-[#00F5A0]/25'
                }`}
              >
                <span>{getCategoryKo(selectedCategory)}</span>
                <span className="font-bold">×</span>
              </button>
            )}

            <button
              type="button"
              id="toggle-chart-collapse-btn"
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold active:scale-95 transition-all ${
                isLight 
                  ? 'bg-slate-100 text-slate-700 hover:text-slate-950 hover:bg-slate-200' 
                  : 'bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              aria-label="차트 접기"
            >
              <span className="text-[11px]">차트 접기</span>
              <ChevronUp size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Chart Viewport */}
      {isOpen && (
        <div className="pt-1 animate-in fade-in duration-200">
          {activeTab === 'trends' ? (
            <MonthlyTrendsChart
              transactions={transactions}
              currencySymbol={currencySymbol}
              isStealth={isStealth}
              theme={theme}
              chartPalette={chartPalette}
              embedded
            />
          ) : activeTab === 'yearly' ? (
            <YearlyTrendsChart
              transactions={transactions}
              currencySymbol={currencySymbol}
              isStealth={isStealth}
              theme={theme}
              chartPalette={chartPalette}
              embedded
            />
          ) : (
            <CategoryDonutChart
              transactions={transactions}
              selectedCategory={selectedCategory}
              onSelectCategory={onSelectCategory}
              currencySymbol={currencySymbol}
              isStealth={isStealth}
              theme={theme}
              chartPalette={chartPalette}
              embedded
            />
          )}
        </div>
      )}
    </section>
  );
};
