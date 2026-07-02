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

    // 최근 14일 일별 식단 기록 수 (1개 쿼리로 배치 조회 후 메모리 집계)
    const since14 = new Date(); since14.setDate(since14.getDate() - 13); since14.setHours(0, 0, 0, 0);
    const { data: mealsLast14 } = await adminSupabase
      .from('meals')
      .select('created_at')
      .gte('created_at', since14.toISOString());

    const dailyMeals = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      const dateStr = d.toISOString().slice(0, 10);
      const count = (mealsLast14 ?? []).filter(m => m.created_at.slice(0, 10) === dateStr).length;
      return { date: d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }), count };
    });

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

    // 토큰 사용량 통계 (최근 14일)
    const tokenSince14 = new Date(); tokenSince14.setDate(tokenSince14.getDate() - 13); tokenSince14.setHours(0, 0, 0, 0);
    const { data: usageData } = await adminSupabase
      .from('gemini_usage')
      .select('model, plan, tokens_in, tokens_out, created_at')
      .gte('created_at', tokenSince14.toISOString());

    const modelTotals: Record<string, { calls: number; tokensIn: number; tokensOut: number }> = {};
    let totalCalls = 0;
    (usageData ?? []).forEach((r: any) => {
      const m = r.model ?? 'unknown';
      if (!modelTotals[m]) modelTotals[m] = { calls: 0, tokensIn: 0, tokensOut: 0 };
      modelTotals[m].calls++;
      modelTotals[m].tokensIn  += r.tokens_in  ?? 0;
      modelTotals[m].tokensOut += r.tokens_out ?? 0;
      totalCalls++;
    });

    // 모델별 단가 ($/1M tokens)
    const PRICE: Record<string, { in: number; out: number }> = {
      'gemini-2.5-pro':       { in: 1.25,  out: 10.0 },
      'gemini-2.5-flash':     { in: 0.075, out: 0.30 },
      'gemini-2.0-flash':     { in: 0.075, out: 0.30 },
      'gemini-2.0-flash-lite':{ in: 0.075, out: 0.075 },
    };
    const tokenStats = Object.entries(modelTotals).map(([model, t]) => {
      const price = PRICE[model] ?? { in: 0.075, out: 0.30 };
      const costUsd = (t.tokensIn / 1_000_000) * price.in + (t.tokensOut / 1_000_000) * price.out;
      return { model, calls: t.calls, tokensIn: t.tokensIn, tokensOut: t.tokensOut, costUsd: Math.round(costUsd * 10000) / 10000 };
    }).sort((a, b) => b.calls - a.calls);

    const totalCostUsd = tokenStats.reduce((s, t) => s + t.costUsd, 0);

    return NextResponse.json({
      success: true,
      data: { planCount, totalUsers, dailyMeals, activeAnalyzers, categoryStats, tokenStats, totalCalls, totalCostUsd: Math.round(totalCostUsd * 10000) / 10000 },
    });
  } catch (error: any) {
    console.error('[admin/reports GET]', error?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
