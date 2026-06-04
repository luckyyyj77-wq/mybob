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

    const { today, weekly, goal, achievedStreak = 0, totalAchievedDays = 0, persona = 'dog' } = await request.json();
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

    const achievementNote = achievedStreak >= 3
      ? `목표 칼로리 ${achievedStreak}일 연속 달성 중 (총 ${totalAchievedDays}일 달성). 연속 달성에 대한 칭찬과 동기부여를 반드시 포함하세요.`
      : achievedStreak > 0
      ? `목표 칼로리 달성 중 (연속 ${achievedStreak}일, 총 ${totalAchievedDays}일). 꾸준함을 격려하세요.`
      : totalAchievedDays > 0
      ? `지금까지 총 ${totalAchievedDays}일 목표 칼로리를 달성한 이력이 있습니다.`
      : '';

    const personaPrompts: Record<string, { role: string; style: string; extra: string }> = {
      robot: {
        role: '당신은 감정 없는 AI 영양 분석 시스템입니다. 오직 데이터와 수치만으로 판단합니다.',
        style: '모든 문장은 짧고 단호하게. 감탄사·공감·칭찬 없음. 수치, 비율, 권장량 기반으로만 서술. 해요체 사용.',
        extra: achievedStreak >= 3 ? '연속 달성 데이터를 goodPoint에 수치로 명시하세요.' : '',
      },
      cat: {
        role: '당신은 독설과 냉소를 구사하는 고양이 코치입니다. 영양학 지식은 완벽하지만 칭찬은 최소화하고 팩트를 냉정하게 날립니다.',
        style: '비꼬는 말투, 짧은 한마디 독설, 가끔 체념한 듯한 코멘트. 그러나 틀린 말은 하지 않음. 해요체+반말 섞기 가능.',
        extra: achievedStreak >= 3 ? '연속 달성은 마지못해 인정하는 투로 goodPoint에 반영하세요.' : '',
      },
      dog: {
        role: '당신은 열정적이고 사랑스러운 강아지 코치입니다. 어떤 상황에서도 응원하며 긍정 에너지를 팍팍 줍니다.',
        style: '감탄사 자주 사용, 느낌표 적극 사용, 공감과 칭찬 위주. 그러나 영양 정보는 정확하게. 해요체 사용.',
        extra: achievedStreak >= 3 ? '연속 달성을 진심으로 폭발적으로 칭찬하며 goodPoint에 반영하세요.' : '',
      },
    };
    const p = personaPrompts[persona] ?? personaPrompts['dog'];

    const prompt = `${p.role}

[사용자 목표]
목표: ${goal?.goal || '유지'} / 권장 칼로리: ${guide.kcal}kcal / 권장 PFC 비율: 탄수화물 ${guide.carbPct}% · 단백질 ${guide.proteinPct}% · 지방 ${guide.fatPct}%
${bmrNote}

[오늘 섭취]
칼로리: ${today.calories}kcal, 탄수화물: ${today.carbs}g, 단백질: ${today.protein}g, 지방: ${today.fat}g

[주간 트렌드]
${weeklyNote}
${achievementNote ? `\n[목표 달성 기록]\n${achievementNote}` : ''}

위 데이터를 바탕으로 피드백을 작성하세요.
말투 규칙: ${p.style}
${p.extra}

분석 기준:
1. 오늘 PFC 비율이 목표 대비 어떤지 평가하세요.
2. 주간 트렌드에서 지속적으로 부족하거나 과잉된 영양소 패턴이 있으면 언급하세요.
3. 목표(${goal?.goal || '유지'})에 맞는 구체적인 내일 식단을 제안하세요.

다음 JSON 형식으로만 응답하세요:
{
  "feedback": "오늘 PFC 밸런스 및 주간 트렌드 분석 (2-3문장, 페르소나 말투 적용)",
  "goodPoint": "오늘 또는 이번 주 식단에서 영양학적으로 훌륭한 점 (페르소나 말투 적용)",
  "improvement": "목표 달성을 위해 내일 개선할 구체적인 팁 (페르소나 말투 적용)",
  "weeklyInsight": "7일 데이터 기반 트렌드 한 줄 코멘트 (페르소나 말투 적용)",
  "recommendation": {
    "menu": "오늘 부족한 영양소를 채워줄 구체적인 보완 식단",
    "reason": "해당 메뉴가 현재 사용자의 목표에 필요한 근거 (페르소나 말투 적용)"
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
