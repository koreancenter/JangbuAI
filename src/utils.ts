import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Asset, AssetType, ChartPaletteType, SupportedCurrency, FxRates } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface AIEngineConfig {
  engineType: 'local' | 'byok';
  localModel: 'gemma-2b' | 'llama3-8b';
  provider: 'gemini' | 'openai' | 'anthropic';
  modelTier: string;
  apiKey: string;
}

export type ThemeMode = 'dark' | 'light' | 'system';

export interface UserPreferences {
  budgetStartDay: number; // 1 to 31
  currencySymbol: string; // 'KRW', 'USD', 'EUR', 'JPY'
  stealthMode: boolean;   // blur financial amounts
  theme: ThemeMode;       // 'dark' | 'light' | 'system'
  chartPalette?: ChartPaletteType; // 'default' | 'sage' | 'clay' | 'burgundy'
  autoCategorization: boolean; // toggle smart auto-categorization (default true)
}

export function getAIEngineConfig(): AIEngineConfig {
  try {
    const stored = localStorage.getItem('vibe_engine_config');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        engineType: parsed.engineType || 'local',
        localModel: parsed.localModel || 'gemma-2b',
        provider: parsed.provider || 'gemini',
        modelTier: parsed.modelTier || '1.5-flash',
        apiKey: parsed.apiKey || ''
      };
    }
  } catch (e) {}
  
  return {
    engineType: 'local',
    localModel: 'gemma-2b',
    provider: 'gemini',
    modelTier: '1.5-flash',
    apiKey: ''
  };
}

export function saveAIEngineConfig(config: AIEngineConfig) {
  localStorage.setItem('vibe_engine_config', JSON.stringify(config));
}

export function getEffectiveTheme(theme: ThemeMode): 'dark' | 'light' {
  if (theme === 'system' && typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document !== 'undefined') {
    const effective = getEffectiveTheme(theme);
    const root = document.documentElement;
    const body = document.body;
    if (effective === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      body.classList.remove('bg-gradient-to-b', 'from-[#0B0F17]', 'via-[#0E1524]', 'to-[#111827]', 'text-slate-100');
      body.classList.add('bg-[#F8FAFC]', 'text-slate-900');
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute('content', '#FFFFFF');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      body.classList.remove('bg-[#F8FAFC]', 'text-slate-900');
      body.classList.add('bg-gradient-to-b', 'from-[#0B0F17]', 'via-[#0E1524]', 'to-[#111827]', 'text-slate-100');
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute('content', '#020617');
    }
  }
}

export function getUserPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem('vibe_user_preferences');
    if (stored) {
      const parsed = JSON.parse(stored);
      const themeVal: ThemeMode = (parsed.theme === 'light' || parsed.theme === 'system' || parsed.theme === 'dark')
        ? parsed.theme
        : 'dark';
      return {
        budgetStartDay: parsed.budgetStartDay ?? 1,
        currencySymbol: parsed.currencySymbol || 'KRW',
        stealthMode: !!parsed.stealthMode,
        theme: themeVal,
        chartPalette: (['default', 'sage', 'clay', 'burgundy'] as const).includes(parsed.chartPalette) 
          ? parsed.chartPalette 
          : 'default',
        autoCategorization: parsed.autoCategorization !== undefined ? !!parsed.autoCategorization : true,
      };
    }
  } catch (e) {}

  return {
    budgetStartDay: 1,
    currencySymbol: 'KRW',
    stealthMode: false,
    theme: 'dark',
    chartPalette: 'default',
    autoCategorization: true,
  };
}

export function saveUserPreferences(prefs: UserPreferences) {
  localStorage.setItem('vibe_user_preferences', JSON.stringify(prefs));
}

export interface CategoryItem {
  key: string;
  nameKo: string;
  iconName?: string;
  emoji: string;
}

export const STANDARD_CATEGORIES: CategoryItem[] = [
  { key: 'Food', nameKo: '식비', emoji: '🍽️' },
  { key: 'Living', nameKo: '생활/쇼핑', emoji: '🛍️' },
  { key: 'Transport', nameKo: '교통', emoji: '🚌' },
  { key: 'Fixed', nameKo: '고정지출', emoji: '🏠' },
  { key: 'Health', nameKo: '의료/건강', emoji: '💊' },
  { key: 'Leisure', nameKo: '문화/여가', emoji: '🎬' },
  { key: 'Uncategorized', nameKo: '미분류', emoji: '❓' },
];

