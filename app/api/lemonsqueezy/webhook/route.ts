import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPlanFromVariantId, getAutoCancelDate, type LSPlan, LS_VARIANT_IDS } from '@/lib/lemonsqueezy';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const webhookSecret = process.env.LS_WEBHOOK_SECRET!;
const lsApiKey = process.env.LS_API_KEY!;

async function verifySignature(body: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    const computed = Array.from(new Uint8Array(signed))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    if (computed.length !== signature.length) return false;
    return computed === signature;
  } catch {
    return false;
  }
}

function getPlanKeyFromVariantId(variantId: string | number): LSPlan {
  const id = String(variantId);
  for (const [key, val] of Object.entries(LS_VARIANT_IDS)) {
    if (val === id) return key as LSPlan;
  }
  return 'pro_monthly';
}

// 플랜 기간 후 구독 취소 예약
async function scheduleCancelAt(subscriptionId: string, plan: LSPlan): Promise<void> {
  const cancelAt = getAutoCancelDate(plan).toISOString();
  await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${lsApiKey}`,
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'subscriptions',
        id: String(subscriptionId),
        attributes: { cancelled: true, ends_at: cancelAt },
      },
    }),
  });
}

export async function POST(request: Request) {
  if (!webhookSecret) {
    console.error('LS_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('x-signature') ?? '';

  const valid = await verifySignature(body, signature);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(body);
  const eventName: string = event.meta?.event_name ?? '';
  const data = event.data ?? {};
  const attrs = data.attributes ?? {};
  const customData = event.meta?.custom_data ?? {};

  const admin = createClient(supabaseUrl, supabaseServiceKey);

  // 구독 생성 → PRO 활성화 + 자동해지 예약 처리
  if (eventName === 'subscription_created') {
    const userId: string | undefined = customData.user_id;
    if (!userId) return NextResponse.json({ ok: true });

    const variantId = attrs.variant_id;
    const plan = getPlanFromVariantId(variantId);
    if (!plan) return NextResponse.json({ ok: true });

    const subscriptionId = String(data.id);
    const autoCancel = customData.auto_cancel === '1';
    const planKey = getPlanKeyFromVariantId(attrs.variant_id);

    await admin.from('profiles').update({
      plan,
      ls_subscription_id: subscriptionId,
      ls_auto_cancel: autoCancel,
    }).eq('id', userId);

    // 자동해지 옵션 선택 시 플랜 기간에 맞춰 취소 예약
    if (autoCancel) {
      await scheduleCancelAt(subscriptionId, planKey);
    }
  }

  // 구독 갱신 성공 → pro 유지
  if (eventName === 'subscription_payment_success') {
    const subscriptionId = String(data.id);
    await admin.from('profiles')
      .update({ plan: 'pro' })
      .eq('ls_subscription_id', subscriptionId);
  }

  // 구독 취소/만료 → free 다운그레이드
  if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
    const subscriptionId = String(data.id);
    // cancelled 상태여도 ends_at 이전까지는 PRO 유지 (만료 시점에 expired 이벤트로 처리)
    if (eventName === 'subscription_expired') {
      await admin.from('profiles')
        .update({ plan: 'free', ls_subscription_id: null, ls_auto_cancel: false })
        .eq('ls_subscription_id', subscriptionId);
    }
  }

  // 구독 재개
  if (eventName === 'subscription_resumed') {
    const subscriptionId = String(data.id);
    await admin.from('profiles')
      .update({ plan: 'pro', ls_auto_cancel: false })
      .eq('ls_subscription_id', subscriptionId);
  }

  return NextResponse.json({ ok: true });
}
