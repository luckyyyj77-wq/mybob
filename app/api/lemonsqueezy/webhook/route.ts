import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const webhookSecret = process.env.LS_WEBHOOK_SECRET!;

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

function getPlanFromVariantId(variantId: string | number): 'pro' | 'lifetime' | null {
  const id = String(variantId);
  if (id === process.env.NEXT_PUBLIC_LS_PRO_MONTHLY_VARIANT_ID) return 'pro';
  if (id === process.env.NEXT_PUBLIC_LS_LIFETIME_VARIANT_ID) return 'lifetime';
  return null;
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

  // 구독 생성/활성화
  if (eventName === 'subscription_created' || eventName === 'subscription_payment_success') {
    const userId: string | undefined = customData.user_id;
    if (!userId) return NextResponse.json({ ok: true });

    const variantId = attrs.variant_id;
    const plan = getPlanFromVariantId(variantId);
    if (!plan) return NextResponse.json({ ok: true });

    const subscriptionId = String(data.id);

    await admin.from('profiles').update({
      plan,
      ls_subscription_id: plan === 'pro' ? subscriptionId : null,
    }).eq('id', userId);
  }

  // 1회성 결제(Lifetime) 완료
  if (eventName === 'order_created') {
    const userId: string | undefined = customData.user_id;
    if (!userId) return NextResponse.json({ ok: true });

    const variantId = attrs.first_order_item?.variant_id ?? attrs.variant_id;
    const plan = getPlanFromVariantId(variantId);
    if (plan !== 'lifetime') return NextResponse.json({ ok: true });

    await admin.from('profiles').update({
      plan: 'lifetime',
      ls_subscription_id: null,
    }).eq('id', userId);
  }

  // 구독 취소/만료 → free 다운그레이드
  if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
    const subscriptionId = String(data.id);
    await admin.from('profiles')
      .update({ plan: 'free', ls_subscription_id: null })
      .eq('ls_subscription_id', subscriptionId);
  }

  // 구독 재개/갱신
  if (eventName === 'subscription_resumed' || eventName === 'subscription_updated') {
    const status: string = attrs.status ?? '';
    if (status === 'active') {
      const subscriptionId = String(data.id);
      await admin.from('profiles')
        .update({ plan: 'pro' })
        .eq('ls_subscription_id', subscriptionId);
    }
  }

  return NextResponse.json({ ok: true });
}
