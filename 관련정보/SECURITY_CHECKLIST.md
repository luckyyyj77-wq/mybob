# MyBob 보안 체크리스트 — 정식 출시 준비

**최초 작성:** 2026-05-24  
**다음 점검 예정:** 2026-08-24 (분기 점검)

---

## 1. 배포 환경 보안 (Vercel)

| 항목 | 상태 | 비고 |
|------|------|------|
| .env.local git 미커밋 확인 | ✅ | gitignore에 포함됨 |
| Vercel Environment Variables 설정 (Production) | ✅ | Vercel 대시보드에서 관리 |
| NEXT_PUBLIC_ 변수는 공개값만 포함 | ✅ | URL, anon key만 public |
| SUPABASE_SERVICE_ROLE_KEY 서버 전용 확인 | ✅ | NEXT_PUBLIC_ 아님 |
| GEMINI_API_KEY 서버 전용 확인 | ✅ | NEXT_PUBLIC_ 아님 |
| RESEND_API_KEY 서버 전용 확인 | ✅ | NEXT_PUBLIC_ 아님 |
| Vercel Preview 환경에 prod 키 미사용 | ✅ | Production 환경 전용으로 설정 완료 (2026-05-24) |
| 커스텀 도메인 HTTPS 강제 적용 | ✅ | Vercel 기본 제공 |
| HSTS 헤더 설정 | ✅ | next.config.js에 추가됨 (2026-05-24) |

## 2. 보안 헤더 (HTTP Headers)

| 헤더 | 상태 | 값 |
|------|------|-----|
| Strict-Transport-Security | ✅ | max-age=63072000; includeSubDomains; preload |
| X-Frame-Options | ✅ | SAMEORIGIN |
| X-Content-Type-Options | ✅ | nosniff |
| X-XSS-Protection | ✅ | 1; mode=block |
| Referrer-Policy | ✅ | strict-origin-when-cross-origin |
| Permissions-Policy | ✅ | camera=(), microphone=(), geolocation=() |
| Content-Security-Policy | ⚠️ | 미설정 — 향후 추가 권장 |

> 보안 헤더 추가: 2026-05-24, next.config.js

## 3. Supabase (DB & Storage)

| 항목 | 상태 | 비고 |
|------|------|------|
| RLS (Row Level Security) 활성화 | ✅ | 주요 테이블 적용 |
| profiles 테이블 — 본인만 조회/수정 | ✅ | RLS 정책 적용 |
| meals 테이블 — 본인만 CRUD | ✅ | RLS 정책 적용 |
| friendships 테이블 — 참여자만 접근 | ✅ | RLS 정책 적용 |
| meal_photos 버킷 — 인증된 사용자만 업로드 | ✅ | Storage 정책 적용 |
| avatars 버킷 — 본인만 업로드 | ✅ | Storage 정책 적용 |
| Supabase 프로젝트 비밀번호 강도 | ✅ | 설정에서 확인됨 |
| Supabase MFA (2단계 인증) 관리자 계정 | ✅ | 활성화 확인됨 (2026-05-24) |
| DB 백업 주기 | ⚠️ | Supabase 무료 플랜 7일 백업 |
| Service Role Key API 라우트 최소화 | ⚠️ | admin/ 및 일부 라우트 사용 중 — 점진적 제거 권장 |

## 4. API 보안

| 항목 | 상태 | 비고 |
|------|------|------|
| 모든 인증 필요 엔드포인트 JWT 검증 | ✅ | Bearer 토큰 검증 |
| OTP 발송 rate limit (3회/분) | ✅ | 2026-05-24 추가 |
| OTP 검증 rate limit (5회/10분) | ✅ | 2026-05-24 추가 |
| Gemini 분석 호출 rate limit | ✅ | 2026-05-24 추가 |
| AI 진단 rate limit (5회/시간) | ✅ | 2026-05-24 추가 |
| AI 식단 추천 rate limit (10회/시간) | ✅ | 2026-05-24 추가 |
| 음식 분석 IP rate limit (10회/분) | ✅ | 2026-05-24 추가 |
| 관리자 API 이메일 기반 인증 | ⚠️ | RBAC으로 교체 권장 |
| 파일 업로드 타입/크기 검증 | ✅ | MIME + Base64 크기 체크 |
| SQL Injection (Supabase ORM 사용) | ✅ | 파라미터화 쿼리 |
| admin/ 엔드포인트 미들웨어 보호 | ⚠️ | 이메일 체크 → RBAC 전환 권장 |

## 5. 인증 & 계정 보안

| 항목 | 상태 | 비고 |
|------|------|------|
| Supabase Auth 이메일 인증 | ✅ | 기본 활성화 |
| 비밀번호 최소 길이 | ✅ | Supabase 기본 8자 이상 |
| PIN 코드 해시 저장 | ⚠️ | 현재 plaintext — bcrypt 저장 권장 |
| OTP 코드 plaintext 저장 (임시) | ⚠️ | 10분 TTL로 노출 위험 낮음, 추후 해시 저장 권장 |
| 세션 토큰 httpOnly 쿠키 | ✅ | Supabase 처리 |
| 로그아웃 시 토큰 무효화 | ✅ | supabase.auth.signOut() |

## 6. 앱 코드 보안

| 항목 | 상태 | 비고 |
|------|------|------|
| console.log 민감정보 제거 | ⚠️ | 일부 API 라우트에 에러 로그 남음 |
| XSS 방지 (React 기본 이스케이핑) | ✅ | JSX 자동 이스케이프 |
| CSRF 방지 (SameSite 쿠키) | ✅ | Supabase 처리 |
| 의존성 취약점 스캔 | ✅ | 2026-05-24 실행 — ws 수정 완료, postcss 잔여 (하단 참고) |
| Next.js 버전 최신 유지 | ⚠️ | v16.2.6 사용 중, postcss 취약점은 v16.3 정식 출시 후 해결 예정 |

---

## 정기 보안 점검 항목 (분기별)

1. `npm audit` 실행 — 취약 패키지 업데이트
2. Supabase & Vercel 대시보드 접근 로그 확인
3. API 키 로테이션 (Gemini, Resend, Supabase service role)
4. 관리자 계정 비밀번호 변경
5. 서비스 이용약관 & 개인정보처리방침 내용 최신화 확인

---

## 향후 개선 우선순위

1. **[HIGH]** 관리자 인증 → RBAC 전환 (이메일 비교 → DB role 컬럼)
2. **[HIGH]** PIN 코드 bcrypt 해시 저장
3. **[MEDIUM]** Content-Security-Policy 헤더 추가
4. **[MEDIUM]** Preview 환경 전용 API 키 분리
5. **[LOW]** Service Role Key → anon key + RLS 정책으로 점진적 전환
