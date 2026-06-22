import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminEmail = process.env.ADMIN_EMAIL!;

async function verifyAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user } } = await supabase.auth.getUser(authHeader.split(' ')[1]);
  if (!user || user.email !== adminEmail) return null;
  return user;
}

// GET: 배너 설정 조회 (인증 불필요 — 앱 전체에서 호출)
export async function GET() {
  const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await adminSupabase
    .from('app_settings')
    .select('value')
    .eq('key', 'banner')
    .single();

  if (error || !data) return NextResponse.json({ banner: null });
  return NextResponse.json({ banner: data.value });
}

// POST: 배너 설정 저장 (관리자 전용)
export async function POST(request: Request) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { message, type, active } = await request.json();
  if (message && message.length > 200) {
    return NextResponse.json({ error: '메시지는 200자 이내' }, { status: 400 });
  }

  const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { error } = await adminSupabase
    .from('app_settings')
    .upsert({ key: 'banner', value: { message: message || '', type: type || 'info', active: !!active } }, { onConflict: 'key' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