export const CATEGORY_NAMES_KO: Record<string, string> = {
  Food: '식비',
  Fixed: '고정지출',
  Living: '생활/쇼핑',
  Transport: '교통',
  Health: '의료/건강',
  Leisure: '문화/여가',
  Uncategorized: '미분류',
};

export function getCategoryKo(category: string): string {
  return CATEGORY_NAMES_KO[category] || category;
}

export const TRANSACTION_TYPE_KO: Record<string, string> = {
  ALL: '전체',
  EXPENSE: '지출',
  INCOME: '수입',
  TRANSFER: '이체',
  SETTLEMENT: '정산',
};

export function getTransactionTypeKo(type: string): string {
  return TRANSACTION_TYPE_KO[type] || type;
}

export const DEFAULT_USER_ASSETS: Asset[] = [
  { id: 'asset-default-1', name: '현대카드', type: 'CARD', billingDay: 14, enabled: true, note: '주요 신용카드' },
  { id: 'asset-default-2', name: '신한은행', type: 'BANK', enabled: true, note: '급여·생활비 계좌' },
  { id: 'asset-default-3', name: '비상금 현금', type: 'CASH', enabled: true, note: '지갑 현금' },
];

export function getUserAssets(): Asset[] {
  try {
    const stored = localStorage.getItem('vibe_user_assets');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  return DEFAULT_USER_ASSETS;
}

export function saveUserAssets(assets: Asset[]): void {
  localStorage.setItem('vibe_user_assets', JSON.stringify(assets));
}

export const ASSET_TYPE_KO: Record<AssetType, string> = {
  CARD: '신용/체크카드',
  BANK: '계좌/통장',
  CASH: '현금',
  OTHER: '기타 자산',
};

export function getAssetTypeKo(type: AssetType): string {
  return ASSET_TYPE_KO[type] || type;
}

export interface CurrencyMeta {
  code: SupportedCurrency;
  symbol: string;
  nameKo: string;
  flag: string;
}

export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  { code: 'KRW', symbol: '₩', nameKo: '대한민국 원', flag: '🇰🇷' },
  { code: 'USD', symbol: '$', nameKo: '미국 달러', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', nameKo: '유럽 유로', flag: '🇪🇺' },
  { code: 'JPY', symbol: '¥', nameKo: '일본 엔', flag: '🇯🇵' },
  { code: 'GBP', symbol: '£', nameKo: '영국 파운드', flag: '🇬🇧' },
];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  KRW: '₩',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  GBP: '£',
};

export function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] || code;
}

// Default Fallback FX Rates table (KRW base)
export const DEFAULT_FX_RATES: FxRates = {
  base: 'KRW',
  rates: {
    KRW: 1,
    USD: 0.00075, // 1 KRW ≈ 0.00075 USD (or 1 USD ≈ 1,333 KRW)
    EUR: 0.00069, // 1 KRW ≈ 0.00069 EUR (or 1 EUR ≈ 1,450 KRW)
    JPY: 0.113,   // 1 KRW ≈ 0.113 JPY (or 100 JPY ≈ 885 KRW)
    GBP: 0.00058, // 1 KRW ≈ 0.00058 GBP (or 1 GBP ≈ 1,720 KRW)
  },
  updatedAt: new Date().toISOString(),
};

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  fxRates: FxRates = DEFAULT_FX_RATES
): number {
  if (fromCurrency === toCurrency) return amount;
  
  const fromRate = fxRates.rates[fromCurrency] || 1;
  const toRate = fxRates.rates[toCurrency] || 1;

  // Since rates are relative to base (KRW)
  // amount in base = amount / fromRate
  // amount in target = (amount / fromRate) * toRate
  const amountInBase = fromRate === 0 ? amount : amount / fromRate;
  const converted = amountInBase * toRate;

  // Rounding: KRW and JPY integers, USD/EUR/GBP 2 decimals
  if (toCurrency === 'KRW' || toCurrency === 'JPY') {
    return Math.round(converted);
  }
  return Math.round(converted * 100) / 100;
}

export const DEFAULT_CATEGORY_BUDGETS: Record<string, number> = {
  Food: 600000,
  Living: 400000,
  Transport: 150000,
  Fixed: 500000,
  Leisure: 200000,
};

export function getCategoryBudgets(): Record<string, number> {
  try {
    const stored = localStorage.getItem('vibe_category_budgets');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {}

  return DEFAULT_CATEGORY_BUDGETS;
}

export function saveCategoryBudgets(budgets: Record<string, number>): void {
  localStorage.setItem('vibe_category_budgets', JSON.stringify(budgets));
}

