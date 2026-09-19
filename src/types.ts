export type AssetType = 'CARD' | 'BANK' | 'CASH' | 'OTHER';

// Multi-Brokerage & Comprehensive Asset Classification
export type AssetCategoryType = 'BROKERAGE' | 'BANK' | 'CRYPTO' | 'REAL_ESTATE' | 'CASH' | 'LIABILITY';

export type LaunchScreenMode = 'vault' | 'ledger';

export interface HoldingItem {
  name: string;
  valuation: number;
  currency?: string;
  quantity?: number;
  profitRate?: number; // e.g. +14.2% -> 14.2
}

export interface AssetAccount {
  id: string;
  institution: string; // e.g., 'Toss Securities', 'Kakao Pay Securities', 'KakaoBank', 'Manual'
  accountName: string; // e.g., 'Toss US Stock', 'Kakao Domestic ISA'
  assetType: AssetCategoryType;
  currentBalance: number;
  currency: string; // 'KRW', 'USD', etc.
  lastUpdated: string; // ISO date
  note?: string;
  accountNumberMasked?: string;
  holdings?: HoldingItem[];
}

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'SETTLEMENT';
export type SupportedCurrency = 'KRW' | 'USD' | 'EUR' | 'JPY' | 'GBP';
export type CurrencyCode = SupportedCurrency | string;

export interface FxRates {
  base: string; // e.g. 'KRW'
  rates: Record<string, number>; // e.g. { 'USD': 0.00075, 'EUR': 0.00069, 'JPY': 0.11, 'GBP': 0.00059, 'KRW': 1 }
  updatedAt: string; // ISO date
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  billingDay?: number; // 1 to 31 (e.g. credit card billing cycle day)
  enabled: boolean;
  note?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  category: string;
  subCategory?: string;
  description: string;
  date: string; // ISO string
  paymentMethod?: string;
  groupId?: string; // Links related multi-part expenses or Dutch-pay settlements
  originalTotal?: number; // Pre-settlement original sum if applicable
  convertedAmount?: number; // Normalized to current base currency if different
  sourceAccountId?: string; // Source account for account-to-account transfer
  targetAccountId?: string; // Destination account for account-to-account transfer
  isInternalTransfer?: boolean; // Transfer between user's own accounts
}

export interface CategoryBudget {
  category: string;
  limit: number;
}

export type ChartPaletteType = 'default' | 'sage' | 'clay' | 'burgundy';

export type FinancialCategory = 'Food' | 'Living' | 'Transport' | 'Fixed' | 'Health' | 'Leisure' | 'Uncategorized';

export interface ReceiptItem {
  name: string;
  price: number;
  quantity?: number;
  // Backward compatibility aliases
  amount?: number;
  category?: string;
}

export interface ParsedReceiptData {
  merchantName: string;
  date: string; // ISO-8601 format YYYY-MM-DD
  totalAmount: number;
  currency: string; // ISO code, e.g., "KRW", "USD"
  category: FinancialCategory | string;
  items: ReceiptItem[];
  confidenceScore: number; // 0.0 to 1.0
  // Backward compatibility fields
  merchant?: string;
  suggestedCategory?: string;
  paymentMethod?: string;
}

// Phase 4: Subscription & Recurring Fixed Expense Model
export interface SubscriptionItem {
  id: string;
  merchant: string;
  amount: number;
  currency: CurrencyCode;
  category: string;
  cycleDays: number; // e.g. 30 (monthly)
  lastBillingDate: string; // ISO date
  nextBillingDate: string; // ISO date
  dDay: number; // e.g. 3 (D-3), 0 (D-Day), -1 (overdue/paid)
  confidence: number; // 0 to 1
  occurrencesCount: number;
  isManual?: boolean;
  isActive: boolean;
  notes?: string;
}

// Phase 4: Predictive Cashflow Forecast Models
export interface CashflowForecastPoint {
  day: number;
  date: string; // YYYY-MM-DD
  isPast: boolean;
  isToday: boolean;
  actualBalance?: number;
  projectedBalance: number;
  dailyBurn: number;
  projectedBurn: number;
  upcomingSubscriptionSum: number;
}

export interface CashflowForecastSummary {
  currentBalance: number;
  projectedMonthEndBalance: number;
  dailyAverageBurn: number;
  daysRemainingInMonth: number;
  totalUpcomingSubscriptions: number;
  runwayDays: number;
  status: 'HEALTHY' | 'MODERATE' | 'DEFICIT_WARNING';
  recommendation: string;
  dataPoints: CashflowForecastPoint[];
}

// Phase 4: Encrypted Local-First Backup Protocol v2.0
export interface EncryptedBackupPayload {
  version: '2.0';
  format: 'vibe-encrypted-v2';
  kdf: 'PBKDF2';
  cipher: 'AES-GCM-256';
  iterations: number;
  salt: string; // Hex
  iv: string; // Hex
  ciphertext: string; // Base64
  createdAt: string;
  meta: {
    transactionCount: number;
    appName: string;
  };
}

export interface UnencryptedBackupPayloadV2 {
  version: '2.0';
  format: 'vibe-backup-v2';
  createdAt: string;
  transactions: Transaction[];
  preferences?: Record<string, any>;
  subscriptions?: SubscriptionItem[];
  assets?: Asset[];
  assetAccounts?: AssetAccount[];
}
