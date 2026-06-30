import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  // token_hash 방식 (이메일 템플릿 직접 조합 URL)
  if (type === 'recovery' && tokenHash) {
    return NextResponse.redirect(`${origin}/auth/reset-password?token_hash=${tokenHash}&type=recovery`);
  }

  // PKCE code 방식
  if (type === 'recovery' && code) {
    return NextResponse.redirect(`${origin}/auth/reset-password?code=${code}`);
  }

  // 일반 로그인/가입: 서버에서 code 교환 후 complete로
  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/auth/callback/complete`);
}
