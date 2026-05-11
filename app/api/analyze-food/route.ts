import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAnalysisLimit, incrementAnalysisCount } from '@/lib/plan';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── 한식 영양DB: 식약처 기반 하드코딩 상위 30종 ──────────────────────────
// OpenFoodFacts의 한식 커버리지 보완용 (100g 기준)
const KOREAN_FOOD_DB: Record<string, { calories: number; carbohydrates: number; protein: number; fat: number; sodium: number; fiber: number }> = {
  '된장찌개':   { calories: 52,  carbohydrates: 4,  protein: 4,  fat: 2,  sodium: 580, fiber: 1 },
  '김치찌개':   { calories: 58,  carbohydrates: 3,  protein: 4,  fat: 3,  sodium: 640, fiber: 1 },
  '비빔밥':     { calories: 145, carbohydrates: 26, protein: 5,  fat: 3,  sodium: 380, fiber: 2 },
  '불고기':     { calories: 178, carbohydrates: 8,  protein: 17, fat: 8,  sodium: 520, fiber: 0 },
  '삼겹살':     { calories: 331, carbohydrates: 0,  protein: 17, fat: 29, sodium: 60,  fiber: 0 },
  '삼계탕':     { calories: 120, carbohydrates: 5,  protein: 14, fat: 5,  sodium: 340, fiber: 0 },
  '갈비탕':     { calories: 110, carbohydrates: 4,  protein: 12, fat: 5,  sodium: 410, fiber: 0 },
  '순두부찌개': { calories: 60,  carbohydrates: 3,  protein: 5,  fat: 3,  sodium: 520, fiber: 1 },
  '냉면':       { calories: 130, carbohydrates: 26, protein: 5,  fat: 1,  sodium: 580, fiber: 1 },
  '잡채':       { calories: 148, carbohydrates: 20, protein: 5,  fat: 5,  sodium: 400, fiber: 1 },
  '떡볶이':     { calories: 140, carbohydrates: 28, protein: 3,  fat: 2,  sodium: 560, fiber: 1 },
  '김밥':       { calories: 175, carbohydrates: 29, protein: 6,  fat: 4,  sodium: 420, fiber: 1 },
  '라면':       { calories: 135, carbohydrates: 19, protein: 3,  fat: 5,  sodium: 690, fiber: 1 },
  '치킨':       { calories: 239, carbohydrates: 8,  protein: 22, fat: 13, sodium: 490, fiber: 0 },
  '피자':       { calories: 270, carbohydrates: 33, protein: 11, fat: 10, sodium: 600, fiber: 2 },
  '햄버거':     { calories: 295, carbohydrates: 30, protein: 15, fat: 13, sodium: 580, fiber: 2 },
  '초밥':       { calories: 170, carbohydrates: 28, protein: 8,  fat: 3,  sodium: 380, fiber: 0 },
  '파전':       { calories: 185, carbohydrates: 22, protein: 6,  fat: 8,  sodium: 440, fiber: 1 },
  '순대':       { calories: 185, carbohydrates: 18, protein: 9,  fat: 8,  sodium: 520, fiber: 1 },
  '보쌈':       { calories: 155, carbohydrates: 2,  protein: 18, fat: 8,  sodium: 430, fiber: 0 },
  '설렁탕':     { calories: 95,  carbohydrates: 3,  protein: 11, fat: 4,  sodium: 390, fiber: 0 },
  '부대찌개':   { calories: 105, carbohydrates: 8,  protein: 7,  fat: 5,  sodium: 720, fiber: 1 },
  '짜장면':     { calories: 165, carbohydrates: 28, protein: 5,  fat: 4,  sodium: 750, fiber: 2 },
  '짬뽕':       { calories: 95,  carbohydrates: 14, protein: 6,  fat: 2,  sodium: 860, fiber: 2 },
  '탕수육':     { calories: 215, carbohydrates: 22, protein: 10, fat: 10, sodium: 480, fiber: 1 },
  '칼국수':     { calories: 120, carbohydrates: 22, protein: 4,  fat: 2,  sodium: 420, fiber: 1 },
  '육개장':     { calories: 68,  carbohydrates: 4,  protein: 7,  fat: 3,  sodium: 590, fiber: 2 },
  '미역국':     { calories: 35,  carbohydrates: 2,  protein: 3,  fat: 1,  sodium: 480, fiber: 1 },
  '해장국':     { calories: 88,  carbohydrates: 5,  protein: 9,  fat: 3,  sodium: 610, fiber: 1 },
  '돈가스':     { calories: 265, carbohydrates: 18, protein: 16, fat: 14, sodium: 520, fiber: 1 },
};

