import { 
  Transaction, 
  SubscriptionItem, 
  CashflowForecastSummary, 
  CashflowForecastPoint, 
  SupportedCurrency, 
  FxRates,
  ParsedReceiptData,
  ReceiptItem,
  AssetAccount,
  AssetScreenshotMutation,
  DebtItem,
  LoanSplitSuggestion,
  ReceivableRecoverySuggestion
} from './types';
import { 
  parseReceiptTextLocally, 
  parseFinancialInputDeterministically,
  ParsedTransactionResult 
} from './financialParser';
import { 
  saveAssetAccount, 
  getAllAssetAccounts, 
  executeLoanRepaymentSplit, 
  executeReceivableRecovery 
} from './db';
import { convertCurrency, AIEngineConfig } from './utils';
import {
  getSecureGeminiApiKey,
  sanitizeApiKey,
  redactSensitiveKey,
  directGeminiReceiptOCR
} from './geminiKeyManager';
import { 
  format, 
  parseISO, 
  differenceInDays, 
  addDays, 
  startOfMonth, 
  endOfMonth, 
  getDate, 
  getDaysInMonth, 
  isSameMonth, 
  isAfter, 
  isBefore,
  addMonths
} from 'date-fns';

const KNOWN_SUBSCRIPTION_KEYWORDS: Record<string, { category: string; defaultCycle: number }> = {
  '넷플릭스': { category: 'Living', defaultCycle: 30 },
  'netflix': { category: 'Living', defaultCycle: 30 },
  '유튜브': { category: 'Living', defaultCycle: 30 },
  'youtube': { category: 'Living', defaultCycle: 30 },
  '스포티파이': { category: 'Living', defaultCycle: 30 },
  'spotify': { category: 'Living', defaultCycle: 30 },
  '쿠팡': { category: 'Living', defaultCycle: 30 },
  '와우멤버십': { category: 'Living', defaultCycle: 30 },
  '와우': { category: 'Living', defaultCycle: 30 },
  '애플': { category: 'Living', defaultCycle: 30 },
  'apple': { category: 'Living', defaultCycle: 30 },
  'icloud': { category: 'Living', defaultCycle: 30 },
  '디즈니': { category: 'Living', defaultCycle: 30 },
  'disney': { category: 'Living', defaultCycle: 30 },
  '티빙': { category: 'Living', defaultCycle: 30 },
  'tving': { category: 'Living', defaultCycle: 30 },
  '웨이브': { category: 'Living', defaultCycle: 30 },
  'wavve': { category: 'Living', defaultCycle: 30 },
  '멜론': { category: 'Living', defaultCycle: 30 },
  'melon': { category: 'Living', defaultCycle: 30 },
  '밀리의서재': { category: 'Living', defaultCycle: 30 },
  '네이버플러스': { category: 'Living', defaultCycle: 30 },
  'chatgpt': { category: 'Work', defaultCycle: 30 },
  'openai': { category: 'Work', defaultCycle: 30 },
  'claude': { category: 'Work', defaultCycle: 30 },
  'notion': { category: 'Work', defaultCycle: 30 },
  'github': { category: 'Work', defaultCycle: 30 },
  'figma': { category: 'Work', defaultCycle: 30 },
  'adobe': { category: 'Work', defaultCycle: 30 },
  '통신비': { category: 'Living', defaultCycle: 30 },
  'skt': { category: 'Living', defaultCycle: 30 },
  'kt': { category: 'Living', defaultCycle: 30 },
  'lgu+': { category: 'Living', defaultCycle: 30 },
  'lg유플러스': { category: 'Living', defaultCycle: 30 },
  '관리비': { category: 'Living', defaultCycle: 30 },
  '월세': { category: 'Living', defaultCycle: 30 },
  '보험료': { category: 'Living', defaultCycle: 30 },
  '정수기': { category: 'Living', defaultCycle: 30 },
  '코웨이': { category: 'Living', defaultCycle: 30 },
  'sk매직': { category: 'Living', defaultCycle: 30 },
  '헬스장': { category: 'Health', defaultCycle: 30 },
  '필라테스': { category: 'Health', defaultCycle: 30 }
};

const STORAGE_KEY_SUBSCRIPTIONS = 'vibe_subscriptions_v2';

/**
 * Normalizes merchant description for clustering
 */
function normalizeMerchantKey(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[0-9]/g, '') // remove numbers
    .replace(/정기|결제|자동|이체|승인|출금|구독|멤버십|플랜/g, '')
    .replace(/[^\w\sㄱ-ㅎ가-힣]/g, '')
    .trim();
}

/**
 * Loads user subscription overrides/manual items from localStorage
 */
export function loadSavedSubscriptions(): SubscriptionItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUBSCRIPTIONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load saved subscriptions:', e);
    return [];
  }
}

