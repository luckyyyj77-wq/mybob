import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const type = searchParams.get('type');

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.exchangeCodeForSession(code);
  }

  // 비밀번호 재설정 링크 → reset-password 페이지로 직행
  if (type === 'recovery' || next === '/auth/reset-password') {
    return NextResponse.redirect(`${origin}/auth/reset-password?type=recovery`);
  }

  // 일반 로그인/가입 콜백 → 온보딩 여부는 클라이언트 판단
  return NextResponse.redirect(`${origin}/auth/callback/complete`);
}
