import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkUploadLimit, incrementUploadCount } from '@/lib/plan';

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

// 텍스트로 음식 칼로리/영양소 추정 (이미지 없음, AI 분석 횟수 미소모)
async function estimateNutrition(foodName: string): Promise<{
  calories: number;
  category: string;
  nutrients: { carbohydrates: number; protein: number; fat: number; fiber: number; sodium: number };
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
    }
  );

  if (!res.ok) throw new Error('Gemini API 호출 실패');
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned);
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { foodName, mealTime, createdAt } = body as {
      foodName: string;
      mealTime: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'latenight';
      createdAt: string;
    };

    if (!foodName?.trim()) return NextResponse.json({ error: 'foodName required' }, { status: 400 });
    if (foodName.trim().length > 100) return NextResponse.json({ error: '음식명은 100자 이내여야 합니다.' }, { status: 400 });

    // 업로드 횟수 체크 (AI 분석 횟수는 소모 안 함)
    const supabaseService = createClient(supabaseUrl, supabaseServiceRoleKey);
    const limitCheck = await checkUploadLimit(supabaseService, user.id);
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: 'UPLOAD_LIMIT_EXCEEDED', used: limitCheck.used, limit: limitCheck.limit }, { status: 429 });
    }

    const nutrition = await estimateNutrition(foodName.trim());

    // 클라우드 저장
    const { data: inserted, error: insertError } = await supabaseService
      .from('meals')
      .insert({
        user_id: user.id,
        food_name: foodName.trim(),
        calories: nutrition.calories,
        category: nutrition.category,
        nutrient: nutrition.nutrients,
        photo_url: null,
        meal_time: mealTime,
        created_at: createdAt,
        is_manual: true,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await incrementUploadCount(supabaseService, user.id);

    return NextResponse.json({ success: true, data: inserted, nutrition });

  } catch (error: any) {
    console.error('[quick-log POST]', error?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