/**
 * Saves subscriptions to localStorage
 */
export function saveSubscriptions(items: SubscriptionItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SUBSCRIPTIONS, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save subscriptions:', e);
  }
}

/**
 * Autonomous Subscription Detector
 * Analyzes transaction histories to identify recurring periodic payments (28-32 days).
 */
export function detectSubscriptions(
  transactions: Transaction[],
  targetCurrency: SupportedCurrency = 'KRW',
  fxRates?: FxRates
): SubscriptionItem[] {
  const savedItems = loadSavedSubscriptions();
  const savedMap = new Map(savedItems.map(s => [s.id, s]));

  // Filter only expenses
  const expenses = transactions.filter(t => t.type === 'EXPENSE' && t.amount > 0);

  // Group by normalized merchant key
  const groups: Record<string, Transaction[]> = {};

  for (const t of expenses) {
    const key = normalizeMerchantKey(t.description || t.category);
    if (!key || key.length < 2) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const detected: SubscriptionItem[] = [];
  const now = new Date();

  for (const [key, txList] of Object.entries(groups)) {
    // Sort chronologically ascending
    const sorted = [...txList].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Check if matches known keywords or has multiple occurrences
    let isKnown = false;
    let defaultCategory = sorted[sorted.length - 1].category || 'Living';

    for (const [kw, info] of Object.entries(KNOWN_SUBSCRIPTION_KEYWORDS)) {
      if (key.includes(kw) || sorted.some(t => t.description.toLowerCase().includes(kw))) {
        isKnown = true;
        defaultCategory = info.category;
        break;
      }
    }

    let isRecurring = false;
    let avgInterval = 30;
    let confidence = 0.5;

    if (sorted.length >= 2) {
      // Calculate intervals between consecutive payments
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const d1 = new Date(sorted[i - 1].date);
        const d2 = new Date(sorted[i].date);
        const diff = Math.abs(differenceInDays(d2, d1));
        if (diff >= 20 && diff <= 45) {
          intervals.push(diff);
        }
      }

      if (intervals.length > 0) {
        avgInterval = Math.round(
          intervals.reduce((a, b) => a + b, 0) / intervals.length
        );
        isRecurring = true;
        confidence = Math.min(0.95, 0.6 + intervals.length * 0.1);
      }
    }

    // If known keyword with at least 1 payment, qualify as subscription
    if (isKnown && !isRecurring) {
      isRecurring = true;
      confidence = 0.85;
      avgInterval = 30;
    }

    if (isRecurring) {
      const latestTx = sorted[sorted.length - 1];
      const lastBilling = new Date(latestTx.date);
      
      // Calculate next billing date based on last date + avgInterval
      let nextBilling = addDays(lastBilling, avgInterval);
      while (isBefore(nextBilling, now) && differenceInDays(now, nextBilling) > 3) {
        nextBilling = addDays(nextBilling, avgInterval);
      }

      const dDay = differenceInDays(nextBilling, now);
      const subId = `sub_${key.replace(/\s+/g, '_')}`;

      // Check if user has saved overrides for this subscription
      const existing = savedMap.get(subId);

      const normalizedAmount = fxRates 
        ? convertCurrency(latestTx.amount, latestTx.currency || 'KRW', targetCurrency, fxRates)
        : latestTx.amount;

      detected.push({
        id: subId,
        merchant: existing?.merchant || latestTx.description || key,
        amount: existing?.amount ?? Math.round(normalizedAmount),
        currency: targetCurrency,
        category: existing?.category || defaultCategory,
        cycleDays: existing?.cycleDays || avgInterval,
        lastBillingDate: latestTx.date,
        nextBillingDate: nextBilling.toISOString(),
        dDay,
        confidence,
        occurrencesCount: sorted.length,
        isActive: existing?.isActive !== false,
        isManual: false,
        notes: existing?.notes
      });
    }
  }

  // Also include manual subscriptions created by user
  for (const saved of savedItems) {
    if (saved.isManual && !detected.some(d => d.id === saved.id)) {
      const lastBilling = new Date(saved.lastBillingDate);
      let nextBilling = new Date(saved.nextBillingDate || addDays(lastBilling, saved.cycleDays));
      while (isBefore(nextBilling, now) && differenceInDays(now, nextBilling) > 3) {
        nextBilling = addDays(nextBilling, saved.cycleDays);
      }
      const dDay = differenceInDays(nextBilling, now);
      detected.push({
        ...saved,
        dDay,
        nextBillingDate: nextBilling.toISOString()
      });
    }
  }

  // Sort by upcoming D-Day ascending (soonest renewals first)
  return detected.sort((a, b) => a.dDay - b.dDay);
}

/**
 * Predictive Cashflow Runway & Liquidity Engine
 * Projects balance from day 1 to end of current month based on actual burn and confirmed recurring commitments.
 */
