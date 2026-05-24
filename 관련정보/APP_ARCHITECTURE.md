# MyBob 앱 아키텍처 & 운영 문서

**최초 작성:** 2026-05-24  
**버전:** 1.0  
**작성 목적:** 정식 출시 준비 — 전체 앱 흐름 시각화, 잠재적 문제 기록, 제3자 운영 가능 수준의 기술 문서

---

## 목차

1. [서비스 개요](#1-서비스-개요)
2. [기술 스택](#2-기술-스택)
3. [전체 아키텍처 구조도](#3-전체-아키텍처-구조도)
4. [페이지 구조 & 라우팅](#4-페이지-구조--라우팅)
5. [API 엔드포인트 전체 목록](#5-api-엔드포인트-전체-목록)
6. [데이터베이스 구조](#6-데이터베이스-구조)
7. [주요 데이터 흐름](#7-주요-데이터-흐름)
8. [인증 & 권한 시스템](#8-인증--권한-시스템)
9. [저장 방식 이원화 시스템](#9-저장-방식-이원화-시스템)
10. [AI 코치 시스템](#10-ai-코치-시스템)
11. [요금제 시스템](#11-요금제-시스템)
12. [외부 서비스 연동](#12-외부-서비스-연동)
13. [보안 & 암호화](#13-보안--암호화)
14. [잠재적 문제 & 대응 방안](#14-잠재적-문제--대응-방안)
15. [lib/ 핵심 모듈 설명](#15-lib-핵심-모듈-설명)
16. [확장 준비 중인 기능](#16-확장-준비-중인-기능)
17. [운영 체크리스트](#17-운영-체크리스트)

---

## 1. 서비스 개요

| 항목 | 내용 |
|------|------|
| 서비스명 | MyBob (뭐먹었어) |
| 서비스 형태 | 식단 기록 + AI 코치 분석 앱 |
| 배포 형태 | 웹앱 (PWA) + Android (Capacitor) |
| 핵심 가치 | 프라이버시 우선 — 서버 없이 로컬 저장 가능 |
| 타겟 사용자 | 한식 위주 식단을 가진 국내 사용자 |
| 수익 모델 | Free (광고) / Pro (₩900/월) / Lifetime |

---

## 2. 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js (App Router) | 16.2.4 |
| UI | React | 19.2.5 |
| 언어 | TypeScript | 5.9 |
| 스타일 | Tailwind CSS | 4.1.17 |
| 애니메이션 | Framer Motion | 12.38.0 |
| 차트 | Recharts | 3.8.1 |
| DB/Auth/Storage | Supabase | 2.84.0 |
| AI 분석 | Google Gemini | @google/generative-ai 0.24.1 |
| 이메일 | Resend | 6.12.3 |
| 로컬 저장 | IndexedDB (Native) + localStorage | — |
| 모바일 래퍼 | Capacitor Android | 8.3.4 |
| 배포 | Vercel | — |

---

## 3. 전체 아키텍처 구조도

```
┌─────────────────────────────────────────────────────────────────┐
│                         클라이언트 (브라우저/앱)                    │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  localStorage │    │  IndexedDB   │    │   Next.js Pages  │   │
│  │ (식단 메타데이터) │    │ (사진 base64) │    │  (React 컴포넌트) │   │
│  └──────────────┘    └──────────────┘    └────────┬─────────┘   │
│                                                   │              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   AuthProvider (전역)                    │    │
│  │  getSession() 1회 → session / token / loading 상태 관리  │    │
│  └─────────────────────────┬───────────────────────────────┘    │
└────────────────────────────┼────────────────────────────────────┘
                             │ Bearer Token
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js API Routes (서버)                   │
│                                                                  │
│  /api/analyze-food  /api/meals  /api/profile  /api/friends       │
│  /api/recommendation  /api/diagnosis  /api/pin-reset             │
│  /api/community  /api/upload-status  /api/admin/*                │
│                                                                  │
│  공통: JWT 검증 → user.id 획득 → RLS 기반 데이터 접근              │
└────────────┬────────────────────────┬───────────────────────────┘
             │                        │
             ▼                        ▼
┌────────────────────┐    ┌───────────────────────┐
│     Supabase       │    │     Google Gemini      │
│                    │    │                        │
│ PostgreSQL DB      │    │ Vision (이미지 분석)    │
│ Auth (JWT)         │    │ Text (코치, 진단, 추천) │
│ Storage (사진)     │    │                        │
│ RLS (보안 정책)     │    └───────────────────────┘
└────────────────────┘
                          ┌───────────────────────┐
                          │       Resend           │
                          │ PIN 초기화 OTP 이메일  │
                          └───────────────────────┘
```

---

## 4. 페이지 구조 & 라우팅

```
app/
├── layout.tsx              ← 루트 레이아웃 (AuthProvider + AppShell)
├── page.tsx                ← 홈 (일일 분석, AI 코치, 주간 통계)
│
├── auth/
│   ├── login/page.tsx      ← 로그인
│   └── signup/page.tsx     ← 회원가입
│
├── onboarding/page.tsx     ← 저장 방식 선택 (최초 1회)
├── capture/page.tsx        ← 음식 촬영/분석 (핵심 기능)
│
├── history/
│   ├── page.tsx            ← 식단 타임라인 (검색/필터/정렬)
│   └── [id]/page.tsx       ← 식단 상세 보기 (수정, 별점)
│
├── report/
│   ├── layout.tsx          ← 리포트 탭 헤더
│   ├── daily/page.tsx      ← 일일 PFC 리포트
│   ├── weekly/page.tsx     ← 주간 추세
│   ├── monthly/page.tsx    ← 월간 리포트
│   └── diagnosis/page.tsx  ← AI 상세 진단 (PRO 전용)
│
├── community/
│   ├── layout.tsx          ← 커뮤니티 탭 헤더
│   ├── recommendation/page.tsx ← 커뮤니티 피드 + 광고
│   ├── neighbors/page.tsx  ← 친구 목록/요청
│   └── challenge/page.tsx  ← 챌린지 (미구현)
│
├── settings/page.tsx       ← 설정 (프로필, 저장방식, 신체정보, 위험구역)
├── partnership/page.tsx    ← 제휴 문의
│
├── admin/
│   ├── layout.tsx
│   ├── page.tsx            ← 관리자 대시보드
│   ├── users/page.tsx      ← 사용자 관리
│   ├── meals/page.tsx      ← 전체 식단 관리
│   ├── reports/page.tsx    ← 리포트 분석
│   ├── feedback/page.tsx   ← 사용자 피드백
│   └── settings/page.tsx   ← 관리자 설정
│
└── api/                    ← (아래 5번 섹션 참조)
```

### 하단 네비게이션 구조
```
[히스토리] [홈] [촬영]
  /history    /   /capture

사이드바 메뉴 (햄버거 버튼):
  홈 / 리포트 / 커뮤니티 / 설정 / 관리자(어드민만)
```

---

## 5. API 엔드포인트 전체 목록

### 식단

| 메서드 | 경로 | 인증 | 역할 |
|--------|------|------|------|
| GET | /api/meals | ✅ 필수 | 식단 목록 조회 (날짜 파라미터 옵션) |
| POST | /api/meals | ✅ 필수 | 식단 저장 + 사진 Storage 업로드 |
| PATCH | /api/meals | ✅ 필수 | 식단 수정 (별점 등) |
| DELETE | /api/meals/delete-all | ✅ 필수 | 전체 식단 + 사진 삭제 |

### AI 분석

| 메서드 | 경로 | 인증 | 역할 |
|--------|------|------|------|
| POST | /api/analyze-food | ✅ 필수 | 이미지 → 음식명 + 영양소 분석 |
| POST | /api/recommendation | ✅ 필수 | Gemini 영양 권장사항 (10회/시간) |
| POST | /api/diagnosis | ✅ 필수 + PRO | Gemini 상세 진단 (5회/시간) |
| GET | /api/upload-status | ✅ 필수 | 일일 업로드/분석 한도 조회 |

### 프로필

| 메서드 | 경로 | 인증 | 역할 |
|--------|------|------|------|
| GET | /api/profile | ✅ 필수 | 프로필 조회 |
| PATCH | /api/profile | ✅ 필수 | 프로필 수정 (닉네임 등) |
| POST | /api/profile/avatar | ✅ 필수 + PRO | 아바타 이미지 업로드 |

### 커뮤니티

| 메서드 | 경로 | 인증 | 역할 |
|--------|------|------|------|
| GET | /api/community | 선택 (게스트 폴백) | 커뮤니티 피드 (사진 있는 식단) |
| GET | /api/friends | ✅ 필수 | 친구 목록 (수락/대기/요청) |
| POST | /api/friends | ✅ 필수 | 친구 요청 |
| PUT | /api/friends | ✅ 필수 | 친구 요청 수락/거절 |
| DELETE | /api/friends | ✅ 필수 | 친구 삭제 |

### 보안

| 메서드 | 경로 | 인증 | 역할 |
|--------|------|------|------|
| POST | /api/pin-reset | ✅ 필수 | OTP 생성 + 이메일 발송 (3회/분) |
| PUT | /api/pin-reset | ✅ 필수 | OTP 검증 (5회/10분) |

### 관리자 (Admin Email 검증)

| 메서드 | 경로 | 역할 |
|--------|------|------|
| GET | /api/admin/stats | 대시보드 통계 (사용자/식단/분석 수) |
| GET | /api/admin/users | 사용자 목록 + 플랜/분석 현황 |
| GET | /api/admin/meals | 전체 식단 검색/필터 |
| GET | /api/admin/reports | 카테고리/시간대별 분석 |

---

## 6. 데이터베이스 구조

### profiles 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | Supabase Auth user.id (PK) |
| plan | text | 'free' / 'pro' / 'lifetime' |
| nickname | text | 랜덤 생성 닉네임 |
| avatar_url | text | 아바타 이미지 URL |
| nickname_changed | boolean | 닉네임 변경 여부 (1회 제한) |
| uploads_today | int | 오늘 업로드 횟수 |
| analyses_today | int | 오늘 분석 횟수 |
| last_upload_date | date | 마지막 업로드 날짜 (초기화 기준) |
| last_analysis_date | date | 마지막 분석 날짜 |
| danger_pin_otp | text | PIN 초기화 OTP (임시, 10분) |
| danger_pin_otp_expires | timestamptz | OTP 만료 시각 |

### meals 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| user_id | uuid | FK → profiles.id |
| food_name | text | 음식명 |
| calories | numeric | 칼로리 (kcal) |
| category | text | 식사 카테고리 (아침/점심/저녁/야식/간식) |
| photo_url | text | Storage URL 또는 null |
| rating | int | 별점 (1-5) |
| nutrient | jsonb | { carbohydrates, protein, fat, sodium, fiber } |
| created_at | timestamptz | 기록 시각 (KST 기준 처리) |

### friendships 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| requester_id | uuid | 친구 요청한 사람 |
| receiver_id | uuid | 친구 요청 받은 사람 |
| status | text | 'pending' / 'accepted' |
| created_at | timestamptz | 요청 시각 |

### Storage 버킷

| 버킷명 | 경로 패턴 | 용도 |
|--------|-----------|------|
| meal_photos | {user_id}/{YYYY-MM}/{uuid}.ext | 식단 사진 |

---

## 7. 주요 데이터 흐름

### 7-1. 음식 촬영 → 분석 → 저장

```
[사용자] 카메라/갤러리로 사진 선택
    ↓
[capture/page.tsx] 이미지 리사이즈 (800px, quality 0.88) → base64
    ↓
[/api/analyze-food POST]
    1. IP rate limit 체크 (10회/분)
    2. JWT 검증
    3. 일일 분석 한도 체크 (checkAnalysisLimit)
    4. mode='food' → 한식DB 검색 (160+ 음식 키워드 매칭)
       - 일치: Korean DB 영양소 반환 (source: korean_db_only)
       - 불일치: Gemini Vision API 호출
         → OpenFoodFacts 검색 병행
         → 최종 폴백: Gemini 추론 (source: gemini_only)
    5. 분석 카운트 증가 (incrementAnalysisCount)
    ↓
[capture/page.tsx] 영양소 표시, 사용자 확인
    ↓
저장 방식 분기:
  LOCAL: localStorage['mybob_meals'] + IndexedDB(사진)
  CLOUD: /api/meals POST → meals 테이블 + Storage 업로드
              → 업로드 카운트 증가 (incrementUploadCount)
```

### 7-2. 홈 화면 일일 분석

```
[app/page.tsx] 마운트
    ↓
useAuth() → token 획득
    ↓
syncFromServer(token):
  - /api/meals GET (클라우드 식단)
  - localStorage['mybob_meals'] (로컬 식단)
  - 병합 후 상태 저장
    ↓
analyzeCoach({ todayMeals, allMeals, goalCalories, goalProtein, persona })
    ↓
상황 판단 (우선순위 순):
  consecutive_skip → no_record → very_few → few → high_calorie
  → low_calorie → protein_lack → carb_heavy → night_eating
  → soul_food → sodium_warning → streak_good → normal(Gemini)
    ↓
  Gemini 필요 시: /api/recommendation POST
  로컬 메시지: getCoachMessage(result, seed)
    ↓
[UI] 코치 메시지 + 주간 차트 + 칼로리 링 표시
```

### 7-3. 친구 관계 흐름

```
[community/neighbors/page.tsx]
    ↓
/api/friends GET → 3가지 상태:
  - accepted: 친구 목록
  - incoming: 받은 요청
  - outgoing: 보낸 요청
    ↓
친구 추가: /api/friends POST { targetNickname }
  → 닉네임으로 user 검색 → friendships 삽입 (status: pending)
    ↓
수락: /api/friends PUT { friendshipId, action: 'accept' }
  → status: pending → accepted
    ↓
거절/삭제: /api/friends DELETE { friendshipId }
```

### 7-4. 저장 방식 전환 (Local ↔ Cloud)

```
[settings/page.tsx] 저장 방식 변경 버튼
    ↓
[StorageModeModal] 경고 표시
    ↓
migrateLocalToCloud(token, onProgress):
  - localStorage 식단 3개씩 배치
  - IndexedDB 사진 base64 → /api/meals POST
  - 진행률 콜백 (onProgress)
    ↓
또는 migrateCloudToLocal(token, onProgress):
  - /api/meals GET 전체 조회
  - Storage URL → IndexedDB 저장
  - requestServerDataDeletion (15일 유예 후 삭제)
    ↓
localStorage['mybob_storage_mode'] = 'cloud' | 'local'
```

---

## 8. 인증 & 권한 시스템

### 인증 흐름

```
app/layout.tsx
  └─ AuthProvider (lib/auth-context.tsx)
       ├─ 마운트 시 supabase.auth.getSession() 1회 호출
       ├─ onAuthStateChange 리스너 (로그인/로그아웃 이벤트)
       └─ Context 제공: { session, loading, token }
            ↓
모든 페이지: useAuth() → token 사용
            ↓
API 호출: Authorization: `Bearer ${token}`
            ↓
서버: supabase.auth.getUser(token) → user.id 검증
```

### 라우트 보호 규칙

| 경로 | 인증 필요 | 미인증 시 |
|------|----------|----------|
| / | ✅ | → /auth/login |
| /capture | ✅ | → /auth/login |
| /history/* | ✅ | → /auth/login |
| /report/* | ✅ | → /auth/login |
| /community/* | ✅ | → /auth/login |
| /settings | ✅ | → /auth/login |
| /admin/* | ✅ + Admin 이메일 | → /auth/login |
| /auth/* | ❌ | 인증 시 → / |
| /onboarding | ❌ | — |
| /partnership | ❌ | — |

### 권한 레벨

```
Guest (미인증): 접근 불가 (일부 커뮤니티 피드 제외)
  ↓
Free: 기본 기능 + 로컬 저장 + 분석 10회/일
  ↓
Pro/Lifetime: 클라우드 저장 + 분석 25회/일 + 진단 + 아바타
  ↓
Admin: 모든 사용자 데이터 조회 + 통계 (env ADMIN_EMAIL 일치)
```

---

## 9. 저장 방식 이원화 시스템

```
LOCAL 모드 (기본, 프라이버시 우선):
  ┌─────────────────────────────────┐
  │ localStorage['mybob_meals']     │
  │ [ { id, food_name, calories,    │
  │     nutrient, category,         │
  │     photo_url: "local:{id}",    │
  │     created_at } ]              │
  └─────────────────────────────────┘
  ┌─────────────────────────────────┐
  │ IndexedDB: mybob_db/photos      │
  │ { mealId: base64_image }        │
  └─────────────────────────────────┘
  특징: 서버 통신 없음, 기기 간 동기화 불가

CLOUD 모드 (PRO 이상):
  ┌─────────────────────────────────┐
  │ Supabase meals 테이블           │
  │ (RLS: 본인만 조회/수정)          │
  └─────────────────────────────────┘
  ┌─────────────────────────────────┐
  │ Supabase Storage meal_photos    │
  │ {user_id}/{YYYY-MM}/{uuid}.ext  │
  └─────────────────────────────────┘
  특징: 다기기 동기화, 백업, 서버 의존

공통 처리:
  - usePhoto(url): "local:" → IndexedDB, else Storage URL
  - KST 기준 날짜 계산 (+9h offset)
```

---

## 10. AI 코치 시스템

### 상황 판정 우선순위 (lib/coach/analyzer.ts)

```
1. consecutive_skip  : 어제 + 오늘 기록 없음 (2-3일 연속)
2. no_record         : 오늘 기록 없음 + 시간대 맥락
3. very_few          : 기록 2개 이하
4. few               : 기록 3-4개
5. high_calorie      : 목표 칼로리 120% 초과
6. low_calorie       : 5개 이상 기록 + 목표 50% 미만
7. protein_lack      : 목표 단백질 60% 미만
8. carb_heavy        : 탄수화물 칼로리 비율 70% 초과
9. night_eating      : 22시 이후 식사 비율 30% 초과
10. soul_food        : 최근 30일 동일 음식 5회 이상
11. sodium_warning   : 최근 30일 고나트륨 음식 10회 이상
12. streak_good      : 최근 3일 목표 칼로리 ±20% 이내
13. normal           : → Gemini 위임
```

### 시간대 (TimeSlot)

| 슬롯 | 시간대 |
|------|--------|
| dawn | 0-6시 |
| morning | 6-11시 |
| lunch | 11-14시 |
| afternoon | 14-18시 |
| evening | 18-22시 |
| night | 22-24시 |

### 페르소나

| 페르소나 | 특성 |
|---------|------|
| robot | 객관적, 수치 기반, 과학적 |
| cat | 까칠하고 직설적, 실용적 |
| dog | 밝고 응원적, 감성적 |

### 메시지 선택 알고리즘

```
상황 → 페르소나별 메시지 풀 선택
  ↓
no_record: NO_RECORD_BY_TIME[timeSlot][persona]
consecutive_skip: CONSECUTIVE_SKIP_MESSAGES(2x) + timeSlot 풀(1x)
night_eating (밤): base + NIGHT_EATING_EXTRA 병합
기타: COACH_MESSAGES[situation][persona]
  ↓
Math.abs(seed) % pool.length → 결정론적 선택 (새로고침 시 변하지 않음)
  ↓
{food}, {count} 플레이스홀더 치환
```

---

## 11. 요금제 시스템

### 한도 설정 (lib/plan.ts)

| 항목 | Free | Pro | Lifetime |
|------|------|-----|----------|
| 일일 사진 업로드 | 10회 | 25회 | 25회 |
| 일일 AI 분석 | 10회 | 25회 | 25회 |
| 클라우드 저장 | ❌ | ✅ | ✅ |
| 닉네임 변경 | ❌ | ✅ (1회) | ✅ (1회) |
| 아바타 업로드 | ❌ | ✅ | ✅ |
| AI 진단 리포트 | ❌ | ✅ | ✅ |
| 광고 | 있음 | 없음 | 없음 |

### 한도 초기화 방식
- `profiles.last_upload_date` 와 오늘 날짜 비교 (KST)
- 날짜가 다르면 `uploads_today = 0` 리셋
- 한도 초과 시 `429 ANALYSIS_LIMIT_EXCEEDED`

---

## 12. 외부 서비스 연동

### Google Gemini AI

| 항목 | 내용 |
|------|------|
| 환경변수 | GEMINI_API_KEY |
| 사용 모델 | gemini-1.5-flash, gemini-1.5-pro (폴백 체인) |
| 사용처 | 음식 이미지 분석, 영양 권장, AI 진단 |
| 비용 관리 | 사용자별 일일 한도 + rate limiting |
| 폴백 체인 | flash → pro → 오류 |

### Resend (이메일)

| 항목 | 내용 |
|------|------|
| 환경변수 | RESEND_API_KEY |
| From | MyBob <onboarding@resend.dev> |
| 사용처 | PIN 초기화 OTP 이메일 |
| 제한 | 발송 3회/분 rate limiting |

### Supabase

| 항목 | 내용 |
|------|------|
| URL | NEXT_PUBLIC_SUPABASE_URL |
| Anon Key | NEXT_PUBLIC_SUPABASE_ANON_KEY (공개) |
| Service Role Key | SUPABASE_SERVICE_ROLE_KEY (서버 전용) |
| 사용처 | Auth, PostgreSQL DB, Storage |
| RLS | 주요 테이블 모두 적용 |

---

## 13. 보안 & 암호화

### 신체정보 암호화 (settings/page.tsx)

```
사용자 PIN 입력
  ↓
PBKDF2 (10,000 iterations, SHA-256)
  + random salt (16 bytes)
  → 256-bit AES 키 생성
  ↓
AES-256-GCM 암호화
  + random IV (12 bytes)
  ↓
localStorage['mybob_body_enc'] = base64(salt + iv + ciphertext)

복호화:
  PIN 입력 → 같은 salt로 키 재생성 → GCM 태그 검증 → 복호화
```

### PIN 저장 방식
- 간단한 해시 기반 비교 (localStorage)
- **개선 예정:** bcrypt 해시 저장

### HTTP 보안 헤더 (next.config.js, 2026-05-24 추가)
- Strict-Transport-Security (HSTS, 2년)
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera/mic/geo 차단

### API Rate Limiting (lib/rate-limit.ts)
- In-memory Map 기반 (서버 재시작 시 초기화)
- OTP 발송: 3회/분/유저
- OTP 검증: 5회/10분/유저
- AI 진단: 5회/시간/유저
- AI 추천: 10회/시간/유저
- 음식 분석: 10회/분/IP

---

## 14. 잠재적 문제 & 대응 방안

### 14-1. Rate Limiter 서버 재시작 초기화
- **문제:** in-memory rate limiter는 Vercel 서버리스 환경에서 인스턴스 재시작 시 초기화됨
- **현재 영향:** OTP brute force 시 서버 재시작으로 우회 가능
- **대응:** 사용자당 일일 한도는 Supabase DB로 영구 관리 중 (이중 방어)
- **향후 개선:** Redis 또는 Supabase 기반 분산 rate limiter

### 14-2. 관리자 인증 이메일 비교 방식
- **문제:** ADMIN_EMAIL 환경변수 노출 시 관리자 계정 위협
- **현재 보호:** 서버 전용 환경변수 (NEXT_PUBLIC_ 아님)
- **향후 개선:** profiles 테이블에 `role: 'admin'` 컬럼 추가 → RBAC 전환

### 14-3. 로컬 저장 데이터 분실
- **문제:** 기기 교체, 브라우저 캐시 삭제 시 로컬 데이터 영구 손실
- **현재 안내:** 온보딩에서 클라우드 저장 권장 안내
- **대응:** 클라우드 전환 유도 UI, 백업 내보내기 기능 (예정)

### 14-4. Supabase Storage 비용
- **문제:** 사용자 증가 시 Storage 비용 급증
- **현재 제한:** 사진 업로드 일일 10/25회 제한
- **모니터링:** Supabase 대시보드 Storage 사용량 주간 확인

### 14-5. Gemini API 비용
- **문제:** Gemini Vision 분석이 비용 집중 포인트
- **현재 보호:** 사용자당 일일 한도 + IP rate limiting
- **모니터링:** Google Cloud Console 일일 비용 알림 설정 필요

### 14-6. KST 시간대 처리
- **문제:** 서버는 UTC, 클라이언트는 로컬 시간대
- **현재 처리:** 모든 날짜 계산에 +9시간 offset 적용 (toKSTDate 함수)
- **잠재적 버그:** 서머타임 없는 한국은 안전, 해외 사용자는 날짜 경계 오류 가능

### 14-7. 커뮤니티 게스트 폴백
- **문제:** 미인증 요청 시 `00000000-0000-0000-0000-000000000000` UUID로 폴백
- **현재 영향:** 공개 피드 조회만 허용, 데이터 쓰기 불가
- **향후 개선:** 명시적 public 접근 정책으로 교체

### 14-8. 챌린지 미구현 상태
- **문제:** /community/challenge 페이지 UI만 존재, 기능 미구현
- **현재 처리:** 진입 시 "준비 중" 안내
- **향후:** 챌린지 기능 구현 후 활성화

---

## 15. lib/ 핵심 모듈 설명

| 파일 | 역할 | 주요 export |
|------|------|-------------|
| auth-context.tsx | 전역 인증 상태 | useAuth() → { session, loading, token } |
| plan.ts | 요금제 한도 관리 | checkUploadLimit, checkAnalysisLimit, increment* |
| rate-limit.ts | API rate limiting | rateLimit(key, max, windowMs) |
| indexed-db.ts | 로컬 사진 저장소 | savePhoto, getPhoto, deletePhoto |
| storage-mode.ts | 저장 방식 관리 | getStorageMode, setStorageMode |
| storage-migration.ts | 저장 방식 전환 엔진 | migrateLocalToCloud, migrateCloudToLocal |
| use-photo.ts | 사진 URL 통합 훅 | usePhoto(url) → resolved URL |
| nickname.ts | 닉네임 생성 | generateNickname() → "신선한당근_145" |
| coach/analyzer.ts | 식단 상황 분석 | analyzeCoach(params) → AnalysisResult |
| coach/messages.ts | 코치 메시지 테이블 | COACH_MESSAGES, NO_RECORD_BY_TIME 등 |
| coach/index.ts | 메시지 선택 | getCoachMessage(result, seed) |
| supabase/client.ts | Supabase 클라이언트 | supabase (singleton) |

---

## 16. 확장 준비 중인 기능

| 기능 | 상태 | 비고 |
|------|------|------|
| 결제 시스템 (토스페이먼츠) | 미구현 | 준비단계 3번 |
| 관리자 RBAC | 미구현 | 현재 이메일 기반 |
| 챌린지 기능 | UI만 존재 | 서버 로직 미구현 |
| 이웃 식단 공유 피드 | 부분 구현 | 커뮤니티 피드 기반 확장 |
| PIN bcrypt 해시화 | 미구현 | 보안 개선 예정 |
| 데이터 내보내기 (CSV/JSON) | 미구현 | 사용자 데이터 백업용 |
| 푸시 알림 | 미구현 | 식사 시간 리마인더 |
| Content-Security-Policy | 미구현 | 보안 헤더 고도화 |
| Redis rate limiting | 미구현 | 분산 환경 대응 |

---

## 17. 운영 체크리스트

### 배포 후 확인 (매 배포 시)

- [ ] Vercel 배포 상태 확인 (vercel.com → Deployments)
- [ ] 홈 페이지 로드 확인
- [ ] 음식 촬영 → 분석 → 저장 1회 테스트
- [ ] 로그인/로그아웃 동작 확인

### 일간 모니터링

- [ ] Supabase 대시보드 → API 에러율 확인
- [ ] Vercel Functions 로그 이상 여부
- [ ] Google Cloud Console → Gemini API 비용 확인

### 주간 점검

- [ ] Supabase Storage 사용량 확인
- [ ] 신규 가입자 수 (admin/stats)
- [ ] 에러 패턴 분석 (Vercel Logs)

### 분기 점검

- [ ] `npm audit` 실행 → 취약 패키지 업데이트
- [ ] API 키 로테이션 (Gemini, Resend)
- [ ] Supabase 백업 확인
- [ ] SECURITY_CHECKLIST.md 업데이트

---

*이 문서는 앱 구조 변경 시 함께 업데이트되어야 합니다.*  
*최종 업데이트: 2026-05-24*
