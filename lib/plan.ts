// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

export type Plan = 'free' | 'pro' | 'lifetime';

export const UPLOAD_LIMITS: Record<Plan, number> = {
  free: 10,
  pro: 25,
  lifetime: 25,
};

export const PLAN_LABEL: Record<Plan, string> = {
  free: '무료',
  pro: '구독',
  lifetime: '평생',
};

// 서버 사이드 전용: 오늘 업로드 수 조회 + 제한 체크
export async function checkUploadLimit(
  adminSupabase: AnySupabaseClient,
  userId: string
): Promise<{ allowed: boolean; plan: Plan; used: number; limit: number }> {
  const today = new Date().toISOString().slice(0, 10); // "2026-05-08"

  // profiles 없으면 자동 생성 (upsert)
  const { data: profile, error } = await adminSupabase
    .from('profiles')
    .select('plan, uploads_today, last_upload_date')
    .eq('id', userId)
    .single();

  let plan: Plan = 'free';
  let uploadsToday = 0;

  if (error || !profile) {
    // 최초 사용자 — 프로필 생성
    await adminSupabase.from('profiles').upsert({
      id: userId,
      plan: 'free',
      uploads_today: 0,
      last_upload_date: today,
    });
  } else {
    plan = profile.plan as Plan;
    // 날짜가 바뀌었으면 카운트 리셋
    uploadsToday = profile.last_upload_date === today ? profile.uploads_today : 0;
  }

  const limit = UPLOAD_LIMITS[plan];
  return { allowed: uploadsToday < limit, plan, used: uploadsToday, limit };
}

// 서버 사이드 전용: 업로드 카운트 +1
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

  const newCount =
    profile?.last_upload_date === today ? (profile.uploads_today || 0) + 1 : 1;

  await adminSupabase.from('profiles').upsert({
    id: userId,
    uploads_today: newCount,
    last_upload_date: today,
    updated_at: new Date().toISOString(),
  });
}
