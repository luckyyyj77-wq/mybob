# MyBob 저장 방식 시스템 — Phase 1/2/3 설명서

---

## 왜 이 시스템을 만들었나?

기존 MyBob은 모든 데이터를 Supabase 서버에 저장했습니다.
그 결과 같은 계정이라도 브라우저와 PWA(설치된 앱)가 서로 다른 데이터를 보는 문제가 있었고,
개인정보에 민감한 사용자가 선택권 없이 서버에 사진과 식단을 올려야 했습니다.

**해결 방향:**
- 기본은 로컬(이 기기 안에만 저장)
- 클라우드는 사용자가 선택한 경우에만
- 언제든 방향을 바꿀 수 있고, 바꿀 때 데이터가 따라서 이동

---

## 전체 구조 한눈에 보기

```
사용자 선택
├── 로컬 모드
│   ├── 사진        → IndexedDB (브라우저 내부 저장소, 용량 제한 없음)
│   └── 식단 메타   → localStorage (음식명, 칼로리, 날짜 등)
│
└── 클라우드 모드
    ├── 사진        → Supabase Storage (서버)
    ├── 식단 메타   → Supabase DB (서버) + localStorage (빠른 조회용 캐시)
    └── 인증        → Supabase Auth (공통, 모드 무관)
```

**인증(로그인)은 모드와 상관없이 항상 서버를 사용합니다.**
로컬 모드를 선택해도 "누가 이 앱을 쓰는지"는 서버가 알고 있어야
나중에 클라우드 전환 시 내 데이터로 연결할 수 있기 때문입니다.

---

## Phase 1 — 선택권 부여

### 무엇을 만들었나?

**온보딩 화면** (`/onboarding`)과 **설정 페이지 내 저장 방식 섹션**

### 온보딩 흐름 (3단계)

```
[1단계: 인트로]
"시작하기 전에 한 가지만 알려드립니다"
→ 로컬 저장 원칙 / 클라우드는 선택 / 언제든 전환 가능 / 삭제 권리 안내

[2단계: 선택]
┌─────────────────────────┐  ┌─────────────────────────┐
│  📱 이 기기에만 저장     │  │  ☁️ 클라우드 동기화      │
│  LOCAL · 무료            │  │  CLOUD · 추후 구독       │
│                          │  │                          │
│  ✓ 개인정보 보호 최우선  │  │  ✓ 여러 기기 동기화      │
│  ✓ 인터넷 없이 사용 가능 │  │  ✓ 커뮤니티·챌린지 참여  │
│  ⚠ 기기 분실 시 복구불가 │  │  ✓ 기기 분실 시 복구 가능│
└─────────────────────────┘  └─────────────────────────┘

[3단계: 확인]
선택 요약 + 클라우드 선택 시 개인정보 동의 문구
→ "시작하기" 누르면 홈으로
```

### 언제 온보딩이 뜨나?

- **신규 가입**: 회원가입 완료 직후 자동으로 `/onboarding`으로 이동
- **기존 사용자 로그인**: `mybob_onboarding_done` 값이 없으면 로그인 후 온보딩으로 이동

### 관련 코드

| 파일 | 역할 |
|------|------|
| `lib/storage-mode.ts` | 모드 읽기/쓰기 유틸. 앱 전체가 이 파일만 참조 |
| `app/onboarding/page.tsx` | 3단계 온보딩 UI |
| `app/auth/signup/page.tsx` | 가입 후 `/onboarding`으로 리다이렉트 |
| `app/auth/login/page.tsx` | 로그인 후 온보딩 미완료면 `/onboarding`으로 |
| `app/settings/page.tsx` | 현재 모드 표시 + "변경" 버튼 |

### localStorage에 저장되는 값

```
mybob_storage_mode      : "local" 또는 "cloud"
mybob_onboarding_done   : "1" (온보딩 완료 여부)
```

---

## Phase 2 — 로컬 사진 저장

### 문제

localStorage는 문자열만 저장할 수 있고 용량이 5~10MB로 제한됩니다.
사진 한 장이 수백 KB이므로 localStorage에 base64로 사진을 저장하면
금방 용량이 꽉 찹니다.

### 해결: IndexedDB

브라우저에 내장된 데이터베이스입니다. 특징:

