import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const lsApiKey = process.env.LS_API_KEY!;

export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 0. Lemon Squeezy 구독 해지 (있는 경우)
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('ls_subscription_id, plan')
      .eq('id', user.id)
      .single();

    if (profile?.ls_subscription_id && profile.plan === 'pro' && lsApiKey) {
      await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${profile.ls_subscription_id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${lsApiKey}`,
          Accept: 'application/vnd.api+json',
        },
      }).catch(() => {}); // 실패해도 탈퇴는 계속 진행
    }

    // 1. Supabase Storage 사진 삭제
    const { data: files } = await adminSupabase.storage
      .from('meal_photos')
      .list(`${user.id}`, { limit: 1000 });

    if (files && files.length > 0) {
      // 월별 폴더 내 파일까지 재귀 삭제
      for (const folder of files) {
        const { data: subFiles } = await adminSupabase.storage
          .from('meal_photos')
          .list(`${user.id}/${folder.name}`, { limit: 1000 });
        if (subFiles && subFiles.length > 0) {
          const paths = subFiles.map(f => `${user.id}/${folder.name}/${f.name}`);
          await adminSupabase.storage.from('meal_photos').remove(paths);
        }
      }
    }

    // 2. meals 테이블 삭제 (RLS 없이 service role로)
    await adminSupabase.from('meals').delete().eq('user_id', user.id);

    // 3. gemini_usage 삭제
    await adminSupabase.from('gemini_usage').delete().eq('user_id', user.id);

    // 4. friendships 삭제
    await adminSupabase.from('friendships')
      .delete()
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);

    // 5. auth.users 삭제 (profiles는 CASCADE로 자동 삭제)
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[auth/delete DELETE]', error?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
