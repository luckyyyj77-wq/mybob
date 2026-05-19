import { COACH_MESSAGES } from './messages';
import type { AnalysisResult } from './analyzer';

export { analyzeCoach } from './analyzer';
export type { AnalysisResult, Persona, Meal as CoachMeal } from './analyzer';
export type { Situation } from './messages';

export function getCoachMessage(result: AnalysisResult, seed: number): string {
  if (result.useGemini) return '';

  const situationMessages = COACH_MESSAGES[result.situation];
  if (!situationMessages) return '';

  const personaMessages = situationMessages[result.persona];
  if (!personaMessages || personaMessages.length === 0) return '';

  const idx = seed % personaMessages.length;
  let message = personaMessages[idx];

  if (result.foodName) {
    message = message.replace(/\{food\}/g, result.foodName);
  }
  if (result.count !== undefined) {
    message = message.replace(/\{count\}/g, String(result.count));
  }

  return message;
}
