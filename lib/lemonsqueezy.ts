export const LS_VARIANT_IDS = {
  pro_monthly:  '1774219',
  pro_6months:  '1774231',
  pro_yearly:   '1774232',
} as const;

export type LSPlan = keyof typeof LS_VARIANT_IDS;

export const PLAN_LABEL: Record<LSPlan, string> = {
  pro_monthly: 'PRO 월간',
  pro_6months: 'PRO 6개월',
  pro_yearly:  'PRO 연간',
};

export const PLAN_PRICE: Record<LSPlan, string> = {
  pro_monthly: '₩900/월',
  pro_6months: '₩4,500/6개월',
  pro_yearly:  '₩8,100/년',
};

export const PLAN_PER_MONTH: Record<LSPlan, string> = {
  pro_monthly: '',
  pro_6months: '월 ₩750 · 1개월 무료',
  pro_yearly:  '월 ₩675 · 3개월 무료',
};

export const PLAN_DESCRIPTION: Record<LSPlan, string> = {
  pro_monthly: '매월 자동 결제 · 언제든 해지 가능',
  pro_6months: '6개월마다 자동 결제 · 17% 절약',
  pro_yearly:  '연간 결제 · 25% 절약',
};

// 플랜별 자동해지 기간 레이블
export const PLAN_CANCEL_LABEL: Record<LSPlan, string> = {
  pro_monthly: '1개월',
  pro_6months: '6개월',
  pro_yearly:  '1년',
};

// 플랜별 자동해지 날짜 계산 (말일 초과 시 해당 달의 마지막 날로 클램프)
export function getAutoCancelDate(plan: LSPlan): Date {
  const now = new Date();
  const day = now.getDate();

  let y = now.getFullYear();
  let m = now.getMonth(); // 0-indexed

  if (plan === 'pro_monthly') {
    m += 1;
  } else if (plan === 'pro_6months') {
    m += 6;
  } else {
    y += 1;
  }

  // 월 오버플로 처리
  y += Math.floor(m / 12);
  m = m % 12;

  // 해당 달의 마지막 날 (2월 28/29일 등)
  const lastDay = new Date(y, m + 1, 0).getDate();
  const safeDay = Math.min(day, lastDay);

  return new Date(y, m, safeDay, now.getHours(), now.getMinutes(), now.getSeconds());
}

export function getLSCheckoutUrl(variantId: string, userEmail: string, userId: string, autoCancel: boolean): string {
  const storeSlug = process.env.NEXT_PUBLIC_LS_STORE_SLUG!;
  const testMode = process.env.NEXT_PUBLIC_LS_TEST_MODE === '1';
  const params = new URLSearchParams({
    'checkout[email]': userEmail,
    'checkout[custom][user_id]': userId,
    'checkout[custom][auto_cancel]': autoCancel ? '1' : '0',
  });
  if (testMode) params.set('test', '1');
  return `https://${storeSlug}.lemonsqueezy.com/buy/${variantId}?${params.toString()}`;
}

export function getVariantIdFromPlan(plan: LSPlan): string {
  return LS_VARIANT_IDS[plan];
}

export function getPlanFromVariantId(variantId: string | number): 'pro' | null {
  const id = String(variantId);
  if (Object.values(LS_VARIANT_IDS).includes(id as any)) return 'pro';
  return null;
}
