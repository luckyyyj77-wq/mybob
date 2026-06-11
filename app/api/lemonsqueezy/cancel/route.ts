import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const lsApiKey = process.env.LS_API_KEY!;

async function getUser(request: Request) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.split(' ')[1];
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile } = await admin
    .from('profiles')
    .select('ls_subscription_id, plan')
    .eq('id', user.id)
    .single();

  if (!profile?.ls_subscription_id) {
    return NextResponse.json({ error: 'NO_SUBSCRIPTION' }, { status: 400 });
  }

  if (profile.plan === 'lifetime') {
    return NextResponse.json({ error: 'LIFETIME_CANNOT_CANCEL' }, { status: 400 });
  }

  const res = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${profile.ls_subscription_id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${lsApiKey}`,
      Accept: 'application/vnd.api+json',
    },
  });

  if (!res.ok) {
    console.error('[ls/cancel] Lemon Squeezy API error:', res.status);
    return NextResponse.json({ error: 'CANCEL_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: '다음 결제일 이후 해지됩니다.' });
}
