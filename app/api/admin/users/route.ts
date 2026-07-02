import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/admin-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: usersData } = await adminSupabase.auth.admin.listUsers();
    const users = usersData?.users ?? [];

    // profiles 테이블에서 플랜 정보 일괄 조회
    const { data: profiles } = await adminSupabase
      .from('profiles')
      .select('id, plan, analyses_today, uploads_today, last_analysis_date');

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

    // 유저별 식단 수 조회
    const { data: mealCounts } = await adminSupabase
      .from('meals')
      .select('user_id');

    const mealCountMap: Record<string, number> = {};
    (mealCounts ?? []).forEach(m => {
      mealCountMap[m.user_id] = (mealCountMap[m.user_id] || 0) + 1;
    });

    const today = new Date().toISOString().slice(0, 10);

    const result = users
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(u => {
        const profile = profileMap[u.id];
        return {
          id: u.id,
          email: u.email ?? '—',
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          plan: profile?.plan ?? 'free',
          meal_count: mealCountMap[u.id] ?? 0,
          analyses_today: profile?.last_analysis_date === today ? (profile?.analyses_today ?? 0) : 0,
        };
      });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[admin/users GET]', error?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { userId, plan } = await request.json();
    if (!userId || !['free', 'pro', 'lifetime'].includes(plan)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await adminSupabase
      .from('profiles')
      .upsert({ id: userId, plan, updated_at: new Date().toISOString() }, { onConflict: 'id' });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[admin/users PATCH]', error?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
