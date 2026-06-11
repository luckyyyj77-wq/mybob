import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminEmail = process.env.ADMIN_EMAIL!;
const lsApiKey = process.env.LS_API_KEY!;

async function verifyAdmin(request: Request) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.split(' ')[1];
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user || user.email !== adminEmail) return null;
  return user;
}

// 구독 중인 유저 목록 조회
export async function GET(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const adminSb = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profiles } = await adminSb
      .from('profiles')
      .select('id, plan, ls_subscription_id, ls_auto_cancel, updated_at')
      .neq('plan', 'free')
      .order('updated_at', { ascending: false });

    const { data: usersData } = await adminSb.auth.admin.listUsers();
    const userMap = Object.fromEntries(
      (usersData?.users ?? []).map(u => [u.id, { email: u.email, created_at: u.created_at }])
    );

    const result = (profiles ?? []).map(p => ({
      id: p.id,
      email: userMap[p.id]?.email ?? '—',
      created_at: userMap[p.id]?.created_at ?? null,
      plan: p.plan,
      ls_subscription_id: p.ls_subscription_id ?? null,
      ls_auto_cancel: p.ls_auto_cancel ?? false,
      plan_updated_at: p.updated_at,
    }));

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[admin/subscriptions GET]', error?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 관리자 수동 구독 해지
export async function DELETE(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });

    const adminSb = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile } = await adminSb
      .from('profiles')
      .select('ls_subscription_id, plan')
      .eq('id', userId)
      .single();

    if (profile?.ls_subscription_id && lsApiKey) {
      await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${profile.ls_subscription_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${lsApiKey}`, Accept: 'application/vnd.api+json' },
      });
    }

    await adminSb.from('profiles').update({
      plan: 'free',
      ls_subscription_id: null,
      ls_auto_cancel: false,
      updated_at: new Date().toISOString(),
    }).eq('id', userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[admin/subscriptions DELETE]', error?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
