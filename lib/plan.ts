// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

// KST(UTC+9) 기준 오늘 날짜 반환 (YYYY-MM-DD)
function getKSTDateString(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

export type Plan = 'free' | 'pro' | 'lifetime';

export const UPLOAD_LIMITS: Record<Plan, number> = {
  free: 10,
  pro: 25,
  lifetime: 25,
};

export const ANALYSIS_LIMITS: Record<Plan, number> = {
  free: 10,
  pro: 25,
  lifetime: 25,
};

export const PLAN_LABEL: Record<Plan, string> = {
  free: '무료',
  pro: '구독',
  lifetime: '평생',
};

// 천인회 프로모션 종료일 (KST 기준)
export const FOUNDING_PROMOTION_END = '2026-12-31';

// 천인회 활성 여부 판단
export function isFoundingActive(profile: { is_founding_member?: boolean; founding_joined_at?: string | null }): boolean {
  if (!profile.is_founding_member || !profile.founding_joined_at) return false;
  const today = getKSTDateString();
  return today <= FOUNDING_PROMOTION_END;
}

// 사용일수 → 보상 개월수 (30/90/180일 기준)
export function getFoundingRewardMonths(daysUsed: number): number {
  if (daysUsed >= 180) return 6;
  if (daysUsed >= 90)  return 3;
  if (daysUsed >= 30)  return 1;
  return 0;
}

// 천인회 포함 실제 유효 플랜 반환
export function getEffectivePlan(profile: {
  plan?: string;
  is_founding_member?: boolean;
  founding_joined_at?: string | null;
  pro_credit_expires_at?: string | null;
}): Plan {
  const raw = (profile.plan as Plan) || 'free';
  if (raw === 'lifetime') return 'lifetime';
  if (raw === 'pro') return 'pro';
  if (isFoundingActive(profile)) return 'pro';
  if (profile.pro_credit_expires_at) {
    const today = getKSTDateString();
    const expiry = profile.pro_credit_expires_at.slice(0, 10);
    if (today <= expiry) return 'pro';
  }
  return 'free';
}

// 공통: 프로필 조회 (없으면 생성 + 천인회 자동 등록)
export async function getOrCreateProfile(adminSupabase: AnySupabaseClient, userId: string) {
  const { data: profile, error } = await adminSupabase
    .from('profiles')
    .select('plan, uploads_today, last_upload_date, analyses_today, last_analysis_date, is_founding_member, founding_joined_at, pro_credit_expires_at')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    const today = getKSTDateString();
    const founding = await tryClaimFoundingSlot(adminSupabase);
    await adminSupabase.from('profiles').upsert({
      id: userId,
      uploads_today: 0,
      last_upload_date: today,
      analyses_today: 0,
      last_analysis_date: today,
      is_founding_member: founding,
      founding_joined_at: founding ? new Date().toISOString() : null,
    }, { onConflict: 'id', ignoreDuplicates: false });
    return {
      plan: 'free' as Plan,
      uploads_today: 0,
      last_upload_date: today,
      analyses_today: 0,
      last_analysis_date: today,
      is_founding_member: founding,
      founding_joined_at: founding ? new Date().toISOString() : null,
      pro_credit_expires_at: null,
    };
  }
  return profile;
}

// 천인회 슬롯 선점 시도 (atomic increment)
async function tryClaimFoundingSlot(adminSupabase: AnySupabaseClient): Promise<boolean> {
  try {
    const today = getKSTDateString();
    if (today > FOUNDING_PROMOTION_END) return false;

    const { data } = await adminSupabase
      .from('founding_slots')
      .select('total_slots, used_slots')
      .eq('id', 1)
      .single();

    if (!data || data.used_slots >= data.total_slots) return false;

    const { error } = await adminSupabase
      .from('founding_slots')
      .update({ used_slots: data.used_slots + 1, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .eq('used_slots', data.used_slots); // optimistic lock

    return !error;
  } catch {
    return false;
  }
}

// 천인회 슬롯 반환 (탈퇴 시)
export async function releaseFoundingSlot(adminSupabase: AnySupabaseClient): Promise<void> {
  try {
    const today = getKSTDateString();
    if (today > FOUNDING_PROMOTION_END) return;
    await adminSupabase.rpc('decrement_founding_slot');
  } catch {
    // 슬롯 반환 실패는 치명적이지 않음 — 무시
  }
}

// 클라우드 저장 제한 체크
export async function checkUploadLimit(
  adminSupabase: AnySupabaseClient,
  userId: string
): Promise<{ allowed: boolean; plan: Plan; used: number; limit: number }> {
  const today = getKSTDateString();
  const profile = await getOrCreateProfile(adminSupabase, userId);

  const plan = getEffectivePlan(profile);
  const used = profile.last_upload_date === today ? (profile.uploads_today || 0) : 0;
  const limit = UPLOAD_LIMITS[plan];

  return { allowed: used < limit, plan, used, limit };
}

// 클라우드 저장 카운트 +1
export async function incrementUploadCount(
  adminSupabase: AnySupabaseClient,
  userId: string
): Promise<void> {
  const today = getKSTDateString();
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('uploads_today, last_upload_date')
    .eq('id', userId)
    .single();

  const newCount = profile?.last_upload_date === today ? (profile.uploads_today || 0) + 1 : 1;

  await adminSupabase.from('profiles').upsert({
    id: userId,
    uploads_today: newCount,
    last_upload_date: today,
    updated_at: new Date().toISOString(),
  });
}

// AI 분석 제한 체크 (로컬/클라우드 공통 — 핵심 서버 비용 제한)
export async function checkAnalysisLimit(
  adminSupabase: AnySupabaseClient,
  userId: string
): Promise<{ allowed: boolean; plan: Plan; used: number; limit: number }> {
  const today = getKSTDateString();
  const profile = await getOrCreateProfile(adminSupabase, userId);

  const plan = getEffectivePlan(profile);
  const used = profile.last_analysis_date === today ? (profile.analyses_today || 0) : 0;
  const limit = ANALYSIS_LIMITS[plan];

  return { allowed: used < limit, plan, used, limit };
}

// AI 분석 카운트 +1
export async function incrementAnalysisCount(
  adminSupabase: AnySupabaseClient,
  userId: string
): Promise<void> {
  const today = getKSTDateString();
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('analyses_today, last_analysis_date')
    .eq('id', userId)
    .single();

  const newCount = profile?.last_analysis_date === today ? (profile.analyses_today || 0) + 1 : 1;

  await adminSupabase.from('profiles').upsert({
    id: userId,
    analyses_today: newCount,
    last_analysis_date: today,
    updated_at: new Date().toISOString(),
  });
}
