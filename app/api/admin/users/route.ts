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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
