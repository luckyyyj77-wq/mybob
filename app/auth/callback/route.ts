import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // code는 클라이언트(reset-password 페이지 or callback/complete)에서 교환
  // 서버에서 교환하면 세션이 브라우저에 전달되지 않음

  if (code) {
    // reset-password로 온 code인지 확인 — type 파라미터로 구분
    const type = searchParams.get('type');
    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/auth/reset-password?code=${code}`);
    }
  }

  // 일반 OAuth/이메일 로그인 콜백 → complete 페이지에서 클라이언트 세션 교환
  return NextResponse.redirect(`${origin}/auth/callback/complete${code ? `?code=${code}` : ''}`);
}
