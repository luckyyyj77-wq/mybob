# MyBob i18n 다국어 구현 기획문서

> 브랜치: `feat/i18n-multilang`
> 목표: 한국어/영어 동시 지원 (next-intl 기반)
> URL 구조: `/ko/...` | `/en/...` (기본값: 브라우저 언어 자동 감지)

---

## 결정 필요 사항 (작업 전 확인)

- [ ] **기본 언어 URL**: 영어가 기본이면 `/capture` (prefix 없음), 한국어가 기본이면 `/ko/capture`
  - 권장: 영어 기본 (`/capture` = 영어, `/ko/capture` = 한국어)
- [ ] **천인회 영문명**: "Founding Member Program" 으로 영미권 적용 여부
- [ ] **영문 약관/정책**: AI 초안 사용 여부 (법적 검토는 별도)

---

## 전체 Phase 요약

| Phase | 내용 | 예상 시간 | 상태 |
|-------|------|-----------|------|
| 0 | 설치 및 설정 기반 | 1~2시간 | 대기 |
| 1 | 폴더 구조 재편 | 2~3시간 | 대기 |
| 2-A | 공통/레이아웃 번역 | 1시간 | 대기 |
| 2-B | 홈/캡처 번역 | 1~2시간 | 대기 |
| 2-C | 설정/히스토리 번역 | 1~2시간 | 대기 |
| 2-D | 리포트/커뮤니티 번역 | 1시간 | 대기 |
| 2-E | 인증/온보딩 번역 | 1시간 | 대기 |
| 3 | AI 프롬프트 언어 분기 | 1~2시간 | 대기 |
| 4 | 약관/정책 영문화 | 1~2시간 | 대기 |
| 5 | SEO + 마무리 | 30분 | 대기 |

---

## Phase 0: 설치 및 설정 기반 구축

### 목표
next-intl 설치 + 라우팅/미들웨어/번역 파일 뼈대 생성

### 작업 목록

**0-1. 패키지 설치**
```bash
npm install next-intl
```

**0-2. 신규 생성 파일 목록**

```
i18n/
  config.ts       ← locales, defaultLocale 정의
  request.ts      ← getRequestConfig (서버사이드 번역 로딩)
  routing.ts      ← createNavigation export (Link, useRouter 등)
middleware.ts     ← 언어 감지 + URL prefix 처리
messages/
  ko.json         ← 한국어 번역 (빈 구조만)
  en.json         ← 영어 번역 (빈 구조만)
```

**0-3. 수정 파일**
- `next.config.js` — `withNextIntl()` 래퍼 추가

**0-4. middleware.ts 핵심 설정**
- `/api/*` 경로 제외
- `/admin/*` 경로 제외 (locale prefix 없이 한국어 유지)
- `/auth/callback` 경로 제외
- 나머지 경로: Accept-Language 기반 자동 감지

### 완료 기준
- `npm run dev` 실행 시 `/ko` 또는 `/en`으로 자동 리다이렉트 됨
- 404 없이 기존 홈 화면이 보임 (아직 번역 미적용이어도 OK)

### 주의사항
- `next.config.js`가 CommonJS(`module.exports`) 방식이므로 `require('next-intl/plugin')` 사용
- next-intl 버전: 최신 stable (3.x) 설치

---

## Phase 1: 폴더 구조 재편

### 목표
`app/` 하위 페이지들을 `app/[locale]/` 아래로 이동

### 현재 → 목표 구조

