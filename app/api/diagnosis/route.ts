import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function toKSTDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

async function getUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function POST(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // PRO 플랜 확인
    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single();
    if (!profile || profile.plan === 'free') {
      return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 403 });
    }

    const { meals, goal, bodyInfo, previousScores, achievedStreak = 0, totalAchievedDays = 0, locale = 'ko' } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    if (!meals || meals.length === 0) return NextResponse.json({ error: 'NO_DATA' }, { status: 422 });
    if (!Array.isArray(meals) || meals.length > 300) return NextResponse.json({ error: 'TOO_MANY_MEALS' }, { status: 400 });

    // KST 기준 날짜별 집계
    const daySet = new Set(meals.map((m: any) => toKSTDate(m.created_at)));
    const days = daySet.size;
    const datesSorted = Array.from(daySet).sort();
    const periodStart = datesSorted[0];
    const periodEnd = datesSorted[datesSorted.length - 1];

    const totalCal  = meals.reduce((s: number, m: any) => s + (m.calories || 0), 0);
    const avgCal    = days > 0 ? Math.round(totalCal / days) : 0;
    const carbs     = meals.reduce((s: number, m: any) => s + (m.nutrient?.carbohydrates || 0), 0);
    const protein   = meals.reduce((s: number, m: any) => s + (m.nutrient?.protein || 0), 0);
    const fat       = meals.reduce((s: number, m: any) => s + (m.nutrient?.fat || 0), 0);
    const sodium    = meals.reduce((s: number, m: any) => s + (m.nutrient?.sodium || 0), 0);
    const fiber     = meals.reduce((s: number, m: any) => s + (m.nutrient?.fiber || 0), 0);
    const avgSodium = days > 0 ? Math.round(sodium / days) : 0;
    const avgFiber  = days > 0 ? Math.round(fiber / days) : 0;

    const catMap: Record<string, number> = {};
    meals.forEach((m: any) => { if (m.category) catMap[m.category] = (catMap[m.category] || 0) + 1; });
    const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const foodMap: Record<string, number> = {};
    meals.forEach((m: any) => { if (m.food_name) foodMap[m.food_name] = (foodMap[m.food_name] || 0) + 1; });
    const topFoods = Object.entries(foodMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name);

    const totalNutri  = carbs + protein + fat;
    const carbPct     = totalNutri > 0 ? Math.round(carbs / totalNutri * 100) : 0;
    const proteinPct  = totalNutri > 0 ? Math.round(protein / totalNutri * 100) : 0;
    const fatPct      = totalNutri > 0 ? Math.round(fat / totalNutri * 100) : 0;

    // 신체정보 기반 목표 칼로리 계산 (Mifflin-St Jeor)
    let targetCalories = 2000;
    let bmrNote = '신체 정보 없음 (기본 2000kcal 적용)';
    if (bodyInfo?.height && bodyInfo?.weight) {
      const h = Number(bodyInfo.height);
      const w = Number(bodyInfo.weight);
      const age = Number(bodyInfo.age) || 30;
      const genderOffset = bodyInfo.gender === 'female' ? -161 : 5;
      const activityMap: Record<string, number> = {
        sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
      };
      const activityMultiplier = activityMap[bodyInfo.activity] ?? 1.375;
      const bmr = Math.round(10 * w + 6.25 * h - 5 * age + genderOffset);
      const tdee = Math.round(bmr * activityMultiplier);
      if (goal === 'diet' || goal === '다이어트') targetCalories = Math.round(tdee * 0.8);
      else if (goal === 'bulk' || goal === '증량') targetCalories = Math.round(tdee * 1.15);
      else targetCalories = tdee;
      bmrNote = `키 ${h}cm, 체중 ${w}kg, 나이 ${age}세, 활동량 ${bodyInfo.activity || '보통'} → 기초대사량 ${bmr}kcal, TDEE ${tdee}kcal, 목표 칼로리 ${targetCalories}kcal`;
    }

    // 이전 진단 점수 맥락
    const trendNote = previousScores && previousScores.length > 0
      ? `이전 진단 기록 (최근 순): ${previousScores.slice(0, 3).map((s: any) => `${s.date} 종합 ${s.overall_score}점(${s.grade})`).join(' / ')}`
      : '이전 진단 기록 없음 (첫 진단)';

    // 목표 달성 기록
    const achievementNote = totalAchievedDays > 0
      ? `목표 칼로리 달성 기록: 총 ${totalAchievedDays}일 달성${achievedStreak > 0 ? `, 현재 ${achievedStreak}일 연속 달성 중` : ''}. 칼로리 일관성(consistency) 점수와 ai_message에 이 데이터를 반드시 반영하세요.`
      : '목표 칼로리 달성 기록 없음 (달성 데이터 미집계 또는 0일)';

    const isEn = locale === 'en';

    const bmrNoteEn = (() => {
      if (!bodyInfo?.height || !bodyInfo?.weight) return 'No body info (default 2000kcal applied)';
      const h = Number(bodyInfo.height), w = Number(bodyInfo.weight), age = Number(bodyInfo.age) || 30;
      const genderOffset = bodyInfo.gender === 'female' ? -161 : 5;
      const activityMap: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
      const activityMultiplier = activityMap[bodyInfo.activity] ?? 1.375;
      const bmr = Math.round(10 * w + 6.25 * h - 5 * age + genderOffset);
      const tdee = Math.round(bmr * activityMultiplier);
      return `Height ${h}cm, Weight ${w}kg, Age ${age}, Activity ${bodyInfo.activity || 'moderate'} → BMR ${bmr}kcal, TDEE ${tdee}kcal, Target ${targetCalories}kcal`;
    })();

    const trendNoteEn = previousScores && previousScores.length > 0
      ? `Previous diagnosis (recent): ${previousScores.slice(0, 3).map((s: any) => `${s.date} overall ${s.overall_score}pts(${s.grade})`).join(' / ')}`
      : 'No previous diagnosis (first time)';

    const achievementNoteEn = totalAchievedDays > 0
      ? `Calorie goal achieved: ${totalAchievedDays} days total${achievedStreak > 0 ? `, currently ${achievedStreak} days streak` : ''}. Reflect this in consistency score and ai_message.`
      : 'No calorie goal achievement data (0 days)';

    const goalEn = goal === 'diet' || goal === '다이어트' ? 'weight loss' : goal === 'bulk' || goal === '증량' ? 'muscle gain' : 'maintenance';

    const prompt = isEn
      ? `You are a world-class nutritionist and health coach.
Analyze the user's meal data from ${periodStart} to ${periodEnd} (${days} days, ${meals.length} records) and write a detailed diagnosis report in JSON.

[User Data]
- Goal: ${goalEn}
- ${bmrNoteEn}
- Daily avg calories: ${avgCal}kcal (target: ${targetCalories}kcal)
- Macro ratio (carbs:protein:fat): ${carbPct}%:${proteinPct}%:${fatPct}%
- Daily avg sodium: ${avgSodium}mg (recommended 2000mg)
- Daily avg fiber: ${avgFiber}g (recommended 25g)
- Frequent foods: ${topFoods.join(', ') || 'none'}
- Frequent categories: ${topCats.map(([c, n]) => `${c}(${n}x)`).join(', ') || 'none'}
- ${trendNoteEn}
- ${achievementNoteEn}

Respond ONLY in JSON. Write each field in English, concretely and practically.
If previous diagnosis exists, mention score changes in summary and ai_message.

{
  "overall_score": integer 0~100,
  "grade": one of "A+/A/B+/B/C+/C/D",
  "summary": "2~3 sentences evaluating overall eating habits with specific numbers and trend vs previous.",
  "scores": {
    "calories": { "score": 0~100, "comment": "one sentence on calorie management" },
    "balance": { "score": 0~100, "comment": "one sentence on macro balance" },
    "sodium": { "score": 0~100, "comment": "one sentence on sodium intake" },
    "fiber": { "score": 0~100, "comment": "one sentence on fiber intake" },
    "consistency": { "score": 0~100, "comment": "one sentence on logging consistency" }
  },
  "strengths": ["strength 1", "strength 2"],
  "issues": [
    { "title": "issue title", "description": "specific description with numbers", "severity": "high/medium/low" },
    { "title": "issue title 2", "description": "specific description", "severity": "high/medium/low" }
  ],
  "recommendations": [
    { "title": "action title", "description": "specific actionable advice", "priority": "high/medium/low" },
    { "title": "action title 2", "description": "specific actionable advice", "priority": "high/medium/low" },
    { "title": "action title 3", "description": "specific actionable advice", "priority": "high/medium/low" }
  ],
  "weekly_plan": [
    { "day": "Mon", "tip": "one specific dietary tip for the day" },
    { "day": "Tue", "tip": "..." },
    { "day": "Wed", "tip": "..." },
    { "day": "Thu", "tip": "..." },
    { "day": "Fri", "tip": "..." },
    { "day": "Sat", "tip": "..." },
    { "day": "Sun", "tip": "..." }
  ],
  "ai_message": "A warm, motivating paragraph (3~4 sentences) to the user. Mention growth vs previous diagnosis."
}

No text outside JSON.`
      : `당신은 국내 최고 수준의 영양사 겸 헬스 코치입니다.
아래 사용자의 ${periodStart} ~ ${periodEnd} (${days}일, ${meals.length}개 기록) 식사 데이터를 분석해 정밀 진단 리포트를 JSON으로 작성하세요.

[사용자 데이터]
- 목표: ${goal || '유지'}
- ${bmrNote}
- 일 평균 칼로리: ${avgCal}kcal (목표: ${targetCalories}kcal)
- 영양소 비율 (탄:단:지): ${carbPct}%:${proteinPct}%:${fatPct}%
- 일 평균 나트륨: ${avgSodium}mg (권장 2000mg)
- 일 평균 식이섬유: ${avgFiber}g (권장 25g)
- 자주 먹는 음식: ${topFoods.join(', ') || '없음'}
- 자주 먹는 카테고리: ${topCats.map(([c, n]) => `${c}(${n}회)`).join(', ') || '없음'}
- ${trendNote}
- ${achievementNote}

아래 JSON 형식으로만 응답하세요. 각 항목은 한국어로 구체적이고 실용적으로 작성하세요.
이전 진단 기록이 있으면 점수 변화와 개선/악화 여부를 summary와 ai_message에 반드시 언급하세요.

{
  "overall_score": 0~100 사이 정수 (종합 건강 점수),
  "grade": "A+/A/B+/B/C+/C/D" 중 하나,
  "summary": "2~3문장으로 전체 식습관 평가. 구체적 수치 언급. 이전 진단 대비 변화 포함.",
  "scores": {
    "calories": { "score": 0~100, "comment": "칼로리 관리 평가 한 문장" },
    "balance": { "score": 0~100, "comment": "영양소 균형 평가 한 문장" },
    "sodium": { "score": 0~100, "comment": "나트륨 섭취 평가 한 문장" },
    "fiber": { "score": 0~100, "comment": "식이섬유 섭취 평가 한 문장" },
    "consistency": { "score": 0~100, "comment": "기록 일관성 평가 한 문장" }
  },
  "strengths": ["잘하고 있는 점 1", "잘하고 있는 점 2"],
  "issues": [
    { "title": "문제점 제목", "description": "구체적 설명 (수치 포함)", "severity": "high/medium/low" },
    { "title": "문제점 제목2", "description": "구체적 설명", "severity": "high/medium/low" }
  ],
  "recommendations": [
    { "title": "실천 방법 제목", "description": "구체적이고 실행 가능한 조언", "priority": "high/medium/low" },
    { "title": "실천 방법 제목2", "description": "구체적이고 실행 가능한 조언", "priority": "high/medium/low" },
    { "title": "실천 방법 제목3", "description": "구체적이고 실행 가능한 조언", "priority": "high/medium/low" }
  ],
  "weekly_plan": [
    { "day": "월", "tip": "오늘 실천할 구체적 식단 팁 한 줄" },
    { "day": "화", "tip": "..." },
    { "day": "수", "tip": "..." },
    { "day": "목", "tip": "..." },
    { "day": "금", "tip": "..." },
    { "day": "토", "tip": "..." },
    { "day": "일", "tip": "..." }
  ],
  "ai_message": "사용자에게 보내는 따뜻하고 동기부여가 되는 한 문단 메시지 (3~4문장). 이전 진단 대비 성장한 부분 언급."
}

JSON 외 텍스트 절대 금지.`;

    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    for (const model of modelsToTry) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { response_mime_type: 'application/json', temperature: 0.3 },
            }),
          }
        );
        const result = await res.json();
        if (res.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
          const data = JSON.parse(result.candidates[0].content.parts[0].text);
          return NextResponse.json({
            success: true,
            diagnosis: data,
            modelUsed: model,
            stats: { avgCal, days, meals: meals.length, periodStart, periodEnd, targetCalories },
          });
        }
        const err = result.error?.message || '';
        if (err.includes('quota') || err.includes('RESOURCE_EXHAUSTED')) continue;
        return NextResponse.json({ error: err || '분석 실패' }, { status: 500 });
      } catch {
        continue;
      }
    }
    return NextResponse.json({ error: '모든 모델 한도 초과' }, { status: 429 });
  } catch (e: any) {
    console.error('[diagnosis POST]', e?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
