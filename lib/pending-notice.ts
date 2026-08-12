// pending-notice.ts — pending 큐 처리 결과(미인식 확정)를 홈 배너로 알리기 위한 localStorage 알림
// process-pending이 미인식 확정 저장에 성공하면 추가하고, 사용자가 확인하거나
// 해당 식단이 복구(이름 입력·수동 편집)되면 제거한다.

import { isUnrecognizedMeal } from './unrecognized';

const KEY = 'mybob_pending_notices';
const MAX_NOTICES = 3;

export type PendingNotice = {
  mealId: string;      // 저장된 식단 id (상세 페이지 링크용)
  capturedAt: string;  // 원본 촬영 시각 (ISO)
  finalizedAt: string; // 미인식 확정 시각 (ISO)
};

export function getPendingNotices(): PendingNotice[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addPendingNotice(notice: PendingNotice): void {
  try {
    const existing = getPendingNotices().filter(n => n.mealId !== notice.mealId);
    localStorage.setItem(KEY, JSON.stringify([notice, ...existing].slice(0, MAX_NOTICES)));
  } catch { /* 알림은 부가 기능 — 저장 실패해도 본 처리에 영향 없음 */ }
}

export function removePendingNotice(mealId: string): void {
  try {
    const remaining = getPendingNotices().filter(n => n.mealId !== mealId);
    if (remaining.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(remaining));
  } catch { }
}

// 이미 복구된(더 이상 미인식이 아닌) 식단의 알림을 자동 제거 — 다른 경로로 복구했거나
// 다른 기기에서 복구한 경우에도 알림이 계속 남는 것 방지. 식단 목록에 없는 알림은 유지
// (서버 동기화 전일 수 있음).
export function pruneResolvedNotices(): void {
  try {
    const meals: { id?: string; food_name?: string; calories?: number; _unrecognized?: boolean }[] =
      JSON.parse(localStorage.getItem('mybob_meals') || '[]');
    for (const notice of getPendingNotices()) {
      const meal = meals.find(m => m.id === notice.mealId);
      if (meal && !isUnrecognizedMeal(meal)) removePendingNotice(notice.mealId);
    }
  } catch { }
}
