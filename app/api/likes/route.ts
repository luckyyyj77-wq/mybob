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

// POST /api/likes — 좋아요 토글 (있으면 취소, 없으면 추가)
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { mealId } = await request.json();
    if (!mealId) return NextResponse.json({ error: 'mealId required' }, { status: 400 });

    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: existing } = await admin
      .from('meal_likes')
      .select('id')
      .eq('meal_id', mealId)
      .eq('user_id', user.id)
      .single();

    // 현재 카운트 조회 (toggle 전)
    const { count: currentCount } = await admin
      .from('meal_likes')
      .select('*', { count: 'exact', head: true })
      .eq('meal_id', mealId);
    const base = currentCount ?? 0;

    if (existing) {
      await admin.from('meal_likes').delete().eq('id', existing.id);
      return NextResponse.json({ liked: false, count: Math.max(0, base - 1) });
    } else {
      await admin.from('meal_likes').insert({ meal_id: mealId, user_id: user.id });
      return NextResponse.json({ liked: true, count: base + 1 });
    }
  } catch (error: unknown) {
    console.error('[likes POST]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// GET /api/likes?mealIds=id1,id2 — 여러 식단의 좋아요 수 + 내 좋아요 여부 조회 (레거시, body 방식 권장)
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const mealIdsParam = searchParams.get('mealIds');
    if (!mealIdsParam) return NextResponse.json({ data: {} });

    const mealIds = mealIdsParam.split(',').filter(Boolean).slice(0, 100);
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: likes } = await admin
      .from('meal_likes')
      .select('meal_id, user_id')
      .in('meal_id', mealIds);

    const result: Record<string, { count: number; liked: boolean }> = {};
    for (const id of mealIds) {
      const entries = likes?.filter(l => l.meal_id === id) ?? [];
      result[id] = {
        count: entries.length,
        liked: entries.some(l => l.user_id === user.id),
      };
    }

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    console.error('[likes GET]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
