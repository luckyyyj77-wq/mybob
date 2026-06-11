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
  pro_6months: '₩7,900/6개월',
  pro_yearly:  '₩8,900/년',
};

export const PLAN_PER_MONTH: Record<LSPlan, string> = {
  pro_monthly: '월 ₩900',
  pro_6months: '월 ₩1,317',
  pro_yearly:  '월 ₩742',
};

export const PLAN_DESCRIPTION: Record<LSPlan, string> = {
  pro_monthly: '매월 자동 결제 · 언제든 해지 가능',
  pro_6months: '6개월마다 자동 결제',
  pro_yearly:  '연간 결제 · 월간 대비 18% 절약',
};

export function getLSCheckoutUrl(variantId: string, userEmail: string, userId: string, autoCancel: boolean): string {
  const storeSlug = process.env.NEXT_PUBLIC_LS_STORE_SLUG!;
  const params = new URLSearchParams({
    'checkout[email]': userEmail,
    'checkout[custom][user_id]': userId,
    'checkout[custom][auto_cancel]': autoCancel ? '1' : '0',
  });
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
