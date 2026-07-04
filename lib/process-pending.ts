// process-pending.ts — IndexedDB pending 큐를 백그라운드에서 재분석/저장하는 엔진

import {
  getAllPendingMeals,
  deletePendingMeal,
  updatePendingMealRetry,
  type PendingMeal,
} from './pending-meals';
import { savePhoto } from './indexed-db';
import { analyzeWithSplit } from './split-analyze';
import { updateGoalAchievement } from './goal-achievement';
import { getFrequentFoodNames } from './frequent-foods';

const MAX_RETRIES = 3;
let isRunning = false;

const UNRECOGNIZED_NAME: Record<string, string> = {
  ko: '미인식 식단',
  en: 'Unrecognized meal',
};

async function saveUnrecognized(meal: PendingMeal, token: string): Promise<void> {
  const name = UNRECOGNIZED_NAME[meal.locale] ?? UNRECOGNIZED_NAME.ko;
  const unrecognizedFood = {
    name,
    calories: 0,
    category: meal.locale === 'en' ? 'Etc' : '기타',
    amount: '',
    nutrients: {},
  };

  if (meal.storageMode === 'local') {
    await savePhoto(meal.id, meal.imageBase64);
    const localMeal = {
      id: meal.id,
      food_name: name,
      calories: 0,
      nutrient: {},
      category: '기타',
      photo_url: `local:${meal.id}`,
      created_at: meal.capturedAt,
      rating: meal.rating,
      portion: meal.portion,
      original_nutrition: null,
      is_public: false,
      visibility: 'private',
      _unrecognized: true,
    };
    const existing = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
    localStorage.setItem('mybob_meals', JSON.stringify([localMeal, ...existing]));
  } else {
    try {
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mealData: {
            ...unrecognizedFood,
            created_at: meal.capturedAt,
          },
          imageBase64: meal.imageBase64,
          rating: meal.rating,
          portion: meal.portion,
          originalNutrition: null,
          isPublic: false,
          visibility: 'private',
        }),
      });
      if (res.ok) {
        const result = await res.json();
        const serverId = result.data?.[0]?.id ?? meal.id;
        const serverPhotoUrl = result.data?.[0]?.photo_url ?? meal.imageBase64;
        const localMeal = {
          id: serverId,
          food_name: name,
          calories: 0,
          nutrient: {},
          category: '기타',
          photo_url: serverPhotoUrl,
          created_at: meal.capturedAt,
          rating: meal.rating,
          portion: meal.portion,
          original_nutrition: null,
          is_public: false,
          visibility: 'private',
          _unrecognized: true,
        };
        const existing = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
        localStorage.setItem('mybob_meals', JSON.stringify([localMeal, ...existing]));
      }
    } catch { /* 저장 실패 시 무시 — pending은 어차피 삭제 */ }
  }

  await deletePendingMeal(meal.id);
}

async function processSingle(meal: PendingMeal, token: string): Promise<boolean> {
  // 1단계: 전체 이미지로 일반 분석 재시도
  let food: Record<string, any> | null = null;

  try {
    const res = await fetch('/api/analyze-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ image: meal.imageBase64, mode: 'food', locale: meal.locale, frequentFoods: getFrequentFoodNames() }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.food) {
        food = data.food;
      }
    } else if (res.status === 429 || res.status === 503) {
      // 아직 바쁨 → 재시도 카운트만 올리고 다음 기회로
      await updatePendingMealRetry(meal.id, meal.retryCount + 1);
      return false;
    } else if (res.status === 422) {
      // NOT_FOOD → 더 이상 재시도 불필요, 폐기
      await deletePendingMeal(meal.id);
      return true;
    }
  } catch {
    await updatePendingMealRetry(meal.id, meal.retryCount + 1);
    return false;
  }

  // 2단계: 전체 분석 실패 시 4분할 분석 폴백 (클라이언트 사이드 split)
  if (!food) {
    const splitResult = await analyzeWithSplit(meal.imageBase64, token, meal.locale);
    if (splitResult.success && splitResult.food) {
      food = splitResult.food as Record<string, any>;
    }
  }

  // 두 방법 모두 실패 → 재시도 카운트 증가
  if (!food) {
    await updatePendingMealRetry(meal.id, meal.retryCount + 1);
    return false;
  }

  // 3단계: 분석 성공 → 저장
  const scaledCalories = Math.round((food.calories ?? 0) * meal.portion);
  const scaledNutrients = Object.fromEntries(
    Object.entries((food.nutrients ?? {}) as Record<string, number | null>).map(([k, v]) =>
      [k, v != null ? Math.round(v * meal.portion * 10) / 10 : v]
    )
  );

  try {
    if (meal.storageMode === 'local') {
      await savePhoto(meal.id, meal.imageBase64);
      const localMeal = {
        id: meal.id,
        food_name: food.name,
        calories: scaledCalories,
        nutrient: scaledNutrients,
        category: food.category ?? '기타',
        photo_url: `local:${meal.id}`,
        created_at: meal.capturedAt,
        rating: meal.rating,
        portion: meal.portion,
        original_nutrition: { calories: food.calories, nutrients: food.nutrients },
        is_public: false,
        visibility: 'private',
        _fromPending: true,
      };
      const existing = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
      localStorage.setItem('mybob_meals', JSON.stringify([localMeal, ...existing]));
      updateGoalAchievement();
    } else {
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mealData: {
            ...food,
            name: food.name,
            calories: scaledCalories,
            nutrients: scaledNutrients,
            created_at: meal.capturedAt,
          },
          imageBase64: meal.imageBase64,
          rating: meal.rating,
          portion: meal.portion,
          originalNutrition: { calories: food.calories, nutrients: food.nutrients },
          isPublic: meal.visibility !== 'private',
          visibility: meal.visibility,
        }),
      });
      if (!res.ok) {
        await updatePendingMealRetry(meal.id, meal.retryCount + 1);
        return false;
      }
      const result = await res.json();
      const serverId = result.data?.[0]?.id ?? meal.id;
      const serverPhotoUrl = result.data?.[0]?.photo_url ?? meal.imageBase64;
      const localMeal = {
        id: serverId,
        food_name: food.name,
        calories: scaledCalories,
        nutrient: scaledNutrients,
        category: food.category ?? '기타',
        photo_url: serverPhotoUrl,
        created_at: meal.capturedAt,
        rating: meal.rating,
        portion: meal.portion,
        original_nutrition: { calories: food.calories, nutrients: food.nutrients },
        is_public: meal.visibility !== 'private',
        visibility: meal.visibility,
        _fromPending: true,
      };
      const existing = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
      localStorage.setItem('mybob_meals', JSON.stringify([localMeal, ...existing]));
      updateGoalAchievement();
    }
  } catch {
    await updatePendingMealRetry(meal.id, meal.retryCount + 1);
    return false;
  }

  await deletePendingMeal(meal.id);
  return true;
}

export async function processPendingMeals(token: string, locale: string): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    const pending = await getAllPendingMeals();
    if (pending.length === 0) return;

    for (const meal of pending) {
      if (meal.retryCount >= MAX_RETRIES) {
        // 최대 재시도 초과 → 미인식 식단으로 저장
        await saveUnrecognized(meal, token);
        continue;
      }
      await processSingle({ ...meal, locale }, token);
      // API 과부하 방지용 최소 간격
      await new Promise(r => setTimeout(r, 800));
    }
  } finally {
    isRunning = false;
  }
}
