/**
 * 서버 식단 데이터와 로컬 캐시 병합 유틸
 *
 * 원칙:
 * - 서버 데이터 우선 (is_public 등 서버 전용 필드 보장)
 * - 로컬 전용 식단(local: 마커, Date.now() id)은 보존
 * - 병합 결과를 항상 localStorage에 저장해 캐시 최신화
 */

const CACHE_KEY = 'mybob_meals';

export interface CachedMeal {
  id: string;
  food_name: string;
  calories: number;
  created_at: string;
  photo_url?: string;
  category?: string;
  nutrient?: Record<string, number | null>;
  rating?: number | null;
  portion?: number;
  original_nutrition?: { calories: number; nutrients: Record<string, number | null> } | null;
  edited_nutrition?: Record<string, number | null> | null;
  is_edited?: boolean;
  is_public?: boolean;
  [key: string]: unknown;
}

/** localStorage에서 캐시 읽기 */
export function readCache(): CachedMeal[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * 서버 데이터와 로컬 캐시 병합 후 저장
 * - serverMeals: /api/meals 응답 배열
 * - 반환값: 병합된 전체 배열 (최신순)
 */
export function mergeAndSave(serverMeals: CachedMeal[]): CachedMeal[] {
  const local = readCache();
  const serverIds = new Set(serverMeals.map(m => m.id));
  // 로컬 전용 식단만 보존 (서버에 없는 것 = 로컬 모드 식단)
  const localOnly = local.filter(m => !serverIds.has(m.id));
  const merged = [...serverMeals, ...localOnly].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
  } catch { }
  return merged;
}

/** 단일 식단 캐시 업데이트 (PATCH 후 동기화) */
export function updateCacheItem(id: string, updates: Partial<CachedMeal>): void {
  const local = readCache();
  const next = local.map(m => m.id === id ? { ...m, ...updates } : m);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch { }
}

/** 새 식단 캐시 앞에 추가 */
export function prependCacheItem(meal: CachedMeal): void {
  const local = readCache();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify([meal, ...local]));
  } catch { }
}
