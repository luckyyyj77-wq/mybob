import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getOrCreateProfile, UPLOAD_LIMITS, ANALYSIS_LIMITS, getEffectivePlan, isFoundingActive, getFoundingRewardMonths, FOUNDING_PROMOTION_END } from '@/lib/plan';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    // getOrCreateProfile 경유 → 신규 유저 천인회 슬롯 자동 선점
    const [profile, slotsRes] = await Promise.all([
      getOrCreateProfile(adminSupabase, user.id),
      adminSupabase.from('founding_slots').select('total_slots, used_slots').eq('id', 1).single(),
    ]);

    const plan = getEffectivePlan(profile);

    const uploadLimit = UPLOAD_LIMITS[plan];
    const uploadUsed = profile.last_upload_date === today ? (profile.uploads_today || 0) : 0;

    const analysisLimit = ANALYSIS_LIMITS[plan];
    const analysisUsed = profile.last_analysis_date === today ? (profile.analyses_today || 0) : 0;

    // 천인회 정보
    const isFoundingMember = isFoundingActive(profile);
    let foundingInfo = null;
    if (isFoundingMember && profile.founding_joined_at) {
      const joinedAt = new Date(profile.founding_joined_at);
      const daysUsed = Math.floor((Date.now() - joinedAt.getTime()) / 86400000);
      const rewardMonths = getFoundingRewardMonths(daysUsed);
      const daysLeft = Math.max(0, Math.ceil((new Date(FOUNDING_PROMOTION_END).getTime() - Date.now()) / 86400000));
      foundingInfo = { joinedAt: profile.founding_joined_at, daysUsed, rewardMonths, daysLeft, promotionEndsAt: FOUNDING_PROMOTION_END };
    }

    const slots = slotsRes.data;
    const remainingSlots = slots ? Math.max(0, slots.total_slots - slots.used_slots) : null;

    return NextResponse.json({
      plan,
      upload: { used: uploadUsed, limit: uploadLimit, remaining: uploadLimit - uploadUsed },
      analysis: { used: analysisUsed, limit: analysisLimit, remaining: analysisLimit - analysisUsed },
      autoCancel: profile.ls_auto_cancel ?? false,
      isFoundingMember,
      foundingInfo,
      remainingSlots,
    });
  } catch (error: any) {
    console.error('[upload-status GET]', error?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
