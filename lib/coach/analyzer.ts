import type { Persona, Situation, TimeSlot } from './messages';

export type { Persona };

export type Meal = {
  id: string;
  food_name: string;
  calories: number;
  created_at: string;
  nutrient?: {
    carbohydrates?: number;
    protein?: number;
    fat?: number;
    sodium?: number;
  };
};

export type AnalysisResult = {
  situation: Situation;
  persona: Persona;
  timeSlot?: TimeSlot;
  foodName?: string;
  count?: number;
  useGemini: boolean;
};

const SODIUM_KEYWORDS = [
  '라면', '순대', '찌개', '국밥', '냉면', '짬뽕', '떡볶이',
  '소시지', '햄', '김치찌개', '된장찌개', '부대찌개', '짜장', '우동', '어묵',
];

// 음식명 유사도 매칭용 — 앞 2글자(한글 기준) 키워드로 그룹핑
function foodGroupKey(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, '');
  return cleaned.slice(0, 2);
}

function toKSTDate(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getTodayKST(): string {
  return toKSTDate(new Date().toISOString());
}

function getKSTHour(iso: string): number {
  const d = new Date(iso);
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).getUTCHours();
}

function getCurrentKSTHour(): number {
  return getKSTHour(new Date().toISOString());
}

function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 0 && hour < 6)   return 'dawn';
  if (hour >= 6 && hour < 11)  return 'morning';
  if (hour >= 11 && hour < 14) return 'lunch';
  if (hour >= 14 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

export function analyzeCoach(params: {
  todayMeals: Meal[];
  allMeals: Meal[];
  goalCalories: number;
  goalProtein: number;
  persona: Persona;
  todayAchieved?: boolean;
}): AnalysisResult {
  const { todayMeals, allMeals, goalCalories, goalProtein, persona, todayAchieved } = params;

  const todayTotal = todayMeals.reduce((s, m) => s + (Number(m.calories) || 0), 0);
  const todayProtein = todayMeals.reduce((s, m) => s + (Number(m.nutrient?.protein) || 0), 0);

  // 탄수화물 비율 계산: 영양소 데이터가 있는 식사만 대상으로 계산
  const mealsWithNutrient = todayMeals.filter(m => m.nutrient?.carbohydrates != null);
  const nutrientCalories = mealsWithNutrient.reduce((s, m) => s + (Number(m.calories) || 0), 0);
  const todayCarbs = mealsWithNutrient.reduce((s, m) => s + (Number(m.nutrient?.carbohydrates) || 0), 0);

  const currentHour = getCurrentKSTHour();
  const timeSlot = getTimeSlot(currentHour);

  // 1. 연속 결식 (어제, 그제 모두 기록 없음)
  const todayKST = getTodayKST();
  const getDateKST = (daysAgo: number) => {
    const d = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };
  const yesterdayMeals = allMeals.filter(m => toKSTDate(m.created_at) === getDateKST(1));
  const dayBeforeMeals = allMeals.filter(m => toKSTDate(m.created_at) === getDateKST(2));
  if (todayMeals.length === 0 && yesterdayMeals.length === 0 && dayBeforeMeals.length === 0) {
    return { situation: 'consecutive_skip', persona, timeSlot, useGemini: false };
  }
  if (todayMeals.length === 0 && yesterdayMeals.length === 0) {
    return { situation: 'consecutive_skip', persona, timeSlot, useGemini: false };
  }

  // 2. no_record — 시간대 맥락 포함
  if (todayMeals.length === 0) {
    return { situation: 'no_record', persona, timeSlot, useGemini: false };
  }

  // 3. very_few — 칼로리 기반으로 판단 (목표의 20% 미만)
  // 아직 하루가 덜 지난 아침/점심 시간대는 기준 완화
  const earlyDaySlots: TimeSlot[] = ['dawn', 'morning', 'lunch'];
  const calThresholdVeryFew = earlyDaySlots.includes(timeSlot) ? goalCalories * 0.15 : goalCalories * 0.2;
  if (todayTotal > 0 && todayTotal < calThresholdVeryFew) {
    return { situation: 'very_few', persona, useGemini: false };
  }

  // 4. few — 목표의 20~45% 범위 (저녁 이후 시간대만 판단, 낮에는 아직 더 먹을 수 있음)
  const lateSlots: TimeSlot[] = ['evening', 'night'];
  if (lateSlots.includes(timeSlot) && todayTotal < goalCalories * 0.45) {
    return { situation: 'few', persona, useGemini: false };
  }

  // 5. high_calorie
  if (todayTotal > goalCalories * 1.2) {
    return { situation: 'high_calorie', persona, useGemini: false };
  }

  // 6. low_calorie — 저녁 이후 기준, 목표 50% 미만
  if (lateSlots.includes(timeSlot) && todayTotal < goalCalories * 0.5) {
    return { situation: 'low_calorie', persona, useGemini: false };
  }

  // 7. protein_lack — 저녁 이후에만 판단 (낮에는 아직 먹을 기회 있음)
  // 영양소 데이터가 있는 식사가 절반 이상일 때만 신뢰성 있는 판단
  const proteinTrackedMeals = todayMeals.filter(m => m.nutrient?.protein != null).length;
  if (
    lateSlots.includes(timeSlot) &&
    proteinTrackedMeals >= Math.ceil(todayMeals.length / 2) &&
    todayProtein < goalProtein * 0.6
  ) {
    return { situation: 'protein_lack', persona, useGemini: false };
  }

  // 8. carb_heavy — 영양소 데이터가 있는 식사 기준으로만 계산
  if (nutrientCalories > 0 && (todayCarbs * 4) / nutrientCalories > 0.7) {
    return { situation: 'carb_heavy', persona, useGemini: false };
  }

  // 9. night_eating (22시 이후 식사 비율 30% 초과)
  if (todayMeals.length >= 2) {
    const nightCount = todayMeals.filter(m => getKSTHour(m.created_at) >= 22).length;
    if (nightCount / todayMeals.length > 0.3) {
      return { situation: 'night_eating', persona, timeSlot, useGemini: false };
    }
  }

  // 최근 30일치 필터
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentMeals = allMeals.filter(m => new Date(m.created_at) >= thirtyDaysAgo);

  // 10. soul_food — 앞 2글자 그룹핑으로 유사 음식 묶어서 카운트
  const foodGroupFreq: Record<string, { count: number; topName: string }> = {};
  recentMeals.forEach(m => {
    if (!m.food_name) return;
    const key = foodGroupKey(m.food_name);
    if (!foodGroupFreq[key]) foodGroupFreq[key] = { count: 0, topName: m.food_name };
    foodGroupFreq[key].count += 1;
    // 그룹 내 가장 짧은(대표) 이름 유지
    if (m.food_name.length < foodGroupFreq[key].topName.length) {
      foodGroupFreq[key].topName = m.food_name;
    }
  });
  const topGroup = Object.values(foodGroupFreq).sort((a, b) => b.count - a.count)[0];
  if (topGroup && topGroup.count >= 5) {
    return { situation: 'soul_food', persona, foodName: topGroup.topName, count: topGroup.count, useGemini: false };
  }

  // 11. sodium_warning
  const sodiumCount: Record<string, number> = {};
  recentMeals.forEach(m => {
    const name = m.food_name || '';
    for (const kw of SODIUM_KEYWORDS) {
      if (name.includes(kw)) { sodiumCount[kw] = (sodiumCount[kw] || 0) + 1; break; }
    }
  });
  const totalSodiumCount = Object.values(sodiumCount).reduce((s, v) => s + v, 0);
  if (totalSodiumCount >= 10) {
    const topSodiumFood = Object.entries(sodiumCount).sort((a, b) => b[1] - a[1])[0];
    return {
      situation: 'sodium_warning',
      persona,
      foodName: topSodiumFood ? topSodiumFood[0] : '',
      count: totalSodiumCount,
      useGemini: false,
    };
  }

  // 12. goal_achieved — 오늘 목표 달성 (streak 체크 전에 단독 달성도 칭찬)
  if (todayAchieved && lateSlots.includes(timeSlot)) {
    return { situation: 'goal_achieved', persona, useGemini: false };
  }

  // 13. streak_good — 오늘 포함 최근 3일 연속 목표 ±20% 이내
  // 오늘(i=0): 아직 하루가 안 끝났으므로 저녁 이후에만 오늘 포함
  let streakCount = 0;
  const startDay = lateSlots.includes(timeSlot) ? 0 : 1;
  const endDay = lateSlots.includes(timeSlot) ? 2 : 3;
  for (let i = startDay; i <= endDay; i++) {
    const dateStr = i === 0 ? todayKST : getDateKST(i);
    const dayMeals = i === 0 ? todayMeals : allMeals.filter(m => toKSTDate(m.created_at) === dateStr);
    const dayCalories = dayMeals.reduce((s, m) => s + (Number(m.calories) || 0), 0);
    if (dayCalories >= goalCalories * 0.8 && dayCalories <= goalCalories * 1.2) streakCount++;
  }
  if (streakCount >= 3) {
    return { situation: 'streak_good', persona, useGemini: false };
  }

  // 13. normal → Gemini 위임
  return { situation: 'normal', persona, useGemini: true };
}
