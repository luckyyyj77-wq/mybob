import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { checkUploadLimit, incrementUploadCount } from '@/lib/plan';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 토큰으로 사용자 인증 — 실패 시 null 반환 (게스트 폴백 없음)
async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// 날짜별 폴더로 경로 분리: {user_id}/2026-05/{uuid}.jpg
function buildStoragePath(userId: string, extension: string): string {
  const month = new Date().toISOString().slice(0, 7); // "2026-05"
  return `${userId}/${month}/${uuidv4()}.${extension}`;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 조회는 anon key + RLS로 충분
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: request.headers.get('Authorization')! } },
    });
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mealData, imageBase64 } = await request.json();
    if (!mealData || !imageBase64) {
      return NextResponse.json({ error: 'mealData and imageBase64 are required.' }, { status: 400 });
    }

    // 이미지 확장자 추출 및 허용된 타입만 허용
    const match = imageBase64.match(/^data:image\/(jpeg|jpg|png|webp);base64,/);
    if (!match) {
      return NextResponse.json({ error: '지원하지 않는 이미지 형식입니다.' }, { status: 400 });
    }
    const fileExtension = match[1] === 'jpg' ? 'jpeg' : match[1];

    // 업로드·쓰기는 service role key (Storage RLS 우회 필요)
    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 일일 업로드 제한 체크
    const limitCheck = await checkUploadLimit(adminSupabase, user.id);
    if (!limitCheck.allowed) {
      return NextResponse.json({
        error: 'UPLOAD_LIMIT_EXCEEDED',
        plan: limitCheck.plan,
        used: limitCheck.used,
        limit: limitCheck.limit,
      }, { status: 429 });
    }

    // 날짜별 폴더로 업로드 (실패해도 식단 데이터는 저장)
    let photoUrl: string | null = null;
    try {
      const storagePath = buildStoragePath(user.id, fileExtension);
      const { error: uploadError } = await adminSupabase.storage
        .from('meal_photos')
        .upload(storagePath, decodeBase64(imageBase64), {
          contentType: `image/${fileExtension}`,
          upsert: false,
        });

      if (uploadError) {
        console.error('[meals POST] storage upload error:', uploadError.message);
      } else {
        const { data: publicUrlData } = adminSupabase.storage
          .from('meal_photos')
          .getPublicUrl(storagePath);
        photoUrl = publicUrlData.publicUrl;
      }
    } catch (storageErr: any) {
      console.error('[meals POST] storage exception:', storageErr?.message);
    }

    const dataToInsert = {
      user_id: user.id,
      food_name: mealData.name || mealData.food_name || '알 수 없음',
      category: mealData.category || '기타',
      calories: Number(mealData.calories) || 0,
      nutrient: mealData.nutrients ?? mealData.nutrient ?? null,
      amount: mealData.amount || null,
      price: mealData.price || null,
      location: mealData.location || null,
      photo_url: photoUrl,
    };

    console.log('[meals POST] dataToInsert =', JSON.stringify(dataToInsert));

    const { data, error } = await adminSupabase
      .from('meals')
      .insert([dataToInsert])
      .select();

    if (error) {
      console.error('[meals POST] insert error:', error.message, error.details, error.hint);
      throw new Error(`INSERT 실패: ${error.message} | ${error.details ?? ''}`);
    }

    // 저장 성공 후 카운트 증가
    await incrementUploadCount(adminSupabase, user.id);

    return NextResponse.json({
      success: true,
      data,
      uploadStatus: { used: limitCheck.used + 1, limit: limitCheck.limit, plan: limitCheck.plan },
    });

  } catch (error: any) {
    console.error('[meals POST] caught error:', error);
    return NextResponse.json({
      error: error.message ?? String(error),
      stack: error.stack ?? null,
    }, { status: 500 });
  }
}

function decodeBase64(base64String: string): ArrayBuffer {
  const base64 = base64String.split(';base64,').pop() as string;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
