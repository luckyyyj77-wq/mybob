// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

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

// 공통: 프로필 조회 (없으면 생성)
async function getOrCreateProfile(adminSupabase: AnySupabaseClient, userId: string) {
  const { data: profile, error } = await adminSupabase
    .from('profiles')
    .select('plan, uploads_today, last_upload_date, analyses_today, last_analysis_date')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    const today = new Date().toISOString().slice(0, 10);
    await adminSupabase.from('profiles').upsert({
      id: userId,
      plan: 'free',
      uploads_today: 0,
      last_upload_date: today,
      analyses_today: 0,
      last_analysis_date: today,
    });
    return { plan: 'free' as Plan, uploads_today: 0, last_upload_date: today, analyses_today: 0, last_analysis_date: today };
  }
  return profile;
}

// 클라우드 저장 제한 체크
export async function checkUploadLimit(
  adminSupabase: AnySupabaseClient,
  userId: string
): Promise<{ allowed: boolean; plan: Plan; used: number; limit: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const profile = await getOrCreateProfile(adminSupabase, userId);

  const plan = profile.plan as Plan;
  const used = profile.last_upload_date === today ? (profile.uploads_today || 0) : 0;
  const limit = UPLOAD_LIMITS[plan];

  return { allowed: used < limit, plan, used, limit };
}

// 클라우드 저장 카운트 +1
export async function incrementUploadCount(
  adminSupabase: AnySupabaseClient,
  userId: string
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
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
  const today = new Date().toISOString().slice(0, 10);
  const profile = await getOrCreateProfile(adminSupabase, userId);

  const plan = profile.plan as Plan;
  const used = profile.last_analysis_date === today ? (profile.analyses_today || 0) : 0;
  const limit = ANALYSIS_LIMITS[plan];

  return { allowed: used < limit, plan, used, limit };
}

// AI 분석 카운트 +1
export async function incrementAnalysisCount(
  adminSupabase: AnySupabaseClient,
  userId: string
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
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
