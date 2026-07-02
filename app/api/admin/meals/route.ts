import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/admin-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const offset = parseInt(searchParams.get('offset') ?? '0');

    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let query = adminSupabase
      .from('meals')
      .select('id, user_id, food_name, category, calories, created_at, photo_url', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category && category !== 'all') query = query.eq('category', category);
    if (search) {
      if (search.length > 100) return NextResponse.json({ error: '검색어가 너무 깁니다.' }, { status: 400 });
      const escaped = search.replace(/[\\%_]/g, '\\$&');
      query = query.ilike('food_name', `%${escaped}%`);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [], total: count ?? 0 });
  } catch (error: any) {
    console.error('[admin/meals GET]', error?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
