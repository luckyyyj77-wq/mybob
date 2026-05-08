# MyBob 비즈니스 모델 정의서

> 작성일: 2026-05-08  
> 버전: 1.0.0

---

## 1. 플랜 구조

| 항목 | 무료 (Free) | 유료 구독 (Pro) |
|---|---|---|
| 가격 | 0원 | 월 900원 |
| AI 분석 횟수 | 하루 10회 | 하루 25회 |
| 클라우드 저장 | 하루 10장 | 하루 25장 |
| 로컬 저장 | 하루 10회 분석 제한 (저장은 무제한) | 하루 25회 분석 제한 (저장은 무제한) |
| 광고 | 있음 | 없음 |
| 소셜 기능 | 잠금 | 해금 |
| 닉네임 설정 | 불가 | 가능 |
| 프로필 이미지 | 불가 | 가능 |
| 영구 구매 | 미구현 (추후 예정) | — |

---

## 2. 제한 기준 상세

### AI 분석 횟수 (핵심 제한)
- **카운트 시점**: `/api/analyze-food` 호출 성공 시
- **리셋**: 매일 자정 (KST 기준, last_upload_date 날짜 변경으로 판단)
- **저장 모드 무관**: 로컬/클라우드 동일하게 적용
- **이유**: AI 분석 = Gemini API 호출 = 서버 비용 발생

### 클라우드 저장 횟수
- **카운트 시점**: `/api/meals` POST 성공 시
- **로컬 모드**: 저장은 IndexedDB에 무제한 (기기 용량 내), AI 분석만 제한
- **클라우드 모드**: AI 분석 + 서버 저장 모두 제한

---

## 3. 광고 정책

- **무료 사용자**: 광고 노출 (AdSense 또는 AdMob 예정)
- **유료 사용자**: 광고 완전 제거
- **광고 위치**: 홈 피드 하단, 히스토리 목록 사이 (추후 구현)
- **목적**: 무료 사용자로 인한 서버 비용 상쇄

---

## 4. 소셜 기능 (Pro 전용)

유료 구독 시 해금되는 기능:

- [ ] 닉네임 설정
- [ ] 프로필 이미지 업로드
- [ ] 커뮤니티 피드 게시 (식단 공유)
- [ ] 챌린지 참여
- [ ] 다른 사용자 팔로우

---

## 5. Supabase profiles 테이블 스키마

```sql
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  plan              text not null default 'free',  -- 'free' | 'pro' | 'lifetime'
  uploads_today     int  not null default 0,        -- 클라우드 저장 카운트
  analyses_today    int  not null default 0,        -- AI 분석 카운트 (핵심)
  last_upload_date  date,                           -- 클라우드 저장 날짜 기준
  last_analysis_date date,                          -- AI 분석 날짜 기준
  nickname          text,                           -- Pro 전용
  avatar_url        text,                           -- Pro 전용
  updated_at        timestamptz default now()
);
```

---

## 6. 비용 추정 (1,000명 기준)

| 항목 | 월 비용 |
|---|---|
| Gemini API (1,000명 × 10건 × 2회 호출 × 30일) | 약 33만 원 |
| Supabase 스토리지 + 트래픽 | 약 5만 원 |
| Vercel | 약 3만 원 |
| **서버 총계** | **약 41만 원/월** |
| **유료 구독 수익** (전환율 10% = 100명 × 900원) | **약 9만 원/월** |
| **손익분기점** | 약 456명 유료 구독 |

---

## 7. 구현 현황

### 완료
- [x] profiles 테이블 생성 (plan, uploads_today, last_upload_date)
- [x] 클라우드 저장 일일 제한 체크 (`/api/meals` POST)
- [x] 업로드 현황 조회 API (`/api/upload-status`)
- [x] 캡처 화면 사용량 배지 및 제한 초과 모달
- [x] 설정 페이지 플랜 현황 + 진행바

### 진행 예정
- [ ] profiles 테이블에 `analyses_today`, `last_analysis_date` 컬럼 추가
- [ ] `/api/analyze-food` 에 AI 분석 횟수 제한 체크 추가
- [ ] 결제 연동 (토스페이먼츠 — 사업자 등록 후)
- [ ] 소셜 기능 (Pro 해금)
- [ ] 닉네임/프로필 이미지 설정 (Pro 전용)
- [ ] 광고 삽입 (AdSense/AdMob)
