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
}) => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('trends');
  const [isOpen, setIsOpen] = useState(true);

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
      {/* Header bar: Sleek Segmented Switcher + Category Filter + Collapse (No horizontal divider line, no box-in-box) */}
      <div className="flex items-center justify-between gap-2 pb-1.5">
        {/* Segmented Switcher */}
        <div className={`inline-flex items-center p-1 rounded-2xl flex-wrap gap-0.5 ${
          isLight ? 'bg-slate-100' : 'bg-white/[0.04]'
        }`}>
          <button
            type="button"
            onClick={() => {
              setActiveTab('trends');
              if (!isOpen) setIsOpen(true);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isOpen && activeTab === 'trends'
                ? isLight
                  ? 'bg-white text-slate-950 font-bold shadow-xs'
                  : 'bg-white/10 text-white font-bold'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <span>일별 지출</span>
          </button>

          <button
            type="button"
            id="tab-yearly-analytics"
            onClick={() => {
              setActiveTab('yearly');
              if (!isOpen) setIsOpen(true);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isOpen && activeTab === 'yearly'
                ? isLight
                  ? 'bg-white text-slate-950 font-bold shadow-xs'
                  : 'bg-white/10 text-white font-bold'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <span>연간 추이</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('categories');
              if (!isOpen) setIsOpen(true);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isOpen && activeTab === 'categories'
                ? isLight
                  ? 'bg-white text-slate-950 font-bold shadow-xs'
                  : 'bg-white/10 text-white font-bold'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <span>카테고리별 비중</span>
            {selectedCategory && (
              <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-emerald-600' : 'bg-[#00F5A0]'}`} />
            )}
          </button>
        </div>

        {/* Right side controls: Category filter tag if active, Palette quick badge & Collapse/Expand button */}
        <div className="flex items-center gap-1.5">
          {/* Palette Badge Indicator / Quick Link */}
          {onOpenThemeSettings ? (
            <button
              type="button"
              id="analytics-theme-palette-badge"
              onClick={onOpenThemeSettings}
              title={`현재 차트 테마: ${palette.name} (${palette.subtitle}) - 설정에서 변경`}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all active:scale-95 ${
                isLight
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                style={{ backgroundColor: palette.primary }}
              />
              <span className="truncate max-w-[110px]">{palette.name}</span>
            </button>
          ) : (
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium ${
                isLight
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-white/[0.04] text-slate-300'
              }`}
              title={`현재 차트 테마: ${palette.name} (${palette.subtitle})`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                style={{ backgroundColor: palette.primary }}
              />
              <span className="truncate max-w-[110px]">{palette.name}</span>
            </div>
          )}

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
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs active:scale-95 transition-all ${
              isLight 
                ? 'bg-slate-100 text-slate-600 hover:text-slate-900' 
                : 'bg-white/[0.04] text-[#94A3B8] hover:text-white'
            }`}
            aria-label={isOpen ? '차트 접기' : '차트 펼치기'}
          >
            <span className="hidden xs:inline text-[11px] font-medium">{isOpen ? '접기' : '펼치기'}</span>
            {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Collapsible Chart Viewport */}
      {isOpen && (
        <div className="pt-2 animate-in fade-in duration-200">
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
