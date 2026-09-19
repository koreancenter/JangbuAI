# DESIGN.md: Vibe Ledger Global SaaS Design System

## 1. Design Philosophy & Foundations
- **Core Philosophy**: Single-surface flat hierarchy, zero visual debt, deterministic financial clarity.
- **Visual Archetype**: Linear / Revolut style minimalist prosumer fintech.
- **Anti-Slop Directives**:
  - Prohibit nested cards (card-inside-card). Surfaces rest on a single unified canvas.
  - Prohibit synthetic gradients (purple-to-cyan), neon glows, and 1px hairline card borders paired with heavy drop shadows.
  - Prohibit text clipping inside pills, tags, chips, and horizontal navigation tabs. All tags maintain `white-space: nowrap` and dynamic padding.
  - Mathematical corner radius rule: When an element with radius `R_inner` is placed within a container with padding `P` and radius `R_outer`, `R_inner = max(0, R_outer - P)`. Maximum card corner radius is 14px.

---

## 2. Color System & Tokens
All colors are defined as HSL tokens with strict contrast boundaries (WCAG AA compliance >= 4.5:1 for body text, 3:1 for large numeric data).

### 2.1 Light Surface (Default Canvas)
```css
--bg-canvas: #f8fafc;        /* Neutral canvas (5% cool undertone) */
--surface-base: #ffffff;     /* Main content surface */
--surface-raised: #f1f5f9;   /* Hover, pressed, subtle controls */
--surface-inset: #e2e8f0;    /* Segment tracks, search background */

--text-primary: #0f172a;     /* Deep slate for high-contrast legible balance */
--text-secondary: #475569;   /* Supporting metadata, timestamps */
--text-tertiary: #94a3b8;    /* Watermark labels, currency symbols */

--border-subtle: #e2e8f0;    /* 1px subtle divider lines */
--border-focus: #0f172a;     /* Sharp focus ring */
```

### 2.2 Dark Surface (Prosumer Dark Mode)
```css
--bg-canvas: #090d16;        /* Deep obsidian canvas */
--surface-base: #111827;     /* Elevated panel */
--surface-raised: #1f2937;   /* Secondary chips and buttons */
--surface-inset: #0d131f;    /* Inputs and tracks */

--text-primary: #f8fafc;
--text-secondary: #94a3b8;
--text-tertiary: #64748b;

--border-subtle: #1e293b;
--border-focus: #38bdf8;
```

### 2.3 Semantic Financial States (Psychology-Safe Palette)
Avoid aggressive saturated neon reds for normal spending. Reserve high-saturation alarms only for hard budget limits.
- **Expense / Outflow**: Neutral slate `#0f172a` (Light) / `#f8fafc` (Dark), with subtle debit marker `-`.
- **Income / Inflow**: `#059669` (Emerald 600, contrast 4.8:1 on light).
- **Transfer / Split**: `#2563eb` (Blue 600).
- **Settlement**: `#7c3aed` (Violet 600).
- **Budget Warning**: `#d97706` (Amber 600).
- **Budget Critical**: `#dc2626` (Red 600).

---

## 3. Typography Scale & Hierarchy
Typography scale matches Low Contrast Major Second (1.125) for data density and tabular numeric stability.

| Level | Size | Weight | Line Height | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display 1** | 32px | 700 (Bold) | 38px | -0.02em | Hero balance figures (`font-variant-numeric: tabular-nums`) |
| **Heading 1** | 20px | 600 (SemiBold)| 26px | -0.01em | Modal headers, section titles |
| **Heading 2** | 16px | 600 (SemiBold)| 22px | -0.005em| Feed group dates, transaction titles |
| **Body Large** | 15px | 500 (Medium) | 22px | normal | Merchant titles, input field text |
| **Body Regular**| 14px | 400 (Regular)| 20px | normal | Secondary metadata, descriptions |
| **Caption** | 12px | 500 (Medium) | 16px | +0.01em | Category badges, payment method tags, timestamps |

---

## 4. Component Architectural Specifications

### 4.1 Global App Header
- **Layout**: Single horizontal row, sticky top, height 56px, `backdrop-filter: blur(12px)`.
- **Elements**:
  - Left: Vibe Ledger logo mark + workspace title.
  - Center: AI Engine telemetry pill (Indicator dot: Green = Active, Blue = Syncing, Amber = Degraded).
  - Right: Currency switcher pill (`KRW ₩` / `USD $` / `EUR €`), Settings button.

### 4.2 Hero Financial Balance Surface
- **Layout**: Full-width flattened card without nested boxes.
- **Metrics Grid**:
  - Primary Net Balance centered or left-aligned with currency symbol.
  - Sub-metrics: Cash Flow Delta (Month-over-month % formatted in neutral tag), Total Inflow, Total Outflow presented in a 2-column inline layout divided by a hair-thin vertical border.
  - Zero red-banner warnings; contextual guidance displayed in a single actionable insight line.

### 4.3 Transaction Feed & Timeline
- **Group Header**: Sticky date row (`YYYY.MM.DD (Day)` format) with daily total outflow.
- **Item Row**:
  - Left: Category visual token (28x28px neutral round box with monochrome icon) + Merchant Name + Category Breadcrumb (`식비 > 카페`).
  - Right: Transaction Amount (`tabular-nums`, distinct sign `+` or `-`) + Payment Instrument tag (`현대카드`, `신한은행`).
  - Interactions: Slide-to-categorize, tap-to-inspect, long-press-to-split.

### 4.4 Unified Natural Language Command Bar (The Omnibar)
- **Position**: Bottom fixed container with safe-area inset adaptation.
- **Input Modalities**:
  - Voice dictation trigger with live waveform indicator.
  - Natural language text field with real-time parsing preview chips (Merchant, Amount, Category rendered before enter).
  - Receipt image upload drop/tap icon for multimodal vision parsing.
- **Zero-Friction Submission**: Quick confirmation button with keyboard `Cmd/Ctrl + Enter` binding.

### 4.5 Settings & Asset Management Drawer
- **Navigation Tabs**: Horizontal scrollable container with `scrollbar-width: none` and elastic overscroll. No text truncation (`text-overflow: clip` prohibited; use `whitespace-nowrap px-4 py-2`).
- **Surface Uniformity**: Remove all dark mode embedded containers from light mode views. All sub-sections use `--surface-raised` matching the parent modal tone.
