import { NextResponse } from 'next/server';

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

  // 일반 로그인/가입: code를 클라이언트로 그대로 전달해서 브라우저에서 세션 교환
  if (code) {
    return NextResponse.redirect(`${origin}/auth/callback/complete?code=${code}`);
  }

  return NextResponse.redirect(`${origin}/auth/callback/complete`);
}