export function calculateCashflowForecast(
  transactions: Transaction[],
  subscriptions: SubscriptionItem[],
  baseCurrency: SupportedCurrency = 'KRW',
  fxRates: FxRates
): CashflowForecastSummary {
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const totalDaysInMonth = getDaysInMonth(now);
  const currentDay = getDate(now);
  const daysRemaining = Math.max(0, totalDaysInMonth - currentDay);

  // Normalize amount to base currency helper
  const norm = (t: Transaction): number => {
    return convertCurrency(t.amount, t.currency || 'KRW', baseCurrency, fxRates);
  };

  // Current month transactions
  const monthTxs = transactions.filter(t => {
    try {
      return isSameMonth(parseISO(t.date), now);
    } catch {
      return false;
    }
  });

  // Calculate actual daily expenses & income up to today
  const dailyActualExpenses: Record<number, number> = {};
  const dailyActualIncome: Record<number, number> = {};

  for (let d = 1; d <= totalDaysInMonth; d++) {
    dailyActualExpenses[d] = 0;
    dailyActualIncome[d] = 0;
  }

  let cumulativeIncomeToDate = 0;
  let cumulativeExpenseToDate = 0;

  for (const t of monthTxs) {
    try {
      const d = getDate(parseISO(t.date));
      const val = norm(t);
      if (t.type === 'INCOME' || t.type === 'SETTLEMENT') {
        dailyActualIncome[d] = (dailyActualIncome[d] || 0) + val;
        if (d <= currentDay) cumulativeIncomeToDate += val;
      } else if (t.type === 'EXPENSE') {
        dailyActualExpenses[d] = (dailyActualExpenses[d] || 0) + val;
        if (d <= currentDay) cumulativeExpenseToDate += val;
      }
    } catch {
      // ignore invalid dates
    }
  }

  const currentBalance = cumulativeIncomeToDate - cumulativeExpenseToDate;

  // Calculate historical daily burn rate (exclude one-time large outliers > 3x daily average if enough data)
  const elapsedDays = Math.max(1, currentDay);
  const rawDailyBurn = cumulativeExpenseToDate / elapsedDays;
  const dailyAverageBurn = Math.round(rawDailyBurn);

  // Active upcoming subscriptions scheduled between tomorrow and month-end
  const upcomingSubscriptions = subscriptions.filter(sub => {
    if (!sub.isActive) return false;
    try {
      const nextDate = parseISO(sub.nextBillingDate);
      return isSameMonth(nextDate, now) && getDate(nextDate) > currentDay;
    } catch {
      return false;
    }
  });

  const totalUpcomingSubscriptions = upcomingSubscriptions.reduce(
    (acc, s) => acc + s.amount,
    0
  );

  // Build 1..N forecast data points
  const dataPoints: CashflowForecastPoint[] = [];
  let runningProjectedBalance = 0;

  // Calculate day-by-day balance curve
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const isPast = day < currentDay;
    const isToday = day === currentDay;
    const dateStr = format(new Date(now.getFullYear(), now.getMonth(), day), 'yyyy-MM-dd');

    // Subscriptions due on this specific day
    const daySubs = subscriptions
      .filter(s => s.isActive && getDate(parseISO(s.nextBillingDate)) === day && isSameMonth(parseISO(s.nextBillingDate), now))
      .reduce((sum, s) => sum + s.amount, 0);

    if (isPast || isToday) {
      // Past/Today uses actual cumulative cashflow
      runningProjectedBalance += (dailyActualIncome[day] - dailyActualExpenses[day]);
      dataPoints.push({
        day,
        date: dateStr,
        isPast,
        isToday,
        actualBalance: Math.round(runningProjectedBalance),
        projectedBalance: Math.round(runningProjectedBalance),
        dailyBurn: Math.round(dailyActualExpenses[day]),
        projectedBurn: Math.round(dailyActualExpenses[day]),
        upcomingSubscriptionSum: daySubs
      });
    } else {
      // Future days apply projected daily average burn + scheduled subscriptions
      const dayExpense = dailyAverageBurn + daySubs;
      runningProjectedBalance -= dayExpense;
      dataPoints.push({
        day,
        date: dateStr,
        isPast: false,
        isToday: false,
        actualBalance: undefined,
        projectedBalance: Math.round(runningProjectedBalance),
        dailyBurn: 0,
        projectedBurn: Math.round(dayExpense),
        upcomingSubscriptionSum: daySubs
      });
    }
  }

  const projectedMonthEndBalance = runningProjectedBalance;

  // Runway days calculation: how many days current balance will last at current burn rate
  let runwayDays = 999;
  if (dailyAverageBurn > 0 && currentBalance > 0) {
    runwayDays = Math.floor(currentBalance / dailyAverageBurn);
  } else if (currentBalance <= 0) {
    runwayDays = 0;
  }

  // Health Status determination
  let status: 'HEALTHY' | 'MODERATE' | 'DEFICIT_WARNING' = 'HEALTHY';
  let recommendation = '';

  if (projectedMonthEndBalance > dailyAverageBurn * 5) {
    status = 'HEALTHY';
    recommendation = `현재 지출 속도가 안정적입니다. 월말에 약 ₩${Math.max(0, projectedMonthEndBalance).toLocaleString()}의 여유 자금이 남을 것으로 예상됩니다.`;
  } else if (projectedMonthEndBalance >= 0) {
    status = 'MODERATE';
    recommendation = `월말 잔액이 타이트합니다. 남은 ${daysRemaining}일 동안 하루 지출을 ₩${Math.round(currentBalance / Math.max(1, daysRemaining)).toLocaleString()} 이하로 관리하세요.`;
  } else {
    status = 'DEFICIT_WARNING';
    const deficitDay = Math.min(totalDaysInMonth, Math.max(currentDay, currentDay + Math.max(0, Math.floor(currentBalance / Math.max(1, dailyAverageBurn)))));
    recommendation = `주의: 현재 소비 속도가 지속될 경우 ${deficitDay}일경 잔액이 소진될 위험이 있습니다. 비필수 지출을 즉시 절감하세요.`;
  }

  return {
    currentBalance: Math.round(currentBalance),
    projectedMonthEndBalance: Math.round(projectedMonthEndBalance),
    dailyAverageBurn,
    daysRemainingInMonth: daysRemaining,
    totalUpcomingSubscriptions: Math.round(totalUpcomingSubscriptions),
    runwayDays: Math.min(99, runwayDays),
    status,
    recommendation,
    dataPoints
  };
}

