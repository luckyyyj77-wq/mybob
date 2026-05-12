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

// GET /api/friends
export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createClient(supabaseUrl, supabaseServiceRoleKey);

  // 3개 쿼리 병렬 실행
  const [acceptedRes, incomingRes, outgoingRes] = await Promise.all([
    db.from('friendships')
      .select('id, requester_id, receiver_id')
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('status', 'accepted'),
    db.from('friendships')
      .select('id, requester_id, created_at')
      .eq('receiver_id', user.id)
      .eq('status', 'pending'),
    db.from('friendships')
      .select('id, receiver_id, created_at')
      .eq('requester_id', user.id)
      .eq('status', 'pending'),
  ]);

  const acceptedRows = acceptedRes.data ?? [];
  const incomingRows = incomingRes.data ?? [];
  const outgoingRows = outgoingRes.data ?? [];

  // 필요한 모든 프로필 ID 수집 후 한 번에 조회
  const profileIds = new Set<string>();
  acceptedRows.forEach(f => {
    profileIds.add(f.requester_id === user.id ? f.receiver_id : f.requester_id);
  });
  incomingRows.forEach(f => profileIds.add(f.requester_id));
  outgoingRows.forEach(f => profileIds.add(f.receiver_id));

  const profileMap: Record<string, any> = {};
  if (profileIds.size > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, nickname, avatar_url')
      .in('id', Array.from(profileIds));
    (profiles ?? []).forEach(p => { profileMap[p.id] = p; });
  }

  const friends = acceptedRows.map(f => {
    const otherId = f.requester_id === user.id ? f.receiver_id : f.requester_id;
    const p = profileMap[otherId] ?? { id: otherId, nickname: '알 수 없음', avatar_url: null };
    return { friendshipId: f.id, ...p };
  });

  const incoming = incomingRows.map(f => ({
    id: f.id,
    created_at: f.created_at,
    requester: profileMap[f.requester_id] ?? { id: f.requester_id, nickname: '알 수 없음', avatar_url: null },
  }));

  const outgoing = outgoingRows.map(f => ({
    id: f.id,
    created_at: f.created_at,
    receiver: profileMap[f.receiver_id] ?? { id: f.receiver_id, nickname: '알 수 없음', avatar_url: null },
  }));

  return NextResponse.json({ friends, incoming, outgoing });
}

const MAX_FRIENDS = 200;        // 최대 이웃 수
const MAX_PENDING_OUT = 30;     // 보낸 요청 대기 최대
const DAILY_REQUEST_LIMIT = 20; // 하루 최대 요청 수
const BURST_LIMIT = 10;         // 연속 요청 한도 (1시간 내)

// POST /api/friends — 이웃 요청
export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { nickname } = await request.json();
  if (!nickname?.trim()) return NextResponse.json({ error: '닉네임을 입력하세요.' }, { status: 400 });

  const db = createClient(supabaseUrl, supabaseServiceRoleKey);

  // ── 한도 체크 병렬 실행 ──────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [acceptedRes, pendingOutRes, dailyRes, burstRes] = await Promise.all([
    // 현재 이웃 수
    db.from('friendships')
      .select('id', { count: 'exact', head: true })
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('status', 'accepted'),
    // 보낸 요청 대기 중 수
    db.from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('requester_id', user.id)
      .eq('status', 'pending'),
    // 오늘 보낸 요청 수
    db.from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('requester_id', user.id)
      .gte('created_at', `${today}T00:00:00.000Z`),
    // 최근 1시간 내 보낸 요청 수 (연속 요청 방지)
    db.from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('requester_id', user.id)
      .gte('created_at', oneHourAgo),
  ]);

  if ((acceptedRes.count ?? 0) >= MAX_FRIENDS) {
    return NextResponse.json({ error: `이웃은 최대 ${MAX_FRIENDS}명까지 가능합니다.` }, { status: 429 });
  }
  if ((pendingOutRes.count ?? 0) >= MAX_PENDING_OUT) {
    return NextResponse.json({ error: `대기 중인 요청이 ${MAX_PENDING_OUT}개를 초과했습니다. 수락되지 않은 요청을 취소해 주세요.` }, { status: 429 });
  }
  if ((dailyRes.count ?? 0) >= DAILY_REQUEST_LIMIT) {
    return NextResponse.json({ error: `오늘 이웃 요청 한도(${DAILY_REQUEST_LIMIT}회)를 초과했습니다. 내일 다시 시도해 주세요.` }, { status: 429 });
  }
  if ((burstRes.count ?? 0) >= BURST_LIMIT) {
    return NextResponse.json({ error: `연속 요청이 많습니다. 1시간 후에 다시 시도해 주세요.` }, { status: 429 });
  }
  // ────────────────────────────────────────────────────────────────

  const { data: target } = await db
    .from('profiles')
    .select('id, nickname')
    .eq('nickname', nickname.trim())
    .maybeSingle();

  if (!target) return NextResponse.json({ error: '해당 닉네임의 사용자를 찾을 수 없습니다.' }, { status: 404 });
  if (target.id === user.id) return NextResponse.json({ error: '자기 자신에게는 요청할 수 없습니다.' }, { status: 400 });

  const { data: existing } = await db
    .from('friendships')
    .select('id, status')
    .or(`and(requester_id.eq.${user.id},receiver_id.eq.${target.id}),and(requester_id.eq.${target.id},receiver_id.eq.${user.id})`)
    .maybeSingle();

  if (existing) {
    const msg = existing.status === 'accepted' ? '이미 이웃입니다.' : '이미 요청을 보냈습니다.';
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
    .select('id')
    .eq('id', friendshipId)
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (!friendship) return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });

  if (action === 'accept') {
    await db.from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendshipId);
    return NextResponse.json({ success: true, message: '이웃이 되었습니다!' });
  } else {
    await db.from('friendships').delete().eq('id', friendshipId);
    return NextResponse.json({ success: true, message: '요청을 거절했습니다.' });
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
