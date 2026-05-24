import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

    // 시간당 10회 이하로 Gemini 호출 제한
    const limit = rateLimit(`gemini-rec:${user.id}`, 10, 60 * 60 * 1000);
    if (limit.limited) {
      return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    }

    const { today, weekly, goal } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });

    // 목표별 권장 칼로리 및 PFC 비율
    const goalGuide: Record<string, { kcal: number; carbPct: number; proteinPct: number; fatPct: number }> = {
      '다이어트': { kcal: 1600, carbPct: 40, proteinPct: 35, fatPct: 25 },
      '유지':     { kcal: 2000, carbPct: 50, proteinPct: 25, fatPct: 25 },
      '증량':     { kcal: 2500, carbPct: 55, proteinPct: 25, fatPct: 20 },
    };
    const guide = goalGuide[goal?.goal || '유지'];

    // BMR 계산 (Mifflin-St Jeor, 성별 미입력 시 중간값)
    let bmrNote = '';
    if (goal?.height && goal?.weight) {
      const bmr = Math.round(10 * Number(goal.weight) + 6.25 * Number(goal.height) - 5 * 30);
      bmrNote = `사용자 신체 정보: 키 ${goal.height}cm, 몸무게 ${goal.weight}kg, 추정 기초대사량 약 ${bmr}kcal.`;
    }

    // 주간 트렌드 요약
    const weeklyNote = weekly && weekly.length > 0
      ? `최근 7일 평균: 칼로리 ${Math.round(weekly.reduce((s: number, d: any) => s + d.calories, 0) / weekly.length)}kcal, 탄수화물 ${Math.round(weekly.reduce((s: number, d: any) => s + d.carbs, 0) / weekly.length)}g, 단백질 ${Math.round(weekly.reduce((s: number, d: any) => s + d.protein, 0) / weekly.length)}g, 지방 ${Math.round(weekly.reduce((s: number, d: any) => s + d.fat, 0) / weekly.length)}g.`
      : '주간 데이터 없음.';

    const prompt = `당신은 15년 경력의 수석 영양학 박사이자 따뜻한 AI 헬스 코치입니다.

[사용자 목표]
목표: ${goal?.goal || '유지'} / 권장 칼로리: ${guide.kcal}kcal / 권장 PFC 비율: 탄수화물 ${guide.carbPct}% · 단백질 ${guide.proteinPct}% · 지방 ${guide.fatPct}%
${bmrNote}

[오늘 섭취]
칼로리: ${today.calories}kcal, 탄수화물: ${today.carbs}g, 단백질: ${today.protein}g, 지방: ${today.fat}g

[주간 트렌드]
${weeklyNote}

위 데이터를 바탕으로 다음 기준에 따라 정밀 분석 피드백을 작성하세요:
1. 오늘 PFC 비율이 목표 대비 어떤지 평가하세요.
2. 주간 트렌드에서 지속적으로 부족하거나 과잉된 영양소 패턴이 있으면 언급하세요.
3. 목표(${goal?.goal || '유지'})에 맞는 구체적인 내일 식단을 제안하세요.
4. 전문적이면서 친근한 말투(해요체)를 사용하세요.

다음 JSON 형식으로만 응답하세요:
{
  "feedback": "오늘 PFC 밸런스 및 주간 트렌드 분석 (2-3문장)",
  "goodPoint": "오늘 또는 이번 주 식단에서 영양학적으로 훌륭한 점",
  "improvement": "목표 달성을 위해 내일 개선할 구체적인 팁",
  "weeklyInsight": "7일 데이터 기반 트렌드 한 줄 코멘트",
  "recommendation": {
    "menu": "오늘 부족한 영양소를 채워줄 구체적인 보완 식단",
    "reason": "해당 메뉴가 현재 사용자의 목표에 필요한 생리학적 근거"
  }
}
반드시 한국어로 작성하세요.`;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: 'application/json' },
      }),
    });

    const result = await response.json();
    if (response.ok) {
      const aiText = result.candidates[0].content.parts[0].text;
      return NextResponse.json({ success: true, data: JSON.parse(aiText) });
    } else {
      console.error('[recommendation] Gemini error:', result.error?.message);
      return NextResponse.json({ error: 'AI 피드백 생성에 실패했습니다.' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[recommendation]', error?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
