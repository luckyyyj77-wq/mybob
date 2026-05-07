import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Storage 사진 전체 삭제 (해당 유저 폴더)
    const { data: files } = await adminSupabase.storage
      .from('meal_photos')
      .list(user.id, { limit: 1000 });

    if (files && files.length > 0) {
      // 월별 폴더 구조: {user_id}/{month}/{file}
      const { data: months } = await adminSupabase.storage
        .from('meal_photos')
        .list(user.id);

      if (months) {
        for (const month of months) {
          const { data: monthFiles } = await adminSupabase.storage
            .from('meal_photos')
            .list(`${user.id}/${month.name}`);

          if (monthFiles && monthFiles.length > 0) {
            const paths = monthFiles.map(f => `${user.id}/${month.name}/${f.name}`);
            await adminSupabase.storage.from('meal_photos').remove(paths);
          }
        }
      }
    }

    // DB meals 레코드 전체 삭제
    const { error } = await adminSupabase
      .from('meals')
      .delete()
      .eq('user_id', user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, message: '서버 데이터가 모두 삭제되었습니다.' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
