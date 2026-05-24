import { COACH_MESSAGES, NO_RECORD_BY_TIME, CONSECUTIVE_SKIP_MESSAGES, NIGHT_EATING_EXTRA } from './messages';
import type { AnalysisResult } from './analyzer';

export { analyzeCoach } from './analyzer';
export type { AnalysisResult, Persona, Meal as CoachMeal } from './analyzer';
export type { Situation } from './messages';

export function getCoachMessage(result: AnalysisResult, seed: number): string {
  if (result.useGemini) return '';

  const { situation, persona, timeSlot, foodName, count } = result;

  let pool: string[] = [];

  if (situation === 'no_record' && timeSlot) {
    // 시간대별 공복 멘트 사용
    pool = NO_RECORD_BY_TIME[timeSlot]?.[persona] ?? [];
  } else if (situation === 'consecutive_skip') {
    // 연속 결식 전용 멘트 + 시간대 멘트 병합으로 다양성 확보
    const skipPool = CONSECUTIVE_SKIP_MESSAGES[persona] ?? [];
    const timePool = timeSlot ? (NO_RECORD_BY_TIME[timeSlot]?.[persona] ?? []) : [];
    // 연속 결식 멘트 위주 (2:1 비율)
    pool = [...skipPool, ...skipPool, ...timePool];
  } else if (situation === 'night_eating' && timeSlot === 'night') {
    // 야식 시간대에 야식 기록 → 더 맥락 있는 멘트 병합
    const basePool = COACH_MESSAGES[situation]?.[persona] ?? [];
    const extraPool = NIGHT_EATING_EXTRA[persona] ?? [];
    pool = [...basePool, ...extraPool];
  } else {
    pool = COACH_MESSAGES[situation]?.[persona] ?? [];
  }

  if (!pool || pool.length === 0) return '';

  const idx = Math.abs(seed) % pool.length;
  let message = pool[idx];

  if (!message) return '';

  if (foodName) message = message.replace(/\{food\}/g, foodName);
  if (count !== undefined) message = message.replace(/\{count\}/g, String(count));

  return message;
}
