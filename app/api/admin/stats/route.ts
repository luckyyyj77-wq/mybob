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
  if (error || !user) return null;
  if (user.email !== adminEmail) return null;
  return user;
}

export async function GET(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 전체 식단 수
    const { count: totalMeals } = await adminSupabase
      .from('meals')
      .select('*', { count: 'exact', head: true });

    // 오늘 신규 기록 수
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todayMeals } = await adminSupabase
      .from('meals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());

    // 이번 주 기록 수
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const { count: weekMeals } = await adminSupabase
      .from('meals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekStart.toISOString());

    // 전체 회원 수
    const { data: usersData } = await adminSupabase.auth.admin.listUsers();
    const totalUsers = usersData?.users?.length ?? 0;

    // 최근 가입 회원 5명
    const recentUsers = (usersData?.users ?? [])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map(u => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at }));

    // 최근 14일 일별 신규 가입자 수
    const allUsers = usersData?.users ?? [];
    const signupStats = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      const count = allUsers.filter(u => {
        const t = new Date(u.created_at).getTime();
        return t >= start.getTime() && t <= end.getTime();
      }).length;
      signupStats.push({
        date: d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
        count,
      });
    }

    // 카테고리별 기록 분포
    const { data: categoryData } = await adminSupabase
      .from('meals')
      .select('category');
    const catCount: Record<string, number> = {};
    (categoryData ?? []).forEach(m => {
      const cat = m.category || '기타';
      catCount[cat] = (catCount[cat] || 0) + 1;
    });
    const categoryStats = Object.entries(catCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));

    // 최근 7일 일별 기록 수 (1개 쿼리로 배치 조회 후 메모리 집계)
    const week7Start = new Date(); week7Start.setDate(week7Start.getDate() - 6); week7Start.setHours(0, 0, 0, 0);
    const { data: recentMeals } = await adminSupabase
      .from('meals')
      .select('created_at')
      .gte('created_at', week7Start.toISOString());

    const dailyStats = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().slice(0, 10);
      const count = (recentMeals ?? []).filter(m => m.created_at.slice(0, 10) === dateStr).length;
      return { date: d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }), count };
    });

    return NextResponse.json({
      success: true,
      data: { totalMeals, todayMeals, weekMeals, totalUsers, recentUsers, categoryStats, dailyStats, signupStats },
    });
  } catch (error: any) {
    console.error('[admin/stats GET]', error?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
