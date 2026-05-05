import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

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

    // 날짜별 폴더로 업로드
    const storagePath = buildStoragePath(user.id, fileExtension);
    const { error: uploadError } = await adminSupabase.storage
      .from('meal_photos')
      .upload(storagePath, decodeBase64(imageBase64), {
        contentType: `image/${fileExtension}`,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: '이미지 업로드 실패', details: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = adminSupabase.storage
      .from('meal_photos')
      .getPublicUrl(storagePath);

    const dataToInsert = {
      user_id: user.id,
      food_name: mealData.name,
      category: mealData.category || '기타',
      calories: mealData.calories,
      price: mealData.price || 0,
      location: mealData.location || '알 수 없음',
      nutrient: mealData.nutrients,
      amount: mealData.amount || 1,
      photo_url: publicUrlData.publicUrl,
    };

    const { data, error } = await adminSupabase
      .from('meals')
      .insert([dataToInsert])
      .select();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
