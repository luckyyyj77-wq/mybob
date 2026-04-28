import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Helper function to get user from token
async function getUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  
  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) return null;
  return user;
}

export async function GET(request: Request) {
  console.log('GET /api/meals: Received request');
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, data: data });

  } catch (error: any) {
    console.error('GET /api/meals error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  console.log('POST /api/meals: Received request');
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mealData, imageBase64 } = await request.json();
    if (!mealData || !imageBase64) {
      return NextResponse.json({ error: 'Meal data and image are required.' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    let photo_url: string | null = null;

    // Image Upload
    try {
        const fileExtension = imageBase64.substring("data:image/".length, imageBase64.indexOf(";base64"));
        const fileName = `${user.id}/${uuidv4()}.${fileExtension}`;
        
        const { error: uploadError } = await supabase.storage
            .from('meal_photos')
            .upload(fileName, decodeBase64(imageBase64), {
                contentType: `image/${fileExtension}`,
                upsert: false,
            });

        if (uploadError) throw new Error(uploadError.message);

        const { data: publicUrlData } = supabase.storage
            .from('meal_photos')
            .getPublicUrl(fileName);
        
        photo_url = publicUrlData.publicUrl;
    } catch (uploadError: any) {
        console.error("Upload error:", uploadError);
        return NextResponse.json({ error: 'Failed to upload image.', details: uploadError.message }, { status: 500 });
    }

    const dataToInsert = {
      user_id: user.id,
      food_name: mealData.name,
      category: mealData.category || '기타',
      calories: mealData.calories,
      price: mealData.price || 0,
      location: mealData.location || '알 수 없음',
      nutrient: mealData.nutrients,
      amount: mealData.amount || 1,
      photo_url: photo_url,
    };

    const { data, error } = await supabase
      .from('meals')
      .insert([dataToInsert])
      .select();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, data: data });

  } catch (error: any) {
    console.error('POST /api/meals error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function decodeBase64(base64String: string): ArrayBuffer {
    const base64 = base64String.split(';base64,').pop() as string;
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}