```
현재                          →  목표
app/layout.tsx                →  app/layout.tsx (최소 shell만)
app/page.tsx                  →  app/[locale]/layout.tsx (새로 생성)
app/capture/page.tsx          →  app/[locale]/page.tsx
app/history/page.tsx          →  app/[locale]/capture/page.tsx
app/history/[id]/page.tsx     →  app/[locale]/history/page.tsx
app/settings/...              →  app/[locale]/history/[id]/page.tsx
app/auth/...                  →  app/[locale]/settings/...
app/report/...                →  app/[locale]/auth/...
app/community/...             →  app/[locale]/report/...
app/onboarding/page.tsx       →  app/[locale]/community/...
app/terms/...                 →  app/[locale]/onboarding/page.tsx
app/legal/...                 →  app/[locale]/terms/page.tsx (통합)
app/partnership/page.tsx      →  app/[locale]/partnership/page.tsx
                                 app/[locale]/privacy/page.tsx
                                 app/[locale]/refund/page.tsx

유지 (이동 안 함)
app/admin/**                  →  그대로 (locale 없음)
app/api/**                    →  그대로 (locale 없음)
app/auth/callback/**          →  그대로 (Supabase OAuth 콜백)
```

### 작업 목록

**1-1. 루트 `app/layout.tsx` 분리**
- 현재: `"use client"` + `usePathname` + `AuthProvider` + `AppShell` 전부 포함
- 변경: 서버 컴포넌트로 전환, `<html>` + `<body>` shell만 유지
- `AppShell` 로직 → `app/[locale]/layout.tsx`로 이동

**1-2. `app/[locale]/layout.tsx` 신규 생성**
- `NextIntlClientProvider` 주입
- 기존 `AppShell` (네비게이션 메뉴) 포함
- `AuthProvider` 포함

**1-3. 페이지 파일 이동**
- `app/page.tsx` → `app/[locale]/page.tsx`
- `app/capture/page.tsx` → `app/[locale]/capture/page.tsx`
- 나머지 페이지들 동일하게 이동

**1-4. terms/legal 통합**
- `app/terms/page.tsx` + `app/legal/terms/page.tsx` 중복 제거
- `app/[locale]/terms/page.tsx`로 통합
- 구 경로는 redirect 처리

**1-5. Link 컴포넌트 교체**
- `next/link` → `@/i18n/routing`에서 export한 `Link`로 일괄 교체
- `next/navigation`의 `useRouter`, `usePathname` → `@/i18n/routing`의 것으로 교체

**1-6. Supabase OAuth 콜백 URL 수정**
- `app/auth/login/page.tsx`의 `redirectTo` 수정
  - 현재: `window.location.origin + '/auth/callback'`
  - 변경: `window.location.origin + '/' + locale + '/auth/callback'` 또는 locale 없는 경로 유지
- Supabase 대시보드 → Authentication → URL Configuration에 영어 콜백 URL 추가

### 완료 기준
- 모든 페이지가 `/ko/...` 경로에서 정상 동작
- `/en/...` 경로에서도 404 없이 접근 가능 (아직 번역 미적용이어도 OK)
- admin, api 경로 영향 없음

### 주의사항
- `usePathname()` 반환값이 `/ko/capture` 형태가 됨 → AppShell의 `startsWith('/capture')` 비교 수정 필요
- next-intl의 `usePathname()`은 locale을 제거한 값 반환하므로 이것 사용

---

## Phase 2-A: 공통/레이아웃 번역

### 목표
네비게이션, 공통 버튼, 에러 메시지 등 공유 UI 번역

### 번역 키 구조 (`messages/ko.json`, `messages/en.json`)

```json
{
  "Common": {
    "save": "저장",
    "cancel": "취소",
    "close": "닫기",
    "loading": "로딩 중...",
    "error": "오류가 발생했습니다",
    "retry": "재시도",
    "confirm": "확인",
    "delete": "삭제",
    "edit": "수정",
    "back": "뒤로",
    "next": "다음",
    "skip": "건너뛰기",
    "free": "무료",
    "pro": "프로",
    "upgrade": "업그레이드"
  },
  "Nav": {
    "home": "홈",
    "report": "리포트",
    "community": "커뮤니티",
    "settings": "설정",
    "partnership": "제휴문의",
    "install": "앱 설치",
    "installed": "설치됨",
    "login": "로그인",
    "myAccount": "내 계정",
    "capture": "촬영"
  },
  "Plan": {
    "free": "무료",
    "pro": "PRO",
    "lifetime": "평생 PRO",
    "founding": "천인회",
    "upgradeToPro": "PRO로 업그레이드",
    "limitReached": "오늘 사용 한도에 도달했습니다"
  }
}
```