function searchKoreanDB(foodName: string): { source: string; nutrients: any; portion: number } | null {
  const key = Object.keys(KOREAN_FOOD_DB).find(k => foodName.includes(k) || k.includes(foodName.slice(0, 2)));
  if (!key) return null;
  const db = KOREAN_FOOD_DB[key];
  // 음식 종류별 일반적인 1인분 중량 추정
  const portionMap: Record<string, number> = {
    '찌개': 300, '탕': 400, '국': 350, '밥': 250, '면': 350,
    '구이': 200, '찜': 250, '전': 150, '치킨': 200, '피자': 180,
  };
  const portion = Object.entries(portionMap).find(([k]) => key.includes(k))?.[1] || 250;
  const scale = portion / 100;
  return {
    source: 'korean_db',
    portion,
    nutrients: {
      carbohydrates: Math.round(db.carbohydrates * scale),
      protein:       Math.round(db.protein * scale),
      fat:           Math.round(db.fat * scale),
      fiber:         Math.round(db.fiber * scale),
      sugar:         0,
      sodium:        Math.round(db.sodium * scale),
      calories:      Math.round(db.calories * scale),
    },
  };
}

// ── OpenFoodFacts 조회 ────────────────────────────────────────────────────────
async function searchOpenFoodFacts(foodName: string) {
  try {
    const query = encodeURIComponent(foodName);
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&page_size=3&fields=product_name,nutriments,categories_tags`;
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    const p = data.products?.[0];
    if (!p) return null;
    const n = p.nutriments || {};
    const portion = 200;
    const s = portion / 100;
    return {
      source: 'openfoodfacts',
      portion,
      nutrients: {
        carbohydrates: Math.round((n['carbohydrates_100g'] || 0) * s),
        protein:       Math.round((n['proteins_100g'] || 0) * s),
        fat:           Math.round((n['fat_100g'] || 0) * s),
        fiber:         Math.round((n['fiber_100g'] || 0) * s),
        sugar:         Math.round((n['sugars_100g'] || 0) * s),
        sodium:        Math.round((n['sodium_100g'] || 0) * s * 1000),
        calories:      Math.round((n['energy-kcal_100g'] || 0) * s),
        vitaminC:      Math.round((n['vitamin-c_100g'] || 0) * s * 1000),
        calcium:       Math.round((n['calcium_100g'] || 0) * s * 1000),
        iron:          Math.round((n['iron_100g'] || 0) * s * 1000),
      },
    };
  } catch {
    return null;
  }
}

// ── Gemini 비전 분석 ──────────────────────────────────────────────────────────
async function analyzeWithGemini(base64Data: string, apiKey: string, dbNutrients: any | null, dbSource: string | null, estimatedPortion: number) {
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

  const nutritionContext = dbNutrients
    ? `[DB 기초 데이터 — 출처: ${dbSource}, 추정 1인분: ${estimatedPortion}g]
탄수화물 ${dbNutrients.carbohydrates}g, 단백질 ${dbNutrients.protein}g, 지방 ${dbNutrients.fat}g, 칼로리 ${dbNutrients.calories}kcal.
사진 속 실제 음식의 조리 상태(소스 양, 튀김 정도, 고명)를 분석해 위 수치를 보정하고, 누락된 미량 영양소를 전문가 수준으로 추론하세요.`
    : `이미지를 시각적으로 분석하여 음식명과 영양 정보를 전부 추론하세요.
식재료 종류, 조리 방식(찜/튀김/볶음 등), 그릇 크기와 음식 밀도를 고려해 1인분 중량과 영양소를 계산하세요.`;

  const prompt = `당신은 세계 최고 수준의 영양 분석 AI입니다.
제공된 이미지를 분석해 아래 JSON 형식으로만 응답하세요.

${nutritionContext}

{
  "name": "구체적인 한국어 음식명 (예: 치즈 돈가스, 해물 파전)",
  "calories": 숫자(kcal),
  "category": "한식/중식/일식/양식/간식/음료",
  "amount": "추정 중량(g) 또는 수량",
  "confidence": "high/medium/low",
  "nutrients": {
    "carbohydrates": 숫자(g),
    "protein": 숫자(g),
    "fat": 숫자(g),
    "fiber": 숫자(g),
    "sugar": 숫자(g),
    "sodium": 숫자(mg),
    "caffeine": 숫자(mg) 또는 null,
    "vitaminA": 숫자(μg),
    "vitaminC": 숫자(mg),
    "vitaminD": 숫자(μg),
    "calcium": 숫자(mg),
    "iron": 숫자(mg),
    "potassium": 숫자(mg)
  }
}

주의:
- 사진에 보이지 않는 나트륨·당류 등은 해당 음식 레시피 기반으로 추정하세요.
- caffeine은 커피·차·에너지음료·콜라 등 카페인 함유 음료·식품에만 숫자(mg)로 응답하고, 일반 음식은 null로 응답하세요.
- JSON 외 텍스트 금지.`;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: base64Data } }] }],
          generationConfig: { response_mime_type: 'application/json', temperature: 0.15 },
        }),
      });
      const result = await res.json();
      if (res.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
        return { success: true, food: JSON.parse(result.candidates[0].content.parts[0].text), modelUsed: model };
      }
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

// ── Open Food Facts 바코드 조회 ───────────────────────────────────────────────
async function lookupBarcode(barcode: string): Promise<{
  product_name: string | null;
  serving_size: string | null;
  servings_per_container: number | null;
  per_serving: Record<string, number | null>;
} | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json?fields=product_name,serving_size,servings_per_container,nutriments`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const n = p.nutriments || {};

    // OFF는 100g 기준 저장 — serving_size_g가 있으면 환산, 없으면 100g 기준 그대로
    const servingG = p.serving_quantity ? parseFloat(p.serving_quantity) : 100;
    const scale = servingG / 100;

    const round1 = (v: number | undefined) => v != null ? Math.round(v * scale * 10) / 10 : null;
    const roundInt = (v: number | undefined) => v != null ? Math.round(v * scale) : null;

    return {
      product_name: p.product_name || null,
      serving_size: p.serving_size || `${servingG}g`,
      servings_per_container: p.servings_per_container ? parseFloat(p.servings_per_container) : null,
      per_serving: {
        calories:      roundInt(n['energy-kcal_100g']),
        carbohydrates: round1(n['carbohydrates_100g']),
        sugar:         round1(n['sugars_100g']),
        protein:       round1(n['proteins_100g']),
        fat:           round1(n['fat_100g']),
        saturated_fat: round1(n['saturated-fat_100g']),
        trans_fat:     round1(n['trans-fat_100g']),
        fiber:         round1(n['fiber_100g']),
        sodium:        roundInt(n['sodium_100g'] != null ? n['sodium_100g'] * 1000 / scale * scale : undefined),
        caffeine:      round1(n['caffeine_100g']),
        vitaminA:      round1(n['vitamin-a_100g']),
        vitaminC:      round1(n['vitamin-c_100g']),
        vitaminD:      round1(n['vitamin-d_100g']),
        calcium:       roundInt(n['calcium_100g'] != null ? n['calcium_100g'] * 1000 / scale * scale : undefined),
        iron:          round1(n['iron_100g']),
        potassium:     roundInt(n['potassium_100g'] != null ? n['potassium_100g'] * 1000 / scale * scale : undefined),
      },
    };
  } catch {
    return null;
  }
}

