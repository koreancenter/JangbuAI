import { ChartPaletteType } from './types';

export interface ChartPaletteDefinition {
  id: ChartPaletteType;
  name: string;
  nameEn: string;
  subtitle: string;
  description: string;
  emoji: string;
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  textDark: string;
  accent: string;
  
  // Chart specific color mappings
  income: string;
  expense: string;
  todayBar: string;
  peakBar: string;
  regularBar: string;
  selectedBar: string;
  
  // Category Donut slice colors
  categoryColors: Record<string, string>;
  
  // Swatch colors for settings preview
  swatches: string[];
}

export const CHART_PALETTES: Record<ChartPaletteType, ChartPaletteDefinition> = {
  // 1. 🌿 세이지 그린 테마 (Sage Green Organic Mode - DESIGN.md)
  sage: {
    id: 'sage',
    name: '세이지 그린',
    nameEn: 'Sage Green Organic',
    subtitle: '자연 친화적 오가닉 미니멀',
    description: '매트한 알루미늄·티타늄 바디 질감과 차분한 녹음의 자연 친화적 테마',
    emoji: '🌿',
    primary: '#87A96B',     // Sage Green
    secondary: '#A3BD8F',   // Sage Muted
    background: '#E2E7DF',  // Light Sage
    surface: '#FFFFFF',     // Pure White
    textDark: '#4E5E4A',    // Deep Sage
    accent: '#C86D51',      // Terracotta Accent / Alert
    
    income: '#87A96B',      // Sage Green
    expense: '#4E5E4A',     // Deep Sage
    todayBar: '#87A96B',    // Sage Green
    peakBar: '#C86D51',     // Terracotta Alert
    regularBar: '#A3BD8F',  // Sage Muted
    selectedBar: '#5B7552', // Deep Olive
    
    categoryColors: {
      Food: '#87A96B',          // Sage Green
      Fixed: '#4E5E4A',         // Deep Sage
      Living: '#A3BD8F',        // Sage Muted
      Transport: '#5B7552',     // Olive Deep
      Health: '#6E8857',        // Forest Sage
      Leisure: '#B5C7AB',       // Light Sage Muted
      Uncategorized: '#8F9E8B'  // Muted Gray Sage
    },
    swatches: ['#87A96B', '#A3BD8F', '#4E5E4A', '#E2E7DF']
  },

  // 2. 🧱 클레이 베이지 테마 (Clay Beige Minimalist Mode - DESIGN.md)
  clay: {
    id: 'clay',
    name: '클레이 베이지',
    nameEn: 'Clay Beige Minimalist',
    subtitle: '콰이어트 럭셔리 뉴트럴',
    description: '최고급 세라믹과 현대 건축물에서 영감을 받은 시각적 피로도가 적은 뉴트럴 톤',
    emoji: '🧱',
    primary: '#C2B280',     // Clay Beige
    secondary: '#D1C5A5',   // Clay Sand
    background: '#EAE5D9',  // Ceramic Warm
    surface: '#F5F2EB',     // Soft Linen
    textDark: '#3E382E',    // Charcoal Brown
    accent: '#C86D51',      // Warm Terracotta
    
    income: '#C2B280',      // Clay Beige
    expense: '#3E382E',     // Charcoal Brown
    todayBar: '#C2B280',    // Clay Beige
    peakBar: '#C86D51',     // Terracotta
    regularBar: '#D1C5A5',  // Clay Sand
    selectedBar: '#7A8450', // Olive Clay
    
    categoryColors: {
      Food: '#C2B280',          // Clay Beige
      Fixed: '#3E382E',         // Charcoal Brown
      Living: '#D1C5A5',        // Clay Sand
      Transport: '#A89A6B',     // Deep Sand
      Health: '#7A8450',        // Olive Clay
      Leisure: '#DDD6C3',       // Linen Light
      Uncategorized: '#9C907E'  // Charcoal Tint
    },
    swatches: ['#C2B280', '#D1C5A5', '#3E382E', '#EAE5D9']
  },

  // 3. 🍷 버건디 와인 테마 (Burgundy Deep Velvet Mode - DESIGN.md)
  burgundy: {
    id: 'burgundy',
    name: '버건디 와인',
    nameEn: 'Burgundy Deep Velvet',
    subtitle: '독점적 시그니처 럭셔리',
    description: '어두운 벨벳 와인빛 배경 위에서 은은하게 빛나는 독보적 고급스러움',
    emoji: '🍷',
    primary: '#800020',     // Burgundy Wine
    secondary: '#D4A5A9',   // Dusty Rose
    background: '#1C050B',  // Deep Wine Black
    surface: '#2D0D14',     // Velvet Crimson
    textDark: '#F7F4F5',    // Off-White
    accent: '#D4A5A9',      // Dusty Rose
    
    income: '#D4A5A9',      // Dusty Rose
    expense: '#800020',     // Burgundy Wine
    todayBar: '#D4A5A9',    // Dusty Rose
    peakBar: '#800020',     // Burgundy Wine
    regularBar: '#A3304B',  // Velvet Crimson Light
    selectedBar: '#E06A7C', // Highlight Crimson
    
    categoryColors: {
      Food: '#800020',          // Burgundy Wine
      Fixed: '#4A0815',         // Deepest Velvet
      Living: '#D4A5A9',        // Dusty Rose
      Transport: '#9E2A42',     // Velvet Crimson
      Health: '#C75D74',        // Rose Violet
      Leisure: '#F7F4F5',       // Off-White
      Uncategorized: '#702231'  // Muted Velvet
    },
    swatches: ['#800020', '#D4A5A9', '#2D0D14', '#1C050B']
  },

  // 4. 💎 클래식 에메랄드 테마 (기본 고대비 테크)
  default: {
    id: 'default',
    name: '클래식 에메랄드',
    nameEn: 'Classic Emerald Tech',
    subtitle: '네온 에메랄드 & 인디고',
    description: '선명한 대비감과 생동감 넘치는 현대적 핀테크 표준 팔레트',
    emoji: '💎',
    primary: '#00F5A0',     // Electric Emerald
    secondary: '#6366F1',   // Soft Indigo
    background: '#0B0F17',  // Deep Slate
    surface: '#111827',     // Slate Card
    textDark: '#F8FAFC',    // White
    accent: '#F43F5E',      // Rose Red
    
    income: '#00F5A0',      // Electric Emerald
    expense: '#F43F5E',     // Rose Red
    todayBar: '#00F5A0',    // Electric Emerald
    peakBar: '#F43F5E',     // Rose Red
    regularBar: '#6366F1',  // Indigo
    selectedBar: '#FBBF24', // Amber
    
    categoryColors: {
      Food: '#00F5A0',          // Emerald
      Fixed: '#6366F1',         // Indigo
      Living: '#F59E0B',        // Amber
      Transport: '#06B6D4',     // Cyan
      Health: '#EC4899',        // Pink
      Leisure: '#A855F7',       // Purple
      Uncategorized: '#94A3B8'  // Slate
    },
    swatches: ['#00F5A0', '#6366F1', '#F43F5E', '#06B6D4']
  }
};

export function getChartPalette(paletteId?: ChartPaletteType | string | null): ChartPaletteDefinition {
  if (paletteId && (paletteId in CHART_PALETTES)) {
    return CHART_PALETTES[paletteId as ChartPaletteType];
  }
  return CHART_PALETTES.default;
}
