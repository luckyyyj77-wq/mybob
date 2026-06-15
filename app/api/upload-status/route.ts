import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { UPLOAD_LIMITS, ANALYSIS_LIMITS } from '@/lib/plan';

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
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('plan, uploads_today, last_upload_date, analyses_today, last_analysis_date, ls_auto_cancel')
    .eq('id', user.id)
    .single();

  const plan = (profile?.plan as 'free' | 'pro' | 'lifetime') || 'free';

  const uploadLimit = UPLOAD_LIMITS[plan];
  const uploadUsed = profile?.last_upload_date === today ? (profile?.uploads_today || 0) : 0;

  const analysisLimit = ANALYSIS_LIMITS[plan];
  const analysisUsed = profile?.last_analysis_date === today ? (profile?.analyses_today || 0) : 0;

  return NextResponse.json({
    plan,
    upload: { used: uploadUsed, limit: uploadLimit, remaining: uploadLimit - uploadUsed },
    analysis: { used: analysisUsed, limit: analysisLimit, remaining: analysisLimit - analysisUsed },
    autoCancel: profile?.ls_auto_cancel ?? false,
  });
}
