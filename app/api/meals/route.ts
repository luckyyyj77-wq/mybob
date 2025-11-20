import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: Request) {
  console.log('GET /api/meals: Received request');
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('GET /api/meals: Unauthorized - No user found.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log(`GET /api/meals: Authenticated user ID: ${user.id}`);

    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('GET /api/meals: Supabase Select Error:', error);
      throw new Error(error.message);
    }

    console.log(`GET /api/meals: Successfully fetched ${data.length} meals.`);
    return NextResponse.json({ success: true, data: data });

  } catch (error) {
    console.error('GET /api/meals: Internal Server Error:', error);
    if (error instanceof Error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  console.log('POST /api/meals: Received request');
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('POST /api/meals: Unauthorized - No user found.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log(`POST /api/meals: Authenticated user ID: ${user.id}`);

    const { mealData, imageBase64 } = await request.json();

    if (!mealData || !imageBase64) {
      return NextResponse.json({ error: 'Meal data and image are required.' }, { status: 400 });
    }

    let photo_url: string | null = null;
    console.log('POST /api/meals: Starting image upload to Supabase Storage...');
    try {
        const fileExtension = imageBase64.substring("data:image/".length, imageBase64.indexOf(";base64"));
        const fileName = `${user.id}/${uuidv4()}.${fileExtension}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('meal_photos')
            .upload(fileName, decodeBase64(imageBase64), {
                contentType: `image/${fileExtension}`,
                upsert: false,
            });

        if (uploadError) {
            console.error('POST /api/meals: Supabase Storage Upload Error:', uploadError);
            throw new Error(`Image upload failed: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
            .from('meal_photos')
            .getPublicUrl(fileName);
        
        if (publicUrlData) {
            photo_url = publicUrlData.publicUrl;
            console.log(`POST /api/meals: Image uploaded successfully. URL: ${photo_url}`);
        }

    } catch (uploadError) {
        console.error("POST /api/meals: Error uploading image to Supabase Storage:", uploadError);
        return NextResponse.json({ error: 'Failed to upload image.', details: uploadError instanceof Error ? uploadError.message : String(uploadError) }, { status: 500 });
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

    console.log('POST /api/meals: Inserting meal data into database:', dataToInsert);
    const { data, error } = await supabase
      .from('meals')
      .insert([dataToInsert])
      .select();

    if (error) {
      console.error('POST /api/meals: Supabase Insert Error:', error);
      throw new Error(error.message);
    }

    console.log('POST /api/meals: Meal data inserted successfully.');
    return NextResponse.json({ success: true, data: data });

  } catch (error) {
    console.error('POST /api/meals: Internal Server Error:', error);
    if (error instanceof Error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
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

