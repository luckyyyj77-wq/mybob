import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getUser(request: Request) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.split(' ')[1];
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// POST /api/pin-reset — 이메일로 OTP 발송
export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user || !user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Supabase Auth의 signInWithOtp 이메일 발송 (서비스 키로)
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  const { error } = await sb.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    console.error('OTP send error:', error);
    return NextResponse.json({ error: 'EMAIL_SEND_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email: user.email });
}

// PUT /api/pin-reset — OTP 검증 후 PIN 초기화 승인
export async function PUT(request: Request) {
  const user = await getUser(request);
  if (!user || !user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { otp } = await request.json();
  if (!otp) return NextResponse.json({ error: 'MISSING_OTP' }, { status: 400 });

  // Supabase OTP 검증
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  const { error } = await sb.auth.verifyOtp({
    email: user.email,
    token: otp,
    type: 'email',
  });

  if (error) {
    console.error('OTP verify error:', error);
    return NextResponse.json({ error: 'WRONG_OTP' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
