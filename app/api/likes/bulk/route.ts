import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// POST /api/likes/bulk — body: { mealIds: string[] }
// 여러 식단의 좋아요 수 + 내 좋아요 여부 일괄 조회
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const mealIds: string[] = Array.isArray(body.mealIds) ? body.mealIds.slice(0, 200) : [];
    if (mealIds.length === 0) return NextResponse.json({ data: {} });

    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: likes } = await admin
      .from('meal_likes')
      .select('meal_id, user_id')
      .in('meal_id', mealIds);

    const result: Record<string, { count: number; liked: boolean }> = {};
    for (const id of mealIds) {
      const entries = likes?.filter(l => l.meal_id === id) ?? [];
      result[id] = { count: entries.length, liked: entries.some(l => l.user_id === user.id) };
    }

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    console.error('[likes/bulk POST]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
