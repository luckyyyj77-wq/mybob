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
}): AnalysisResult {
  const { todayMeals, allMeals, goalCalories, goalProtein, persona } = params;

  const todayTotal = todayMeals.reduce((s, m) => s + (Number(m.calories) || 0), 0);
  const todayProtein = todayMeals.reduce((s, m) => s + (Number(m.nutrient?.protein) || 0), 0);
  const todayCarbs = todayMeals.reduce((s, m) => s + (Number(m.nutrient?.carbohydrates) || 0), 0);

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
    // 3일 연속 기록 없음 — 더 강한 메시지
    return { situation: 'consecutive_skip', persona, timeSlot, useGemini: false };
  }
  if (todayMeals.length === 0 && yesterdayMeals.length === 0) {
    return { situation: 'consecutive_skip', persona, timeSlot, useGemini: false };
  }

  // 2. no_record — 시간대 맥락 포함
  if (todayMeals.length === 0) {
    return { situation: 'no_record', persona, timeSlot, useGemini: false };
  }

  // 3. very_few
  if (todayMeals.length <= 2) {
    return { situation: 'very_few', persona, useGemini: false };
  }

  // 4. few
  if (todayMeals.length <= 4) {
    return { situation: 'few', persona, useGemini: false };
  }

  // 5. high_calorie
  if (todayTotal > goalCalories * 1.2) {
    return { situation: 'high_calorie', persona, useGemini: false };
  }

  // 6. low_calorie (5개 이상)
  if (todayMeals.length >= 5 && todayTotal < goalCalories * 0.5) {
    return { situation: 'low_calorie', persona, useGemini: false };
  }

  // 7. protein_lack
  if (todayProtein < goalProtein * 0.6) {
    return { situation: 'protein_lack', persona, useGemini: false };
  }

  // 8. carb_heavy
  if (todayTotal > 0 && (todayCarbs * 4) / todayTotal > 0.7) {
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

  // 10. soul_food
  const foodFreq: Record<string, number> = {};
  recentMeals.forEach(m => {
    if (m.food_name) foodFreq[m.food_name] = (foodFreq[m.food_name] || 0) + 1;
  });
  const topFood = Object.entries(foodFreq).sort((a, b) => b[1] - a[1])[0];
  if (topFood && topFood[1] >= 5) {
    return { situation: 'soul_food', persona, foodName: topFood[0], count: topFood[1], useGemini: false };
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

  // 12. streak_good (최근 3일 연속 목표 칼로리 ±20% 이내)
  let streakCount = 0;
  for (let i = 1; i <= 3; i++) {
    const dateStr = getDateKST(i);
    const dayMeals = allMeals.filter(m => toKSTDate(m.created_at) === dateStr);
    const dayCalories = dayMeals.reduce((s, m) => s + (Number(m.calories) || 0), 0);
    if (dayCalories >= goalCalories * 0.8 && dayCalories <= goalCalories * 1.2) streakCount++;
  }
  if (streakCount >= 3) {
    return { situation: 'streak_good', persona, useGemini: false };
  }

  // 13. normal → Gemini 위임
  return { situation: 'normal', persona, useGemini: true };
}
