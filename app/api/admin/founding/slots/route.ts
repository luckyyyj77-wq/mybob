import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/admin-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await adminSupabase.from('founding_slots').select('*').eq('id', 1).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
