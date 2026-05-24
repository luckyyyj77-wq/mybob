// Paddle 클라이언트 초기화 (브라우저 전용)
export const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!;

// Paddle 상품 ID (Paddle 대시보드에서 생성 후 입력)
export const PADDLE_PRODUCTS = {
  pro_monthly:  process.env.NEXT_PUBLIC_PADDLE_PRO_MONTHLY_ID!,   // PRO 월간 구독
  pro_yearly:   process.env.NEXT_PUBLIC_PADDLE_PRO_YEARLY_ID!,    // PRO 연간 구독
  lifetime:     process.env.NEXT_PUBLIC_PADDLE_LIFETIME_ID!,       // 평생 이용권 (1회성)
} as const;

export type PaddlePlan = keyof typeof PADDLE_PRODUCTS;

// 가격 표시용 (Paddle 대시보드 설정과 일치해야 함)
export const PLAN_PRICE = {
  pro_monthly: '₩900/월',
  pro_yearly:  '₩7,900/년',
  lifetime:    '₩19,900',
} as const;

export const PLAN_DESCRIPTION = {
  pro_monthly: '매월 자동 결제 · 언제든 해지 가능',
  pro_yearly:  '연간 결제 · 월 대비 27% 절약',
  lifetime:    '1회 결제 · 영구 이용',
} as const;
