import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// GET /api/community — 이웃들의 공개 식단 피드
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // PRO 확인
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single();

    if (!profile || profile.plan === 'free') {
      return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 403 });
    }

    // 나의 이웃 ID 목록 조회 (수락된 것만)
    const { data: friendships } = await adminSupabase
      .from('friendships')
      .select('requester_id, receiver_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (!friendships || friendships.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const friendIds = friendships.map(f =>
      f.requester_id === user.id ? f.receiver_id : f.requester_id
    );

    // 이웃들의 공개 식단 조회
    const { data: meals, error } = await adminSupabase
      .from('meals')
      .select('id, user_id, food_name, calories, category, photo_url, created_at, portion')
      .in('user_id', friendIds)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // 닉네임/아바타 일괄 조회
    const userIds = Array.from(new Set(meals?.map(m => m.user_id) ?? []));
    const { data: profiles } = await adminSupabase
      .from('profiles')
      .select('id, nickname, avatar_url')
      .in('id', userIds);

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

    const feed = (meals ?? []).map(m => ({
      ...m,
      nickname: profileMap[m.user_id]?.nickname ?? '익명',
      avatar_url: profileMap[m.user_id]?.avatar_url ?? null,
    }));

    return NextResponse.json({ success: true, data: feed });

  } catch (error: any) {
    console.error('[community GET]', error?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
