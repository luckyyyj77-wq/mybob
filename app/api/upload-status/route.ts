import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const today = new Date().toISOString().slice(0, 10);

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('plan, uploads_today, last_upload_date')
    .eq('id', user.id)
    .single();

  const plan = (profile?.plan as 'free' | 'pro' | 'lifetime') || 'free';
  const limits = { free: 10, pro: 25, lifetime: 25 };
  const limit = limits[plan];
  const used = profile?.last_upload_date === today ? (profile?.uploads_today || 0) : 0;

  return NextResponse.json({ plan, used, limit, remaining: limit - used });
}
