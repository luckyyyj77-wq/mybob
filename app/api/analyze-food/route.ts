import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAnalysisLimit, incrementAnalysisCount } from '@/lib/plan';

export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
  const portionMap: Record<string, number> = { '찌개': 300, '탕': 400, '국': 350, '밥': 250, '면': 350, '구이': 200, '찜': 250, '전': 150, '치킨': 200, '피자': 180 };
  const portion = Object.entries(portionMap).find(([k]) => key.includes(k))?.[1] || 250;
  const scale = portion / 100;
  return { source: 'korean_db', portion, nutrients: { carbohydrates: Math.round(db.carbohydrates * scale), protein: Math.round(db.protein * scale), fat: Math.round(db.fat * scale), fiber: Math.round(db.fiber * scale), sugar: 0, sodium: Math.round(db.sodium * scale), calories: Math.round(db.calories * scale) } };
}

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
    return { source: 'openfoodfacts', portion, nutrients: { carbohydrates: Math.round((n['carbohydrates_100g'] || 0) * s), protein: Math.round((n['proteins_100g'] || 0) * s), fat: Math.round((n['fat_100g'] || 0) * s), fiber: Math.round((n['fiber_100g'] || 0) * s), sugar: Math.round((n['sugars_100g'] || 0) * s), sodium: Math.round((n['sodium_100g'] || 0) * s * 1000), calories: Math.round((n['energy-kcal_100g'] || 0) * s), vitaminC: Math.round((n['vitamin-c_100g'] || 0) * s * 1000), calcium: Math.round((n['calcium_100g'] || 0) * s * 1000), iron: Math.round((n['iron_100g'] || 0) * s * 1000) } };
  } catch { return null; }
}

