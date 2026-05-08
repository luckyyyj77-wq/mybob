import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  // Pro 확인
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (!profile || profile.plan === 'free') {
    return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 403 });
  }

  const { imageBase64 } = await request.json();
  if (!imageBase64) return NextResponse.json({ error: '이미지가 없습니다.' }, { status: 400 });

  const match = imageBase64.match(/^data:image\/(jpeg|jpg|png|webp);base64,/);
  if (!match) return NextResponse.json({ error: '지원하지 않는 이미지 형식입니다.' }, { status: 400 });

  const ext = match[1] === 'jpg' ? 'jpeg' : match[1];
  const base64 = imageBase64.split(';base64,').pop() as string;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

  const storagePath = `avatars/${user.id}/${uuidv4()}.${ext}`;

  const { error: uploadError } = await adminSupabase.storage
    .from('meal_photos')
    .upload(storagePath, bytes.buffer, { contentType: `image/${ext}`, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = adminSupabase.storage.from('meal_photos').getPublicUrl(storagePath);

  // profiles에 avatar_url 저장
  await adminSupabase.from('profiles').upsert({
    id: user.id,
    avatar_url: urlData.publicUrl,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, avatar_url: urlData.publicUrl });
}
