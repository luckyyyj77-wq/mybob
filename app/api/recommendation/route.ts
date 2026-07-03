import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

const PERSONA_MAP: Record<string, { persona: string; level: string }> = {
  dog:   { persona: 'good',    level: 'strong' },
  cat:   { persona: 'evil',    level: 'strong' },
  robot: { persona: 'neutral', level: 'medium' },
};

export async function POST(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { today, weekly, goal, achievedStreak = 0, totalAchievedDays = 0, persona = 'dog', mealNames = [], currentHour, locale = 'ko' } = await request.json();
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const cdbKey = process.env.CDB_API_KEY?.trim();
    if (!geminiKey || !cdbKey) return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });

    const goalGuide: Record<string, { kcal: number; carbPct: number; proteinPct: number; fatPct: number }> = {
      'diet':     { kcal: 1600, carbPct: 40, proteinPct: 35, fatPct: 25 },
      'maintain': { kcal: 2000, carbPct: 50, proteinPct: 25, fatPct: 25 },
      'bulk':     { kcal: 2500, carbPct: 55, proteinPct: 25, fatPct: 20 },
      // Legacy Korean values (backward compat)
      '다이어트': { kcal: 1600, carbPct: 40, proteinPct: 35, fatPct: 25 },
      '유지':     { kcal: 2000, carbPct: 50, proteinPct: 25, fatPct: 25 },
      '증량':     { kcal: 2500, carbPct: 55, proteinPct: 25, fatPct: 20 },
    };
    const guide = goalGuide[goal?.goal || 'maintain'] ?? goalGuide['maintain'];

    const hour = typeof currentHour === 'number' ? currentHour : new Date().getHours();
    
    // Time slot labels (localized)
    const getTimeSlotLabel = (h: number, l: string) => {
      if (l === 'en') {
        if (h >= 0 && h < 5) return 'Early Dawn (Sleep time, 0-4 AM)';
        if (h >= 5 && h < 7) return 'Dawn (5-6 AM, Waking up early)';
        if (h >= 7 && h < 11) return 'Morning (7-10 AM)';
        if (h >= 11 && h < 14) return 'Lunch (11 AM - 1 PM)';
        if (h >= 14 && h < 17) return 'Afternoon (2-4 PM)';
        if (h >= 17 && h < 19) return 'Late Afternoon/Commute (5-6 PM)';
        if (h >= 19 && h < 22) return 'Evening (7-9 PM)';
        return 'Late Night (After 10 PM)';
      }
      if (h >= 0 && h < 5) return '새벽 (수면 시간대, 0~4시)';
      if (h >= 5 && h < 7) return '이른 아침 (5~6시, 일찍 일어나신 시간대)';
      if (h >= 7 && h < 11) return '아침 (7~10시)';
      if (h >= 11 && h < 14) return '점심 (11~13시)';
      if (h >= 14 && h < 17) return '오후 (14~16시)';
      if (h >= 17 && h < 19) return '늦은 오후/퇴근 시간대 (17~18시)';
      if (h >= 19 && h < 22) return '저녁 (19~21시)';
      return '야식 시간대 (22시 이후)';
    };
    const timeSlotLabel = getTimeSlotLabel(hour, locale);

    let bmrNote = '';
    if (goal?.height && goal?.weight) {
      const bmr = Math.round(10 * Number(goal.weight) + 6.25 * Number(goal.height) - 5 * 30);
      bmrNote = locale === 'en' 
        ? `Height ${goal.height}cm, Weight ${goal.weight}kg, BMR approx ${bmr}kcal.`
        : `키 ${goal.height}cm, 몸무게 ${goal.weight}kg, 기초대사량 약 ${bmr}kcal.`;
    }

    const mealsNote = mealNames.length > 0
      ? (locale === 'en' ? `Foods eaten today: ${mealNames.slice(0, 8).join(', ')}.` : `오늘 먹은 음식: ${mealNames.slice(0, 8).join(', ')}.`)
      : (locale === 'en' ? 'No food recorded today.' : '오늘 먹은 음식 정보 없음.');

    const weeklyAvg = weekly && weekly.length > 0 ? {
      calories: Math.round(weekly.reduce((s: number, d: any) => s + d.calories, 0) / weekly.length),
      carbs:    Math.round(weekly.reduce((s: number, d: any) => s + d.carbs, 0) / weekly.length),
      protein:  Math.round(weekly.reduce((s: number, d: any) => s + d.protein, 0) / weekly.length),
      fat:      Math.round(weekly.reduce((s: number, d: any) => s + d.fat, 0) / weekly.length),
    } : null;

    const weeklyNote = weeklyAvg
      ? (locale === 'en' 
          ? `Weekly Avg: Calories ${weeklyAvg.calories}kcal, Carbs ${weeklyAvg.carbs}g, Protein ${weeklyAvg.protein}g, Fat ${weeklyAvg.fat}g.`
          : `주간 평균: 칼로리 ${weeklyAvg.calories}kcal, 탄수화물 ${weeklyAvg.carbs}g, 단백질 ${weeklyAvg.protein}g, 지방 ${weeklyAvg.fat}g.`)
      : (locale === 'en' ? 'No weekly data.' : '주간 데이터 없음.');

    const streakNote = achievedStreak >= 3
      ? (locale === 'en' ? `Achieved goal for ${achievedStreak} consecutive days (Total ${totalAchievedDays} days).` : `목표 칼로리 ${achievedStreak}일 연속 달성 중 (총 ${totalAchievedDays}일).`)
      : achievedStreak > 0
      ? (locale === 'en' ? `Achieving goal for ${achievedStreak} consecutive days.` : `목표 칼로리 연속 ${achievedStreak}일 달성 중.`)
      : totalAchievedDays > 0
      ? (locale === 'en' ? `Has history of achieving goal for total ${totalAchievedDays} days.` : `총 ${totalAchievedDays}일 목표 달성 이력 있음.`)
      : '';

    // ── Step 1: Gemini Analysis ──
    const analysisPrompt = locale === 'en' ? `You are a professional nutrition analyst. Analyze the following meal data and respond ONLY in JSON.

[Current Time] ${timeSlotLabel}
[Goal] ${goal?.goal || 'Maintain'} / Target ${guide.kcal}kcal / Carbs${guide.carbPct}% Protein${guide.proteinPct}% Fat${guide.fatPct}%
${bmrNote}
[Eaten Today] ${mealsNote}
[Nutrients Today] Calories ${today.calories}kcal, Carbs ${today.carbs}g, Protein ${today.protein}g, Fat ${today.fat}g
[Weekly] ${weeklyNote}
${streakNote ? `[Streak] ${streakNote}` : ''}

Respond in the following JSON format:
{
  "summary": "A one-sentence summary of today's meal status reflecting food and time (input for coach comment, include specific food names)",
  "goodPoint": "One sentence on a nutritionally good point today (mention specific food names)",
  "improvement": "One practical improvement tip based on the current time ${timeSlotLabel}",
  "weeklyInsight": "One line comment on weekly trends",
  "recommendation": {
    "menu": "A specific food recommendation to fill nutrient gaps (appropriate for current time)",
    "reason": "One sentence explaining why the menu is needed"
  },
  "personaFeedback": "A comment in the style of a ${persona} (dog: energetic/friendly, cat: sharp/witty, robot: data-driven/formal). This field is ONLY if locale is not Korean."
}
MUST be written in English.`
: `당신은 영양 분석 전문가입니다. 아래 식단 데이터를 분석하여 JSON으로만 응답하세요.

[현재 시간대] ${timeSlotLabel}
[목표] ${goal?.goal || '유지'} / 권장 ${guide.kcal}kcal / 탄${guide.carbPct}%·단${guide.proteinPct}%·지${guide.fatPct}%
${bmrNote}
[오늘 먹은 것] ${mealsNote}
[오늘 영양] 칼로리 ${today.calories}kcal, 탄수화물 ${today.carbs}g, 단백질 ${today.protein}g, 지방 ${today.fat}g
[주간] ${weeklyNote}
${streakNote ? `[연속달성] ${streakNote}` : ''}

다음 JSON 형식으로만 응답하세요:
{
  "summary": "오늘 먹은 음식과 시간대를 반영한 식단 상황 한 문장 요약 (코치 코멘트 생성용 input, 구체적인 음식명 포함)",
  "goodPoint": "오늘 식단에서 영양학적으로 잘 된 점 한 문장 (구체적인 음식명 언급)",
  "improvement": "${timeSlotLabel} 기준으로 지금 당장 실천할 수 있는 개선 팁 한 문장",
  "weeklyInsight": "주간 트렌드 한 줄 코멘트",
  "recommendation": {
    "menu": "부족한 영양소를 채울 구체적인 식단 (현재 시간대에 맞는 음식)",
    "reason": "해당 메뉴가 필요한 이유 한 문장"
  }
}
반드시 한국어로 작성하세요.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: analysisPrompt }] }],
        generationConfig: { response_mime_type: 'application/json' },
      }),
    });

    if (!geminiRes.ok) return NextResponse.json({ error: 'AI 피드백 생성에 실패했습니다.' }, { status: 500 });

    const geminiResult = await geminiRes.json();
    const analysis = JSON.parse(geminiResult.candidates[0].content.parts[0].text);

    // ── Step 2: Persona Comment ──
    let feedback = analysis.summary;

    if (locale !== 'ko' && analysis.personaFeedback) {
      // English persona feedback generated by Gemini
      feedback = analysis.personaFeedback;
    } else {
      // Korean persona feedback via cdbapi
      const CDB_FALLBACK: Record<string, string[]> = {
        dog:   ['오늘도 기록 잘 하셨어요! 저 너무 기뻐요! 내일도 같이해요!', '주인님 최고예요! 오늘 식단 정말 잘 보셨어요! 저 응원할게요!', '오늘도 열심히 드셨군요! 저 행복해요! 내일도 같이해요!'],
        cat:   ['뭐, 오늘 식단은 그럭저럭이네요. 내일은 좀 더 신경 써봐요.', '분석은 끝났어요. 결과는 스스로 판단하세요. 저는 할 말 다 했어요.', '오늘 하루 기록했군요. 그것만으로도 충분히 했어요. 내일도 그렇게 하세요.'],
        robot: ['오늘 식단 분석 완료. 데이터를 바탕으로 내일 식단을 조정하세요.', '기록된 데이터를 확인했습니다. 꾸준한 기록이 정확한 분석을 만듭니다.', '오늘 섭취 데이터 수집 완료. 목표 달성을 위한 패턴을 유지하세요.'],
      };

      const cdbPersona = PERSONA_MAP[persona] ?? PERSONA_MAP['dog'];
      const cdbController = new AbortController();
      const cdbTimeout = setTimeout(() => cdbController.abort(), 4000);

      try {
        const cdbRes = await fetch('https://cdbapi.vercel.app/api/v1/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': cdbKey },
          body: JSON.stringify({ input: analysis.summary, persona: cdbPersona.persona, level: cdbPersona.level }),
          signal: cdbController.signal,
        });
        if (cdbRes.ok) {
          const cdbResult = await cdbRes.json();
          if (cdbResult.comment) feedback = cdbResult.comment;
        } else {
          const pool = CDB_FALLBACK[persona] ?? CDB_FALLBACK['dog'];
          feedback = pool[Math.floor(Math.random() * pool.length)];
        }
      } catch {
        const pool = CDB_FALLBACK[persona] ?? CDB_FALLBACK['dog'];
        feedback = pool[Math.floor(Math.random() * pool.length)];
      } finally {
        clearTimeout(cdbTimeout);
      }
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