function buildNutritionPrompt(dbNutrients: any | null, dbSource: string | null, estimatedPortion: number, locale: string): string {
  const nutritionContext = locale === 'en'
    ? (dbNutrients ? `[DB Reference — Source: ${dbSource}, Est. Serving: ${estimatedPortion}g] Carbs ${dbNutrients.carbohydrates}g, Protein ${dbNutrients.protein}g, Fat ${dbNutrients.fat}g, Cal ${dbNutrients.calories}kcal. Verify with visual analysis and adjust if cooking state differs.` : `Use visual analysis to estimate serving weight, portion size, and nutrients.`)
    : (dbNutrients ? `[DB 기초 데이터 — 출처: ${dbSource}, 추정 1인분: ${estimatedPortion}g] 탄수화물 ${dbNutrients.carbohydrates}g, 단백질 ${dbNutrients.protein}g, 지방 ${dbNutrients.fat}g, 칼로리 ${dbNutrients.calories}kcal. 시각적으로 검증하고 조리 상태가 다르면 보정.` : `시각적 분석으로 1인분 중량, 포션 크기, 영양가 추정.`);

  const drinkRules = locale === 'en'
    ? `DRINK IDENTIFICATION (apply when liquid is visible):
Step 1 — Liquid color & opacity:
 • Pure black, no red tint → Americano / Black Coffee
 • Black + tan/beige foam layer → Latte / Cappuccino
 • Dark brown-red + visible carbonation bubbles + slight sparkle → Cola / Soft drink
 • Transparent amber/yellow → Tea / Juice
 • Opaque white/beige → Milk / Smoothie
Step 2 — Ice check (if present):
 • Large irregular ice → Coffee drink (ice added manually)
 • Small uniform ice → Cola (factory-uniform)
Step 3 — Iced Americano vs Iced Cola:
 • Americano = pure black, ZERO red tint, no bubbles, matte surface
 • Cola = dark brown-RED, VISIBLE carbonation bubbles, slight surface sheen
 Use BOTH color AND bubble evidence — never decide from one clue alone.
DO NOT classify as Water if any color or opacity is visible.`
    : `음료 식별 규칙 (액체가 보일 때 적용):
1단계 — 색상 & 투명도:
 • 순수 검정, 적색 없음 → 아메리카노 / 블랙 커피
 • 검정 + 베이지 거품층 → 라떼 / 카푸치노
 • 진한 갈색-적색 + 탄산 거품 + 반짝임 → 콜라 / 탄산음료
 • 투명 황갈색 → 차 / 주스
 • 불투명 흰색/베이지 → 우유 / 스무디
2단계 — 얼음 확인 (있을 경우):
 • 크고 불규칙한 얼음 → 커피 음료
 • 작고 균일한 얼음 → 콜라
3단계 — 아이스 아메리카노 vs 아이스 콜라:
 • 아메리카노 = 순수 검정, 적색 없음, 거품 없음, 무광 표면
 • 콜라 = 진한 갈색+적색, 탄산 거품 뚜렷, 표면 윤기
 색상과 거품 증거를 반드시 함께 사용 — 하나만으로 판단 금지.
색상이나 불투명도가 있으면 물로 분류 금지.`;

  const solidFoodRules = locale === 'en'
    ? `SOLID FOOD IDENTIFICATION:
Texture + Shape rules (critical for preventing misclassification):
 • Golden-yellow + uniform breadcrumb coating + cylindrical/bite-sized → Fried nugget (NOT scone)
 • Pale tan + crumbly dry texture + dome shape + no coating → Scone / Pastry
 • Golden + thin flat single piece + fine breading → Schnitzel / Pork cutlet
 • Golden + irregular skin-like surface → Fried chicken

DO NOT classify as Scone if: breadcrumb coating is visible or shape is cylindrical.
DO NOT classify as Nugget if: no breading, pale/crumbly interior visible.

Category rules:
 Korean (한식): fermented ingredients visible (kimchi red, gochujang, doenjang), multiple side dishes, soy-ginger marinade
 Chinese (중식): cornstarch gloss on sauce, soy+scallion without Korean fermentation, wok char marks
 Japanese (일식): fresh/raw focus, light soy, minimal sauce, precise plating, nori/wasabi/soy dip visible
 Exception — noodle soups: Korean noodle = red gochujang broth; Chinese noodle = glossy dark soy broth; Japanese ramen = clear miso/shoyu broth
DO NOT classify as Japanese if Korean or Chinese ingredients are dominant.`
    : `고체 음식 식별:
질감 + 형태 규칙 (오분류 방지 핵심):
 • 황금색 + 균일한 빵가루 코팅 + 원통형/한입 크기 → 튀긴 너겟 (스콘 아님)
 • 옅은 갈색 + 건조하고 부스러지는 식감 + 돔 형태 + 코팅 없음 → 스콘 / 페이스트리
 • 황금색 + 얇고 납작한 단일 조각 + 고운 빵가루 → 돈가스 / 커틀릿
 • 황금색 + 불규칙한 껍질 같은 표면 → 튀긴 치킨

빵가루 코팅이 보이거나 원통형이면 스콘으로 분류 금지.
코팅 없고 속이 옅은 부스러기 식감이면 너겟으로 분류 금지.

카테고리 규칙:
 한식: 발효 재료 보임 (김치 빨간색, 고추장, 된장), 여러 반찬, 간장-생강 양념
 중식: 소스에 전분 윤기, 간장+파 (한식 발효 없음), 웍 자국
 일식: 신선/생 위주, 연한 간장, 소스 최소, 정밀 플레이팅, 노리/와사비/간장 딥
 예외 — 국수 요리: 한식=빨간 고추장 국물, 중식=진한 간장 윤기 국물, 일식=맑은 미소/쇼유 국물
한식/중식 재료가 주를 이루면 일식으로 분류 금지.`;

  const systemInstruction = locale === 'en'
    ? `You are a world-class food image recognition and nutrition analysis AI. Analyze the image carefully using ALL visual clues (color, texture, shape, opacity, bubbles, coating). Respond ONLY with valid JSON — no explanation, no markdown.

PRINCIPLES:
1. Use multiple visual clues, never just one feature.
2. Apply the drink rules when liquid is visible.
3. Apply the solid food rules to prevent texture/shape misclassification.
4. If visual evidence is ambiguous, set confidence to "low" and pick the most likely option.
5. Include a brief "reasoning" field explaining your key identification logic.`
    : `당신은 세계 최고 수준의 음식 이미지 인식 및 영양 분석 AI입니다. 모든 시각적 단서(색상, 질감, 형태, 투명도, 거품, 코팅)를 활용해 이미지를 꼼꼼히 분석하세요. 유효한 JSON만 응답 — 설명이나 마크다운 없이.

원칙:
1. 여러 시각적 단서 사용, 하나의 특징으로만 판단 금지.
2. 액체가 보이면 음료 규칙 적용.
3. 고체 음식은 질감/형태 규칙으로 오분류 방지.
4. 시각적 근거가 애매하면 confidence를 "low"로 설정하고 가장 가능성 높은 답 선택.
5. 핵심 식별 근거를 "reasoning" 필드에 간단히 기재.`;

  const jsonSchema = locale === 'en'
    ? `{
  "name": "Specific food name in English",
  "calories": number (kcal),
  "category": "Korean/Chinese/Japanese/Western/Snack/Drink",
  "amount": "Est. weight(g) or quantity",
  "confidence": "high/medium/low",
  "reasoning": "Key visual clues used for identification",
  "nutrients": {
    "carbohydrates": number (g), "protein": number (g), "fat": number (g),
    "fiber": number (g), "sugar": number (g), "sodium": number (mg),
    "caffeine": number (mg) or null,
    "vitaminA": number (μg), "vitaminC": number (mg), "vitaminD": number (μg),
    "calcium": number (mg), "iron": number (mg), "potassium": number (mg)
  }
}`
    : `{
  "name": "구체적인 한국어 음식명",
  "calories": 숫자 (kcal),
  "category": "한식/중식/일식/양식/간식/음료",
  "amount": "추정 중량(g) 또는 수량",
  "confidence": "high/medium/low",
  "reasoning": "식별에 사용한 핵심 시각적 근거",
  "nutrients": {
    "carbohydrates": 숫자 (g), "protein": 숫자 (g), "fat": 숫자 (g),
    "fiber": 숫자 (g), "sugar": 숫자 (g), "sodium": 숫자 (mg),
    "caffeine": 숫자 (mg) 또는 null,
    "vitaminA": 숫자 (μg), "vitaminC": 숫자 (mg), "vitaminD": 숫자 (μg),
    "calcium": 숫자 (mg), "iron": 숫자 (mg), "potassium": 숫자 (mg)
  }
}`;

  return `${systemInstruction}\n\n${drinkRules}\n\n${solidFoodRules}\n\n${nutritionContext}\n\nOUTPUT FORMAT:\n${jsonSchema}`;
}

