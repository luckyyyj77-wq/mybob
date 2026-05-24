import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { rateLimit } from '@/lib/rate-limit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const resend = new Resend(process.env.RESEND_API_KEY!);

async function getUser(request: Request) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.split(' ')[1];
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/pin-reset — 6자리 OTP 생성 후 이메일 발송
export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user || !user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 분당 3회 이하로 OTP 발송 제한
  const sendLimit = rateLimit(`pin-send:${user.id}`, 3, 60 * 1000);
  if (sendLimit.limited) {
    return NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 });
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분

  // profiles 테이블에 OTP 저장
  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const { error: dbError } = await admin.from('profiles').update({
    danger_pin_otp: otp,
    danger_pin_otp_expires: expiresAt.toISOString(),
  }).eq('id', user.id);

  if (dbError) {
    console.error('OTP save error:', dbError);
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 });
  }

  // Resend로 이메일 발송
  const { error: mailError } = await resend.emails.send({
    from: 'MyBob <onboarding@resend.dev>',
    to: user.email,
    subject: '[MyBob] 위험구역 PIN 초기화 인증 코드',
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
        <h2 style="font-size: 18px; font-weight: 400; margin-bottom: 24px;">MyBob 위험구역 PIN 초기화</h2>
        <p style="font-size: 14px; color: #6b7280; margin-bottom: 24px;">아래 6자리 인증 코드를 입력하세요. 10분 내에 사용해야 합니다.</p>
        <div style="background: #f3f4f6; padding: 24px; text-align: center; letter-spacing: 12px; font-size: 32px; font-weight: 600; margin-bottom: 24px;">
          ${otp}
        </div>
        <p style="font-size: 12px; color: #9ca3af;">본인이 요청하지 않았다면 이 이메일을 무시하세요.</p>
      </div>
    `,
  });

  if (mailError) {
    console.error('Resend error:', mailError);
    return NextResponse.json({ error: 'EMAIL_SEND_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email: user.email });
}

// PUT /api/pin-reset — OTP 검증
export async function PUT(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 10분 안에 5회 이상 OTP 검증 시도 시 잠금
  const verifyLimit = rateLimit(`pin-verify:${user.id}`, 5, 10 * 60 * 1000);
  if (verifyLimit.limited) {
    return NextResponse.json({ error: 'TOO_MANY_ATTEMPTS' }, { status: 429 });
  }

  const { otp } = await request.json();
  if (!otp) return NextResponse.json({ error: 'MISSING_OTP' }, { status: 400 });

  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile } = await admin
    .from('profiles')
    .select('danger_pin_otp, danger_pin_otp_expires')
    .eq('id', user.id)
    .single();

  if (!profile?.danger_pin_otp) return NextResponse.json({ error: 'NO_OTP' }, { status: 400 });
  if (new Date() > new Date(profile.danger_pin_otp_expires)) return NextResponse.json({ error: 'OTP_EXPIRED' }, { status: 400 });
  if (profile.danger_pin_otp !== otp) return NextResponse.json({ error: 'WRONG_OTP' }, { status: 400 });

  // 검증 성공 — OTP 소진
  await admin.from('profiles').update({
    danger_pin_otp: null,
    danger_pin_otp_expires: null,
  }).eq('id', user.id);

  return NextResponse.json({ ok: true });
}
