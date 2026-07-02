import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAnalysisLimit, incrementAnalysisCount } from '@/lib/plan';

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

async function analyzeWithGemini(
  base64Data: string, apiKey: string, isPro: boolean, locale: string, confirmedNames: string[]
): Promise<{ success: boolean; items?: any[]; modelUsed?: string; error?: string }> {
  const modelsToTry = isPro
    ? ['gemini-2.5-pro', 'gemini-2.5-flash']
    : ['gemini-2.5-flash', 'gemini-2.0-flash'];
  const prompt = buildNutritionPrompt(locale, confirmedNames);
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
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const userId = user.id;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const limitCheck = await checkAnalysisLimit(adminSupabase, user.id);
    if (!limitCheck.allowed) return NextResponse.json({ error: 'ANALYSIS_LIMIT_EXCEEDED', used: limitCheck.used, limit: limitCheck.limit }, { status: 429 });
    const plan = limitCheck.plan;

    const MAX_BASE64_BYTES = 10 * 1024 * 1024; // 10MB base64 (~7.5MB 원본)
    if (image.length > MAX_BASE64_BYTES) {
      return NextResponse.json({ error: 'IMAGE_TOO_LARGE' }, { status: 413 });
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

    // 1단계: flash-lite로 음식 목록 확정 (NOT_FOOD 체크 겸용) — 빠르게 선행
    const namePrompt = locale === 'en'
      ? 'List all distinct foods and drinks visible in this image. Reply with ONLY a JSON array of specific names, e.g. ["Iced Americano", "Kimchi Jjigae", "Rice"]. If there is nothing edible, reply exactly: NOT_FOOD'
      : '이 이미지에 보이는 모든 음식과 음료를 나열하세요. 구체적인 이름을 JSON 배열로만 답하세요 (예: ["아이스 아메리카노", "김치찌개", "공기밥"]). 먹을 수 있는 것이 없으면 정확히 NOT_FOOD 라고만 답하세요.';

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
      return NextResponse.json({ error: 'NOT_FOOD' }, { status: 422 });
    }

    // 2단계: 확정된 이름 목록을 본분석에 주입 — 영양소 추정에만 집중
    const geminiResult = await analyzeWithGemini(base64Data, apiKey, isPro, locale, confirmedNames as string[]);

    if (!geminiResult.success) return NextResponse.json({ error: geminiResult.error }, { status: 503 });

    const items = geminiResult.items!;

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

    if (userId) {
      const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
      await incrementAnalysisCount(adminSupabase, userId);
    }

    return NextResponse.json({
      success: true,
      food: finalFood,
      source: 'gemini',
      analysisStatus: { plan },
    });

  } catch {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
