import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { nutrients } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: 'API 키가 없습니다.' }, { status: 500 });

    const prompt = `
      당신은 전문 영양사입니다. 사용자의 오늘 하루 영양 섭취 데이터는 다음과 같습니다:
      - 칼로리: ${nutrients.calories} kcal
      - 탄수화물: ${nutrients.carbs}g
      - 단백질: ${nutrients.protein}g
      - 지방: ${nutrients.fat}g

      이 데이터를 분석하여 사용자에게 따뜻하고 전문적인 피드백을 제공해주세요.
      JSON 형식으로만 응답하며, 구조는 다음과 같습니다:
      {
        "feedback": "전체적인 섭취 밸런스에 대한 1-2문장의 피드백",
        "goodPoint": "오늘 식단에서 잘한 점 한 가지",
        "improvement": "개선하면 좋을 점 한 가지",
        "recommendation": {
          "menu": "다음 식사로 추천하는 메뉴 이름",
          "reason": "해당 메뉴를 추천하는 영양학적 이유"
        }
      }
      한국어로 답변해주세요.
    `;

    // Gemini API 호출 (1.5 Flash 사용)
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    const result = await response.json();

    if (response.ok) {
      const aiText = result.candidates[0].content.parts[0].text;
      return NextResponse.json({ success: true, data: JSON.parse(aiText) });
    } else {
      return NextResponse.json({ error: 'AI 피드백 생성 실패', details: result.error?.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Recommendation API Error:', error);
    return NextResponse.json({ error: '서버 오류 발생', details: error.message }, { status: 500 });
  }
}
