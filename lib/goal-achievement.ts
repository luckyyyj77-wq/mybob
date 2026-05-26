export const TARGET_CALORIES_KEY = 'mybob_target_calories';
export const GOAL_ACHIEVED_KEY   = 'mybob_goal_achieved';

function kstDateKey(date = new Date()): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 식단 저장/수정 후 호출 — 오늘 합산 칼로리가 목표의 90~110%면 달성 기록
export function updateGoalAchievement(): void {
  try {
    const targetStr = localStorage.getItem(TARGET_CALORIES_KEY);
    if (!targetStr) return;
    const target = parseInt(targetStr);
    if (!isFinite(target) || target <= 0) return;

    const meals: { calories: number; created_at: string }[] =
      JSON.parse(localStorage.getItem('mybob_meals') || '[]');

    const todayKey = kstDateKey();
    const todayCalories = meals
      .filter(m => kstDateKey(new Date(m.created_at)) === todayKey)
      .reduce((s, m) => s + (Number(m.calories) || 0), 0);

    const ratio = todayCalories / target;
    const achieved: Record<string, boolean> =
      JSON.parse(localStorage.getItem(GOAL_ACHIEVED_KEY) || '{}');

    if (ratio >= 0.9 && ratio <= 1.1) {
      achieved[todayKey] = true;
    } else {
      delete achieved[todayKey];
    }
    localStorage.setItem(GOAL_ACHIEVED_KEY, JSON.stringify(achieved));
  } catch { }
}

// 연속 달성일 수 반환
export function getAchievedStreak(): number {
  try {
    const achieved: Record<string, boolean> =
      JSON.parse(localStorage.getItem(GOAL_ACHIEVED_KEY) || '{}');
    let streak = 0;
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000);
    for (let i = 0; i < 365; i++) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      if (achieved[key]) streak++;
      else break;
    }
    return streak;
  } catch {
    return 0;
  }
}

// 총 달성 일수 반환
export function getTotalAchievedDays(): number {
  try {
    const achieved: Record<string, boolean> =
      JSON.parse(localStorage.getItem(GOAL_ACHIEVED_KEY) || '{}');
    return Object.values(achieved).filter(Boolean).length;
  } catch {
    return 0;
  }
}
