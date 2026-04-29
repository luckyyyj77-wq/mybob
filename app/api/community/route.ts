import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Helper function to get user from token
async function getUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
     // Guest mode fallback
     return { id: '00000000-0000-0000-0000-000000000000' };
  }
  
  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await supabase.auth.getUser(token);
  return user || { id: '00000000-0000-0000-0000-000000000000' };
}

export async function GET(request: Request) {
  try {
    const user = await getUser(request);
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // 본인의 식단 기록 중 사진이 있는 것만 가져옵니다.
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', user.id) // 본인 데이터로 제한
      .not('photo_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Community API Error:', error);
    return NextResponse.json({ error: '데이터를 가져오지 못했습니다.' }, { status: 500 });
  }
}
