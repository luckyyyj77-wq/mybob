import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAnalysisLimit, incrementAnalysisCount } from '@/lib/plan';

export const maxDuration = 30;

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
    const portion = 200; const s = portion / 100;
    return { source: 'openfoodfacts', portion, nutrients: { carbohydrates: Math.round((n['carbohydrates_100g'] || 0) * s), protein: Math.round((n['proteins_100g'] || 0) * s), fat: Math.round((n['fat_100g'] || 0) * s), fiber: Math.round((n['fiber_100g'] || 0) * s), sugar: Math.round((n['sugars_100g'] || 0) * s), sodium: Math.round((n['sodium_100g'] || 0) * s * 1000), calories: Math.round((n['energy-kcal_100g'] || 0) * s), vitaminC: Math.round((n['vitamin-c_100g'] || 0) * s * 1000), calcium: Math.round((n['calcium_100g'] || 0) * s * 1000), iron: Math.round((n['iron_100g'] || 0) * s * 1000) } };
  } catch { return null; }
}

// DB 컨텍스트 없이 순수 시각 분석 프롬프트 — AI가 이름 추출 결과에 끌리지 않도록
function buildNutritionPrompt(locale: string): string {
  const drinkRules = locale === 'en'
    ? `DRINK IDENTIFICATION (apply when any liquid is visible):
Step 1 — Color & opacity of the liquid:
 • Pure black, zero red tint → Americano / Black Coffee
 • Black + tan/beige foam layer on top → Latte / Cappuccino
 • Dark brown-reddish + visible carbonation bubbles + surface sheen → Cola / Soft drink
 • Transparent amber/yellow → Tea / Juice / Iced Tea
 • Opaque white/beige → Milk / Smoothie
Step 2 — Ice (if present):
 • Large irregular cubes → Coffee (ice added manually)
 • Small uniform cubes → Cola / carbonated (factory-standard)
Step 3 — Iced Americano vs Iced Cola (the most common confusion):
 • Americano = PURE black liquid, NO red tint, NO visible bubbles, matte flat surface
 • Cola = dark brown with RED undertone, VISIBLE carbonation micro-bubbles, slight sheen/sparkle
 → Use BOTH color AND bubble evidence together — never judge from one clue alone.
NEVER classify as Water unless liquid is completely clear and colorless.`
    : `음료 식별 규칙 (액체가 보일 때 반드시 적용):
1단계 — 액체 색상 & 투명도:
 • 순수 검정, 적색 없음 → 아메리카노 / 블랙 커피
 • 검정 + 상단 베이지/갈색 거품층 → 라떼 / 카푸치노
 • 진한 갈색+적색 + 탄산 거품 뚜렷 + 표면 반짝임 → 콜라 / 탄산음료
 • 투명 황갈색/노란색 → 차 / 주스 / 아이스티
 • 불투명 흰색/베이지 → 우유 / 스무디
2단계 — 얼음 (있을 경우):
 • 크고 불규칙한 얼음 → 커피 음료 (수동으로 추가된 얼음)
 • 작고 균일한 얼음 → 콜라 / 탄산음료 (공장 규격)
3단계 — 아이스 아메리카노 vs 아이스 콜라 (가장 흔한 혼동):
 • 아메리카노 = 순수 검정, 적색 없음, 거품/기포 없음, 무광 표면
 • 콜라 = 진한 갈색+적색 톤, 눈에 보이는 탄산 기포, 표면 윤기
 → 색상과 기포 증거를 반드시 함께 사용 — 하나만으로 절대 판단하지 말 것.
액체가 완전히 투명하고 무색이 아니면 물로 분류 금지.`;

  const solidFoodRules = locale === 'en'
    ? `SOLID FOOD IDENTIFICATION — Texture + Shape (critical):
 • Golden-yellow + uniform fine breadcrumb coating + cylindrical or bite-sized shape → Fried NUGGET (never scone)
 • Pale tan/cream + crumbly dry texture + dome/biscuit shape + NO coating → SCONE / Pastry
 • Golden + thin flat single piece + even fine breading → Pork cutlet / Schnitzel
 • Golden + irregular bumpy skin-like surface, no uniform coating → Fried Chicken

HARD RULES:
 ✗ DO NOT call it Scone if breadcrumb coating is visible or shape is cylindrical.
 ✗ DO NOT call it Nugget if surface is smooth/crumbly with no breading.
 ✗ DO NOT call it Japanese if Korean or Chinese ingredients are dominant.

CATEGORY (when food origin is mixed, pick the dominant culture):
 Korean: kimchi/gochujang red visible, doenjang, multiple side dishes (반찬), soy-ginger marinade
 Chinese: cornstarch-glossy sauce, soy+scallion without Korean fermentation, wok char
 Japanese: fresh/raw focus, light soy, minimal sauce, precise plating, nori/wasabi/soy dip
 Noodle soups → Korean=red gochujang broth, Chinese=dark glossy soy broth, Japanese=clear miso/shoyu`
    : `고체 음식 식별 — 질감 + 형태 (핵심):
 • 황금색 + 균일한 고운 빵가루 코팅 + 원통형 또는 한입 크기 → 튀긴 너겟 (스콘 절대 아님)
 • 옅은 베이지/크림색 + 건조하고 부스러지는 질감 + 돔/비스킷 형태 + 코팅 없음 → 스콘 / 페이스트리
 • 황금색 + 얇고 납작한 단일 조각 + 균일한 고운 빵가루 → 돈가스 / 커틀릿
 • 황금색 + 불규칙한 울퉁불퉁한 껍질 표면, 균일한 코팅 없음 → 튀긴 치킨

절대 규칙:
 ✗ 빵가루 코팅이 보이거나 원통형이면 스콘으로 분류 금지.
 ✗ 표면이 부드럽고 부스러지며 빵가루 없으면 너겟으로 분류 금지.
 ✗ 한식/중식 재료가 주를 이루면 일식으로 분류 금지.

카테고리 (혼합 음식은 지배적인 문화 선택):
 한식: 김치/고추장 빨간색, 된장, 여러 반찬 보임, 간장-생강 양념
 중식: 전분 윤기 소스, 간장+파 (한식 발효 없음), 웍 자국
 일식: 신선/생 위주, 연한 간장, 소스 최소, 정밀 플레이팅, 노리/와사비
 국수 요리 → 한식=빨간 고추장 국물, 중식=진한 윤기 간장 국물, 일식=맑은 미소/쇼유`;

  const systemInstruction = locale === 'en'
    ? `You are an expert food image recognition AI. Analyze every visual detail in the image (color, texture, shape, opacity, surface bubbles, coating, broth color) and return ONLY valid JSON with no extra text.

KEY PRINCIPLES:
1. Trust your visual analysis — ignore any preconceptions about what the food "should" be.
2. Always apply drink rules when liquid is visible; always apply solid food rules for solid items.
3. Use MULTIPLE clues simultaneously — never rely on a single feature.
4. If genuinely ambiguous, set confidence "low" but still pick the most visually supported answer.
5. Identify ALL distinct food/drink items visible in the image separately.`
    : `당신은 음식 이미지 인식 전문 AI입니다. 이미지의 모든 시각적 세부사항(색상, 질감, 형태, 투명도, 표면 기포, 코팅, 국물 색)을 분석하고 유효한 JSON만 반환하세요. 추가 텍스트 없이.

핵심 원칙:
1. 시각적 분석을 신뢰하세요 — 음식이 "무엇이어야 한다"는 선입견 무시.
2. 액체가 보이면 음료 규칙, 고체 음식은 고체 규칙 반드시 적용.
3. 여러 단서를 동시에 사용 — 단 하나의 특징에만 의존 금지.
4. 진짜 애매하면 confidence "low"로 설정하되 시각적으로 가장 지지되는 답 선택.
5. 이미지에 보이는 모든 음식/음료 품목을 각각 별도로 식별.`;

  const jsonSchema = locale === 'en'
    ? `{
  "items": [
    {
      "name": "Specific food name in English",
      "calories": number (kcal, for this item only),
      "category": "Korean/Chinese/Japanese/Western/Snack/Drink",
      "amount": "Est. weight(g) or quantity",
      "confidence": "high/medium/low",
      "reasoning": "2-3 key visual clues that led to this identification",
      "nutrients": {
        "carbohydrates": number (g), "protein": number (g), "fat": number (g),
        "fiber": number (g), "sugar": number (g), "sodium": number (mg),
        "caffeine": number (mg) or null,
        "vitaminA": number (μg), "vitaminC": number (mg), "vitaminD": number (μg),
        "calcium": number (mg), "iron": number (mg), "potassium": number (mg)
      }
    }
  ]
}
RULE: Always use the "items" array. 1 food = 1 element. Multiple distinct foods/drinks = multiple elements.`
    : `{
  "items": [
    {
      "name": "구체적인 한국어 음식명",
      "calories": 숫자 (kcal, 이 품목만의 칼로리),
      "category": "한식/중식/일식/양식/간식/음료",
      "amount": "추정 중량(g) 또는 수량",
      "confidence": "high/medium/low",
      "reasoning": "이 식별의 근거가 된 핵심 시각적 단서 2-3가지",
      "nutrients": {
        "carbohydrates": 숫자 (g), "protein": 숫자 (g), "fat": 숫자 (g),
        "fiber": 숫자 (g), "sugar": 숫자 (g), "sodium": 숫자 (mg),
        "caffeine": 숫자 (mg) 또는 null,
        "vitaminA": 숫자 (μg), "vitaminC": 숫자 (mg), "vitaminD": 숫자 (μg),
        "calcium": 숫자 (mg), "iron": 숫자 (mg), "potassium": 숫자 (mg)
      }
    }
  ]
}
규칙: 반드시 "items" 배열 사용. 음식 1개 = 요소 1개. 여러 음식/음료 = 각각 별도 요소.`;

  return `${systemInstruction}\n\n${drinkRules}\n\n${solidFoodRules}\n\nOUTPUT FORMAT (JSON only):\n${jsonSchema}`;
}