### 작업 목록
- `app/[locale]/layout.tsx`의 AppShell 메뉴 텍스트 → `t('Nav.home')` 등으로 교체
- `components/` 하위 공통 컴포넌트 번역 처리
  - `StorageModeModal.tsx`
  - `MealPhoto.tsx`

### 완료 기준
- 네비게이션 메뉴가 `/ko`에서는 한국어, `/en`에서는 영어로 표시

---

## Phase 2-B: 홈 + 캡처 번역

### 목표
가장 핵심 페이지 2개 번역 (홈, 캡처)

### 파일
- `app/[locale]/page.tsx` (홈)
- `app/[locale]/capture/page.tsx` (캡처 — 한국어 155줄, 가장 복잡)

### 번역 키 추가

```json
{
  "Home": {
    "greeting": "안녕하세요",
    "todayMeals": "오늘의 식단",
    "noMeals": "아직 기록된 식단이 없습니다",
    "startCapture": "첫 식단 촬영하기",
    "coachComment": "오늘의 코치 한마디",
    "uploadCount": "{count}번 업로드",
    "analysisCount": "{count}번 분석"
  },
  "Capture": {
    "title": "식단 촬영",
    "modes": {
      "camera": "카메라",
      "gallery": "갤러리",
      "ocr": "영양성분표",
      "manual": "직접 입력"
    },
    "analyzing": "분석 중...",
    "analyzed": "분석 완료",
    "saveBtn": "저장하기",
    "ratingLabel": "맛 평가",
    "ratings": {
      "excellent": "최고",
      "good": "좋음",
      "average": "보통",
      "poor": "별로",
      "terrible": "최악"
    },
    "mealTime": {
      "breakfast": "아침",
      "lunch": "점심",
      "dinner": "저녁",
      "snack": "간식"
    },
    "sourceLabel": {
      "gemini": "AI 분석",
      "korean_db": "한식DB",
      "korean_db_gemini": "한식DB+AI",
      "manual": "직접 입력",
      "ocr": "영양성분표"
    },
    "permDenied": "카메라 권한이 차단되어 있습니다",
    "limitReached": "오늘 분석 횟수를 모두 사용했습니다"
  }
}
```

### 주의사항
- `RATING_OPTIONS`, `SOURCE_LABEL`, `MEAL_TIMES` 같은 모듈 레벨 상수 배열 → 컴포넌트 내부로 이동 후 `useTranslations` 사용
- `useMemo`와 조합: `const ratingOptions = useMemo(() => [{ label: t('Capture.ratings.excellent'), value: 5 }, ...], [t])`

### 완료 기준
- 캡처 페이지가 `/ko`에서 한국어, `/en`에서 영어로 표시
- 분석 결과 UI도 언어 분기 확인

---

## Phase 2-C: 설정 + 히스토리 번역

### 파일
- `app/[locale]/settings/page.tsx`
- `app/[locale]/settings/account/page.tsx` (한국어 102줄)
- `app/[locale]/settings/plan/page.tsx`
- `app/[locale]/history/page.tsx`
- `app/[locale]/history/[id]/page.tsx`

### 번역 키 추가

```json
{
  "Settings": {
    "title": "설정",
    "storageMode": "저장 방식",
    "goal": "목표 설정",
    "export": "데이터 내보내기",
    "profile": "프로필",
    "logout": "로그아웃",
    "dangerZone": "위험 구역",
    "deleteAccount": "계정 삭제",
    "deleteAllData": "모든 데이터 삭제"
  },
  "History": {
    "title": "식단 기록",
    "views": {
      "timeline": "타임라인",
      "grid": "그리드",
      "gallery": "갤러리"
    },
    "sort": {
      "newest": "최신순",
      "oldest": "오래된순",
      "calories": "칼로리순"
    },
    "noHistory": "기록된 식단이 없습니다",
    "categories": {
      "korean": "한식",
      "western": "양식",
      "japanese": "일식",
      "chinese": "중식",
      "fast_food": "패스트푸드",
      "snack": "간식",
      "drink": "음료",
      "etc": "기타"
    }
  }
}
```