- 용량 제한 없음 (기기 저장 공간에 따라 GB 단위)
- 이미지 데이터(base64, Blob) 저장 가능
- 앱 삭제 전까지 영구 보존
- 브라우저별 독립 저장 (Safari, Chrome 각각 따로)

### 로컬 모드에서 사진 저장 방식

```
촬영/선택 → resizeImage (800px, JPEG 82%) → IndexedDB에 저장
                                           → localStorage에 메타 저장
                                             (photo_url: "local:1234567890")
```

`photo_url`에 `"local:식별자"` 형태의 마커를 저장해두고,
화면에 표시할 때 이 마커를 보고 IndexedDB에서 실제 사진을 꺼냅니다.

### 클라우드 모드에서 사진 저장 방식

```
촬영/선택 → resizeImage → 서버(Supabase Storage) 업로드
                        → localStorage에 메타 저장
                          (photo_url: "https://supabase.../photo.jpg")
```

### 사진 표시 — MealPhoto 컴포넌트

```
photo_url이 "local:abc" → IndexedDB에서 base64 꺼내서 표시
photo_url이 "https://..." → 그냥 URL로 표시
```

이 판별 로직을 `usePhoto` 훅과 `MealPhoto` 컴포넌트로 묶어서
history, 상세페이지 등 어디서든 `<MealPhoto photoUrl={...} />`만 쓰면 됩니다.

### 관련 코드

| 파일 | 역할 |
|------|------|
| `lib/indexed-db.ts` | IndexedDB 저장/조회/삭제 함수 모음 |
| `lib/use-photo.ts` | photo_url 판별 훅 (`local:` vs URL) |
| `components/MealPhoto.tsx` | 사진 표시 공용 컴포넌트 |
| `app/capture/page.tsx` | 저장 시 모드 분기 (로컬 vs 클라우드) |

### 데이터 흐름 요약

```
로컬 모드
  저장: 사진 → IndexedDB["photos"]["1234"] = "data:image/jpeg;base64,..."
        메타 → localStorage["mybob_meals"] = [{photo_url: "local:1234", ...}]
  표시: "local:1234" → IndexedDB에서 꺼냄 → <img src="data:image/..." />

클라우드 모드
  저장: 사진 → Supabase Storage → 서버 URL 받음
        메타 → localStorage["mybob_meals"] = [{photo_url: "https://...", ...}]
  표시: "https://..." → 바로 <img src="https://..." />
```

---

## Phase 3 — 전환 엔진

### 핵심 아이디어

모드를 바꿀 때 단순히 설정값만 바꾸는 게 아니라
**데이터 자체가 함께 이동**해야 합니다.

### 로컬 → 클라우드 전환

```
[시작]
  ↓
Wi-Fi인지 확인
  ↓ Wi-Fi 아님
경고 표시: "모바일 데이터 사용 중, 요금 발생 가능"
  ↓ 계속 또는 취소
  ↓
localStorage에서 "local:" 마커가 붙은 식단 목록 추출
  ↓
3개씩 묶어서(배치) 서버에 업로드:
  1. IndexedDB에서 해당 식단의 사진 꺼내기 (base64)
  2. /api/meals POST 요청 (사진 + 식단 정보)
  3. 서버에서 받은 URL로 localStorage의 photo_url 교체
  4. 0.5초 대기 (서버 부담 분산)
  5. 다음 배치 반복
  ↓
모드를 'cloud'로 변경
  ↓
[완료]
```

### 클라우드 → 로컬 전환

```
[시작]
  ↓
/api/meals GET으로 서버의 식단 목록 전체 조회
  ↓
서버 사진 URL 목록 추출 (https://... 로 시작하는 것들)
  ↓
3개씩 묶어서(배치) 다운로드:
  1. 서버 URL로 사진 fetch
  2. base64로 변환
  3. IndexedDB에 저장 (key: 식단ID)
  4. photo_url을 "local:식단ID"로 교체
  5. 0.5초 대기
  6. 다음 배치 반복
  ↓
localStorage에 전체 데이터 저장
  ↓
15일 후 삭제 예약 기록
(localStorage["mybob_cloud_delete_scheduled"] = "2026-05-22T...")
  ↓
모드를 'local'로 변경
  ↓
[완료] → 설정 페이지에 주황색 배너 표시
```

