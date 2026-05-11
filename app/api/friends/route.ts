import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// GET /api/friends — 내 친구 목록 + 받은/보낸 요청 목록
export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createClient(supabaseUrl, supabaseServiceRoleKey);

  // 수락된 친구 (내가 requester이거나 receiver)
  const { data: friends } = await db
    .from('friendships')
    .select(`
      id, status, created_at,
      requester:profiles!friendships_requester_id_fkey(id, nickname, avatar_url),
      receiver:profiles!friendships_receiver_id_fkey(id, nickname, avatar_url)
    `)
    .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .eq('status', 'accepted');

  // 받은 대기 요청
  const { data: incoming } = await db
    .from('friendships')
    .select(`
      id, created_at,
      requester:profiles!friendships_requester_id_fkey(id, nickname, avatar_url)
    `)
    .eq('receiver_id', user.id)
    .eq('status', 'pending');

  // 보낸 대기 요청
  const { data: outgoing } = await db
    .from('friendships')
    .select(`
      id, created_at,
      receiver:profiles!friendships_receiver_id_fkey(id, nickname, avatar_url)
    `)
    .eq('requester_id', user.id)
    .eq('status', 'pending');

  // 친구 목록에서 상대방 프로필만 추출
  const friendList = (friends ?? []).map((f: any) => {
    const other = f.requester?.id === user.id ? f.receiver : f.requester;
    return { friendshipId: f.id, ...other };
  });

  return NextResponse.json({
    friends: friendList,
    incoming: incoming ?? [],
    outgoing: outgoing ?? [],
  });
}

// POST /api/friends — 친구 요청 보내기 { nickname }
export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { nickname } = await request.json();
  if (!nickname?.trim()) return NextResponse.json({ error: '닉네임을 입력하세요.' }, { status: 400 });

  const db = createClient(supabaseUrl, supabaseServiceRoleKey);

  // 닉네임으로 상대방 찾기
  const { data: target } = await db
    .from('profiles')
    .select('id, nickname')
    .eq('nickname', nickname.trim())
    .single();

  if (!target) return NextResponse.json({ error: '해당 닉네임의 사용자를 찾을 수 없습니다.' }, { status: 404 });
  if (target.id === user.id) return NextResponse.json({ error: '자기 자신에게는 요청할 수 없습니다.' }, { status: 400 });

  // 이미 관계 있는지 확인
  const { data: existing } = await db
    .from('friendships')
    .select('id, status')
    .or(
      `and(requester_id.eq.${user.id},receiver_id.eq.${target.id}),and(requester_id.eq.${target.id},receiver_id.eq.${user.id})`
    )
    .single();

  if (existing) {
    const msg = existing.status === 'accepted' ? '이미 친구입니다.' : '이미 요청이 존재합니다.';
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const { error } = await db.from('friendships').insert({
    requester_id: user.id,
    receiver_id: target.id,
    status: 'pending',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, message: `${target.nickname}님에게 친구 요청을 보냈습니다.` });
}

// PATCH /api/friends — 요청 수락/거절 { friendshipId, action: 'accept'|'reject' }
export async function PATCH(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { friendshipId, action } = await request.json();
  if (!friendshipId || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const db = createClient(supabaseUrl, supabaseServiceRoleKey);

  // 본인이 receiver인 요청만 처리 가능
  const { data: friendship } = await db
    .from('friendships')
    .select('id, status')
    .eq('id', friendshipId)
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
    .single();

  if (!friendship) return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });

  if (action === 'accept') {
    await db.from('friendships').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', friendshipId);
    return NextResponse.json({ success: true, message: '친구 요청을 수락했습니다.' });
  } else {
    await db.from('friendships').delete().eq('id', friendshipId);
    return NextResponse.json({ success: true, message: '친구 요청을 거절했습니다.' });
  }
}

// DELETE /api/friends — 친구 삭제 { friendshipId }
export async function DELETE(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { friendshipId } = await request.json();
  const db = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { error } = await db
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
    .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
