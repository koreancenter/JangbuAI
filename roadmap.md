# roadmap.md: Vibe Ledger Global SaaS Engineering Roadmap

## Milestone Overview

```
[Phase 1: Critical Fixes & AI Reliability] ──> [Phase 2: Single-Surface UI/UX] ──> [Phase 3: Multi-Currency & Multimodal] ──> [Phase 4: Autonomous Intelligence]
              (Week 1)                                   (Week 2)                                 (Week 3)                                (Week 4)
```

---

## Phase 1: AI Parser Reliability & Financial Accuracy (Sprint 1)
> **Objective**: Eliminate parsing errors (e.g., `-₩4` parsing bug), implement robust Korean number normalization, and achieve 0% `Uncategorized` on common transactions.

- [x] **1.1 Korean Number & Currency Parser Engine**
  - Implement parsing for `만원`, `천원`, `억`, `k`, `m`, and decimal amounts (e.g. `4만원` -> `40,000`, `1.5만` -> `15,000`).
  - Add test suites covering Korean split billing (더치페이), transfer statements, and multi-clause inputs.
- [x] **1.2 Merchant & Category Lexicon Integration**
  - Integrate top 500 domestic & global merchant rules (스타벅스 -> `Food > Cafe`, 이마트 -> `Food > Grocery`, 넷플릭스 -> `Fixed > Subscriptions`).
  - Eliminate generic `미분류 · General` fallbacks by inferring highest-probability category.
- [x] **1.3 Structured Output Validation & Anonymization**
  - Add server-side schema verification preventing negative number inversions and malformed JSON responses.
  - Enforce automated stripping of card numbers, bank accounts, and phone numbers before LLM inference.
- [x] **1.4 AI Resilience, Strict Structured Outputs & Image Pre-processing**
  - Gemini Vision strict `responseSchema` with `merchantName`, `date` (YYYY-MM-DD), `totalAmount`, `currency`, `category`, `items`, and `confidenceScore`.
  - Client-side Canvas downscaling to max 1280x1280px WebP/JPEG (0.8 quality) with automatic EXIF stripping.
  - Exponential backoff retry engine (up to 3 attempts, jittered backoff) for HTTP 429 rate-limits.
  - Seamless offline pre-flight detection and graceful fallback to `parseReceiptTextLocally` in `financialParser.ts`.

---

## Phase 2: Design System Refactoring & Visual Hierarchy (Sprint 2)
> **Objective**: Strip out nested cards, eliminate text clipping, unify light/dark surface tokens, and implement Linear/Revolut grade visual polish.

- [x] **2.1 Single-Surface Canvas Conversion**
  - Refactor `FinancialSummaryCard` and `App.tsx` to eliminate 4-level nested borders and redundant shadows.
  - Standardize container padding to 20px desktop / 16px mobile with mathematical corner radius calculations.
- [x] **2.2 Text Clipping & Layout Fixes**
  - Fix horizontal segment controls in `SettingsModal.tsx` (`자산 관...` -> full `자산 관리` with `whitespace-nowrap px-4 py-2`).
  - Add responsive line-wrapping and truncation safeguards to transaction feed items.
- [x] **2.3 Dark Container Normalization in Light Views**
  - Remove rogue charcoal boxes (`rgb(55, 65, 81)`) inside light mode settings drawer.
  - Implement unified semantic token classes (`--surface-raised`, `--surface-inset`).
- [x] **2.4 Financial Psychology Color Restructuring**
  - Replace aggressive fluorescent red warning banners with calm neutral slate styling and actionable contextual tips.
- [x] **2.5 Monolith Deconstruction & State Refactoring**
  - Extract domain hooks under `src/hooks/`: `useTransactions.ts` (IndexedDB CRUD & streams), `useBudgetAnalytics.ts` (FX conversions & multi-iteration chart metrics), `useAutonomousEngine.ts` (subscription intelligence & runway forecast).
  - Wrap modal and action callbacks in `useCallback` to prevent unnecessary component tree re-renders.
  - Decompose `src/App.tsx` into a lightweight layout, routing, and dock orchestration coordinator.

---

## Phase 3: Global Multi-Currency & Multimodal Omnibar (Sprint 3)
> **Objective**: Expand from single KRW currency to Global Multi-Currency with real-time FX conversions and multimodal receipt scanning.

- [x] **3.1 Multi-Currency Core Engine**
  - Support `KRW (₩)`, `USD ($)`, `EUR (€)`, `JPY (¥)`.
  - Add cached daily FX exchange rate provider endpoint (`/api/fx-rates`).
  - Implement one-tap dashboard currency toggle with automatic base-currency normalization.
- [x] **3.2 Multimodal Receipt Scanner**
  - Add image drag-and-drop & camera snapshot trigger to the Omnibar.
  - Implement `/api/parse-receipt` with Gemini Vision structured line-item extraction.
- [x] **3.3 Omnibar Real-Time Preview**
  - Display dynamic extraction chips (Merchant, Amount, Category) in real-time as the user types or dictates.

---

## Phase 4: Autonomous Financial Intelligence & Prosumer SaaS (Sprint 4)
> **Objective**: Position Vibe Ledger as an autonomous personal CFO with recurring subscription tracking, cashflow forecasting, and multi-device sync.

- [x] **4.1 Autonomous Subscription Detector**
  - Implement automated 30-day recurring cadence pattern detection on transaction histories.
  - Provide dedicated subscription dashboard with upcoming renewal D-day countdowns.
- [x] **4.2 Predictive Cashflow Runway**
  - Build predictive cashflow chart projecting end-of-month liquidity based on historical spending cadence.
- [x] **4.3 Local-First Backup & Cloud Sync Protocol (v2.0)**
  - Enhance IndexedDB schema to support migration versions, differential exports, and AES-GCM encrypted cloud sync.
- [x] **4.4 Performance & Bundle Optimization**
  - Audit WebGPU / On-device loading to prevent mobile battery drain and cellular payload bottlenecks.
