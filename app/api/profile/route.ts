import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateNickname } from '@/lib/nickname';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('plan, nickname, avatar_url')
    .eq('id', user.id)
    .single();

  let nickname = profile?.nickname ?? null;

  // 닉네임 없으면 랜덤 생성 후 저장
  if (!nickname) {
    nickname = generateNickname();
    await adminSupabase
      .from('profiles')
      .upsert({ id: user.id, nickname, updated_at: new Date().toISOString() });
  }

  return NextResponse.json({
    plan: profile?.plan ?? 'free',
    nickname,
    avatar_url: profile?.avatar_url ?? null,
    email: user.email,
  });
}

export async function PATCH(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  const plan = profile?.plan ?? 'free';

  const body = await request.json();
  const updates: Record<string, string> = {};

  if (typeof body.nickname === 'string') {
    // 무료 사용자는 닉네임 직접 변경 불가
    if (plan === 'free') {
      return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 403 });
    }
    const nick = body.nickname.trim();
    if (nick.length < 2 || nick.length > 16) {
      return NextResponse.json({ error: '닉네임은 2~16자여야 합니다.' }, { status: 400 });
    }
    updates.nickname = nick;
  }

  if (typeof body.avatar_url === 'string') {
    if (plan === 'free') {
      return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 403 });
    }
    updates.avatar_url = body.avatar_url;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 });
  }

  const { error } = await adminSupabase
    .from('profiles')
    .upsert({ id: user.id, ...updates, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
