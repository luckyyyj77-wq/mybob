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

// GET /api/community — 추천 피드 (전체 공개 식단, FREE 포함)
// GET /api/community?type=neighbors — 이웃 공개 식단 피드 (PRO 전용)
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 이웃 피드는 PRO 전용
    if (type === 'neighbors') {
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single();

      if (!profile || profile.plan === 'free') {
        return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 403 });
      }

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

      const { data: meals, error } = await adminSupabase
        .from('meals')
        .select('id, user_id, food_name, calories, category, photo_url, created_at, portion')
        .in('user_id', friendIds)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

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
    }

    // 추천 피드: 전체 공개 식단 (자신 제외, 최신순)
    const { data: meals, error } = await adminSupabase
      .from('meals')
      .select('id, user_id, food_name, calories, category, photo_url, created_at, portion')
      .eq('is_public', true)
      .neq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) throw error;

    const userIds = Array.from(new Set(meals?.map(m => m.user_id) ?? []));
    let profileMap: Record<string, { nickname: string; avatar_url: string | null }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await adminSupabase
        .from('profiles')
        .select('id, nickname, avatar_url')
        .in('id', userIds);
      profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
    }

    const feed = (meals ?? []).map(m => ({
      ...m,
      nickname: profileMap[m.user_id]?.nickname ?? '익명',
      avatar_url: profileMap[m.user_id]?.avatar_url ?? null,
    }));

    return NextResponse.json({ success: true, data: feed });

  } catch (error: unknown) {
    console.error('[community GET]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
