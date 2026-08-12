// launch-flags.ts — 무료 중심 운영 방침(2026-07-29 결정)에 따른 노출 제어 플래그
// 일정 유저가 모일 때까지 유료 결제 없이 광고·제휴만으로 운영한다. 재개 시 false로 되돌린다.
// 클라이언트/서버 어디서든 import 가능해야 하므로 이 파일에는 플래그 외 다른 코드를 두지 않는다.

// 천인회 프로모션 보류: 신규 슬롯 선점 중단(lib/plan.ts) + 모든 천인회 UI 숨김.
// 기존 멤버의 PRO 혜택(getEffectivePlan)은 이 플래그와 무관하게 유지된다.
export const FOUNDING_PAUSED: boolean = true;

// 유료 결제 보류: PRO 업그레이드 동선(LS 체크아웃 진입점) 숨김. 플랫폼 무관 —
// 안드로이드 한정이던 isNativeApp() 분기보다 넓게 적용된다.
export const PAYMENTS_PAUSED: boolean = true;
