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

// 앱 페르소나 → cdbapi 페르소나 매핑
const PERSONA_MAP: Record<string, { persona: string; level: string }> = {
  dog:   { persona: 'good',    level: 'strong' },
  cat:   { persona: 'evil',    level: 'strong' },
  robot: { persona: 'neutral', level: 'medium' },
};

export async function POST(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limit = rateLimit(`rec:${user.id}`, 10, 60 * 60 * 1000);
    if (limit.limited) {
      return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    }

    const { today, weekly, goal, achievedStreak = 0, totalAchievedDays = 0, persona = 'dog' } = await request.json();
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const cdbKey = process.env.CDB_API_KEY?.trim();
    if (!geminiKey || !cdbKey) return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });

    const goalGuide: Record<string, { kcal: number; carbPct: number; proteinPct: number; fatPct: number }> = {
      '다이어트': { kcal: 1600, carbPct: 40, proteinPct: 35, fatPct: 25 },
      '유지':     { kcal: 2000, carbPct: 50, proteinPct: 25, fatPct: 25 },
      '증량':     { kcal: 2500, carbPct: 55, proteinPct: 25, fatPct: 20 },
    };
    const guide = goalGuide[goal?.goal || '유지'];

    let bmrNote = '';
    if (goal?.height && goal?.weight) {
      const bmr = Math.round(10 * Number(goal.weight) + 6.25 * Number(goal.height) - 5 * 30);
      bmrNote = `키 ${goal.height}cm, 몸무게 ${goal.weight}kg, 기초대사량 약 ${bmr}kcal.`;
    }

    const weeklyAvg = weekly && weekly.length > 0 ? {
      calories: Math.round(weekly.reduce((s: number, d: any) => s + d.calories, 0) / weekly.length),
      carbs:    Math.round(weekly.reduce((s: number, d: any) => s + d.carbs, 0) / weekly.length),
      protein:  Math.round(weekly.reduce((s: number, d: any) => s + d.protein, 0) / weekly.length),
      fat:      Math.round(weekly.reduce((s: number, d: any) => s + d.fat, 0) / weekly.length),
    } : null;

    const weeklyNote = weeklyAvg
      ? `주간 평균: 칼로리 ${weeklyAvg.calories}kcal, 탄수화물 ${weeklyAvg.carbs}g, 단백질 ${weeklyAvg.protein}g, 지방 ${weeklyAvg.fat}g.`
      : '주간 데이터 없음.';

    const streakNote = achievedStreak >= 3
      ? `목표 칼로리 ${achievedStreak}일 연속 달성 중 (총 ${totalAchievedDays}일).`
      : achievedStreak > 0
      ? `목표 칼로리 연속 ${achievedStreak}일 달성 중.`
      : totalAchievedDays > 0
      ? `총 ${totalAchievedDays}일 목표 달성 이력 있음.`
      : '';

    // ── Step 1: Gemini로 식단 맥락 요약 + 구조화 피드백 생성 ──
    const analysisPrompt = `당신은 영양 분석 전문가입니다. 아래 식단 데이터를 분석하여 JSON으로만 응답하세요.

[목표] ${goal?.goal || '유지'} / 권장 ${guide.kcal}kcal / 탄${guide.carbPct}%·단${guide.proteinPct}%·지${guide.fatPct}%
${bmrNote}
[오늘] 칼로리 ${today.calories}kcal, 탄수화물 ${today.carbs}g, 단백질 ${today.protein}g, 지방 ${today.fat}g
[주간] ${weeklyNote}
${streakNote ? `[연속달성] ${streakNote}` : ''}

다음 JSON 형식으로만 응답하세요:
{
  "summary": "오늘 식단 상황을 한 문장으로 객관적으로 요약 (코치 코멘트 생성용 input으로 쓸 텍스트)",
  "goodPoint": "오늘 식단에서 영양학적으로 잘 된 점 한 문장",
  "improvement": "내일 개선할 구체적인 팁 한 문장",
  "weeklyInsight": "주간 트렌드 한 줄 코멘트",
  "recommendation": {
    "menu": "부족한 영양소를 채울 구체적인 식단",
    "reason": "해당 메뉴가 필요한 이유 한 문장"
  }
}
반드시 한국어로 작성하세요.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: analysisPrompt }] }],
        generationConfig: { response_mime_type: 'application/json' },
      }),
    });

    if (!geminiRes.ok) {
      console.error('[recommendation] Gemini error');
      return NextResponse.json({ error: 'AI 피드백 생성에 실패했습니다.' }, { status: 500 });
    }

    const geminiResult = await geminiRes.json();
    const analysis = JSON.parse(geminiResult.candidates[0].content.parts[0].text);

    // ── Step 2: cdbapi로 페르소나 코멘트 생성 ──
    const cdbPersona = PERSONA_MAP[persona] ?? PERSONA_MAP['dog'];
    const cdbRes = await fetch('https://cdbapi.vercel.app/api/v1/comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cdbKey,
      },
      body: JSON.stringify({
        input: analysis.summary,
        persona: cdbPersona.persona,
        level: cdbPersona.level,
      }),
    });

    let feedback = analysis.summary;
    if (cdbRes.ok) {
      const cdbResult = await cdbRes.json();
      if (cdbResult.comment) feedback = cdbResult.comment;
    } else {
      console.error('[recommendation] cdbapi error');
    }

    return NextResponse.json({
      success: true,
      data: {
        feedback,
        goodPoint: analysis.goodPoint,
        improvement: analysis.improvement,
        weeklyInsight: analysis.weeklyInsight,
        recommendation: analysis.recommendation,
      },
    });

  } catch (error: any) {
    console.error('[recommendation]', error?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
