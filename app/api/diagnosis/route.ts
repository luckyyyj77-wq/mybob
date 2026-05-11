import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { meals, goal, targetCalories } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: 'API 키 없음' }, { status: 500 });
    if (!meals || meals.length === 0) return NextResponse.json({ error: 'NO_DATA' }, { status: 422 });

    // 최근 30일 기준 통계 계산
    const totalCal = meals.reduce((s: number, m: any) => s + (m.calories || 0), 0);
    const days = new Set(meals.map((m: any) => new Date(m.created_at).toDateString())).size;
    const avgCal = days > 0 ? Math.round(totalCal / days) : 0;
    const carbs   = meals.reduce((s: number, m: any) => s + (m.nutrient?.carbohydrates || 0), 0);
    const protein = meals.reduce((s: number, m: any) => s + (m.nutrient?.protein || 0), 0);
    const fat     = meals.reduce((s: number, m: any) => s + (m.nutrient?.fat || 0), 0);
    const sodium  = meals.reduce((s: number, m: any) => s + (m.nutrient?.sodium || 0), 0);
    const fiber   = meals.reduce((s: number, m: any) => s + (m.nutrient?.fiber || 0), 0);
    const avgSodium = days > 0 ? Math.round(sodium / days) : 0;
    const avgFiber  = days > 0 ? Math.round(fiber / days) : 0;

    const catMap: Record<string, number> = {};
    meals.forEach((m: any) => { if (m.category) catMap[m.category] = (catMap[m.category] || 0) + 1; });
    const topCats = Object.entries(catMap).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5);

    const foodMap: Record<string, number> = {};
    meals.forEach((m: any) => { if (m.food_name) foodMap[m.food_name] = (foodMap[m.food_name] || 0) + 1; });
    const topFoods = Object.entries(foodMap).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5).map(([name]) => name);

    const totalNutri = carbs + protein + fat;
    const carbPct   = totalNutri > 0 ? Math.round(carbs / totalNutri * 100) : 0;
    const proteinPct = totalNutri > 0 ? Math.round(protein / totalNutri * 100) : 0;
    const fatPct    = totalNutri > 0 ? Math.round(fat / totalNutri * 100) : 0;

    const prompt = `당신은 국내 최고 수준의 영양사 겸 헬스 코치입니다.
아래 사용자의 최근 ${days}일 식사 데이터를 분석해 정밀 진단 리포트를 JSON으로 작성하세요.

[사용자 데이터]
- 목표: ${goal || '유지'}
- 목표 칼로리: ${targetCalories}kcal/일
- 기록 식사 수: ${meals.length}회 / ${days}일
- 일 평균 칼로리: ${avgCal}kcal
- 영양소 비율 (탄:단:지): ${carbPct}%:${proteinPct}%:${fatPct}%
- 일 평균 나트륨: ${avgSodium}mg (권장 2000mg)
- 일 평균 식이섬유: ${avgFiber}g (권장 25g)
- 자주 먹는 음식: ${topFoods.join(', ') || '없음'}
- 자주 먹는 카테고리: ${topCats.map(([c, n]) => `${c}(${n}회)`).join(', ') || '없음'}

아래 JSON 형식으로만 응답하세요. 각 항목은 한국어로 구체적이고 실용적으로 작성하세요.

{
  "overall_score": 0~100 사이 정수 (종합 건강 점수),
  "grade": "A+/A/B+/B/C+/C/D" 중 하나,
  "summary": "2~3문장으로 전체 식습관 평가. 구체적 수치 언급.",
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
    { "title": "실천 방법 제목2", "description": "구체적이고 실행 가능한 조언2", "priority": "high/medium/low" },
    { "title": "실천 방법 제목3", "description": "구체적이고 실행 가능한 조언3", "priority": "high/medium/low" }
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
  "ai_message": "사용자에게 보내는 따뜻하고 동기부여가 되는 한 문단 메시지 (3~4문장)"
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
          return NextResponse.json({ success: true, diagnosis: data, modelUsed: model, stats: { avgCal, days, meals: meals.length } });
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
