import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { consumeAnalysisCredit, refundAnalysisCredit } from '@/lib/plan';
import { lookupKoreanFoodsDB, normalizeFoodName, type FoodDbEntry } from '@/lib/food-db';

export const maxDuration = 30;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function buildNutritionPrompt(locale: string, confirmedNames: string[]): string {
  const nameInstruction = confirmedNames.length > 0
    ? (locale === 'en'
        ? `The foods in this image are: ${confirmedNames.map(n => `"${n}"`).join(', ')}. Analyze each one separately and estimate its nutritional values.`
        : `이 이미지에 있는 음식은 ${confirmedNames.map(n => `"${n}"`).join(', ')}입니다. 각각을 분리하여 영양소 수치를 추정하세요.`)
    : (locale === 'en'
        ? `Analyze the food in this image and return ONLY valid JSON.`
        : `이 이미지의 음식을 분석하고 유효한 JSON만 반환하세요.`);

  const jsonSchema = locale === 'en'
    ? `{
  "items": [
    {
      "name": "Specific food name in English",
      "calories": number (kcal, for this item only),
      "category": "Korean/Chinese/Japanese/Western/Snack/Drink",
      "amount": "Est. weight(g) or quantity",
      "confidence": "high/medium/low",
      "nutrients": {
        "carbohydrates": number (g), "protein": number (g), "fat": number (g),
        "fiber": number (g), "sugar": number (g), "sodium": number (mg),
        "caffeine": number (mg) or null,
        "vitaminA": number (μg), "vitaminC": number (mg), "vitaminD": number (μg),
        "calcium": number (mg), "iron": number (mg), "potassium": number (mg)
      }
    }
  ]
}`
    : `{
  "items": [
    {
      "name": "구체적인 한국어 음식명",
      "calories": 숫자 (kcal, 이 품목만의 칼로리),
      "category": "한식/중식/일식/양식/간식/음료",
      "amount": "추정 중량(g) 또는 수량",
      "confidence": "high/medium/low",
      "nutrients": {
        "carbohydrates": 숫자 (g), "protein": 숫자 (g), "fat": 숫자 (g),
        "fiber": 숫자 (g), "sugar": 숫자 (g), "sodium": 숫자 (mg),
        "caffeine": 숫자 (mg) 또는 null,
        "vitaminA": 숫자 (μg), "vitaminC": 숫자 (mg), "vitaminD": 숫자 (μg),
        "calcium": 숫자 (mg), "iron": 숫자 (mg), "potassium": 숫자 (mg)
      }
    }
  ]
}`;

  const itemCount = confirmedNames.length > 1
    ? (locale === 'en'
        ? ` Output exactly ${confirmedNames.length} elements in the "items" array, one per food listed above.`
        : ` "items" 배열에 위에서 나열한 음식 ${confirmedNames.length}개를 각각 하나의 요소로 출력하세요.`)
    : '';

  return `${nameInstruction}${itemCount} Use the "items" array — one element per distinct food or drink.\n\n${jsonSchema}`;
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

// Gemini structured output 스키마 — 응답 형식을 API 레벨에서 강제해 파싱 실패 최소화
const NUTRIENTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    carbohydrates: { type: 'NUMBER' },
    protein: { type: 'NUMBER' },
    fat: { type: 'NUMBER' },
    fiber: { type: 'NUMBER' },
    sugar: { type: 'NUMBER' },
    sodium: { type: 'NUMBER' },
    caffeine: { type: 'NUMBER', nullable: true },
    vitaminA: { type: 'NUMBER' },
    vitaminC: { type: 'NUMBER' },
    vitaminD: { type: 'NUMBER' },
    calcium: { type: 'NUMBER' },
    iron: { type: 'NUMBER' },
    potassium: { type: 'NUMBER' },
  },
  required: ['carbohydrates', 'protein', 'fat'],
};

const ITEMS_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          calories: { type: 'NUMBER' },
          category: { type: 'STRING' },
          amount: { type: 'STRING' },
          confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
          nutrients: NUTRIENTS_SCHEMA,
        },
        required: ['name', 'calories', 'nutrients'],
      },
    },
  },
  required: ['items'],
};