---

## Phase 2-D: 리포트 + 커뮤니티 번역

### 파일
- `app/[locale]/report/daily/page.tsx`
- `app/[locale]/report/weekly/page.tsx`
- `app/[locale]/report/monthly/page.tsx`
- `app/[locale]/report/diagnosis/page.tsx`
- `app/[locale]/community/` 하위 파일들

### 번역 키 추가

```json
{
  "Report": {
    "daily": "일간 리포트",
    "weekly": "주간 리포트",
    "monthly": "월간 리포트",
    "diagnosis": "AI 정밀 진단",
    "calories": "칼로리",
    "protein": "단백질",
    "carbs": "탄수화물",
    "fat": "지방",
    "goal": "목표",
    "actual": "실제",
    "noData": "이 날의 데이터가 없습니다"
  },
  "Community": {
    "title": "커뮤니티",
    "neighbors": "이웃",
    "recommendation": "추천",
    "locked": "PRO 전용 기능입니다",
    "addNeighbor": "이웃 추가",
    "pendingRequests": "받은 요청"
  }
}
```

---

## Phase 2-E: 인증 + 온보딩 번역

### 파일
- `app/[locale]/auth/login/page.tsx`
- `app/[locale]/auth/signup/page.tsx`
- `app/[locale]/onboarding/page.tsx`

### 번역 키 추가

```json
{
  "Auth": {
    "login": "로그인",
    "signup": "회원가입",
    "email": "이메일",
    "password": "비밀번호",
    "googleLogin": "Google로 계속하기",
    "forgotPassword": "비밀번호를 잊으셨나요?",
    "noAccount": "계정이 없으신가요?",
    "hasAccount": "이미 계정이 있으신가요?",
    "errors": {
      "invalidEmail": "올바른 이메일 주소를 입력해주세요",
      "wrongPassword": "비밀번호가 올바르지 않습니다",
      "emailNotFound": "등록된 이메일이 없습니다"
    }
  },
  "Onboarding": {
    "title": "저장 방식을 선택해주세요",
    "local": {
      "title": "내 기기에 저장",
      "desc": "인터넷 없이도 사용 가능, 기기 분실 시 데이터 손실"
    },
    "cloud": {
      "title": "클라우드에 저장",
      "desc": "어디서든 접근 가능, 로그인 필요"
    }
  }
}
```

### 주의사항
- Supabase 에러 메시지(`error.message`)는 영어로 반환됨 → 에러 코드별 매핑 테이블 만들기
  ```typescript
  const AUTH_ERROR_MAP: Record<string, string> = {
    'Invalid login credentials': t('Auth.errors.wrongPassword'),
    'Email not confirmed': t('Auth.errors.emailNotConfirmed'),
    ...
  }
  ```

---

## Phase 3: AI 프롬프트 언어 분기

### 목표
Gemini AI 분석 결과가 사용자 언어로 반환되도록 처리

### 파일
- `app/api/analyze-food/route.ts` (한국어 255줄 — 가장 중요)
- `app/api/recommendation/route.ts`
- `app/api/diagnosis/route.ts`

### 구현 방식
클라이언트(capture/page.tsx)에서 `locale`을 fetch body에 포함해서 전달:

```typescript
// capture/page.tsx
const { locale } = useLocale(); // next-intl hook
body: JSON.stringify({ image, mode, locale })

// analyze-food/route.ts
const { image, mode, locale } = await req.json();
const prompt = locale === 'en' ? EN_PROMPT : KO_PROMPT;
```

### 영어 프롬프트 수정 포인트
- `"name"` 필드: 영어 음식명으로 응답하도록 지시
- `"category"` 필드: `Korean/Chinese/Japanese/Western/FastFood/Snack/Drink/Other`로 변경
- 응답 언어 지시: "Respond in English" 추가
- `"description"` 필드: 한국어 설명 → 영어 설명

### 완료 기준
- 영어 사용자: AI 분석 결과가 영어로 표시
- 한국어 사용자: 기존과 동일

