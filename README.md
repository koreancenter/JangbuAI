# 💸 Jangbu AI (장부 AI)

> **Private, On-Device AI Bookkeeping for Everyone.**  
> 서버 없이 기기 내부(On-Device / WebGPU)에서 100% 동작하는 프라이버시 중심의 스마트 AI 가계부

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-brightgreen.svg)](https://web.dev/progressive-web-apps/)
[![WebGPU Supported](https://img.shields.io/badge/WebGPU-Supported-blue.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

---

## 🌟 Why Jangbu AI?

시중에 있는 대부분의 AI 가계부는 당신의 **민감한 금융 거래 내역을 외부 서버로 전송**합니다.  
**Jangbu AI**는 **Privacy-First** 철학으로 제작되었습니다. WebGPU 기반의 Web LM 기술 및 On-Device AI를 활용하여, **단 하나의 금융 데이터도 외부 서버로 유출되지 않고 오직 당신의 기기 안에서만 처리**됩니다.

---

## ✨ Key Features

- **🔒 100% Zero-Server & Privacy-First:** 모든 데이터는 기기 내부(Local Storage / IndexedDB)에만 저장되고 연산됩니다.
- **🤖 Multi-AI Engine Support:**
  - **Web LM (WebGPU):** NPU나 API Key 없이 브라우저/기기 GPU만으로 완전 무료 오프라인 AI 연산.
  - **On-Device NPU:** 모바일 기기 NPU 자원을 활용한 극가성비/고성능 초경량 연산.
  - **BYOK (Bring Your Own Key):** OpenAI, Gemini 등 본인의 API Key를 직접 등록하여 초고성능 분석 이용.
- **📱 PWA & Cross-Platform:** 설치 없이 웹 브라우저로 즉시 실행, 모바일 홈 화면에 추가하여 앱처럼 활용 가능.
- **🧾 Smart Text Parsing:** 알림 문자(SMS), 카카오톡 결제 알림, 영수증 텍스트를 AI가 자동으로 인식하고 카테고리 분류.
- **🎨 Minimal & Seamless UI:** 복잡한 중첩 구조(Box-in-Box)를 제거한 클린하고 직관적인 borderless 리스트 디자인.

---

## 🏗️ Architecture & Fallback System

Jangbu AI는 사용자의 기기 환경에 맞춰 **3단계 AI 연산 시스템**을 자동으로 전환(Fallback)합니다.

```text
[User Input (SMS/Receipt)]
│
├─► 1. BYOK Key Present? ──────► [Cloud API (OpenAI/Gemini)] (Fastest & Most Accurate)
│
├─► 2. NPU Available? ─────────► [Native On-Device LLM] (Battery Efficient)
│
├─► 3. WebGPU Supported? ──────► [Web LM / WebLLM] (100% Free & Local GPU)
│
└─► 4. Low-spec / Fallback ────► [Rule-based Regex Classifier] (Instant)
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- Node.js 18.x 이상
- npm 또는 pnpm

### Installation

```bash
# 1. Repository 클론
git clone https://github.com/your-username/jangbu-ai.git

# 2. 프로젝트 디렉토리 이동
cd jangbu-ai

# 3. 의존성 패키지 설치
npm install

# 4. 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속하여 확인하세요.

---

## 📱 PWA Installation Guide

- **Android (Chrome):** 주소창 우측의 `[앱 설치]` 버튼 또는 메뉴의 `[홈 화면에 추가]` 선택.
- **iOS (Safari):** 하단 공유 아이콘(↑) 클릭 → `[홈 화면에 추가]` 선택.

---

## 🛡️ Privacy & Security

Jangbu AI는 **Zero-Knowledge Architecture**를 따릅니다.

- 별도의 회원가입이나 로그인 서버가 존재하지 않습니다.
- 모든 자산 및 가계부 데이터는 브라우저의 `IndexedDB`에 암호화되어 저장됩니다.
- 사용자가 입력한 API Key는 기기 로컬 스토리지 외에 절대 다른 곳으로 전송되지 않습니다.

---

## 🤝 Contributing

버그 제보, 기능 제안, PR(Pull Request)은 언제나 환영합니다!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
