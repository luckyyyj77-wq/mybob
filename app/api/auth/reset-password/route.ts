import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    const { email, redirectTo } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'invalid' }, { status: 400 });
    }

    const limit = rateLimit(`reset-pw:${email.toLowerCase()}`, 3, 10 * 60 * 1000);
    if (limit.limited) {
      return NextResponse.json({ ok: true }); // 보안상 동일한 성공 응답
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 가입된 이메일인지 확인 — listUsers는 페이지당 기본 50명이라 전체 페이지 순회 필요
    let exists = false;
    for (let page = 1; page <= 20; page++) {
      const { data } = await adminSupabase.auth.admin.listUsers({ page, perPage: 1000 });
      const users = data?.users ?? [];
      exists = users.some(u => u.email?.toLowerCase() === email.toLowerCase());
      if (exists || users.length < 1000) break;
    }

    if (!exists) {
      // 보안상 동일한 성공 응답 (이메일 존재 여부 노출 안 함)
      return NextResponse.json({ ok: true });
    }

    // 가입된 이메일만 실제 발송
    const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);
    const finalRedirectTo = redirectTo || 'https://mybob.kr/auth/callback?type=recovery';
    const { error } = await anonSupabase.auth.resetPasswordForEmail(email, { redirectTo: finalRedirectTo });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[auth/reset-password POST]', error?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