---

## Phase 4: 약관/정책 영문화

### 목표
terms, privacy, refund 페이지 영문 버전 작성

### 파일
- `app/[locale]/terms/page.tsx`
- `app/[locale]/privacy/page.tsx`
- `app/[locale]/refund/page.tsx`

### 처리 방식
`messages/en.json`에 영문 조항 내용 포함:

```json
{
  "Terms": {
    "title": "Terms of Service",
    "lastModified": "Last modified: May 26, 2026",
    "sections": {
      "purpose": {
        "title": "Article 1 (Purpose)",
        "body": "These terms govern..."
      }
    }
  }
}
```

### 주의사항
- 법적 문서이므로 AI 초안 후 검토 권장
- 약관 구조가 한국식(제1조)과 영미식(Article 1)이 달라 별도 작성 필요
- 기존 `/terms`, `/legal/terms` 경로 → `/ko/terms`로 redirect 처리

---

## Phase 5: SEO + 마무리

### 목표
다국어 SEO 처리 + 전체 동작 확인

### 작업 목록

**5-1. generateMetadata 적용**
```typescript
// app/[locale]/layout.tsx
export async function generateMetadata({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return {
    title: t('title'),          // "MyBob - 뭐먹었어" | "MyBob - Meal Tracker"
    description: t('description'),
    openGraph: {
      locale: locale === 'ko' ? 'ko_KR' : 'en_US'
    }
  };
}
```

**5-2. hreflang 태그 추가**
```html
<link rel="alternate" hreflang="ko" href="https://mybob.kr/ko/..." />
<link rel="alternate" hreflang="en" href="https://mybob.kr/en/..." />
```

**5-3. 최종 점검 체크리스트**
- [ ] `/` → `/ko` 또는 `/en` 자동 리다이렉트
- [ ] `/ko/capture` 정상 동작
- [ ] `/en/capture` 정상 동작
- [ ] Google 로그인 후 콜백 정상
- [ ] AI 분석 결과 언어 분기 확인
- [ ] admin 페이지 영향 없음
- [ ] Vercel 배포 후 동작 확인

---

## 파일별 번역 우선순위 전체 목록

### 높음 (사용자가 가장 자주 보는 화면)
1. `layout.tsx` AppShell 네비게이션
2. `app/[locale]/page.tsx` 홈
3. `app/[locale]/capture/page.tsx`
4. `app/[locale]/auth/login/page.tsx`

### 중간
5. `app/[locale]/history/page.tsx`
6. `app/[locale]/history/[id]/page.tsx`
7. `app/[locale]/settings/page.tsx`
8. `app/[locale]/settings/account/page.tsx`
9. `app/[locale]/report/daily/page.tsx`
10. `app/[locale]/report/weekly/page.tsx`

### 낮음 (보조 화면)
11. `app/[locale]/report/monthly/page.tsx`
12. `app/[locale]/report/diagnosis/page.tsx`
13. `app/[locale]/community/` 전체
14. `app/[locale]/onboarding/page.tsx`
15. `app/[locale]/settings/plan/page.tsx`
16. `app/[locale]/terms/page.tsx`
17. `app/[locale]/privacy/page.tsx`
18. `app/[locale]/partnership/page.tsx`

---

## 참고: next-intl 핵심 패턴

### 클라이언트 컴포넌트에서
```typescript
'use client';
import { useTranslations } from 'next-intl';

export default function MyComponent() {
  const t = useTranslations('Capture');
  return <p>{t('analyzing')}</p>;
}
```

### 서버 컴포넌트에서
```typescript
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('Home');
  return <p>{t('greeting')}</p>;
}
```

### Link 컴포넌트 (locale 자동 포함)
```typescript
import { Link } from '@/i18n/routing';
// href="/capture" → 자동으로 /ko/capture 또는 /en/capture
<Link href="/capture">촬영</Link>
```

### 현재 locale 가져오기
```typescript
import { useLocale } from 'next-intl';
const locale = useLocale(); // 'ko' | 'en'
```
