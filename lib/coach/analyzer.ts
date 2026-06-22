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

const SODIUM_KEYWORDS_BY_LOCALE: Record<string, string[]> = {
  ko: [
    '라면', '순대', '찌개', '국밥', '냉면', '짬뽕', '떡볶이',
    '소시지', '햄', '김치찌개', '된장찌개', '부대찌개', '짜장', '우동', '어묵',
  ],
  en: [
    'ramen', 'sausage', 'ham', 'stew', 'soup', 'burger', 'pizza', 'fried chicken',
    'instant noodles', 'bacon', 'salami', 'pepperoni', 'pickles', 'soy sauce', 'kimchi',
  ],
};

// 음식명 유사도 매칭용 — 로케일별 최적화
function foodGroupKey(name: string, locale: string = 'ko'): string {
  const cleaned = name.trim();
  if (locale === 'ko') {
    return cleaned.replace(/\s+/g, '').slice(0, 2);
  }
  // 영문의 경우 첫 단어의 앞 4글자 사용 (예: "Chicken Salad" -> "chic")
  const firstWord = cleaned.split(/\s+/)[0].toLowerCase();
  return firstWord.slice(0, 4);
}

function toKSTDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function getTodayKST(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function getKSTHour(iso: string): number {
  const h = parseInt(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false }), 10);
  return h === 24 ? 0 : h; // 일부 브라우저가 자정을 24로 반환
}

function getCurrentKSTHour(): number {
  return getKSTHour(new Date().toISOString());
}

function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 0  && hour < 5)  return 'early_dawn';
  if (hour >= 5  && hour < 7)  return 'dawn';
  if (hour >= 7  && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'lunch';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 19) return 'late_afternoon';
  if (hour >= 19 && hour < 22) return 'evening';
  return 'night';
}

export function analyzeCoach(params: {
  todayMeals: Meal[];
  allMeals: Meal[];
  goalCalories: number;
  goalProtein: number;
  persona: Persona;
  todayAchieved?: boolean;
  locale?: string;
}): AnalysisResult {
  const { todayMeals, allMeals, goalCalories, goalProtein, persona, todayAchieved, locale = 'ko' } = params;

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
    const base = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    base.setDate(base.getDate() - daysAgo);
    return base.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
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
  const earlyDaySlots: TimeSlot[] = ['early_dawn', 'dawn', 'morning', 'lunch'];
  const calThresholdVeryFew = earlyDaySlots.includes(timeSlot) ? goalCalories * 0.15 : goalCalories * 0.2;
  if (todayTotal > 0 && todayTotal < calThresholdVeryFew) {
    return { situation: 'very_few', persona, useGemini: false };
  }

  // 4. few — 목표의 20~55% 범위 (저녁 이후 시간대만 판단, 낮에는 아직 더 먹을 수 있음)
  const lateSlots: TimeSlot[] = ['evening', 'night', 'late_afternoon'];
  if (lateSlots.includes(timeSlot) && todayTotal < goalCalories * 0.55) {
    return { situation: 'few', persona, useGemini: false };
  }

  // 5. high_calorie
  if (todayTotal > goalCalories * 1.2) {
    return { situation: 'high_calorie', persona, useGemini: false };
  }

  // 6. low_calorie — 저녁 이후, 목표 55~75% 범위 (few보다 위, 정상 범위 미달)
  if (lateSlots.includes(timeSlot) && todayTotal < goalCalories * 0.75) {
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

  // 10. soul_food — 그룹핑으로 유사 음식 묶어서 카운트
  const foodGroupFreq: Record<string, { count: number; topName: string }> = {};
  recentMeals.forEach(m => {
    if (!m.food_name) return;
    const key = foodGroupKey(m.food_name, locale);
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
  const sodiumKeywords = SODIUM_KEYWORDS_BY_LOCALE[locale] ?? SODIUM_KEYWORDS_BY_LOCALE.ko;
  recentMeals.forEach(m => {
    const name = (m.food_name || '').toLowerCase();
    for (const kw of sodiumKeywords) {
      if (name.includes(kw.toLowerCase())) { sodiumCount[kw] = (sodiumCount[kw] || 0) + 1; break; }
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