async function analyzeWithGemini(
  base64Data: string, apiKey: string, isPro: boolean, locale: string, confirmedNames: string[]
): Promise<{ success: boolean; items?: any[]; modelUsed?: string; error?: string; tokensIn?: number; tokensOut?: number }> {
  // PRO는 2.5-pro를 순차 우선 시도(응답이 느려 타임아웃 여유), 실패 시 flash 폴백.
  // 병렬(Promise.any)로 돌리면 flash가 거의 항상 먼저 끝나 pro 결과를 버리고 비용만 2배가 됨.
  const modelPlans = isPro
    ? [{ model: 'gemini-2.5-pro', timeout: 12000 }, { model: 'gemini-2.5-flash', timeout: 8000 }]
    : [{ model: 'gemini-2.5-flash', timeout: 8000 }, { model: 'gemini-2.0-flash', timeout: 8000 }];
  const prompt = buildNutritionPrompt(locale, confirmedNames);

  for (const { model, timeout } of modelPlans) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: base64Data } }] }],
          generationConfig: { response_mime_type: 'application/json', response_schema: ITEMS_RESPONSE_SCHEMA, temperature: 0.05 },
        }),
        signal: AbortSignal.timeout(timeout),
      });
      const result = await res.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (res.ok && text) {
        const items = safeParseItems(text);
        if (items && items.length > 0) {
          return {
            success: true,
            items,
            modelUsed: model,
            tokensIn: result.usageMetadata?.promptTokenCount,
            tokensOut: result.usageMetadata?.candidatesTokenCount,
          };
        }
      }
    } catch { /* 타임아웃/네트워크 오류 → 다음 모델 폴백 */ }
  }
  return { success: false, error: 'Gemini timeout' };
}

async function logGeminiUsage(
  adminSupabase: any,
  params: { userId: string; model: string; plan: string; tokensIn?: number; tokensOut?: number; mode: 'vision' | 'ocr' }
) {
  try {
    await adminSupabase.from('gemini_usage').insert({
      user_id: params.userId,
      model: params.model,
      plan: params.plan,
      tokens_in: params.tokensIn ?? null,
      tokens_out: params.tokensOut ?? null,
      mode: params.mode,
    });
  } catch { /* 사용량 기록 실패는 분석 결과에 영향 주지 않음 */ }
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
        return {
          success: true,
          data: JSON.parse(result.candidates[0].content.parts[0].text),
          modelUsed: model,
          tokensIn: result.usageMetadata?.promptTokenCount,
          tokensOut: result.usageMetadata?.candidatesTokenCount,
        };
      }
      if (result.error?.message?.includes('quota')) continue;
      return { success: false, error: result.error?.message };
    } catch { continue; }
  }
  return { success: false, error: 'Error' };
}

