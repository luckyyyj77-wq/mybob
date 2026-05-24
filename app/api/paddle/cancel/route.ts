import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const paddleApiKey = process.env.PADDLE_API_KEY!;
const paddleEnv = process.env.PADDLE_ENV ?? 'sandbox'; // 'sandbox' | 'production'

async function getUser(request: Request) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.split(' ')[1];
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// POST /api/paddle/cancel — 구독 취소 요청
export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile } = await admin
    .from('profiles')
    .select('paddle_subscription_id, plan')
    .eq('id', user.id)
    .single();

  if (!profile?.paddle_subscription_id) {
    return NextResponse.json({ error: 'NO_SUBSCRIPTION' }, { status: 400 });
  }

  if (profile.plan === 'lifetime') {
    return NextResponse.json({ error: 'LIFETIME_CANNOT_CANCEL' }, { status: 400 });
  }

  const baseUrl = paddleEnv === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';

  const res = await fetch(`${baseUrl}/subscriptions/${profile.paddle_subscription_id}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paddleApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ effective_from: 'next_billing_period' }),
  });

  if (!res.ok) {
    const err = await res.json();
    return NextResponse.json({ error: err.error?.detail ?? 'CANCEL_FAILED' }, { status: 500 });
  }

  // webhook에서 최종 처리되지만 UI 즉시 반영용 메시지
  return NextResponse.json({ ok: true, message: '다음 결제일 이후 해지됩니다.' });
}
