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

// GET /api/community?type=neighbors — 이웃 피드 (PRO 전용)
// GET /api/community — 추천 피드: 이웃(neighbors+public) + 전체공개(public) 혼합
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // ── 이웃 피드 (PRO 전용) ──────────────────────────────────────────
    if (type === 'neighbors') {
      const { data: profile } = await admin.from('profiles').select('plan').eq('id', user.id).single();
      if (!profile || profile.plan === 'free') {
        return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 403 });
      }

      const { data: friendships } = await admin
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

      const { data: meals, error } = await admin
        .from('meals')
        .select('id, user_id, food_name, calories, category, photo_url, created_at, portion, visibility')
        .in('user_id', friendIds)
        .in('visibility', ['neighbors', 'public'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return NextResponse.json({ success: true, data: await attachProfiles(admin, meals ?? []) });
    }

    // ── 추천 피드 ────────────────────────────────────────────────────
    // 이웃 ID 조회 (있으면 neighbors+public, 없으면 public만)
    const { data: friendships } = await admin
      .from('friendships')
      .select('requester_id, receiver_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);

    const friendIds = (friendships ?? []).map(f =>
      f.requester_id === user.id ? f.receiver_id : f.requester_id
    );

    // 이웃 식단: neighbors + public (최신 30개)
    let neighborMeals: any[] = [];
    if (friendIds.length > 0) {
      const { data } = await admin
        .from('meals')
        .select('id, user_id, food_name, calories, category, photo_url, created_at, portion, visibility')
        .in('user_id', friendIds)
        .in('visibility', ['neighbors', 'public'])
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      neighborMeals = data ?? [];
    }

    // 전체 공개 식단: public only (좋아요 수 포함, 자신+이웃 제외)
    const excludeIds = [user.id, ...friendIds];
    const { data: publicMeals } = await admin
      .from('meals')
      .select('id, user_id, food_name, calories, category, photo_url, created_at, portion, visibility')
      .eq('visibility', 'public')
      .not('user_id', 'in', `(${excludeIds.map(id => `"${id}"`).join(',')})`)
      .order('created_at', { ascending: false })
      .limit(50);

    // 좋아요 수 조회
    const publicIds = (publicMeals ?? []).map(m => m.id);
    let likeCounts: Record<string, number> = {};
    if (publicIds.length > 0) {
      const { data: likes } = await admin
        .from('meal_likes')
        .select('meal_id')
        .in('meal_id', publicIds);
      for (const l of likes ?? []) {
        likeCounts[l.meal_id] = (likeCounts[l.meal_id] ?? 0) + 1;
      }
    }

    // 인기순 + 랜덤 가중치 정렬 (좋아요 1개 = 최신성 1시간 가치)
    const scoredPublic = (publicMeals ?? []).map(m => {
      const likes = likeCounts[m.id] ?? 0;
      const ageHours = (Date.now() - new Date(m.created_at).getTime()) / 3600000;
      const randomFactor = 0.7 + Math.random() * 0.6; // 0.7~1.3
      const score = (likes + 1) / Math.pow(ageHours + 2, 0.8) * randomFactor;
      return { ...m, like_count: likes, score };
    }).sort((a, b) => b.score - a.score).slice(0, 30);

    // 이웃 식단 + 전체공개 식단 합치기 (이웃 우선 배치)
    const neighborWithFlag = neighborMeals.map(m => ({ ...m, like_count: likeCounts[m.id] ?? 0, is_neighbor: true }));
    const combined = [...neighborWithFlag, ...scoredPublic];

    const allMeals = await attachProfiles(admin, combined);

    return NextResponse.json({ success: true, data: allMeals });

  } catch (error: unknown) {
    console.error('[community GET]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

async function attachProfiles(admin: any, meals: any[]) {
  if (meals.length === 0) return [];
  const userIds = Array.from(new Set(meals.map(m => m.user_id)));
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, nickname, avatar_url')
    .in('id', userIds);
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
  return meals.map(m => ({
    ...m,
    nickname: profileMap[m.user_id]?.nickname ?? '익명',
    avatar_url: profileMap[m.user_id]?.avatar_url ?? null,
  }));
}
