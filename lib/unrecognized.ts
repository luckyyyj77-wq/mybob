// 미인식 식단 판별 — _unrecognized 플래그는 localStorage에만 있어서
// 서버 저장 모드/기기 변경 시 사라짐. 저장된 내용(이름+0kcal)으로도 판별한다.
// 이름 목록은 lib/process-pending.ts의 UNRECOGNIZED_NAME과 일치해야 함.

const UNRECOGNIZED_NAMES = new Set(['미인식 식단', 'Unrecognized meal']);

export function isUnrecognizedMeal(meal: {
  food_name?: string;
  calories?: number;
  _unrecognized?: boolean;
}): boolean {
  if (meal._unrecognized) return true;
  return UNRECOGNIZED_NAMES.has(meal.food_name ?? '') && !meal.calories;
}
