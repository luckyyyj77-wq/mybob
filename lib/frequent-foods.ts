/**
 * 자주 먹는 음식 추출 — AI 분석 힌트용
 *
 * localStorage 식단 기록에서 반복 품목 상위 N개를 뽑아 analyze-food 요청에
 * 함께 보낸다. 1단계(이름 확정) 프롬프트에 힌트로 주입되어 반복 품목의
 * 이름이 일관되게 나오고, 식약처 DB 매칭률도 올라간다.
 */

import { isUnrecognizedMeal } from './unrecognized';

const CACHE_KEY = 'mybob_meals';

export type FoodCacheEntry = {
  calories: number;
  nutrients: Record<string, number | null>;
  category?: string;
};

// 이름이 정확히 일치하는 과거 단일 품목 식단을 즉시 재사용하기 위한 캐시.
// 복수 품목 식단('A + B')은 개별 품목 영양소를 분리할 수 없어 제외.
// 가장 최근 기록이 우선하도록 배열 앞에서부터 채움(mybob_meals는 최신이 앞).
export function getFoodCache(): Record<string, FoodCacheEntry> {
  try {
    const meals: { food_name?: string; calories?: number; nutrient?: Record<string, number | null>; category?: string }[]
      = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    const cache: Record<string, FoodCacheEntry> = {};
    for (const m of meals) {
      if (!m.food_name || m.food_name.includes(' + ')) continue;
      if (m.calories == null || m.calories <= 0) continue;
      if (isUnrecognizedMeal(m)) continue;
      const name = m.food_name.trim();
      if (!name || cache[name]) continue; // 이미 최신 기록으로 채워짐
      cache[name] = { calories: m.calories, nutrients: m.nutrient ?? {}, category: m.category };
    }
    return cache;
  } catch {
    return {};
  }
}

export function getFrequentFoodNames(limit = 20): string[] {
  try {
    const meals: { food_name?: string; calories?: number; _unrecognized?: boolean }[]
      = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    const counts = new Map<string, number>();
    for (const m of meals) {
      if (!m.food_name || isUnrecognizedMeal(m)) continue;
      // 복수 품목 식단은 ' + '로 합쳐 저장되므로 개별 품목으로 분리
      for (const raw of String(m.food_name).split(' + ')) {
        const name = raw.trim();
        if (!name || name.length > 40) continue;
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count >= 2) // 2회 이상 먹은 품목만 힌트로
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name]) => name);
  } catch {
    return [];
  }
}
