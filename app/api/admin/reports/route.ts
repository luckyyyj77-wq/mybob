import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminEmail = process.env.ADMIN_EMAIL!;

async function verifyAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user || user.email !== adminEmail) return null;
  return user;
}

export async function GET(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 플랜별 유저 수
    const { data: profiles } = await adminSupabase
      .from('profiles')
      .select('plan, analyses_today, last_analysis_date');

    const planCount = { free: 0, pro: 0, lifetime: 0 };
    (profiles ?? []).forEach(p => {
      const plan = p.plan as keyof typeof planCount;
      if (plan in planCount) planCount[plan]++;
    });

    // profiles 없는 유저 = free로 처리
    const { data: usersData } = await adminSupabase.auth.admin.listUsers();
    const totalUsers = usersData?.users?.length ?? 0;
    const profiledUsers = (profiles ?? []).length;
    planCount.free += totalUsers - profiledUsers;

    // 최근 14일 일별 식단 기록 수
    const dailyMeals = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      const { count } = await adminSupabase
        .from('meals')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());
      dailyMeals.push({
        date: d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
        count: count ?? 0,
      });
    }

    // 오늘 활성 분석 사용자 수 (analyses_today > 0)
    const today = new Date().toISOString().slice(0, 10);
    const activeAnalyzers = (profiles ?? []).filter(
      p => p.last_analysis_date === today && (p.analyses_today ?? 0) > 0
    ).length;

    // 카테고리별 누적
    const { data: catData } = await adminSupabase.from('meals').select('category');
    const catCount: Record<string, number> = {};
    (catData ?? []).forEach(m => {
      const c = m.category || '기타';
      catCount[c] = (catCount[c] || 0) + 1;
    });
    const categoryStats = Object.entries(catCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    return NextResponse.json({
      success: true,
      data: { planCount, totalUsers, dailyMeals, activeAnalyzers, categoryStats },
    });
  } catch (error: any) {
    console.error('[admin/reports GET]', error?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
