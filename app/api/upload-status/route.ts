import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { UPLOAD_LIMITS, ANALYSIS_LIMITS, getEffectivePlan, isFoundingActive, getFoundingRewardMonths, FOUNDING_PROMOTION_END } from '@/lib/plan';

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

  const [profileRes, slotsRes] = await Promise.all([
    adminSupabase
      .from('profiles')
      .select('plan, uploads_today, last_upload_date, analyses_today, last_analysis_date, ls_auto_cancel, is_founding_member, founding_joined_at, pro_credit_expires_at')
      .eq('id', user.id)
      .single(),
    adminSupabase
      .from('founding_slots')
      .select('total_slots, used_slots')
      .eq('id', 1)
      .single(),
  ]);

  const profile = profileRes.data;
  const plan = getEffectivePlan(profile || {});

  const uploadLimit = UPLOAD_LIMITS[plan];
  const uploadUsed = profile?.last_upload_date === today ? (profile?.uploads_today || 0) : 0;

  const analysisLimit = ANALYSIS_LIMITS[plan];
  const analysisUsed = profile?.last_analysis_date === today ? (profile?.analyses_today || 0) : 0;

  // 천인회 정보
  const isFoundingMember = isFoundingActive(profile || {});
  let foundingInfo = null;
  if (isFoundingMember && profile?.founding_joined_at) {
    const joinedAt = new Date(profile.founding_joined_at);
    const daysUsed = Math.floor((Date.now() - joinedAt.getTime()) / 86400000);
    const rewardMonths = getFoundingRewardMonths(daysUsed);
    const endDate = new Date(FOUNDING_PROMOTION_END);
    const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86400000));
    foundingInfo = {
      joinedAt: profile.founding_joined_at,
      daysUsed,
      rewardMonths,
      daysLeft,
      promotionEndsAt: FOUNDING_PROMOTION_END,
    };
  }

  // 남은 슬롯 (비멤버에게 표시용)
  const slots = slotsRes.data;
  const remainingSlots = slots ? Math.max(0, slots.total_slots - slots.used_slots) : null;

  return NextResponse.json({
    plan,
    upload: { used: uploadUsed, limit: uploadLimit, remaining: uploadLimit - uploadUsed },
    analysis: { used: analysisUsed, limit: analysisLimit, remaining: analysisLimit - analysisUsed },
    autoCancel: profile?.ls_auto_cancel ?? false,
    isFoundingMember,
    foundingInfo,
    remainingSlots,
  });
}
