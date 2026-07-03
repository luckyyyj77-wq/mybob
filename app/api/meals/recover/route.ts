// 미인식 식단 복구 — 사용자가 입력한 음식 이름으로 영양정보를 받아 기존 식단을 채움
//
// 흐름: 식약처 DB 조회 + Gemini 텍스트 추정 병렬 실행
//   - DB 매칭 + 1인분 중량(Z10500) 있으면 → DB 수치를 1인분으로 환산해 우선 사용
//   - 아니면 Gemini 추정(1인분 기준) 사용
// mealId가 서버 UUID면 meals 행도 함께 업데이트 (로컬 모드는 클라이언트가 localStorage 처리)
// AI 분석 크레딧 1회 차감 (실패 시 환불)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { consumeAnalysisCredit, refundAnalysisCredit } from '@/lib/plan';
import { lookupKoreanFoodDB } from '@/lib/food-db';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const geminiApiKey = process.env.GEMINI_API_KEY!;

async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// 텍스트로 1인분 영양정보 추정 (quick-log와 동일 방식)
async function estimateNutrition(foodName: string): Promise<{
  calories: number;
  category: string;
  nutrients: Record<string, number>;
}> {
  const prompt = `다음 음식의 1인분 기준 영양정보를 JSON으로 반환해. 음식명: "${foodName}"

응답 형식 (JSON만, 설명 없이):
{
  "calories": 숫자,
  "category": "한식|중식|일식|양식|간식|음료|기타" 중 하나,
  "nutrients": {
    "carbohydrates": 숫자(g),
    "protein": 숫자(g),
    "fat": 숫자(g),
    "fiber": 숫자(g),
    "sugar": 숫자(g),
    "sodium": 숫자(mg)
  }
}

음식을 모르면 비슷한 음식 기준으로 추정해. 반드시 JSON만 반환.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!res.ok) throw new Error('Gemini API 호출 실패');
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned);
}

export async function POST(request: Request) {
  let creditConsumed = false;
  let creditUserId: string | null = null;
  const supabaseService = createClient(supabaseUrl, supabaseServiceRoleKey);
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { mealId, foodName, portion = 1 } = body as {
      mealId?: string;
      foodName: string;
      portion?: number;
    };

    if (!foodName?.trim()) return NextResponse.json({ error: 'foodName required' }, { status: 400 });
    if (foodName.trim().length > 100) return NextResponse.json({ error: '음식명은 100자 이내여야 합니다.' }, { status: 400 });
    const safePortion = [1, 0.5, 0.25].includes(portion) ? portion : 1;

    const limitCheck = await consumeAnalysisCredit(supabaseService, user.id);
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: 'ANALYSIS_LIMIT_EXCEEDED', used: limitCheck.used, limit: limitCheck.limit }, { status: 429 });
    }
    creditConsumed = true;
    creditUserId = user.id;

    const name = foodName.trim();
    const [geminiResult, dbEntry] = await Promise.allSettled([
      estimateNutrition(name),
      lookupKoreanFoodDB(name),
    ]).then(([g, d]) => [
      g.status === 'fulfilled' ? g.value : null,
      d.status === 'fulfilled' ? d.value : null,
    ] as const);

    if (!geminiResult && !dbEntry) {
      await refundAnalysisCredit(supabaseService, user.id);
      return NextResponse.json({ error: '영양정보 조회에 실패했습니다.' }, { status: 503 });
    }

    // 1인분 기준 base 수치 결정: 식약처 DB(1인분 중량 있을 때) 우선, 나머지는 Gemini
    let baseCalories = geminiResult?.calories ?? 0;
    let baseNutrients: Record<string, number> = { ...(geminiResult?.nutrients ?? {}) };
    let source = 'gemini';

    if (dbEntry && dbEntry.servingGrams) {
      const factor = dbEntry.servingGrams / dbEntry.basisGrams;
      baseCalories = Math.round(dbEntry.calories * factor);
      for (const [k, v] of Object.entries(dbEntry.nutrients)) {
        if (v != null) baseNutrients[k] = Math.round(v * factor * 10) / 10;
      }
      source = 'korean_db';
    }

    if (!baseCalories || baseCalories <= 0) {
      await refundAnalysisCredit(supabaseService, user.id);
      return NextResponse.json({ error: '영양정보 조회에 실패했습니다.' }, { status: 503 });
    }

    const category = geminiResult?.category ?? '기타';
    const scaledCalories = Math.round(baseCalories * safePortion);
    const scaledNutrients = Object.fromEntries(
      Object.entries(baseNutrients).map(([k, v]) => [k, Math.round(v * safePortion * 10) / 10])
    );

    // 서버 식단이면 DB 행 업데이트 (본인 소유만)
    const isUuid = mealId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mealId);
    if (isUuid) {
      const { error: updateError } = await supabaseService
        .from('meals')
        .update({
          food_name: name,
          calories: scaledCalories,
          category,
          nutrient: scaledNutrients,
          original_nutrition: { calories: baseCalories, nutrients: baseNutrients },
        })
        .eq('id', mealId)
        .eq('user_id', user.id);
      if (updateError) throw updateError;
    }

    return NextResponse.json({
      success: true,
      food: { name, calories: scaledCalories, category, nutrients: scaledNutrients, source },
      base: { calories: baseCalories, nutrients: baseNutrients },
    });

  } catch (error: any) {
    console.error('[meals/recover POST]', error?.message);
    if (creditConsumed && creditUserId) {
      await refundAnalysisCredit(supabaseService, creditUserId);
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