function safeParseItems(text: string): any[] | null {
  try {
    // 전체 JSON 파싱 시도
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.items) && parsed.items.length > 0) return parsed.items;
    // items 없이 단일 객체로 왔을 때
    if (parsed?.name && parsed?.calories != null) return [parsed];
  } catch { /* fallthrough */ }

  // 마크다운 코드블록 제거 후 재시도
  const stripped = text.replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed?.items) && parsed.items.length > 0) return parsed.items;
    if (parsed?.name && parsed?.calories != null) return [parsed];
  } catch { /* fallthrough */ }

  // items 배열만 추출 시도
  const itemsMatch = stripped.match(/"items"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
  if (itemsMatch) {
    try { return JSON.parse(itemsMatch[1]); } catch { /* fallthrough */ }
  }

  // 최후: 첫 번째 {…} 객체 추출
  const objMatch = stripped.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]);
      if (parsed?.name && parsed?.calories != null) return [parsed];
      if (Array.isArray(parsed?.items)) return parsed.items;
    } catch { /* fallthrough */ }
  }

  return null;
}

async function analyzeWithGemini(
  base64Data: string, apiKey: string, isPro: boolean, locale: string
): Promise<{ success: boolean; items?: any[]; modelUsed?: string; error?: string }> {
  const modelsToTry = isPro
    ? ['gemini-2.5-pro', 'gemini-2.5-flash']
    : ['gemini-2.5-flash', 'gemini-2.0-flash'];
  const prompt = buildNutritionPrompt(locale);
  const MODEL_TIMEOUT = 8000;

  async function tryModel(model: string): Promise<{ success: boolean; items: any[]; modelUsed: string }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (res.ok && text) {
      const items = safeParseItems(text);
      if (items && items.length > 0) return { success: true, items, modelUsed: model };
    }
    throw new Error(result.error?.message || 'failed');
  }

  try {
    return await Promise.any(modelsToTry.map(m => tryModel(m)));
  } catch {
    return { success: false, error: 'Gemini timeout' };
  }
}