// ── 영양성분표 + 바코드 통합 분석 ─────────────────────────────────────────────
async function analyzeNutritionLabel(base64Data: string, apiKey: string) {
  // Gemini에게 바코드 숫자 추출 + 영양표 읽기를 한 번에 요청
  const prompt = `당신은 식품 패키지 분석 전문가입니다. 이미지를 보고 아래 JSON으로만 응답하세요.

우선순위:
1. 바코드(EAN-13, EAN-8, UPC-A 등)가 보이면 숫자를 읽어 barcode 필드에 기록
2. 영양성분표가 보이면 수치를 그대로 읽기 (추론 금지)
3. 둘 다 없으면 readable: false

{
  "barcode": "바코드 숫자 문자열 또는 null",
  "product_name": "제품명 또는 null",
  "serving_size": "1회 제공량 (예: 30g, 1봉, 200mL) 또는 null",
  "servings_per_container": 숫자 또는 null,
  "per_serving": {
    "calories": 숫자(kcal) 또는 null,
    "carbohydrates": 숫자(g) 또는 null,
    "sugar": 숫자(g) 또는 null,
    "protein": 숫자(g) 또는 null,
    "fat": 숫자(g) 또는 null,
    "saturated_fat": 숫자(g) 또는 null,
    "trans_fat": 숫자(g) 또는 null,
    "fiber": 숫자(g) 또는 null,
    "sodium": 숫자(mg) 또는 null,
    "caffeine": 숫자(mg) 또는 null,
    "vitaminA": 숫자(μg) 또는 null,
    "vitaminC": 숫자(mg) 또는 null,
    "vitaminD": 숫자(μg) 또는 null,
    "calcium": 숫자(mg) 또는 null,
    "iron": 숫자(mg) 또는 null,
    "potassium": 숫자(mg) 또는 null
  },
  "readable": true
}

바코드만 있고 영양표가 없으면 per_serving의 모든 값을 null로, readable: true로 응답.
아무것도 없으면: { "readable": false }

주의:
- 100g 기준 표는 1회 제공량 기준으로 환산
- % DV(일일섭취량%)만 있는 항목은 null
- JSON 외 텍스트 절대 금지`;

  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: base64Data } },
          ]}],
          generationConfig: { response_mime_type: 'application/json', temperature: 0.05 },
        }),
      });
      const result = await res.json();
      if (res.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
        const parsed = JSON.parse(result.candidates[0].content.parts[0].text);
        return { success: true, data: parsed, modelUsed: model };
      }
      const errMsg = result.error?.message || '';
      if (errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) continue;
      return { success: false, error: errMsg };
    } catch (e: any) {
      console.warn(`${model} OCR failed:`, e.message);
      continue;
    }
  }
  return { success: false, error: '모델 오류. 잠시 후 다시 시도해주세요.' };
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { image, mode } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: 'API 키가 없습니다.' }, { status: 500 });

    // AI 분석 횟수 제한 체크 (로컬/클라우드 무관 — Gemini 호출 비용 제한)
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
        const limitCheck = await checkAnalysisLimit(adminSupabase, user.id);
        if (!limitCheck.allowed) {
          return NextResponse.json({
            error: 'ANALYSIS_LIMIT_EXCEEDED',
            plan: limitCheck.plan,
            used: limitCheck.used,
            limit: limitCheck.limit,
          }, { status: 429 });
        }
        // 분석 완료 후 카운트 증가는 성공 응답 직전에 처리
        (request as any)._userId = user.id;
        (request as any)._adminSupabase = adminSupabase;
        (request as any)._analysisUsed = limitCheck.used;
        (request as any)._analysisLimit = limitCheck.limit;
        (request as any)._plan = limitCheck.plan;
      }
    }

    const base64Data = image.includes(',') ? image.split(',')[1] : image;

    // ── 영양성분표 + 바코드 OCR 모드 ─────────────────────────────────────────
    if (mode === 'ocr') {
      const ocrResult = await analyzeNutritionLabel(base64Data, apiKey);

      if (!ocrResult.success) {
        return NextResponse.json({ error: ocrResult.error }, { status: 500 });
      }
      if (!ocrResult.data.readable) {
        return NextResponse.json({ error: 'OCR_NOT_READABLE' }, { status: 422 });
      }

      const d = ocrResult.data;
      let p = d.per_serving;
      let source = 'ocr';
      let productName = d.product_name;
      let servingSize = d.serving_size;
      let servingsPerContainer = d.servings_per_container;

      // 바코드가 인식됐으면 Open Food Facts 조회 (OCR 영양표보다 DB가 더 정확)
      if (d.barcode) {
        console.log(`Barcode detected: ${d.barcode} — querying Open Food Facts`);
        const barcodeData = await lookupBarcode(d.barcode);
        if (barcodeData) {
          // DB 데이터를 우선 사용, 없는 항목은 OCR로 보완
          productName = barcodeData.product_name || productName;
          servingSize = barcodeData.serving_size || servingSize;
          servingsPerContainer = barcodeData.servings_per_container ?? servingsPerContainer;
          // 칼로리가 DB에 있으면 DB 전체를 신뢰
          if (barcodeData.per_serving.calories != null) {
            p = { ...p, ...Object.fromEntries(
              Object.entries(barcodeData.per_serving).filter(([, v]) => v != null)
            )};
            source = 'barcode+off';
          }
        } else {
          source = 'barcode+ocr'; // 바코드는 읽었지만 DB 미등록 제품
        }
      }

      // 분석 카운트 증가
      const userId = (request as any)._userId;
      const adminSupabase = (request as any)._adminSupabase;
      const analysisUsed = (request as any)._analysisUsed ?? 0;
      const analysisLimit = (request as any)._analysisLimit ?? 10;
      const plan = (request as any)._plan ?? 'free';
      if (userId && adminSupabase) await incrementAnalysisCount(adminSupabase, userId);

      return NextResponse.json({
        success: true,
        food: {
          name: productName || '포장 식품',
          calories: p.calories,
          category: '기타',
          amount: servingSize || '1회 제공량',
          confidence: 'high',
          nutrients: {
            carbohydrates: p.carbohydrates ?? undefined,
            protein:       p.protein       ?? undefined,
            fat:           p.fat           ?? undefined,
            fiber:         p.fiber         ?? undefined,
            sugar:         p.sugar         ?? undefined,
            sodium:        p.sodium        ?? undefined,
            caffeine:      p.caffeine      ?? undefined,
            vitaminA:      p.vitaminA      ?? undefined,
            vitaminC:      p.vitaminC      ?? undefined,
            vitaminD:      p.vitaminD      ?? undefined,
            calcium:       p.calcium       ?? undefined,
            iron:          p.iron          ?? undefined,
            potassium:     p.potassium     ?? undefined,
          },
        },
        source,
        modelUsed: ocrResult.modelUsed,
        ocrMeta: {
          barcode: d.barcode || null,
          serving_size: servingSize,
          servings_per_container: servingsPerContainer,
        },
        analysisStatus: { used: analysisUsed + 1, limit: analysisLimit, plan },
      });
    }

    // Step 1: 음식명 인식 (빠른 텍스트 전용 호출)
    let foodName = '';
    try {
      const nameRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: '이 음식 사진에서 음식 이름만 한국어로 짧게 답하세요. 음식 이름만, 다른 텍스트 없이. 예: 된장찌개' },
              { inline_data: { mime_type: 'image/jpeg', data: base64Data } },
            ]}],
            generationConfig: { temperature: 0.1 },
          }),
        }
      );
      const nameResult = await nameRes.json();
      if (nameRes.ok) {
        foodName = (nameResult.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/["\n]/g, '').trim();
      }
    } catch { /* 실패 시 DB 조회 생략하고 Gemini 전체 분석으로 진행 */ }

    // Step 2: 한식DB + OpenFoodFacts 병렬 조회 (음식명 인식 성공 시)
    let dbResult: { source: string; nutrients: any; portion: number } | null = null;
    if (foodName) {
      // 한식 DB 먼저 (로컬, 빠름) — 없으면 OpenFoodFacts
      const koreanHit = searchKoreanDB(foodName);
      if (koreanHit) {
        dbResult = koreanHit;
        console.log(`Korean DB hit: ${foodName}`);
      } else {
        const offHit = await searchOpenFoodFacts(foodName);
        if (offHit) {
          dbResult = offHit;
          console.log(`OpenFoodFacts hit: ${foodName}`);
        }
      }
    }

    // Step 3: Gemini 비전 분석 (DB 결과를 컨텍스트로 제공)
    const geminiResult = await analyzeWithGemini(
      base64Data, apiKey,
      dbResult?.nutrients || null,
      dbResult?.source || null,
      dbResult?.portion || 250
    );

    // Gemini 완전 실패 → DB 데이터 폴백
    if (!geminiResult.success) {
      if (dbResult && foodName) {
        return NextResponse.json({
          success: true,
          food: { name: foodName, calories: dbResult.nutrients.calories, category: '기타', amount: `${dbResult.portion}g(추정)`, confidence: 'low', nutrients: dbResult.nutrients },
          source: dbResult.source + '_only',
          modelUsed: null,
        });
      }
      return NextResponse.json({ error: geminiResult.error }, { status: 429 });
    }

    // Step 4: DB + Gemini 결과 융합
    const finalFood = geminiResult.food;
    if (dbResult) {
      const dbCal = dbResult.nutrients.calories;
      const gemCal = finalFood.calories;
      // 칼로리 차이 50% 이내일 때만 DB 탄단지 신뢰 (더 검증된 값)
      if (dbCal > 0 && Math.abs(dbCal - gemCal) / Math.max(gemCal, 1) < 0.5) {
        finalFood.nutrients.carbohydrates = dbResult.nutrients.carbohydrates || finalFood.nutrients.carbohydrates;
        finalFood.nutrients.protein       = dbResult.nutrients.protein       || finalFood.nutrients.protein;
        finalFood.nutrients.fat           = dbResult.nutrients.fat           || finalFood.nutrients.fat;
        finalFood.nutrients.fiber         = dbResult.nutrients.fiber         || finalFood.nutrients.fiber;
        finalFood.nutrients.sodium        = dbResult.nutrients.sodium        || finalFood.nutrients.sodium;
      }
      // 미량 영양소는 DB 값으로 보완
      if (dbResult.nutrients.vitaminC > 0) finalFood.nutrients.vitaminC = dbResult.nutrients.vitaminC;
      if (dbResult.nutrients.calcium  > 0) finalFood.nutrients.calcium  = dbResult.nutrients.calcium;
      if (dbResult.nutrients.iron     > 0) finalFood.nutrients.iron     = dbResult.nutrients.iron;
    }

    const source = dbResult
      ? (dbResult.source === 'korean_db' ? 'korean_db+gemini' : 'openfoodfacts+gemini')
      : 'gemini_only';

    // 분석 성공 시 카운트 증가
    const userId = (request as any)._userId;
    const adminSupabase = (request as any)._adminSupabase;
    const analysisUsed = (request as any)._analysisUsed ?? 0;
    const analysisLimit = (request as any)._analysisLimit ?? 10;
    const plan = (request as any)._plan ?? 'free';
    if (userId && adminSupabase) {
      await incrementAnalysisCount(adminSupabase, userId);
    }

    return NextResponse.json({
      success: true,
      food: finalFood,
      modelUsed: geminiResult.modelUsed,
      source,
      analysisStatus: { used: analysisUsed + 1, limit: analysisLimit, plan },
    });

  } catch (error: any) {
    return NextResponse.json({ error: '서버 오류', details: error.message }, { status: 500 });
  }
}
