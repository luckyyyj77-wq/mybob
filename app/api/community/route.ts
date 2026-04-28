import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // 최근 30개의 식단 기록을 가져옵니다. (사진이 있는 것 위주로)
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .not('photo_url', 'is', null) // 사진이 있는 데이터 우선
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Community API Error:', error);
    return NextResponse.json({ error: '데이터를 가져오지 못했습니다.' }, { status: 500 });
  }
}