async function analyzeWithHaiku(
  base64Data: string, apiKey: string, locale: string
): Promise<{ success: boolean; items?: any[]; modelUsed?: string; error?: string }> {
  const prompt = buildNutritionPrompt(locale);
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
    const items = safeParseItems(text);
    if (!items) return { success: false, error: 'Invalid Haiku response' };
    return { success: true, items, modelUsed: 'claude-haiku-4-5' };
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
        return { success: true, data: JSON.parse(result.candidates[0].content.parts[0].text), modelUsed: model };
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

    // ── Food mode ──────────────────────────────────────────────────────────
    const isPro = plan !== 'free';
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();

    // NOT_FOOD 체크(flash-lite)와 본분석(flash 병렬)을 동시에 시작
    const namePrompt = locale === 'en'
      ? 'Is this image food or drink? If yes, reply with just the food name in English. If not food, reply exactly: NOT_FOOD'
      : '이 이미지가 음식이나 음료인가요? 맞으면 음식 이름만 한국어로 답하고, 음식이 아니면 정확히 NOT_FOOD 라고만 답하세요.';

    const [nameResult, geminiResult] = await Promise.all([
      // NOT_FOOD 사전 체크 — 실패해도 본분석은 계속
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: namePrompt }, { inline_data: { mime_type: 'image/jpeg', data: base64Data } }] }], generationConfig: { temperature: 0.05 } }),
        signal: AbortSignal.timeout(5000),
      }).then(async r => {
        const d = await r.json();
        return (d.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/["\n]/g, '').trim();
      }).catch(() => ''),

      // 본분석 — 동시에 시작
      analyzeWithGemini(base64Data, apiKey, isPro, locale),
    ]);

    // NOT_FOOD 판단 (이름 추출이 성공했고 명확히 NOT_FOOD인 경우만 차단)
    if (nameResult === 'NOT_FOOD') {
      return NextResponse.json({ error: 'NOT_FOOD' }, { status: 422 });
    }

    let aiResult = geminiResult;
    let aiSource = 'gemini';
    if (!geminiResult.success && anthropicKey) {
      const haikuResult = await analyzeWithHaiku(base64Data, anthropicKey, locale);
      if (haikuResult.success) {
        aiResult = haikuResult;
        aiSource = 'haiku';
      }
    }

    if (!aiResult.success) return NextResponse.json({ error: aiResult.error }, { status: 503 });

    const items = aiResult.items!;

    // 복수 품목 합산
    const mergedNutrients: Record<string, number> = {};
    for (const item of items) {
      if (!item?.nutrients) continue;
      for (const [k, v] of Object.entries(item.nutrients)) {
        if (v == null) continue;
        mergedNutrients[k] = (mergedNutrients[k] ?? 0) + (v as number);
      }
    }
    const totalCalories = items.reduce((s: number, it: any) => s + (it?.calories ?? 0), 0);
    const combinedName = items.map((it: any) => it?.name).filter(Boolean).join(' + ');
    const primaryCategory = items[0]?.category ?? '';
    const primaryAmount = items.map((it: any) => it?.amount).filter(Boolean).join(', ');
    const primaryConfidence = items[0]?.confidence ?? 'medium';

    const finalFood: Record<string, any> = {
      name: combinedName,
      calories: totalCalories,
      category: primaryCategory,
      amount: primaryAmount,
      confidence: primaryConfidence,
      nutrients: mergedNutrients,
      itemCount: items.length,
    };

    // DB 보정: 단일 품목 + 이름 추출 성공 시에만 (잘못된 DB 데이터로 오염 방지)
    if (items.length === 1 && nameResult && nameResult !== 'NOT_FOOD') {
      const koreanHit = searchKoreanDB(nameResult);
      const dbResult = koreanHit;
      if (dbResult && dbResult.nutrients.calories > 0) {
        const ratio = Math.abs(dbResult.nutrients.calories - totalCalories) / Math.max(totalCalories, 1);
        if (ratio < 0.5) {
          const dbPatch = Object.fromEntries(
            Object.entries(dbResult.nutrients).filter(([, v]) => v != null && v !== 0)
          ) as Record<string, number>;
          finalFood.nutrients = { ...finalFood.nutrients, ...dbPatch };
        }
      }
    }

    if (userId) {
      const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
      await incrementAnalysisCount(adminSupabase, userId);
    }

    return NextResponse.json({
      success: true,
      food: finalFood,
      source: aiSource + '_only',
      analysisStatus: { plan },
    });

  } catch {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
