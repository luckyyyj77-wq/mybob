# MyBob 천인회 프로모션 정책서

> 작성일: 2026-06-16  
> 버전: 1.0.0  
> 상태: 구현 예정

---

## 1. 개요

MyBob 초기 사용자 1,000명을 대상으로 PRO 기능을 무료로 제공하는 창립 멤버 프로그램.  
"천인회(千人會)"라는 이름으로 브랜딩하여 희소성과 소속감을 부여한다.

---

## 2. 핵심 규칙

### 2-1. 참여 조건
- **선착순 1,000명**: 가입 순서 기준 (가입 시점 profiles.created_at)
- **자격 자동 부여**: 1,000번째 가입자까지 자동으로 천인회 멤버로 등록

### 2-2. 혜택
- 가입 즉시 PRO 기능 전체 무료 사용 (plan = 'pro' 와 동일)
- PRO 기능: AI 분석 하루 25회, 클라우드 저장 25회, 커뮤니티, 닉네임, 아바타 등

### 2-3. 프로모션 종료 조건 (날짜 기반)
- **종료일: 2026년 12월 31일 23:59 KST**
- 이 날짜 이후 신규 가입자는 일반 FREE 플랜으로 시작
- 기존 천인회 멤버는 종료일 이후 보상 크레딧(§2-5)으로 전환

### 2-4. 공석 보충
- 천인회 멤버가 탈퇴(회원 탈퇴)하면 해당 자리는 공석으로 처리
- 공석 발생 시 다음 신규 가입자가 자동으로 천인회 자격 취득
- 단, 종료일(2026-12-31) 이후에는 공석 보충 없음

### 2-5. 종료 후 보상 크레딧 (충성도 보상)
프로모션 종료 시점 기준 사용일수에 따라 PRO 구독 크레딧 자동 지급:

| 사용일수 | 보상 |
|---------|------|
| 30일 이상 | PRO 1개월 |
| 90일 이상 | PRO 3개월 |
| 180일 이상 | PRO 6개월 |

- **사용일수 기준**: `founding_joined_at` ~ 종료일(2026-12-31) 사이 실제 경과일
- **지급 시점**: 2027-01-01 자정 자동 처리 (Supabase 크론 또는 수동 실행)
- 크레딧 만료일 = 지급일 + 보상 개월수 (예: 1개월 → 2027-01-31)

---

## 3. 데이터 구조

### 3-1. profiles 테이블 추가 컬럼

```sql
-- 천인회 멤버 여부
is_founding_member  boolean  DEFAULT false

-- 천인회 가입일 (프로모션 참여 시작일)
founding_joined_at  timestamptz  DEFAULT null

-- 종료 후 보상 크레딧 만료일
pro_credit_expires_at  timestamptz  DEFAULT null
```

### 3-2. 플랜 판단 로직 (우선순위)

```
1. plan = 'lifetime'           → 평생 이용권
2. plan = 'pro' AND ls_auto_cancel = false  → 유료 구독 PRO
3. is_founding_member = true AND 종료일 이전  → 천인회 PRO
4. pro_credit_expires_at > NOW()            → 크레딧 PRO
5. 그 외                                    → FREE
```

### 3-3. founding_slots 테이블 (천인회 현황 추적)

```sql
CREATE TABLE founding_slots (
  total_slots     int  DEFAULT 1000,   -- 전체 자리수
  used_slots      int  DEFAULT 0,      -- 현재 점유 수
  promotion_end   date DEFAULT '2026-12-31',
  updated_at      timestamptz
);
```

---

## 4. API 변경사항

### 4-1. 가입 시 천인회 자동 체크
`/api/auth/callback` 또는 `getOrCreateProfile` 실행 시:
1. `founding_slots.used_slots < 1000` 이고 종료일 이전이면
2. `is_founding_member = true`, `founding_joined_at = NOW()` 설정
3. `founding_slots.used_slots += 1`

### 4-2. upload-status API 응답에 천인회 정보 추가
```json
{
  "plan": "pro",
  "isFoundingMember": true,
  "foundingJoinedAt": "2026-06-16T...",
  "promotionEndsAt": "2026-12-31",
  "daysUsed": 15
}
```

### 4-3. 탈퇴 시 공석 처리
`/api/account/delete` 실행 시:
- `is_founding_member = true`인 유저 탈퇴 → `founding_slots.used_slots -= 1`

---

## 5. UI 변경사항

### 5-1. 홈 화면 배너
- 천인회 멤버: "🎖️ 천인회 멤버 · D-{종료일까지 남은 일수}" 배너
- 비멤버 + 자리 있음: "✨ 천인회 {남은 자리}석 남음 · 지금 가입하면 PRO 무료"
- 비멤버 + 자리 없음: 배너 미표시

### 5-2. 설정 > 플랜 페이지
- 천인회 멤버: 플랜 배지 "🎖️ 천인회 PRO" 표시
- 종료일까지 D-day, 사용일수, 예상 보상 크레딧 표시
- 예: "지금까지 15일 사용 · 종료 시 1개월 크레딧 예정"

### 5-3. 관리자 > 천인회 현황 탭
- 사용 슬롯 / 전체 슬롯 (예: 342 / 1000)
- 천인회 멤버 목록 (가입일, 사용일수, 예상 보상)
- 수동 슬롯 조정 버튼

---

## 6. 홍보 문구

### 앱 내 문구
- "MyBob을 처음 사랑해준 1,000명, 천인회"
- "선착순 1,000명은 2026년 말까지 PRO 기능 무료"
- "오래 쓸수록 더 많이 돌아와요 — 천인회 충성 보상"

### SNS 문구 (인스타/쇼츠용)
- "지금 가입하면 1년 PRO 무료 🎖️ 선착순 1,000명 천인회"
- "내 식단을 AI가 분석해줘 + 창립 멤버 혜택까지"

---

## 7. 구현 체크리스트

### Supabase
- [ ] profiles 테이블: `is_founding_member`, `founding_joined_at`, `pro_credit_expires_at` 컬럼 추가
- [ ] founding_slots 테이블 생성 + 초기 row 삽입
- [ ] RLS: founding_slots는 읽기 공개, 쓰기 service_role만

### 백엔드
- [ ] `lib/plan.ts`: 천인회 플랜 판단 로직 추가
- [ ] `lib/plan.ts` → `getOrCreateProfile`: 천인회 자동 등록 로직
- [ ] `app/api/upload-status/route.ts`: 천인회 정보 응답 추가
- [ ] `app/api/account/delete/route.ts`: 탈퇴 시 슬롯 반환

### 프론트엔드
- [ ] `app/page.tsx`: 천인회 배너 컴포넌트
- [ ] `app/settings/plan/page.tsx`: 천인회 PRO 배지 + D-day + 보상 예고
- [ ] `app/admin/`: 천인회 현황 탭

### 종료 처리 (2027-01-01)
- [ ] 크레딧 자동 지급 스크립트 (수동 실행 또는 Edge Function)

---

## 8. 주요 결정 사항

| 항목 | 결정 | 이유 |
|------|------|------|
| 종료일 | 2026-12-31 | 명확한 날짜 기반, 마케팅 "연말까지" 문구 활용 |
| 보상 구간 | 30/90/180일 | 직관적, 자동 계산 용이 |
| 공석 보충 | 자동 (탈퇴 즉시) | 대기 수요 유지, 긴장감 |
| 슬롯 추적 | founding_slots 테이블 | 원자적 카운트, race condition 방지 |
| 플랜 판단 | is_founding_member + 날짜 체크 | 기존 plan 컬럼과 독립적으로 운영 |
