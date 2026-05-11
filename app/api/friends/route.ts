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

async function getProfile(db: any, id: string) {
  const { data } = await db.from('profiles').select('id, nickname, avatar_url').eq('id', id).single();
  return data;
}

// GET /api/friends
export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createClient(supabaseUrl, supabaseServiceRoleKey);

  // 수락된 친구
  const { data: acceptedRows } = await db
    .from('friendships')
    .select('id, requester_id, receiver_id')
    .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .eq('status', 'accepted');

  // 받은 대기 요청
  const { data: incomingRows } = await db
    .from('friendships')
    .select('id, requester_id, created_at')
    .eq('receiver_id', user.id)
    .eq('status', 'pending');

  // 보낸 대기 요청
  const { data: outgoingRows } = await db
    .from('friendships')
    .select('id, receiver_id, created_at')
    .eq('requester_id', user.id)
    .eq('status', 'pending');

  // 프로필 병렬 로드
  const friendList = await Promise.all(
    (acceptedRows ?? []).map(async (f) => {
      const otherId = f.requester_id === user.id ? f.receiver_id : f.requester_id;
      const profile = await getProfile(db, otherId);
      return { friendshipId: f.id, ...(profile ?? { id: otherId, nickname: '알 수 없음', avatar_url: null }) };
    })
  );

  const incoming = await Promise.all(
    (incomingRows ?? []).map(async (f) => {
      const profile = await getProfile(db, f.requester_id);
      return { id: f.id, created_at: f.created_at, requester: profile ?? { id: f.requester_id, nickname: '알 수 없음', avatar_url: null } };
    })
  );

  const outgoing = await Promise.all(
    (outgoingRows ?? []).map(async (f) => {
      const profile = await getProfile(db, f.receiver_id);
      return { id: f.id, created_at: f.created_at, receiver: profile ?? { id: f.receiver_id, nickname: '알 수 없음', avatar_url: null } };
    })
  );

  return NextResponse.json({ friends: friendList, incoming, outgoing });
}

// POST /api/friends — 친구 요청 보내기
export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { nickname } = await request.json();
  if (!nickname?.trim()) return NextResponse.json({ error: '닉네임을 입력하세요.' }, { status: 400 });

  const db = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: target } = await db
    .from('profiles')
    .select('id, nickname')
    .eq('nickname', nickname.trim())
    .maybeSingle();

  if (!target) return NextResponse.json({ error: '해당 닉네임의 사용자를 찾을 수 없습니다.' }, { status: 404 });
  if (target.id === user.id) return NextResponse.json({ error: '자기 자신에게는 요청할 수 없습니다.' }, { status: 400 });

  // 이미 관계 있는지 확인 (maybeSingle — 없으면 null)
  const { data: existing } = await db
    .from('friendships')
    .select('id, status')
    .or(`and(requester_id.eq.${user.id},receiver_id.eq.${target.id}),and(requester_id.eq.${target.id},receiver_id.eq.${user.id})`)
    .maybeSingle();

  if (existing) {
    const msg = existing.status === 'accepted' ? '이미 이웃입니다.' : '이미 요청이 존재합니다.';
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const { error } = await db.from('friendships').insert({
    requester_id: user.id,
    receiver_id: target.id,
    status: 'pending',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, message: `${target.nickname}님에게 이웃 요청을 보냈습니다.` });
}

// PATCH /api/friends — 수락/거절
export async function PATCH(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { friendshipId, action } = await request.json();
  if (!friendshipId || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const db = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: friendship } = await db
    .from('friendships')
    .select('id, status')
    .eq('id', friendshipId)
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (!friendship) return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });

  if (action === 'accept') {
    await db.from('friendships').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', friendshipId);
    return NextResponse.json({ success: true, message: '이웃 요청을 수락했습니다.' });
  } else {
    await db.from('friendships').delete().eq('id', friendshipId);
    return NextResponse.json({ success: true, message: '이웃 요청을 거절했습니다.' });
  }
}

// DELETE /api/friends — 이웃 삭제
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
