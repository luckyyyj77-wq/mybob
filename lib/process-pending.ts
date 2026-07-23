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
import { getFrequentFoodNames, getFoodCache } from './frequent-foods';

const MAX_RETRIES = 3;
// 재시도 간 최소 대기시간(ms) — retryCount별 백오프. 인덱스 = 다음 시도 전 이미 쌓인 retryCount.
const RETRY_BACKOFF_MS = [0, 60_000, 5 * 60_000];
let isRunning = false;

const UNRECOGNIZED_NAME: Record<string, string> = {
  ko: '미인식 식단',
  en: 'Unrecognized meal',
};

// 미인식 확정 저장. 저장이 실제로 성공했을 때만 pending을 삭제하고 true 반환 —
// 실패(오프라인·401·한도 등) 시 큐에 남겨 다음 pass에서 재시도한다 (사진 유실 방지).
async function saveUnrecognized(meal: PendingMeal, token: string): Promise<boolean> {
  const name = UNRECOGNIZED_NAME[meal.locale] ?? UNRECOGNIZED_NAME.ko;
  const unrecognizedFood = {
    name,
    calories: 0,
    category: meal.locale === 'en' ? 'Etc' : '기타',
    amount: '',
    nutrients: {},
  };

  if (meal.storageMode === 'local') {
    try {
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
    } catch {
      return false;
    }
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
      if (!res.ok) return false;
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
    } catch {
      return false;
    }
  }

  await deletePendingMeal(meal.id);
  return true;
}

async function processSingle(meal: PendingMeal, token: string): Promise<boolean> {
  // 1단계: 전체 이미지로 일반 분석 재시도
  let food: Record<string, any> | null = null;

  try {
    const res = await fetch('/api/analyze-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ image: meal.imageBase64, mode: 'food', locale: meal.locale, frequentFoods: getFrequentFoodNames(), foodCache: getFoodCache() }),
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
    // 네트워크 예외(오프라인 등)는 분석 실패가 아님 — 카운트 유지, 시각만 갱신
    await updatePendingMealRetry(meal.id, meal.retryCount);
    return false;
  }

  // 2단계: 전체 분석 실패 시 4분할 분석 폴백 (클라이언트 사이드 split)
  // 크레딧을 최대 4개 추가 소모하므로 마지막 재시도에서만 실행
  if (!food && meal.retryCount >= MAX_RETRIES - 1) {
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
    // 저장 중 네트워크 예외 — 분석 실패가 아니므로 카운트 유지, 시각만 갱신
    await updatePendingMealRetry(meal.id, meal.retryCount);
    return false;
  }

  await deletePendingMeal(meal.id);
  return true;
}

export async function processPendingMeals(token: string, locale: string): Promise<void> {
  if (isRunning) return;
  // 오프라인이면 어떤 시도도 성공할 수 없음 — 카운트 오염 방지 위해 pass 자체를 건너뜀
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  isRunning = true;
  try {
    const pending = await getAllPendingMeals();
    if (pending.length === 0) return;

    for (const meal of pending) {
      // 재시도 소진 후에도 마지막 백오프 간격 적용 (미인식 저장 반복 실패 시 과호출 방지)
      const backoff = RETRY_BACKOFF_MS[Math.min(meal.retryCount, RETRY_BACKOFF_MS.length - 1)];
      if (meal.lastAttemptAt && Date.now() - meal.lastAttemptAt < backoff) {
        continue; // 아직 다음 재시도 시각이 안 됨 — 이번 pass는 건너뜀
      }
      if (meal.retryCount >= MAX_RETRIES) {
        // 최대 재시도 초과 → 미인식 식단으로 저장. 실패하면 큐에 남겨 다음 pass에서 재시도
        const saved = await saveUnrecognized(meal, token);
        if (!saved) await updatePendingMealRetry(meal.id, meal.retryCount);
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
