import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { image } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: 'API 키가 없습니다.' }, { status: 500 });

    const base64Data = image.includes(',') ? image.split(',')[1] : image;

    // 1. 모델 목록 가져오기
    const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listResponse = await fetch(listModelsUrl);
    const listData = await listResponse.json();
    
    const availableModels = listData.models
      ?.filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
      .map((m: any) => m.name.replace('models/', '')) || [];

    // 2. 우선순위에 따라 모델 시도
    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro-vision"];
    // 목록에 있는 모델들만 필터링해서 시도 순서 결정
    const filteredModels = modelsToTry.filter(m => availableModels.includes(m));
    if (filteredModels.length === 0 && availableModels.length > 0) {
      filteredModels.push(availableModels[0]);
    }

    let lastError = "";

    for (const modelName of filteredModels) {
      console.log(`Trying model: ${modelName}`);
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: "Analyze this food image and return ONLY a JSON object: { \"name\": \"음식명\", \"calories\": 0, \"category\": \"\", \"nutrients\": { \"carbohydrates\": 0, \"protein\": 0, \"fat\": 0 } }. Please respond in Korean." },
                { inline_data: { mime_type: "image/jpeg", data: base64Data } }
              ]
            }],
            generationConfig: { response_mime_type: "application/json" }
          })
        });

        const result = await response.json();

        if (response.ok) {
          const aiText = result.candidates[0].content.parts[0].text;
          return NextResponse.json({ 
            success: true, 
            food: JSON.parse(aiText),
            modelUsed: modelName 
          });
        } else {
          lastError = result.error?.message || "Unknown error";
          // 만약 "High Demand" 에러라면 다음 모델로 즉시 넘어감
          if (lastError.includes("high demand") || lastError.includes("overloaded")) {
            console.warn(`Model ${modelName} is overloaded, trying next...`);
            continue;
          }
          break; // 다른 심각한 에러라면 중단
        }
      } catch (err: any) {
        lastError = err.message;
        continue;
      }
    }

    return NextResponse.json({ 
      error: 'AI 분석 실패', 
      details: lastError,
      availableModels: availableModels
    }, { status: 500 });

  } catch (error: any) {
    return NextResponse.json({ error: '서버 오류', details: error.message }, { status: 500 });
  }
}