async function analyzeWithGemini(base64Data: string, apiKey: string, dbNutrients: any | null, dbSource: string | null, estimatedPortion: number, isPro = false, locale = 'ko'): Promise<{ success: boolean; food?: any; modelUsed?: string; error?: string }> {
  const modelsToTry = isPro ? ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'] : ['gemini-2.5-flash', 'gemini-2.0-flash'];
  const prompt = buildNutritionPrompt(dbNutrients, dbSource, estimatedPortion, locale);
  const MODEL_TIMEOUT = 20000;

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: base64Data } }] }],
          generationConfig: { response_mime_type: 'application/json', temperature: 0.05 },
        }),
        signal: AbortSignal.timeout(MODEL_TIMEOUT),
      });
      const result = await res.json();
      if (res.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
        return { success: true, food: JSON.parse(result.candidates[0].content.parts[0].text), modelUsed: model };
      }
      const errMsg = result.error?.message || '';
      // quota/rate limit → 다음 모델 시도
      if (res.status === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate')) continue;
      // 그 외 API 오류 → 다음 모델 시도
      continue;
    } catch (e: any) {
      // 타임아웃/네트워크 오류 → 다음 모델 시도
      continue;
    }
  }
  return { success: false, error: 'Gemini timeout' };
}

async function analyzeWithHaiku(base64Data: string, apiKey: string, dbNutrients: any | null, dbSource: string | null, estimatedPortion: number, locale = 'ko'): Promise<{ success: boolean; food?: any; modelUsed?: string; error?: string }> {
  const prompt = buildNutritionPrompt(dbNutrients, dbSource, estimatedPortion, locale);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Data } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const result = await res.json();
    if (!res.ok) return { success: false, error: result.error?.message };
    const text = result.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { success: false, error: 'Invalid Haiku response' };
    return { success: true, food: JSON.parse(jsonMatch[0]), modelUsed: 'claude-haiku-4-5' };
  } catch {
    return { success: false, error: 'Haiku timeout' };
  }
}