export async function POST(request: Request) {
  let creditConsumed = false;
  let creditUserId: string | null = null;
  try {
    const { image, mode, locale = 'ko', frequentFoods, foodCache } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: 'No API Key' }, { status: 500 });

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const userId = user.id;

    // 이미지 검증은 크레딧 소진 전에 (잘못된 요청이 크레딧을 깎지 않도록)
    if (typeof image !== 'string' || image.length === 0) {
      return NextResponse.json({ error: 'INVALID_IMAGE' }, { status: 400 });
    }
    const MAX_BASE64_BYTES = 10 * 1024 * 1024; // 10MB base64 (~7.5MB 원본)
    if (image.length > MAX_BASE64_BYTES) {
      return NextResponse.json({ error: 'IMAGE_TOO_LARGE' }, { status: 413 });
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    // 원자적 체크+증가 — 실패 경로에서는 refundAnalysisCredit으로 반환
    const limitCheck = await consumeAnalysisCredit(adminSupabase, user.id);
    if (!limitCheck.allowed) return NextResponse.json({ error: 'ANALYSIS_LIMIT_EXCEEDED', used: limitCheck.used, limit: limitCheck.limit }, { status: 429 });
    creditConsumed = true;
    creditUserId = userId;
    const plan = limitCheck.plan;

    const base64Data = image.includes(',') ? image.split(',')[1] : image;

    if (mode === 'ocr') {
      const ocrResult = await analyzeNutritionLabel(base64Data, apiKey, locale);
      if (!ocrResult.success) {
        await refundAnalysisCredit(adminSupabase, userId);
        return NextResponse.json({ error: ocrResult.error }, { status: 500 });
      }
      if (!ocrResult.data.readable) {
        await refundAnalysisCredit(adminSupabase, userId);
        return NextResponse.json({ error: 'OCR_NOT_READABLE' }, { status: 422 });
      }
      await logGeminiUsage(adminSupabase, {
        userId, plan, mode: 'ocr',
        model: ocrResult.modelUsed!, tokensIn: ocrResult.tokensIn, tokensOut: ocrResult.tokensOut,
      });
      const d = ocrResult.data; let p = d.per_serving; let source = 'ocr';
      if (d.barcode) {
        const barcodeData = await lookupBarcode(d.barcode);
        if (barcodeData) {
          if (barcodeData.per_serving.calories != null) { p = { ...p, ...Object.fromEntries(Object.entries(barcodeData.per_serving).filter(([, v]) => v != null)) }; source = 'barcode+off'; }
        } else source = 'barcode+ocr';
      }
      return NextResponse.json({ success: true, food: { name: d.product_name || 'Product', calories: p.calories, category: 'Etc', amount: d.serving_size || '1 serving', nutrients: p }, source, analysisStatus: { plan, used: limitCheck.used, limit: limitCheck.limit } });
    }

    // ── Food mode ──────────────────────────────────────────────────────────
    const isPro = plan !== 'free';

    // 자주 먹는 음식 힌트 — 반복 품목의 이름을 일관되게 확정시켜 식약처 DB 매칭률을 높임
    const foodHints: string[] = Array.isArray(frequentFoods)
      ? frequentFoods
          .filter((s: any) => typeof s === 'string' && s.trim().length > 0)
          .map((s: string) => s.trim().slice(0, 40))
          .slice(0, 20)
      : [];
    const hintText = foodHints.length > 0
      ? (locale === 'en'
          ? ` For reference, this user frequently eats: ${foodHints.join(', ')}. If a food in the image is one of these, use that exact name.`
          : ` 참고로 이 사용자가 자주 먹는 음식: ${foodHints.join(', ')}. 이미지 속 음식이 이 목록의 음식과 같다면 그 이름을 그대로 사용하세요.`)
      : '';

    // 1단계: flash-lite로 음식 목록 확정 (NOT_FOOD 체크 겸용) — 빠르게 선행
    const namePrompt = (locale === 'en'
      ? 'List all distinct foods and drinks visible in this image. Reply with ONLY a JSON array of specific names, e.g. ["Iced Americano", "Kimchi Jjigae", "Rice"]. If there is nothing edible, reply exactly: NOT_FOOD'
      : '이 이미지에 보이는 모든 음식과 음료를 나열하세요. 구체적인 이름을 JSON 배열로만 답하세요 (예: ["아이스 아메리카노", "김치찌개", "공기밥"]). 먹을 수 있는 것이 없으면 정확히 NOT_FOOD 라고만 답하세요.'
    ) + hintText;

    const confirmedNames: string[] = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: namePrompt }, { inline_data: { mime_type: 'image/jpeg', data: base64Data } }] }], generationConfig: { temperature: 0.05 } }),
        signal: AbortSignal.timeout(5000),
      }
    ).then(async r => {
      const d = await r.json();
      const raw = (d.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      if (raw === 'NOT_FOOD') return 'NOT_FOOD' as any;
      // JSON 배열 파싱 시도, 실패 시 단일 문자열을 배열로 감싸기
      try {
        const stripped = raw.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(stripped);
        if (Array.isArray(parsed)) return parsed.map((s: any) => String(s).trim()).filter(Boolean);
      } catch { /* fallthrough */ }
      // 배열 파싱 실패 → 단일 이름으로 처리
      const cleaned = raw.replace(/["\n\[\]]/g, '').trim();
      return cleaned ? [cleaned] : [];
    }).catch(() => []);

    if (confirmedNames === 'NOT_FOOD' as any) {
      await refundAnalysisCredit(adminSupabase, userId);
      return NextResponse.json({ error: 'NOT_FOOD' }, { status: 422 });
    }

    // 단일 품목 + 과거 캐시에 동일 이름이 있으면 Gemini 본분석/한식DB 조회 없이 즉시 재사용
    // (Gemini 지연/실패 회피 + 호출 절감 목적. 복수 품목은 개별 영양소 분리가 안 되어 대상에서 제외)
    if (confirmedNames.length === 1 && foodCache && typeof foodCache === 'object') {
      const cached = foodCache[confirmedNames[0]];
      if (cached && typeof cached.calories === 'number' && cached.calories > 0) {
        await refundAnalysisCredit(adminSupabase, userId);
        return NextResponse.json({
          success: true,
          food: {
            name: confirmedNames[0],
            calories: cached.calories,
            category: cached.category ?? '',
            amount: '',
            confidence: 'high',
            nutrients: cached.nutrients ?? {},
            itemCount: 1,
          },
          source: 'cache',
          analysisStatus: { plan, used: Math.max(0, limitCheck.used - 1), limit: limitCheck.limit },
        });
      }
    }

    // 2단계: 확정된 이름 목록을 본분석에 주입 — 영양소 추정에만 집중
    // 식약처 DB 조회는 Gemini와 병렬 실행 (추가 지연 없음, 키 없으면 빈 Map)
    const nameList = confirmedNames as string[];
    const [geminiResult, dbMap] = await Promise.all([
      analyzeWithGemini(base64Data, apiKey, isPro, locale, nameList),
      locale === 'ko' && nameList.length > 0
        ? lookupKoreanFoodsDB(nameList)
        : Promise.resolve(new Map<string, FoodDbEntry>()),
    ]);

    if (!geminiResult.success) {
      await refundAnalysisCredit(adminSupabase, userId);
      return NextResponse.json({ error: geminiResult.error }, { status: 503 });
    }
    await logGeminiUsage(adminSupabase, {
      userId, plan, mode: 'vision',
      model: geminiResult.modelUsed!, tokensIn: geminiResult.tokensIn, tokensOut: geminiResult.tokensOut,
    });

    // 식약처 DB 매칭 품목은 DB 수치로 교체 — Gemini는 중량 추정 담당,
    // DB가 제공하지 않는 항목(식이섬유·비타민 등)은 Gemini 추정 유지
    const parseGrams = (amount: unknown): number | null => {
      const m = String(amount ?? '').match(/(\d+(?:\.\d+)?)\s*g/i);
      return m ? parseFloat(m[1]) : null;
    };

    let dbMatchedCount = 0;
    const items = geminiResult.items!.map((item: any) => {
      const entry = dbMap.get(normalizeFoodName(String(item?.name ?? '')));
      if (!entry) return item;
      const grams = parseGrams(item?.amount) ?? entry.basisGrams;
      const scale = grams / entry.basisGrams;
      const dbNutrients = Object.fromEntries(
        Object.entries(entry.nutrients)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, Math.round((v as number) * scale * 10) / 10])
      );
      dbMatchedCount++;
      return {
        ...item,
        calories: Math.round(entry.calories * scale),
        confidence: 'high',
        nutrients: { ...item.nutrients, ...dbNutrients },
      };
    });

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

    // 안전망: 1단계(flash-lite) 실패로 NOT_FOOD 체크를 건너뛴 경우에도
    // 본분석 결과가 0kcal이면 음식이 아닌 것으로 판정 (환불 후 422)
    if (totalCalories <= 0) {
      await refundAnalysisCredit(adminSupabase, userId);
      return NextResponse.json({ error: 'NOT_FOOD' }, { status: 422 });
    }

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

    return NextResponse.json({
      success: true,
      food: finalFood,
      source: dbMatchedCount > 0 ? 'korean_db+gemini' : 'gemini',
      modelUsed: geminiResult.modelUsed,
      analysisStatus: { plan, used: limitCheck.used, limit: limitCheck.limit },
    });

  } catch {
    if (creditConsumed && creditUserId) {
      const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
      await refundAnalysisCredit(adminSupabase, creditUserId);
    }
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
