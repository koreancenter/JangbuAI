# SPED.md: Vibe Ledger Technical Specification (System & Product Engineering Document)

*Note: This is the engineering specification document conforming to SPEC.md.*

## 1. Architecture & Services
- Frontend: React 19, TypeScript, Tailwind CSS v4, Motion, Lucide icons.
- Server Layer: Node.js Express server (`server.ts`) acting as security proxy for Gemini API and currency FX rates.
- Data Storage: Local-First IndexedDB (`idb`) with full offline availability and client-side encryption support.

## 2. Two-Tier Natural Language & Financial Parser
- **Tier 1 (Client/Local Heuristic)**: Deterministic regex and dictionary for Korean & English currency amounts (e.g., `4만원`, `$35`, `12,000원`), merchant recognition, and payment method attribution.
- **Tier 2 (Gemini Structured Engine)**: `gemini-3.8-flash` executing structured JSON schema decoding with automated fallback on network degradation or missing API keys.

## 3. Global SaaS Feature Specifications
- **Multi-Currency**: Base currency normalization (KRW, USD, EUR, JPY) with real-time FX caching.
- **Subscription Intelligence**: Automated recurrence cadence detection (30-day recurring merchant clustering) and proactive renewal notifications.
- **Multimodal Receipt Parsing**: Drag-and-drop receipt image analysis extracting itemized breakdowns and merchant details.
- **Single-Surface Minimalist UI**: Flattened card hierarchy, zero clipped text, WCAG AA compliant financial color schemes.

*For complete schema declarations, refer to `SPEC.md` and `DESIGN.md`.*