async function lookupBarcode(barcode: string) {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json?fields=product_name,serving_size,servings_per_container,nutriments`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product; const n = p.nutriments || {}; const servingG = p.serving_quantity ? parseFloat(p.serving_quantity) : 100; const scale = servingG / 100;
    const r1 = (v: any) => v != null ? Math.round(v * scale * 10) / 10 : null;
    const ri = (v: any) => v != null ? Math.round(v * scale) : null;
    return { product_name: p.product_name || null, serving_size: p.serving_size || `${servingG}g`, servings_per_container: p.servings_per_container ? parseFloat(p.servings_per_container) : null, per_serving: { calories: ri(n['energy-kcal_100g']), carbohydrates: r1(n['carbohydrates_100g']), sugar: r1(n['sugars_100g']), protein: r1(n['proteins_100g']), fat: r1(n['fat_100g']), saturated_fat: r1(n['saturated-fat_100g']), trans_fat: r1(n['trans-fat_100g']), fiber: r1(n['fiber_100g']), sodium: ri(n['sodium_100g'] != null ? n['sodium_100g'] * 1000 : undefined), caffeine: r1(n['caffeine_100g']), vitaminA: r1(n['vitamin-a_100g']), vitaminC: r1(n['vitamin-c_100g']), vitaminD: r1(n['vitamin-d_100g']), calcium: ri(n['calcium_100g'] != null ? n['calcium_100g'] * 1000 : undefined), iron: r1(n['iron_100g']), potassium: ri(n['potassium_100g'] != null ? n['potassium_100g'] * 1000 : undefined) } };
  } catch { return null; }
}

async function analyzeNutritionLabel(base64Data: string, apiKey: string, locale = 'ko') {
  const prompt = locale === 'en'
    ? `Analyze food package. If barcode visible, extract to barcode field. If nutrition label visible, read values. Respond in JSON. { "barcode": "string or null", "product_name": "string or null", "serving_size": "string or null", "per_serving": { ... }, "readable": true/false }`
    : `식품 패키지 분석. 바코드 보이면 barcode 필드에 기록, 영양표 보이면 수치 읽기. JSON으로만 응답. { "barcode": "string or null", "product_name": "string or null", "serving_size": "string or null", "per_serving": { ... }, "readable": true/false }`;

  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: base64Data } }] }], generationConfig: { response_mime_type: 'application/json', temperature: 0.05 } }) });
      const result = await res.json();
      if (res.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
        return { success: true, data: JSON.parse(result.candidates[0].content.parts[0].text), modelUsed: model, tokensIn: result.usageMetadata?.promptTokenCount, tokensOut: result.usageMetadata?.candidatesTokenCount };
      }
      if (result.error?.message?.includes('quota')) continue;
      return { success: false, error: result.error?.message };
    } catch { continue; }
  }
  return { success: false, error: 'Error' };
}

export async function POST(request: Request) {
  try {
    const { image, mode, locale = 'ko' } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: 'No API Key' }, { status: 500 });

    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;
    let plan = 'free';
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
        const limitCheck = await checkAnalysisLimit(adminSupabase, user.id);
        if (!limitCheck.allowed) return NextResponse.json({ error: 'ANALYSIS_LIMIT_EXCEEDED', used: limitCheck.used, limit: limitCheck.limit }, { status: 429 });
        plan = limitCheck.plan;
      }
    }

    const base64Data = image.includes(',') ? image.split(',')[1] : image;

    if (mode === 'ocr') {
      const ocrResult = await analyzeNutritionLabel(base64Data, apiKey, locale);
      if (!ocrResult.success) return NextResponse.json({ error: ocrResult.error }, { status: 500 });
      if (!ocrResult.data.readable) return NextResponse.json({ error: 'OCR_NOT_READABLE' }, { status: 422 });
      const d = ocrResult.data; let p = d.per_serving; let source = 'ocr';
      if (d.barcode) {
        const barcodeData = await lookupBarcode(d.barcode);
        if (barcodeData) {
          if (barcodeData.per_serving.calories != null) { p = { ...p, ...Object.fromEntries(Object.entries(barcodeData.per_serving).filter(([, v]) => v != null)) }; source = 'barcode+off'; }
        } else source = 'barcode+ocr';
      }
      if (userId) {
        const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
        await incrementAnalysisCount(adminSupabase, userId);
      }
      return NextResponse.json({ success: true, food: { name: d.product_name || 'Product', calories: p.calories, category: 'Etc', amount: d.serving_size || '1 serving', nutrients: p }, source, analysisStatus: { plan } });
    }

    // Food mode — 음식 이름 사전 추출 (NOT_FOOD 체크)
    const namePrompt = locale === 'en' ? 'If food/drink, name it in English briefly. Else "NOT_FOOD".' : '음식이면 한국어로 이름만 짧게, 아니면 "NOT_FOOD".';
    let foodName = '';
    try {
      const nameRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: namePrompt }, { inline_data: { mime_type: 'image/jpeg', data: base64Data } }] }], generationConfig: { temperature: 0.1 } }),
        signal: AbortSignal.timeout(5000),
      });
      const nameResult = await nameRes.json();
      if (nameRes.ok) {
        const raw = (nameResult.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/["\n]/g, '').trim();
        if (raw === 'NOT_FOOD') return NextResponse.json({ error: 'NOT_FOOD' }, { status: 422 });
        foodName = raw;
      }
    } catch { }

    const isPro = plan !== 'free';
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    const koreanHit = foodName ? searchKoreanDB(foodName) : null;
    const [offHit, geminiResult] = await Promise.all([
      (!koreanHit && foodName) ? searchOpenFoodFacts(foodName) : Promise.resolve(null),
      analyzeWithGemini(base64Data, apiKey, koreanHit?.nutrients ?? null, koreanHit?.source ?? null, koreanHit?.portion ?? 250, isPro, locale),
    ]);

    let aiResult = geminiResult;
    let aiSource = 'gemini';
    // Haiku 폴백: Gemini 전체 실패(타임아웃/quota 소진) 시에만
    if (!geminiResult.success && anthropicKey) {
      aiResult = await analyzeWithHaiku(base64Data, anthropicKey, koreanHit?.nutrients ?? null, koreanHit?.source ?? null, koreanHit?.portion ?? 250, locale);
      aiSource = 'haiku';
    }

    if (!aiResult.success) return NextResponse.json({ error: aiResult.error }, { status: 429 });
    const finalFood = aiResult.food;
    const dbResult = offHit || koreanHit;
    if (dbResult) {
      if (dbResult.nutrients.calories > 0 && Math.abs(dbResult.nutrients.calories - finalFood.calories) / Math.max(finalFood.calories, 1) < 0.5) {
        finalFood.nutrients = { ...finalFood.nutrients, ...Object.fromEntries(Object.entries(dbResult.nutrients).filter(([, v]) => v != null && v !== 0)) };
      }
    }

    if (userId) {
      const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
      await incrementAnalysisCount(adminSupabase, userId);
    }

    return NextResponse.json({ success: true, food: finalFood, source: dbResult ? dbResult.source + '+' + aiSource : aiSource + '_only', analysisStatus: { plan } });

  } catch {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
