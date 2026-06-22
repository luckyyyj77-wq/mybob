import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getFoundingRewardMonths } from '@/lib/plan';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminEmail = process.env.ADMIN_EMAIL!;

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user } } = await supabase.auth.getUser(authHeader.split(' ')[1]);
  if (!user || user.email !== adminEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  // 천인회 멤버 프로필 조회
  const { data: profiles, error } = await adminSupabase
    .from('profiles')
    .select('id, founding_joined_at')
    .eq('is_founding_member', true)
    .order('founding_joined_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!profiles?.length) return NextResponse.json({ members: [] });

  // auth.users에서 이메일 조회
  const { data: authUsers } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map(authUsers?.users?.map(u => [u.id, u.email]) ?? []);

  const now = Date.now();
  const members = profiles.map(p => {
    const daysUsed = p.founding_joined_at
      ? Math.floor((now - new Date(p.founding_joined_at).getTime()) / 86400000)
      : 0;
    return {
      id: p.id,
      email: emailMap.get(p.id) || '—',
      founding_joined_at: p.founding_joined_at,
      daysUsed,
      rewardMonths: getFoundingRewardMonths(daysUsed),
    };
  });

  // 일별 가입 수 집계 (최근 30일)
  const dailyMap: Record<string, number> = {};
  const thirtyDaysAgo = new Date(now - 30 * 86400000);
  profiles.forEach(p => {
    if (!p.founding_joined_at) return;
    const d = new Date(p.founding_joined_at);
    if (d < thirtyDaysAgo) return;
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = (dailyMap[key] || 0) + 1;
  });
  const dailyStats = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date: date.slice(5), count }));

  return NextResponse.json({ members, dailyStats });
}
