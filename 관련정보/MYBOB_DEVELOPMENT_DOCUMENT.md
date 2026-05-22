# MYBOB — 개발 전체 문서

> 작성일: 2026-04-30  
> 버전: 1.0.0  
> 저장소: https://github.com/luckyyyj77-wq/mybob

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [디렉터리 구조](#3-디렉터리-구조)
4. [디자인 원칙](#4-디자인-원칙)
5. [인증 흐름](#5-인증-흐름)
6. [페이지별 설계](#6-페이지별-설계)
7. [API 엔드포인트](#7-api-엔드포인트)
8. [AI 분석 파이프라인 (핵심)](#8-ai-분석-파이프라인-핵심)
9. [데이터 저장 전략](#9-데이터-저장-전략)
10. [레이아웃 시스템](#10-레이아웃-시스템)
11. [네비게이션 구조](#11-네비게이션-구조)
12. [주요 이슈 및 해결 과정](#12-주요-이슈-및-해결-과정)
13. [환경 변수](#13-환경-변수)
14. [배포](#14-배포)

---

## 1. 프로젝트 개요

**MYBOB**은 음식 사진을 찍으면 AI가 자동으로 영양정보를 분석해주는 모바일 웹 식단 기록 앱이다.

### 핵심 사용 흐름

```
사진 촬영 → AI 분석 (음식명 + 영양소) → 기록 저장 → 리포트/코칭 확인
```

### 주요 기능

- 카메라로 음식 촬영 또는 갤러리에서 이미지 업로드
- Gemini Vision AI + OpenFoodFacts DB 하이브리드 영양 분석
- 칼로리, 탄·단·지, 식이섬유, 나트륨, 비타민A/C/D, 칼슘, 철분, 칼륨 추출
- 일간/주간/월간 영양 리포트 (도넛 차트)
- AI 영양 코치 코멘트 및 다음 식사 추천
- 타임라인 형식의 식단 기록 열람
- 커뮤니티 피드 및 챌린지 탭
- Supabase 기반 회원 인증 + 사진 스토리지
- 오프라인 대비 localStorage 이중 저장

---

## 2. 기술 스택

| 분류 | 라이브러리 / 서비스 | 역할 |
|---|---|---|
| 프레임워크 | Next.js 16 (App Router) | SSR + API Routes |
| 언어 | TypeScript 5.9 | 정적 타입 |
| UI | React 19 + 인라인 스타일 | 컴포넌트 렌더링 |
| 애니메이션 | Framer Motion 12 | 페이지 전환, 결과 등장 |
| 아이콘 | react-icons 5 | 네비게이션/버튼 아이콘 |
| 카메라 | react-webcam 7 | 브라우저 카메라 스트림 |
| 차트 | Recharts 3 | 영양소 파이 차트 |
| 인증/DB | Supabase JS 2 | 사용자 세션, meals 테이블, 이미지 스토리지 |
| AI — 이미지 분석 | Google Gemini API (v1beta) | 음식 인식 + 영양 추론 |
| AI — 영양 코칭 | Google Gemini API (v1beta) | 하루 식단 피드백 생성 |
| 영양 DB | OpenFoodFacts (무료 REST API) | 공개 식품 영양 데이터 |
| CSS | Tailwind CSS 4 + 인라인 스타일 | 유틸리티 + 컴포넌트 스타일 |

---

## 3. 디렉터리 구조

```
MyBob/
├── app/
│   ├── layout.tsx                  # 루트 레이아웃: 인증 체크, 사이드바, 바텀 네비
│   ├── page.tsx                    # 홈 — 오늘 칼로리 + AI 코치
│   ├── globals.css
│   ├── capture/
│   │   └── page.tsx                # 카메라 촬영 + AI 분석 + 저장
│   ├── history/
│   │   └── page.tsx                # 타임라인 식단 기록
│   ├── report/
│   │   ├── layout.tsx              # 리포트 탭 레이아웃 (일간/주간/월간)
│   │   ├── daily/page.tsx          # 일간 리포트 + 도넛 차트
│   │   ├── weekly/page.tsx         # 주간 리포트
│   │   └── monthly/page.tsx        # 월간 리포트
│   ├── community/
│   │   ├── layout.tsx              # 커뮤니티 탭 레이아웃
│   │   ├── recommendation/page.tsx # 추천 피드
│   │   └── challenge/page.tsx      # 챌린지
│   ├── settings/
│   │   └── page.tsx                # 알림 설정, 개인정보
│   ├── auth/
│   │   ├── login/page.tsx          # 로그인
│   │   └── signup/page.tsx         # 회원가입
│   └── api/
│       ├── analyze-food/route.ts   # 핵심: Gemini + OpenFoodFacts 하이브리드 분석
│       ├── meals/route.ts          # CRUD: 식단 기록 (Supabase)
│       ├── recommendation/route.ts # AI 영양 코칭 피드백
│       └── community/route.ts      # 커뮤니티 데이터
├── lib/
│   └── supabase/client.ts          # Supabase 클라이언트 싱글턴
├── public/
├── package.json
└── .env.local                      # API 키 (git 제외)
```

---

## 4. 디자인 원칙

앱 전체를 관통하는 디자인 철학:

### 플랫 미니멀리즘
- 그림자(box-shadow) 없음 — 모든 요소는 1px 보더만 사용
- 폰트 웨이트: 기본 400 (bold 없음)
- 색상 팔레트: 검정 `#000000`, 보라 `#6B21A8`, 회색 `#9ca3af`, 흰색 `#ffffff`
- 버튼: 검정 배경 + 흰 텍스트 or 흰 배경 + 1px 회색 보더

### 모바일 퍼스트 한 화면 원칙
- 모든 페이지는 `height: calc(100svh - 65px)` + `overflow: hidden`
- 스크롤이 필요한 영역(리스트)만 `overflowY: auto`를 내부에 적용
- `100svh` — iOS Safari의 동적 viewport 대응 (100vh 대신 사용)

### 레이아웃 색상 계층
```
배경: white
구분선: #e5e7eb (1px solid)
비활성 텍스트: #9ca3af
강조: #6B21A8 (보라)
위험/삭제: #ef4444
```

---

## 5. 인증 흐름

`app/layout.tsx`의 `useEffect`에서 모든 라우트에 걸쳐 세션을 검사한다.

```
앱 진입
  │
  ├─ supabase.auth.getSession() 호출
  │
  ├─ 세션 없음 + 보호된 경로 → /auth/login 리다이렉트
  ├─ 세션 있음 + 인증 경로 → / 리다이렉트
  └─ 정상 → 렌더링
```

**보호된 경로 목록:**
```typescript
const isProtectedRoute = pathname === '/' ||
  ['/capture', '/report', '/history', '/community', '/settings']
  .some(route => pathname?.startsWith(route));
```

**인증 상태 변화 감지:**
```typescript
supabase.auth.onAuthStateChange((_event, newSession) => {
  // 로그인/로그아웃 시 즉시 라우팅 처리
});
```

로딩 중에는 스피너만 렌더링하고 레이아웃 전체를 숨긴다(`return null`이 아닌 스피너 HTML 반환).

---

## 6. 페이지별 설계

### 6.1 홈 (`app/page.tsx`)

**역할:** 오늘의 식단 요약 + AI 코치 코멘트

**레이아웃:**
```
┌─────────────────────────┐
│  무엇을 드시나요?         │  flex: 1 (위 섹션)
│  오늘 N개 기록됨          │
├─────────────────────────┤
│  💡 AI COACH             │  flex: 2 (아래 섹션)
│  • 오늘 섭취 칼로리       │
│  • 영양 밸런스 (탄/단/지) │
│  • 코치 코멘트            │
└─────────────────────────┘
```

**데이터 로딩 전략:**
1. `localStorage.getItem('mybob_meals')` — 즉시 로드
2. `GET /api/meals` — 서버 데이터 병합 (중복 제거: `food_name + calories` 조합 키)
3. 오늘 날짜 필터링 → 합산 → AI 피드백 요청

**AI 피드백 조건:** 오늘 기록이 1개 이상일 때만 `/api/recommendation` 호출

---

### 6.2 카메라 촬영 (`app/capture/page.tsx`)

**역할:** 음식 촬영 → AI 분석 → 저장

**전체 화면 고정:**
```typescript
position: 'fixed', inset: 0  // 바텀 네비 위에 완전히 덮음
```

**상태 머신:**

```
[카메라 뷰]
  imageSrc = null
  cameraReady = false → true (onUserMedia 콜백)
  
    ↓ 촬영 버튼 클릭 (cameraReady === true일 때만 활성)
    
[프리뷰 뷰]
  imageSrc = base64 string
  analysis = null
  
    ↓ "AI 분석 시작" 버튼
    
  loadingAnalysis = true
  
    ↓ 분석 완료
    
  analysis = AnalysisResult
  
    ↓ "기록에 저장" 버튼
    
  saved = true
  
    ↓ "추가 촬영" → retake() → imageSrc = null (웹캠 스트림 유지)
    ↓ "홈으로" → Link href="/"
```

**카메라 권한 유지:**
- `Webcam` 컴포넌트는 `imageSrc` 상태와 무관하게 항상 마운트 유지
- `retake()`는 `setImageSrc(null)`, `setAnalysis(null)`만 실행 — 웹캠 언마운트 없음
- `cameraReady` 플래그: `onUserMedia` 콜백에서 `true`로 설정, 이후 재촬영에도 유지

**패널 구조 (분석 후):**
```
┌──────────────────────┐
│  이미지 (flex: 0 0 45%)│  overflow: hidden
├──────────────────────┤
│  스크롤 가능 결과 영역  │  flex: 1, overflowY: auto
│  - 음식명 + 칼로리     │
│  - 탄·단·지 그리드     │
│  - 비타민·무기질 배지  │
│  - 저장 완료 메시지    │
├──────────────────────┤
│  버튼 고정 영역        │  flexShrink: 0 (항상 보임)
│  [기록에 저장]         │
│  [추가 촬영] [홈으로]  │
└──────────────────────┘
```

> **핵심 설계 결정:** 버튼 영역을 `marginTop: 'auto'`로 처리하면 결과 콘텐츠가 많아질 때 버튼이 화면 밖으로 밀린다. 결과 영역에 `overflowY: auto`를 주고 버튼을 `flexShrink: 0`으로 분리하여 해결.

---

### 6.3 타임라인 (`app/history/page.tsx`)

**역할:** 전체 식단 기록을 시간 역순으로 열람

**레이아웃:**
- 고정 헤더 + 스크롤 가능한 리스트 영역
- 세로 타임라인 선: `position: absolute, left: 10px, width: 1px`
- 각 항목: 원형 도트 + 카드 (사진 썸네일, 음식명, 칼로리, 시간)
- Framer Motion `staggered` 등장: `delay: i * 0.03`

---

### 6.4 리포트 (`app/report/`)

**레이아웃 (`report/layout.tsx`):**
- `height: calc(100svh - 65px)`
- 헤더 (REPORT / 리포트 제목 + 뒤로가기)
- 탭 바 (일간 / 주간 / 월간) — 활성 탭: 검정 배경

**일간 리포트 (`report/daily/page.tsx`):**
- 2×2 스탯 카드 그리드 (총 칼로리, 기록 횟수, 탄수화물, 단백질)
- Recharts `PieChart` (도넛형) — 탄·단·지 비율 시각화
- 오늘 식사 메뉴 목록

---

### 6.5 설정 (`app/settings/page.tsx`)

- 푸시 알림 주기: `<select>` 드롭다운
- AI 분석 알림: 커스텀 토글 스위치 (CSS 전환)
  ```typescript
  // 토글 핵심 — backgroundColor로 on/off 표현
  backgroundColor: aiAlert ? 'black' : 'white'
  // 원형 핸들 위치
  left: aiAlert ? '20px' : '3px'
  ```
- 이메일 변경, 회원 탈퇴 섹션

---

### 6.6 인증 (`app/auth/`)

- **로그인:** 이메일 + 비밀번호 → `supabase.auth.signInWithPassword()`
- **회원가입:** 이메일 + 비밀번호 확인 → `supabase.auth.signUp()`
- 공통: 1px 보더, 그림자 없음, 검정 제출 버튼

---

## 7. API 엔드포인트

### `POST /api/analyze-food`

음식 이미지를 분석하여 영양정보를 반환한다. → [8장 상세 설명](#8-ai-분석-파이프라인-핵심)

**요청:**
```json
{ "image": "data:image/jpeg;base64,..." }
```

**응답 (성공):**
```json
{
  "success": true,
  "food": {
    "name": "된장찌개",
    "calories": 180,
    "category": "한식",
    "amount": "1인분",
    "nutrients": {
      "carbohydrates": 15,
      "protein": 12,
      "fat": 7,
      "fiber": 3,
      "sugar": 2,
      "sodium": 820,
      "vitaminA": 45,
      "vitaminC": 8,
      "vitaminD": 0,
      "calcium": 120,
      "iron": 2,
      "potassium": 380
    }
  },
  "modelUsed": "gemini-2.5-flash",
  "source": "hybrid"
}
```

**source 값:**
- `"hybrid"` — Gemini + OpenFoodFacts 데이터 결합
- `"gemini_only"` — Gemini 단독 추론
- `"openfoodfacts_only"` — Gemini 실패, DB 데이터만 반환

---

### `GET /api/meals`

사용자의 전체 식단 기록 조회 (Supabase `meals` 테이블)

**인증:** `Authorization: Bearer <token>` (없으면 게스트 모드)

**응답:**
```json
{ "success": true, "data": [ /* Meal[] */ ] }
```

---

### `POST /api/meals`

식단 기록 저장

**요청:**
```json
{
  "mealData": { "name": "...", "calories": 300, "nutrients": {...} },
  "imageBase64": "data:image/jpeg;base64,..."
}
```

**처리 순서:**
1. JWT 토큰으로 사용자 확인
2. Base64 이미지 → `ArrayBuffer` 디코딩 → Supabase Storage `meal_photos` 버킷에 업로드
3. 퍼블릭 URL 획득
4. `meals` 테이블에 INSERT (user_id, food_name, category, calories, nutrient JSON, photo_url)

---

### `POST /api/recommendation`

하루 영양 데이터를 받아 AI 코칭 피드백 생성

**요청:**
```json
{ "nutrients": { "calories": 1800, "carbs": 220, "protein": 80, "fat": 60 } }
```

**응답:**
```json
{
  "success": true,
  "data": {
    "feedback": "전반적인 밸런스 코멘트",
    "goodPoint": "잘한 점",
    "improvement": "개선점",
    "recommendation": { "menu": "추천 메뉴명", "reason": "영양학적 이유" }
  }
}
```

---

## 8. AI 분석 파이프라인 (핵심)

`app/api/analyze-food/route.ts`

한계: 무료 Gemini API는 분당 호출 한도가 낮고, 음식명 인식 정확도와 미량 영양소 추론에 한계가 있다.

**해결 전략: 3단계 하이브리드 파이프라인**

```
이미지 입력
    │
    ▼
[Step 1] Gemini Vision — 음식명만 추출 (저비용)
    │  gemini-2.0-flash
    │  프롬프트: "음식 이름만 한국어로 짧게"
    │  → "된장찌개"
    │
    ▼
[Step 2] OpenFoodFacts API — 무료 영양 DB 조회
    │  https://world.openfoodfacts.org/cgi/search.pl
    │  검색어: 음식명 (한국어)
    │  → 100g 기준 영양소 → 200g(1인분) 환산
    │  carbohydrates, protein, fat, fiber, sugar, sodium
    │  vitaminC, calcium, iron (있는 경우)
    │
    ▼
[Step 3] Gemini Vision — 전체 분석 (DB 데이터를 컨텍스트로 제공)
    │  modelsToTry: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
    │  프롬프트에 DB 데이터 포함 → Gemini가 사진 보정 + 비타민 추론
    │  response_mime_type: 'application/json'
    │  temperature: 0.2 (일관성 우선)
    │
    ▼
[Step 4] 데이터 병합
    │  DB 칼로리와 Gemini 칼로리 차이 < 50% → DB 탄단지 우선 적용
    │  비타민/무기질은 DB 값이 0보다 크면 DB로 덮어씀
    │
    ▼
응답 반환
```

### Gemini 모델 폴백 로직

```typescript
const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

for (const model of modelsToTry) {
  const res = await fetch(`.../${model}:generateContent?key=${apiKey}`, ...);
  
  if (res.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
    return { success: true, food: parsed, modelUsed: model };
  }
  
  // quota/RESOURCE_EXHAUSTED 에러면 다음 모델로
  if (errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
    continue;
  }
  
  return { success: false, error: errMsg };
}
```

> **모델 변천 이력:**  
> `gemini-1.5-flash` (deprecated 2025) → `gemini-1.5-pro` (deprecated 2025) → **현재:** `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`

### OpenFoodFacts 영양 환산 로직

```typescript
// 100g 기준 → 1인분(200g) 환산
const portion = 200;
const per100 = (val: number | undefined) =>
  val ? Math.round((val * portion) / 100) : 0;

return {
  carbohydrates: per100(n['carbohydrates_100g']),
  protein: per100(n['proteins_100g']),       // 주의: proteins (복수)
  fat: per100(n['fat_100g']),
  fiber: per100(n['fiber_100g']),
  sugar: per100(n['sugars_100g']),            // 주의: sugars (복수)
  sodium: per100(n['sodium_100g']) * 1000,   // g → mg 변환
  vitaminC: per100(n['vitamin-c_100g']) * 1000,
  calcium: per100(n['calcium_100g']) * 1000,
  iron: per100(n['iron_100g']) * 1000,
};
```

### Gemini 분석 프롬프트 구조

```
당신은 전문 영양사이자 음식 분석 AI입니다.

[DB 데이터가 있을 때]
OpenFoodFacts DB에서 가져온 기본 영양정보 (참고용):
탄수화물 Xg, 단백질 Xg, 지방 Xg, 칼로리 Xkcal.
이 값을 기반으로 실제 사진 속 음식의 양을 고려해 조정하고,
비타민·무기질을 추가로 추론해주세요.

[DB 데이터 없을 때]
이미지만 보고 음식명과 영양정보를 추론해주세요.
일반적인 한식 1인분(약 200g) 기준으로 추정하세요.

응답 JSON 형식: { name, calories, category, amount, nutrients: { ... } }

중요:
- 음식명은 반드시 한국어로
- 모르는 값은 0이 아닌 일반적인 추정값 사용
- JSON 외 다른 텍스트 절대 포함 금지
```

---

## 9. 데이터 저장 전략

### 이중 저장 구조

```
사용자가 "기록에 저장" 클릭
        │
        ├─► localStorage ['mybob_meals'] 배열에 prepend  ← 즉시, 오프라인에서도 동작
        │
        └─► POST /api/meals → Supabase meals 테이블     ← 서버 영구 저장
                            → Supabase Storage 이미지 업로드
```

### 데이터 병합 (중복 제거)

서버와 로컬 데이터를 합칠 때 `food_name + calories` 조합을 키로 사용:

```typescript
const keys = new Set(serverData.map(m => `${m.food_name}_${m.calories}`));
combined = [...serverData, ...localData.filter(m => !keys.has(`${m.food_name}_${m.calories}`))];
```

서버 데이터를 우선으로, 로컬에만 있는 항목을 뒤에 추가한다.

### Supabase 테이블 스키마 (`meals`)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | auth.users 외래키 |
| food_name | text | 음식명 |
| category | text | 한식/중식/일식/양식/간식/음료 |
| calories | int | kcal |
| nutrient | jsonb | 영양소 상세 (탄·단·지·비타민 등) |
| amount | int | 수량 |
| price | int | 가격 (기본 0) |
| location | text | 위치 (기본 '알 수 없음') |
| photo_url | text | Supabase Storage 퍼블릭 URL |
| created_at | timestamptz | 기록 시각 |

---

## 10. 레이아웃 시스템

### 전체 레이아웃 구조

```
<html>
  <body style="display: flex; flex-direction: column; height: 100%">
    
    [사이드바 오버레이 — position: fixed, inset: 0, z-index: 1000]
    AnimatePresence → motion.div (x: -100% → 0)
    
    <main style="flex-grow: 1; padding-bottom: showNav ? 65px : 0">
      {children}   ← 각 페이지 콘텐츠
    </main>
    
    [바텀 네비 — position: fixed, bottom: 0, z-index: 9999]
    showNav가 true일 때만 렌더링
    
  </body>
</html>
```

### 페이지 높이 공식

```css
/* 바텀 네비가 있는 모든 일반 페이지 */
height: calc(100svh - 65px);
overflow: hidden;

/* 카메라 페이지 (바텀 네비 없음) */
position: fixed;
inset: 0;
```

### `showNav` 조건

```typescript
const isAuthRoute = pathname?.startsWith('/auth');
const isCaptureRoute = pathname === '/capture';
const showNav = !isAuthRoute && !isCaptureRoute;
```

카메라 페이지에서는 바텀 네비를 완전히 숨겨 촬영 UI와 충돌을 방지한다.

---

## 11. 네비게이션 구조

### 바텀 네비바

```
┌────────────────────────────────────┐
│  ☰  (햄버거)  [○ 카메라]  TIMELINE │
└────────────────────────────────────┘
        position: fixed, bottom: 0
```

- **햄버거 버튼:** `setIsMenuOpen(prev => !prev)` — 한 번 더 누르면 닫힘
- **카메라 원:** `Link href="/capture"`, `margin-top: -28px`으로 위로 돌출
- **TIMELINE:** `Link href="/history"`, 보라색 레이블

### 풀스크린 사이드바

```
┌──────────────────────────────┐
│  MYBOB              [X 버튼] │  ← 탑 헤더 (햄버거 재클릭으로도 닫힘)
│                              │
│  🏠 홈                       │
│  📊 리포트                    │
│  👥 커뮤니티                  │
│  ⚙️ 설정                      │
│  🤝 제휴문의                  │
│                              │
│  [로그인 / 로그아웃]           │  ← 하단 인증 버튼
└──────────────────────────────┘
position: fixed, inset: 0, z-index: 1000
animation: x -100% → 0 (Framer Motion, 280ms)
```

---

## 12. 주요 이슈 및 해결 과정

### Issue 1: 바텀 네비가 카메라 화면을 가림

**원인:** 카메라 페이지도 일반 레이아웃을 공유하므로 바텀 네비가 위에 렌더링됨.

**해결:**
```typescript
// layout.tsx
const isCaptureRoute = pathname === '/capture';
const showNav = !isAuthRoute && !isCaptureRoute;
// isCaptureRoute일 때 바텀 네비 자체를 DOM에서 제거
```

---

### Issue 2: AI 분석/저장 버튼이 사라지는 현상

**원인:** 분석 패널이 `flex: 1`로 설정된 상태에서 버튼을 `marginTop: 'auto'`로 밀어 내리는 방식 사용. 비타민·무기질 뱃지 등 콘텐츠가 많아지면 버튼이 패널 영역 밖으로 overflow.

**해결:**
```
Before:
  패널 전체 flex:1 + marginTop: 'auto' 버튼

After:
  패널 → flex: 0 0 55%, overflow: hidden
    └─ 결과 영역: flex:1, overflowY: auto (스크롤 가능)
    └─ 버튼 영역: flexShrink: 0 (항상 패널 하단 고정)
```

---

### Issue 3: 카메라 재촬영 시 권한 재요청

**원인:** `imageSrc`가 있을 때 `Webcam` 컴포넌트를 조건부 언마운트 → 재마운트 시 브라우저가 권한 재요청.

**해결:**
```typescript
// Webcam은 항상 렌더링, imageSrc와 무관하게 유지
// AnimatePresence로 카메라 뷰와 프리뷰 뷰를 교체하되
// Webcam 자체는 두 뷰 바깥에 고정 마운트 유지
// retake()는 상태만 초기화
const retake = () => {
  setImageSrc(null);
  setAnalysis(null);
  setSaved(false);
  // Webcam 컴포넌트 건드리지 않음
};
```

---

### Issue 4: Gemini 모델 deprecated 오류

**오류 메시지:**
```
models/gemini-1.5-flash is not found for API version v1beta,
or is not supported for generateContent.
```

**원인:** Google이 2025년에 gemini-1.5 시리즈 전체를 API에서 제거.

**해결:**
```typescript
// Before
const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

// After
const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
```

사용 가능한 모델 확인: `GET https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}`

---

### Issue 5: Gemini API 할당량 초과로 분석 불가

**원인:** 무료 플랜은 분당 요청 횟수가 제한됨. 이미지 1장 분석에 Vision API 호출 2회 필요.

**해결 (하이브리드 파이프라인):**
- Step 1: 텍스트만 반환하는 경량 호출 (음식명만)
- Step 2: 무료 OpenFoodFacts DB로 대부분의 영양소 확보 (API 호출 없음)
- Step 3: Gemini는 DB 보완 + 비타민 추론에만 집중 → 토큰 절약
- Gemini 완전 실패 시 DB 데이터만으로도 기본 응답 반환

---

### Issue 6: 햄버거 메뉴 토글 (한 번 더 눌러 닫기)

**원인:** 처음 구현이 클릭 → 열기만 처리, 닫기는 메뉴 내 X 버튼만 존재.

**해결:**
```typescript
// 토글 방식으로 변경
<button onClick={() => setIsMenuOpen(prev => !prev)}>
```

---

## 13. 환경 변수

`.env.local` 파일에 저장 (git 추적 제외):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # 서버 사이드 전용 (클라이언트 노출 금지)

# Google Gemini
GEMINI_API_KEY=AIza...
```

| 변수 | 사용처 | 노출 범위 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 클라이언트 + 서버 | 공개 가능 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트 + 서버 | 공개 가능 (RLS로 보호) |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 API Route만 | 절대 클라이언트 노출 금지 |
| `GEMINI_API_KEY` | 서버 API Route만 | 절대 클라이언트 노출 금지 |

---

## 14. 배포

### 로컬 실행

```bash
npm install
npm run dev       # http://localhost:3000
```

### 프로덕션 빌드

```bash
npm run build
npm run start
```

### Git 저장소

- 원격: `https://github.com/luckyyyj77-wq/mybob.git`
- 브랜치: `main` (단일 브랜치 운영)
- 커밋 컨벤션: `fix:`, `feat:`, `refactor:` 프리픽스

### 주요 커밋 이력

| 커밋 | 내용 |
|---|---|
| 초기 구현 | 전체 앱 리디자인 (모바일 플랫 미니멀) |
| 카메라 개선 | 권한 유지, 버튼 구조 수정 |
| 하이브리드 AI | Gemini + OpenFoodFacts 3단계 파이프라인 |
| `1d30e80` | Gemini 1.5 deprecated → 2.x 모델 교체 |
| `5c71b22` | 분석 후 버튼 화면 밖 밀림 버그 수정 |

---

*이 문서는 MYBOB v1.0.0 기준으로 작성되었습니다.*
