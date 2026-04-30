import { NextResponse } from 'next/server';

// OpenFoodFacts에서 음식명으로 영양정보 조회
async function searchOpenFoodFacts(foodName: string) {
  try {
    const query = encodeURIComponent(foodName);
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&page_size=3&fields=product_name,nutriments,categories_tags`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;

    const data = await res.json();
    const products = data.products;
    if (!products || products.length === 0) return null;

    // 가장 첫 번째 결과 사용
    const p = products[0];
    const n = p.nutriments || {};

    // 100g 기준 → 1인분(200g) 기준으로 환산 (일반적인 한식 1인분)
    const portion = 200;
    const per100 = (val: number | undefined) => val ? Math.round((val * portion) / 100) : 0;

    return {
      source: 'openfoodfacts',
      nutrients: {
        carbohydrates: per100(n['carbohydrates_100g']),
        protein: per100(n['proteins_100g']),
        fat: per100(n['fat_100g']),
        fiber: per100(n['fiber_100g']),
        sugar: per100(n['sugars_100g']),
        sodium: per100(n['sodium_100g']) * 1000, // g → mg
        calories: per100(n['energy-kcal_100g']),
        // 비타민·무기질은 OpenFoodFacts에 있으면 가져오고 없으면 0
        vitaminC: per100(n['vitamin-c_100g']) * 1000, // g → mg
        calcium: per100(n['calcium_100g']) * 1000,
        iron: per100(n['iron_100g']) * 1000,
      }
    };
  } catch {
    return null;
  }
}

// Gemini로 이미지에서 음식명 + 완전한 영양정보 추론
async function analyzeWithGemini(base64Data: string, apiKey: string, dbNutrients: any | null) {
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

  // DB 데이터가 있으면 Gemini에게 보완만 요청, 없으면 전체 추론 요청
  const nutritionContext = dbNutrients
    ? `OpenFoodFacts DB에서 가져온 기본 영양정보가 있습니다 (참고용):
       탄수화물 ${dbNutrients.carbohydrates}g, 단백질 ${dbNutrients.protein}g, 지방 ${dbNutrients.fat}g, 칼로리 ${dbNutrients.calories}kcal.
       이 값을 기반으로 실제 사진 속 음식의 양을 고려해 조정하고, 비타민·무기질을 추가로 추론해주세요.`
    : `이미지만 보고 음식명과 영양정보를 추론해주세요. 일반적인 한식 1인분(약 200g) 기준으로 추정하세요.`;

  const prompt = `당신은 전문 영양사이자 음식 분석 AI입니다.
이 음식 사진을 분석해서 아래 JSON 형식으로만 응답하세요.

${nutritionContext}

응답 JSON 형식:
{
  "name": "한국어 음식명 (정확하고 구체적으로, 예: 된장찌개, 비빔밥, 삼겹살)",
  "calories": 숫자(kcal),
  "category": "한식/중식/일식/양식/간식/음료 중 하나",
  "amount": "1인분 또는 추정 중량(g)",
  "nutrients": {
    "carbohydrates": 숫자(g),
    "protein": 숫자(g),
    "fat": 숫자(g),
    "fiber": 숫자(g),
    "sugar": 숫자(g),
    "sodium": 숫자(mg),
    "vitaminA": 숫자(μg),
    "vitaminC": 숫자(mg),
    "vitaminD": 숫자(μg),
    "calcium": 숫자(mg),
    "iron": 숫자(mg),
    "potassium": 숫자(mg)
  }
}

중요:
- 음식명은 반드시 한국어로, 실제 음식명을 정확히 적어주세요
- 모르는 값은 0이 아닌 일반적인 추정값을 사용하세요
- JSON 외 다른 텍스트는 절대 포함하지 마세요`;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
            ]
          }],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.2, // 낮을수록 일관성 있는 답변
          }
        })
      });

      const result = await res.json();

      if (res.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
        const parsed = JSON.parse(result.candidates[0].content.parts[0].text);
        return { success: true, food: parsed, modelUsed: model };
      }

      // 한도 초과 에러면 다음 모델 시도
      const errMsg = result.error?.message || '';
      if (errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('overloaded')) {
        console.warn(`${model} quota exceeded, trying next...`);
        continue;
      }

      return { success: false, error: errMsg };
    } catch (e: any) {
      console.warn(`${model} failed:`, e.message);
      continue;
    }
  }

  return { success: false, error: '모든 모델 한도 초과. 잠시 후 다시 시도해주세요.' };
}

export async function POST(request: Request) {
  try {
    const { image } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: 'API 키가 없습니다.' }, { status: 500 });

    const base64Data = image.includes(',') ? image.split(',')[1] : image;

    // Step 1: Gemini로 음식명 먼저 빠르게 인식 (텍스트만 반환, 소모 최소화)
    let foodName = '';
    try {
      const nameUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const nameRes = await fetch(nameUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: '이 음식 사진에서 음식 이름만 한국어로 짧게 답하세요. 예시: 된장찌개, 비빔밥, 삼겹살. 음식 이름만, 다른 텍스트 없이.' },
              { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
            ]
          }],
          generationConfig: { temperature: 0.1 }
        })
      });
      const nameResult = await nameRes.json();
      if (nameRes.ok) {
        foodName = nameResult.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        foodName = foodName.replace(/["\n]/g, '').trim();
      }
    } catch { /* 실패해도 계속 진행 */ }

    // Step 2: OpenFoodFacts에서 영양 DB 조회 (음식명 인식 성공 시)
    let dbNutrients = null;
    if (foodName) {
      dbNutrients = await searchOpenFoodFacts(foodName);
      if (dbNutrients) {
        console.log(`OpenFoodFacts hit for: ${foodName}`);
      }
    }

    // Step 3: Gemini로 전체 분석 (DB 데이터 있으면 보완, 없으면 전체 추론)
    const geminiResult = await analyzeWithGemini(base64Data, apiKey, dbNutrients?.nutrients || null);

    if (!geminiResult.success) {
      // Gemini 완전 실패 시 DB 데이터라도 반환
      if (dbNutrients && foodName) {
        return NextResponse.json({
          success: true,
          food: {
            name: foodName,
            calories: dbNutrients.nutrients.calories,
            category: '기타',
            amount: '200g(추정)',
            nutrients: dbNutrients.nutrients,
          },
          source: 'openfoodfacts_only',
        });
      }
      return NextResponse.json({ error: geminiResult.error }, { status: 429 });
    }

    // Step 4: DB 데이터로 Gemini 결과 보완 (더 신뢰할 수 있는 탄단지 값 적용)
    const finalFood = geminiResult.food;
    if (dbNutrients) {
      // DB 칼로리가 있고 Gemini 값과 크게 차이 안 나면 DB 값 우선
      const dbCal = dbNutrients.nutrients.calories;
      const geminiCal = finalFood.calories;
      if (dbCal > 0 && Math.abs(dbCal - geminiCal) / geminiCal < 0.5) {
        finalFood.nutrients.carbohydrates = dbNutrients.nutrients.carbohydrates || finalFood.nutrients.carbohydrates;
        finalFood.nutrients.protein = dbNutrients.nutrients.protein || finalFood.nutrients.protein;
        finalFood.nutrients.fat = dbNutrients.nutrients.fat || finalFood.nutrients.fat;
        finalFood.nutrients.fiber = dbNutrients.nutrients.fiber || finalFood.nutrients.fiber;
        finalFood.nutrients.sodium = dbNutrients.nutrients.sodium || finalFood.nutrients.sodium;
      }
      // 비타민·무기질은 DB 값이 있으면 보완
      if (dbNutrients.nutrients.vitaminC > 0) finalFood.nutrients.vitaminC = dbNutrients.nutrients.vitaminC;
      if (dbNutrients.nutrients.calcium > 0) finalFood.nutrients.calcium = dbNutrients.nutrients.calcium;
      if (dbNutrients.nutrients.iron > 0) finalFood.nutrients.iron = dbNutrients.nutrients.iron;
    }

    return NextResponse.json({
      success: true,
      food: finalFood,
      modelUsed: geminiResult.modelUsed,
      source: dbNutrients ? 'hybrid' : 'gemini_only',
    });

  } catch (error: any) {
    return NextResponse.json({ error: '서버 오류', details: error.message }, { status: 500 });
  }
}
