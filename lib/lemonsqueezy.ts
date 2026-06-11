export const LS_PRODUCTS = {
  pro_monthly: process.env.NEXT_PUBLIC_LS_PRO_MONTHLY_VARIANT_ID!,
  lifetime:    process.env.NEXT_PUBLIC_LS_LIFETIME_VARIANT_ID!,
} as const;

export type LSPlan = keyof typeof LS_PRODUCTS;

export const PLAN_PRICE: Record<LSPlan, string> = {
  pro_monthly: '₩2,900/월',
  lifetime:    '₩29,900',
};

export const PLAN_DESCRIPTION: Record<LSPlan, string> = {
  pro_monthly: '매월 자동 결제 · 언제든 해지 가능',
  lifetime:    '1회 결제 · 영구 이용',
};

export function getLSCheckoutUrl(variantId: string, userEmail: string, userId: string): string {
  const storeSlug = process.env.NEXT_PUBLIC_LS_STORE_SLUG!;
  const params = new URLSearchParams({
    'checkout[email]': userEmail,
    'checkout[custom][user_id]': userId,
  });
  return `https://${storeSlug}.lemonsqueezy.com/buy/${variantId}?${params.toString()}`;
}
