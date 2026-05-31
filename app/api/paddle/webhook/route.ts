import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET!;

// Paddle webhook 서명 검증
async function verifyPaddleSignature(body: string, signature: string): Promise<boolean> {
  try {
    const parts: Record<string, string> = {};
    for (const part of signature.split(';')) {
      const idx = part.indexOf('=');
      if (idx > 0) parts[part.slice(0, idx)] = part.slice(idx + 1);
    }
    const ts = parts['ts'];
    const h1 = parts['h1'];
    if (!ts || !h1) return false;

    // 타임스탬프 5분 이내 검증 (NaN 방어)
    const tsNum = parseInt(ts, 10);
    if (!isFinite(tsNum)) return false;
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - tsNum) > 300) return false;

    const payload = `${ts}:${body}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const computed = Array.from(new Uint8Array(signed))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // 타이밍 공격 방어: 길이 다르면 즉시 false
    if (computed.length !== h1.length) return false;
    return computed === h1;
  } catch {
    return false;
  }
}

function getPlanFromPriceId(priceId: string): 'pro' | 'lifetime' | null {
  const monthlyId = process.env.NEXT_PUBLIC_PADDLE_PRO_MONTHLY_ID;
  const yearlyId  = process.env.NEXT_PUBLIC_PADDLE_PRO_YEARLY_ID;
  const lifetimeId = process.env.NEXT_PUBLIC_PADDLE_LIFETIME_ID;
  if (priceId === monthlyId || priceId === yearlyId) return 'pro';
  if (priceId === lifetimeId) return 'lifetime';
  return null;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('paddle-signature') ?? '';

  if (!webhookSecret) {
    console.error('PADDLE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const valid = await verifyPaddleSignature(body, signature);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(body);
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  const { event_type, data } = event;

  // 구독 활성화 / 1회성 결제 완료
  if (event_type === 'subscription.activated' || event_type === 'transaction.completed') {
    const customData = data.custom_data ?? {};
    const userId: string | undefined = customData.user_id;
    if (!userId) return NextResponse.json({ ok: true }); // user_id 없으면 무시

    const priceId = data.items?.[0]?.price?.id ?? data.items?.[0]?.price_id ?? '';
    const plan = getPlanFromPriceId(priceId);
    if (!plan) return NextResponse.json({ ok: true });

    const subscriptionId = event_type === 'subscription.activated' ? data.id : null;

    await admin.from('profiles').update({
      plan,
      ...(subscriptionId ? { paddle_subscription_id: subscriptionId } : {}),
    }).eq('id', userId);
  }

  // 구독 취소 / 만료 → free로 다운그레이드
  if (event_type === 'subscription.canceled' || event_type === 'subscription.paused') {
    const subscriptionId = data.id;
    await admin.from('profiles')
      .update({ plan: 'free', paddle_subscription_id: null })
      .eq('paddle_subscription_id', subscriptionId);
  }

  // 구독 재개/갱신 성공 (pro 유지 확인)
  if (event_type === 'subscription.resumed' || event_type === 'subscription.renewed') {
    const subscriptionId = data.id;
    await admin.from('profiles')
      .update({ plan: 'pro' })
      .eq('paddle_subscription_id', subscriptionId);
  }

  return NextResponse.json({ ok: true });
}