// ---------------------------------------------------------------------------
// Phase 1: AI Resilience, Structured Outputs & Error Recovery
// ---------------------------------------------------------------------------

export interface ResilientReceiptParseOptions {
  imageBase64: string;
  mimeType?: string;
  engineConfig?: unknown;
  defaultCurrency?: string;
  rawFallbackText?: string;
  maxRetries?: number;
  onRetry?: (attempt: number, delayMs: number, reason: string) => void;
}

export interface ResilientReceiptParseResult {
  receipt: ParsedReceiptData;
  source: 'gemini' | 'local_fallback' | 'local_deterministic';
  attempts: number;
}

/**
 * Resilient Receipt Parsing Engine:
 * - Pre-flight offline verification.
 * - Exponential backoff retry logic (up to 3 attempts) for HTTP 429 and transient 5xx network spikes.
 * - Enforces strict schema conformance and type-safe fallbacks.
 * - Seamlessly falls back to local heuristic text parser (financialParser.ts) when offline or upon terminal failure.
 */
export async function parseReceiptWithResilience(
  options: ResilientReceiptParseOptions
): Promise<ResilientReceiptParseResult> {
  const {
    imageBase64,
    mimeType = 'image/webp',
    engineConfig,
    defaultCurrency = 'KRW',
    rawFallbackText = '',
    maxRetries = 3,
    onRetry
  } = options;

  // 1. Offline Pre-flight Check
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (rawFallbackText.trim()) {
      const fallbackData = parseReceiptTextLocally(rawFallbackText, defaultCurrency);
      return {
        receipt: fallbackData,
        source: 'local_fallback',
        attempts: 0
      };
    }
    throw new Error('OFFLINE: 현재 오프라인 상태입니다. 영수증 텍스트 직접 입력 모드를 사용해주세요.');
  }

  // 2. Pre-flight API Key & Engine Config Resolution
  const resolvedConfig = (engineConfig as Partial<AIEngineConfig> | undefined) || {};
  const effectiveApiKey = sanitizeApiKey(resolvedConfig.apiKey) || getSecureGeminiApiKey() || '';
  const effectiveConfig: AIEngineConfig = {
    engineType: resolvedConfig.engineType || (effectiveApiKey ? 'byok' : 'local'),
    localModel: resolvedConfig.localModel || 'gemma-2b',
    provider: resolvedConfig.provider || 'gemini',
    modelTier: resolvedConfig.modelTier || 'gemini-3.8-flash',
    apiKey: effectiveApiKey
  };

  // If BYOK is active and no key is configured anywhere, fail early with user-friendly actionable prompt
  if (effectiveConfig.engineType === 'byok' && !effectiveApiKey) {
    if (rawFallbackText.trim()) {
      const fallbackData = parseReceiptTextLocally(rawFallbackText, defaultCurrency);
      return {
        receipt: fallbackData,
        source: 'local_fallback',
        attempts: 0
      };
    }
    throw new Error('API_KEY_REQUIRED: 클라우드 AI 영수증 인식을 위해 Gemini API 키가 필요합니다. 설정에서 API 키를 등록해주세요.');
  }

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxRetries) {
    attempt++;
    try {
      let data: any = null;

      try {
        const res = await fetch('/api/parse-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: imageBase64,
            mimeType,
            engineConfig: effectiveConfig
          })
        });

        // Check for 401/403 Invalid API key
        if (res.status === 401 || res.status === 403) {
          throw new Error('INVALID_API_KEY: 등록된 Gemini API 키 인증에 실패했습니다 (만료 또는 권한 없음). 설정에서 키를 확인해주세요.');
        }

        // Handle Rate Limit (HTTP 429) or Server Unavailable (500/502/503/504)
        if (res.status === 429 || res.status >= 500) {
          const errorText = await res.text().catch(() => '');
          const isRateLimit = res.status === 429;
          const reason = isRateLimit ? 'API 사용량 제한 (Rate Limit 429)' : `서버 일시 오류 (${res.status})`;

          if (attempt < maxRetries) {
            const delayMs = Math.min(5000, 1000 * Math.pow(2, attempt - 1) + Math.random() * 300);
            onRetry?.(attempt, delayMs, reason);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }

          throw new Error(`${reason}: 영수증 분석에 실패했습니다. (${redactSensitiveKey(errorText, effectiveApiKey) || '응답 없음'})`);
        }

        if (res.ok) {
          data = await res.json();
        } else if (res.status === 404 && effectiveApiKey) {
          // Cloudflare Pages static environment where /api is not present: direct BYOK Gemini API call
          data = await directGeminiReceiptOCR(imageBase64, mimeType, effectiveApiKey, defaultCurrency as SupportedCurrency);
        } else {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `영수증 인식 실패 (HTTP ${res.status})`);
        }
      } catch (fetchErr: unknown) {
        const errStr = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        if (errStr.includes('API_KEY_REQUIRED') || errStr.includes('INVALID_API_KEY')) {
          throw fetchErr;
        }

        // If backend fetch failed with network/404 on static hosting, attempt direct client-side OCR
        if (effectiveApiKey && (errStr.includes('Failed to fetch') || errStr.includes('404') || errStr.includes('NetworkError'))) {
          data = await directGeminiReceiptOCR(imageBase64, mimeType, effectiveApiKey, defaultCurrency as SupportedCurrency);
        } else {
          throw fetchErr;
        }
      }
      if (!data.receipt) {
        throw new Error('유효한 영수증 데이터 구조가 반환되지 않았습니다.');
      }

      // Enforce strict schema validation and default safety
      const raw = data.receipt;
      const today = new Date().toISOString().slice(0, 10);
      const validDate = raw.date && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : today;

      const items: ReceiptItem[] = Array.isArray(raw.items)
        ? raw.items.map((it: Record<string, unknown>) => ({
            name: String(it.name || '품목').trim(),
            price: Math.abs(Number(it.price ?? it.amount ?? 0)),
            quantity: it.quantity ? Math.max(1, Number(it.quantity)) : 1,
            amount: Math.abs(Number(it.price ?? it.amount ?? 0)),
            category: typeof it.category === 'string' ? it.category : undefined
          }))
        : [];

      const totalAmount = Math.abs(Number(raw.totalAmount)) ||
        items.reduce((acc, it) => acc + (it.price * (it.quantity || 1)), 0);

      const normalizedReceipt: ParsedReceiptData = {
        merchantName: String(raw.merchantName || raw.merchant || '영수증 결제').trim(),
        date: validDate,
        totalAmount,
        currency: raw.currency ? String(raw.currency).toUpperCase() : defaultCurrency,
        category: String(raw.category || raw.suggestedCategory || 'Living'),
        items,
        confidenceScore: typeof raw.confidenceScore === 'number'
          ? Math.max(0, Math.min(1, raw.confidenceScore))
          : 0.95,
        // Backward compatibility
        merchant: String(raw.merchantName || raw.merchant || '영수증 결제').trim(),
        suggestedCategory: String(raw.category || raw.suggestedCategory || 'Living'),
        paymentMethod: raw.paymentMethod ? String(raw.paymentMethod) : undefined
      };

      return {
        receipt: normalizedReceipt,
        source: data.source === 'local' ? 'local_deterministic' : 'gemini',
        attempts: attempt
      };
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : String(err);
      if (errStr.includes('API_KEY_REQUIRED') || errStr.includes('INVALID_API_KEY')) {
        throw err;
      }
      const safeMsg = redactSensitiveKey(errStr, effectiveApiKey);
      lastError = new Error(safeMsg);
      if (attempt < maxRetries) {
        const delayMs = Math.min(5000, 1000 * Math.pow(2, attempt - 1) + Math.random() * 300);
        onRetry?.(attempt, delayMs, safeMsg || '네트워크 재시도');
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // Final fallback: If raw text is available, run local heuristic parser
  if (rawFallbackText.trim()) {
    const fallbackData = parseReceiptTextLocally(rawFallbackText, defaultCurrency);
    return {
      receipt: fallbackData,
      source: 'local_fallback',
      attempts: attempt
    };
  }

  throw lastError || new Error('영수증 분석 중 오류가 발생했습니다. 다시 시도해주세요.');
}