### 15일 삭제 예약

클라우드 → 로컬로 전환하면 서버 데이터를 바로 지우지 않습니다.
혹시 "아, 실수했다" 싶을 때를 대비해 15일의 유예 기간을 줍니다.

```
설정 페이지 배너:
┌─────────────────────────────────────────────────────┐
│ ⏳ 서버 데이터가 12일 후 삭제될 예정입니다.          │
│    (2026-05-22 예정)                                 │
│                                                      │
│  [지금 삭제]    [취소 (클라우드 유지)]               │
└─────────────────────────────────────────────────────┘
```

- **지금 삭제**: 서버에서 즉시 사진 + 식단 데이터 전부 삭제
- **취소**: 예약 해제, 클라우드에 데이터 계속 유지, 모드는 로컬 상태 유지

### 배치 처리를 하는 이유

사진 10개를 동시에 서버로 보내면:
- 서버에 순간 부하가 몰림
- 네트워크 오류 시 전체가 실패
- 앱이 잠시 멈춘 것처럼 느껴짐

3개씩 나눠서 0.5초 간격으로 보내면:
- 서버 부하 분산
- 하나 실패해도 나머지는 계속 진행
- 진행률 바로 상황을 실시간으로 보여줄 수 있음

### 전환 UI 흐름 (StorageModeModal)

```
선택 화면
  → (Wi-Fi 아닐 때만) 경고 화면
  → 진행 중 (보라색 진행 바 + "N / M 업로드 중...")
  → 완료 또는 오류
```

### 서버 데이터 전체 삭제 API

`DELETE /api/meals/delete-all`

1. 인증 토큰으로 사용자 확인
2. Supabase Storage에서 해당 사용자의 모든 사진 파일 삭제
   (월별 폴더 순서대로: `userId/2026-04/`, `userId/2026-05/` ...)
3. DB의 meals 테이블에서 해당 사용자 레코드 전체 삭제

### 관련 코드

| 파일 | 역할 |
|------|------|
| `lib/storage-migration.ts` | 전환 엔진 전체 로직 |
| `components/StorageModeModal.tsx` | 전환 UI (단계별 화면) |
| `app/settings/page.tsx` | 모달 연결, 15일 배너 표시 |
| `app/api/meals/delete-all/route.ts` | 서버 전체 삭제 API |

---

## 전체 데이터 흐름 요약

### 로컬 모드 사용자 여정

```
회원가입
  → 온보딩: "로컬 저장" 선택
  → 식단 촬영/저장
      사진 → IndexedDB
      메타 → localStorage
  → 기록 보기
      "local:id" 감지 → IndexedDB에서 사진 로드
  → (선택) 클라우드로 전환
      IndexedDB 사진 → 서버 업로드
      모드 변경
```

### 클라우드 모드 사용자 여정

```
회원가입
  → 온보딩: "클라우드 동기화" 선택
  → 식단 촬영/저장
      사진 → Supabase Storage → URL 받음
      메타 → Supabase DB + localStorage 캐시
  → 기록 보기
      "https://..." URL 그대로 표시
  → (선택) 로컬로 전환
      서버 사진 → IndexedDB 다운로드
      15일 삭제 예약
      모드 변경
```

---

## localStorage 키 목록

| 키 | 값 | 설명 |
|----|-----|------|
| `mybob_storage_mode` | `"local"` / `"cloud"` | 현재 저장 방식 |
| `mybob_onboarding_done` | `"1"` | 온보딩 완료 여부 |
| `mybob_meals` | JSON 배열 | 식단 메타 데이터 전체 |
| `mybob_goal` | JSON | 키/몸무게/목표 |
| `mybob_camera_granted` | `"1"` | 카메라 권한 허용 캐시 |
| `mybob_cloud_delete_scheduled` | ISO 날짜 문자열 | 서버 삭제 예약일 |

---

## 앞으로 남은 것 (Phase 4)

- **구독/결제 연동**: 클라우드 모드를 유료로 전환 (Stripe 또는 토스페이먼츠)
- **서버 삭제 자동화**: 15일이 지나면 Supabase Edge Function이 자동으로 삭제 실행
- **Web Push 알림**: 삭제 D-7, D-3, D-1에 알림 발송
