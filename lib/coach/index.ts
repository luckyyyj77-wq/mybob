import {
  COACH_MESSAGES_BY_LOCALE,
  NO_RECORD_BY_TIME_BY_LOCALE,
  CONSECUTIVE_SKIP_MESSAGES_BY_LOCALE,
  NIGHT_EATING_EXTRA_BY_LOCALE,
} from './messages';
import type { AnalysisResult } from './analyzer';

export { analyzeCoach } from './analyzer';
export type { AnalysisResult, Persona, Meal as CoachMeal } from './analyzer';
export type { Situation } from './messages';

export function getCoachMessage(result: AnalysisResult, seed: number, locale: string = 'ko'): string {
  if (result.useGemini) return '';

  const { situation, persona, timeSlot, foodName, count } = result;

  // 로케일 기반 메시지 풀 선택 (기본값 ko)
  const coachMessages = COACH_MESSAGES_BY_LOCALE[locale] ?? COACH_MESSAGES_BY_LOCALE.ko;
  const noRecordByTime = NO_RECORD_BY_TIME_BY_LOCALE[locale] ?? NO_RECORD_BY_TIME_BY_LOCALE.ko;
  const consecutiveSkipMessages = CONSECUTIVE_SKIP_MESSAGES_BY_LOCALE[locale] ?? CONSECUTIVE_SKIP_MESSAGES_BY_LOCALE.ko;
  const nightEatingExtra = NIGHT_EATING_EXTRA_BY_LOCALE[locale] ?? NIGHT_EATING_EXTRA_BY_LOCALE.ko;

  let pool: string[] = [];

  if (situation === 'no_record' && timeSlot) {
    // 시간대별 공복 멘트 사용
    pool = noRecordByTime[timeSlot]?.[persona] ?? [];
  } else if (situation === 'consecutive_skip') {
    // 연속 결식 전용 멘트 + 시간대 멘트 병합으로 다양성 확보
    const skipPool = consecutiveSkipMessages[persona] ?? [];
    const timePool = timeSlot ? (noRecordByTime[timeSlot]?.[persona] ?? []) : [];
    // 연속 결식 멘트 위주 (2:1 비율)
    pool = [...skipPool, ...skipPool, ...timePool];
  } else if (situation === 'night_eating' && timeSlot === 'night') {
    // 야식 시간대에 야식 기록 → 더 맥락 있는 멘트 병합
    const basePool = coachMessages[situation]?.[persona] ?? [];
    const extraPool = nightEatingExtra[persona] ?? [];
    pool = [...basePool, ...extraPool];
  } else {
    pool = coachMessages[situation]?.[persona] ?? [];
  }

  if (!pool || pool.length === 0) return '';

  const idx = Math.abs(seed) % pool.length;
  let message = pool[idx];

  if (!message) return '';

  if (foodName) message = message.replace(/\{food\}/g, foodName);
  if (count !== undefined) message = message.replace(/\{count\}/g, String(count));

  return message;
}