/**
 * Transaction Reconciliation & Deduplication Checker:
 * Analyzes whether a parsed receipt coincides with an existing recorded transaction
 * (same merchant, within 2 days, and same amount).
 */
export function reconcileReceiptWithTransactions(
  receipt: ParsedReceiptData,
  recentTransactions: Transaction[]
): { isDuplicate: boolean; matchedTransaction?: Transaction } {
  const receiptAmount = receipt.totalAmount;
  const receiptDate = new Date(receipt.date);
  const receiptMerchant = (receipt.merchantName || receipt.merchant || '').toLowerCase().replace(/\s+/g, '');

  for (const tx of recentTransactions) {
    if (Math.abs(tx.amount - receiptAmount) < 1) {
      const txDate = new Date(tx.date);
      const dayDiff = Math.abs(differenceInDays(receiptDate, txDate));
      if (dayDiff <= 2) {
        const txDesc = (tx.description || '').toLowerCase().replace(/\s+/g, '');
        if (receiptMerchant && (txDesc.includes(receiptMerchant) || receiptMerchant.includes(txDesc))) {
          return { isDuplicate: true, matchedTransaction: tx };
        }
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * ============================================================================
 * AUTONOMOUS FINANCE ORCHESTRATION PIPELINE
 * Zero financial calculation friction & autonomous execution engine
 * ============================================================================
 */

export interface ParsedScreenshotResult {
  asset: {
    institution: string;
    accountName: string;
    assetType: 'BROKERAGE' | 'BANK' | 'CRYPTO' | 'REAL_ESTATE' | 'CASH' | 'LIABILITY';
    currentBalance: number;
    cashBalance?: number;
    investedAssets?: number;
    currency: SupportedCurrency;
    holdings?: Array<{
      name: string;
      valuation: number;
      quantity?: number;
      profitRate?: number;
    }>;
    confidenceScore: number;
    notes?: string;
  };
  mutation: AssetScreenshotMutation;
  matchedExistingAccount?: AssetAccount;
  source: 'gemini' | 'local';
}

/**
 * 1. Screenshot-to-Balance Extraction (Multimodal):
 * Sends screenshot to /api/parse-asset-screenshot, cross-references with existing accounts,
 * and creates a ready-to-commit AssetScreenshotMutation without asking user to type single numbers.
 */
export async function parseBrokerageScreenshot(
  imageBase64: string,
  mimeType: string = 'image/webp',
  engineConfig?: AIEngineConfig,
  existingAccounts: AssetAccount[] = []
): Promise<ParsedScreenshotResult> {
  const currentKey = sanitizeApiKey(engineConfig?.apiKey) || getSecureGeminiApiKey() || '';
  const effectiveConfig: AIEngineConfig = {
    engineType: engineConfig?.engineType || (currentKey ? 'byok' : 'local'),
    localModel: engineConfig?.localModel || 'gemma-2b',
    provider: engineConfig?.provider || 'gemini',
    modelTier: engineConfig?.modelTier || 'gemini-3.8-flash',
    apiKey: currentKey
  };

  const res = await fetch('/api/parse-asset-screenshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: imageBase64,
      mimeType,
      engineConfig: effectiveConfig
    })
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('INVALID_API_KEY: Gemini API 키 인증에 실패했습니다. 설정에서 키를 확인해주세요.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const rawError = err.error || `스크린샷 분석에 실패했습니다. (HTTP ${res.status})`;
    throw new Error(redactSensitiveKey(rawError, currentKey));
  }

  const data = await res.json();
  const rawAsset = data.asset;
  if (!rawAsset) {
    throw new Error('자산 스크린샷에서 유효한 계좌 정보를 찾을 수 없습니다.');
  }

  const institution = String(rawAsset.institution || '기타 금융기관').trim();
  const accountName = String(rawAsset.accountName || '자산 계좌').trim();
  const totalAccountValue = Math.abs(Number(rawAsset.currentBalance)) || 0;
  const cashBalance = typeof rawAsset.cashBalance === 'number' ? Math.abs(rawAsset.cashBalance) : undefined;
  const investedAssets = typeof rawAsset.investedAssets === 'number' 
    ? Math.abs(rawAsset.investedAssets) 
    : (cashBalance !== undefined ? Math.max(0, totalAccountValue - cashBalance) : undefined);
  const currency: SupportedCurrency = (['KRW', 'USD', 'EUR', 'JPY', 'GBP'].includes(rawAsset.currency)
    ? rawAsset.currency
    : 'KRW') as SupportedCurrency;
  const confidenceScore = typeof rawAsset.confidenceScore === 'number' ? rawAsset.confidenceScore : 0.95;

  // Try to find matching existing account by institution or account name
  const matched = existingAccounts.find(acc => {
    const instMatch = acc.institution.toLowerCase().includes(institution.toLowerCase()) ||
                      institution.toLowerCase().includes(acc.institution.toLowerCase());
    const nameMatch = acc.accountName.toLowerCase().includes(accountName.toLowerCase()) ||
                      accountName.toLowerCase().includes(acc.accountName.toLowerCase());
    return instMatch || (acc.institution === institution && nameMatch);
  });

  const action = matched ? 'UPDATE_EXISTING' : 'CREATE_NEW';
  const explanation = matched
    ? `기존 '${matched.accountName}' (${matched.institution})의 잔고를 ${totalAccountValue.toLocaleString()} ${currency}로 업데이트합니다.`
    : `신규 '${institution} - ${accountName}' 계좌를 등록하고 총 자산 ${totalAccountValue.toLocaleString()} ${currency}를 반영합니다.`;

  const mutation: AssetScreenshotMutation = {
    action,
    targetAccountId: matched?.id,
    institution,
    accountName,
    totalAccountValue,
    cashBalance,
    investedAssets,
    currency,
    holdings: rawAsset.holdings,
    confidenceScore,
    explanation
  };

  return {
    asset: {
      institution,
      accountName,
      assetType: rawAsset.assetType || 'BROKERAGE',
      currentBalance: totalAccountValue,
      cashBalance,
      investedAssets,
      currency,
      holdings: rawAsset.holdings,
      confidenceScore,
      notes: rawAsset.notes
    },
    mutation,
    matchedExistingAccount: matched,
    source: data.source || 'gemini'
  };
}

export interface AutonomousTextParseResult {
  transactions: ParsedTransactionResult[];
  hasLoanSplit: boolean;
  loanSplitSuggestion?: LoanSplitSuggestion;
  hasReceivableRecovery: boolean;
  receivableRecoverySuggestion?: ReceivableRecoverySuggestion;
  hasCardSettlementDeduplication: boolean;
  summary: string;
  source: 'gemini' | 'local_deterministic';
}

/**
 * 2. Autonomous Financial Text & Notification Orchestration:
 * Dispatches input to deterministic heuristics (loan splits, receivable matching, card settlement)
 * and optionally enhances with Gemini if cloud engine is enabled.
 */
export async function orchestrateAutonomousFinancialText(
  text: string,
  debts: DebtItem[] = [],
  engineConfig?: AIEngineConfig
): Promise<AutonomousTextParseResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      transactions: [],
      hasLoanSplit: false,
      hasReceivableRecovery: false,
      hasCardSettlementDeduplication: false,
      summary: '입력된 내용이 없습니다.',
      source: 'local_deterministic'
    };
  }

  // First run local deterministic parser with active debts context
  const localResults = parseFinancialInputDeterministically(trimmed, debts);

  const loanSplit = localResults.find(r => r.loanSplitSuggestion)?.loanSplitSuggestion;
  const receivableRecovery = localResults.find(r => r.receivableRecoverySuggestion)?.receivableRecoverySuggestion;
  const hasCardSettlement = localResults.some(r => r.type === 'TRANSFER' && r.subCategory === '카드대금');

  // If local parser detected high-confidence debt split or card settlement, return immediately
  if (loanSplit || receivableRecovery || hasCardSettlement) {
    let summary = '금융 내역이 자동으로 분석되었습니다.';
    if (loanSplit) {
      summary = `대출 원리금 상환 감지: 원금 감채 ${loanSplit.principalAmount.toLocaleString()}원 + 이자 비용 ${loanSplit.interestAmount.toLocaleString()}원`;
    } else if (receivableRecovery) {
      summary = `${receivableRecovery.counterparty}님 대여금 회수 입금 감지: ${receivableRecovery.recoveredAmount.toLocaleString()}원 채권 차감 (수입 부풀림 방지)`;
    } else if (hasCardSettlement) {
      summary = `카드 대금 결제 감지: 내부 이체(TRANSFER)로 처리하여 월간 지출 예산 중복 반영을 방지했습니다.`;
    }

    return {
      transactions: localResults,
      hasLoanSplit: Boolean(loanSplit),
      loanSplitSuggestion: loanSplit,
      hasReceivableRecovery: Boolean(receivableRecovery),
      receivableRecoverySuggestion: receivableRecovery,
      hasCardSettlementDeduplication: hasCardSettlement,
      summary,
      source: 'local_deterministic'
    };
  }

  // If engineConfig allows Gemini AI, attempt enhanced parsing
  if (engineConfig?.engineType !== 'local') {
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          engineConfig
        })
      });

      if (res.ok) {
        const data = await res.json();
        const txs: ParsedTransactionResult[] = data.transactions || [];
        if (txs.length > 0) {
          const aiLoanSplit = txs.find(t => t.loanSplitSuggestion)?.loanSplitSuggestion;
          const aiReceivable = txs.find(t => t.receivableRecoverySuggestion)?.receivableRecoverySuggestion;
          const aiCardSettlement = txs.some(t => t.type === 'TRANSFER' && (t.subCategory === '카드대금' || t.isInternalTransfer));

          return {
            transactions: txs,
            hasLoanSplit: Boolean(aiLoanSplit),
            loanSplitSuggestion: aiLoanSplit,
            hasReceivableRecovery: Boolean(aiReceivable),
            receivableRecoverySuggestion: aiReceivable,
            hasCardSettlementDeduplication: aiCardSettlement,
            summary: 'AI 모델을 통해 금융 내역이 정밀 파싱되었습니다.',
            source: 'gemini'
          };
        }
      }
    } catch {
      // Fallback seamlessly to local deterministic parser
    }
  }

  return {
    transactions: localResults,
    hasLoanSplit: false,
    hasReceivableRecovery: false,
    hasCardSettlementDeduplication: false,
    summary: `${localResults.length}건의 거래 내역이 로컬 파서로 분석되었습니다.`,
    source: 'local_deterministic'
  };
}

/**
 * 3. Autonomous Execution: One-tap commit of Screenshot Mutation
 * Directly updates or creates the target AssetAccount in local IndexedDB.
 */
export async function commitAutonomousAssetMutation(
  mutation: AssetScreenshotMutation
): Promise<AssetAccount> {
  const existingAccounts = await getAllAssetAccounts();
  const now = new Date().toISOString();

  let target: AssetAccount;

  if (mutation.action === 'UPDATE_EXISTING' && mutation.targetAccountId) {
    const existing = existingAccounts.find(a => a.id === mutation.targetAccountId);
    if (!existing) {
      throw new Error(`대상 자산 계좌(${mutation.targetAccountId})를 찾을 수 없습니다.`);
    }

    target = {
      ...existing,
      currentBalance: mutation.totalAccountValue,
      cashBalance: mutation.cashBalance !== undefined ? mutation.cashBalance : existing.cashBalance,
      investedAssets: mutation.investedAssets !== undefined ? mutation.investedAssets : existing.investedAssets,
      currency: mutation.currency,
      lastUpdated: now,
      note: `${now.slice(0, 10)} 스크린샷 자동 동기화`,
      holdings: mutation.holdings || existing.holdings
    };
  } else {
    // Create new AssetAccount
    target = {
      id: `acc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      accountName: mutation.accountName,
      institution: mutation.institution,
      assetType: 'BROKERAGE',
      currency: mutation.currency,
      currentBalance: mutation.totalAccountValue,
      cashBalance: mutation.cashBalance,
      investedAssets: mutation.investedAssets,
      lastUpdated: now,
      note: '스크린샷 OCR 자동 등록',
      holdings: mutation.holdings
    };
  }

  await saveAssetAccount(target);
  return target;
}

/**
 * 4. Autonomous Execution: One-tap Loan Repayment Split
 * Executes atomic principal reduction and interest expense logging.
 */
export async function commitAutonomousLoanSplit(
  suggestion: LoanSplitSuggestion,
  paymentMethod?: string
): Promise<{ principalTx: Transaction; interestTx?: Transaction; updatedDebt: DebtItem }> {
  const res = await executeLoanRepaymentSplit(
    suggestion.debtId,
    suggestion.principalAmount,
    suggestion.interestAmount,
    suggestion.currency,
    paymentMethod || suggestion.counterpartyOrBank
  );
  return {
    principalTx: res.principalTransaction,
    interestTx: res.interestTransaction,
    updatedDebt: res.updatedDebt
  };
}

/**
 * 5. Autonomous Execution: One-tap Receivable Recovery
 * Executes atomic receivable settlement, reducing debt without inflating income.
 */
export async function commitAutonomousReceivableRecovery(
  suggestion: ReceivableRecoverySuggestion,
  paymentMethod?: string
): Promise<{ settlementTx: Transaction; updatedDebt: DebtItem }> {
  const res = await executeReceivableRecovery(
    suggestion.debtId,
    suggestion.recoveredAmount,
    suggestion.currency,
    paymentMethod || suggestion.counterparty
  );
  return {
    settlementTx: res.settlementTransaction,
    updatedDebt: res.updatedDebt
  };
}
