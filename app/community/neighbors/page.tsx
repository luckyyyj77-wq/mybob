"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { FaUserPlus, FaCheck, FaTimes, FaUserMinus, FaUndo } from 'react-icons/fa';

interface Profile { id: string; nickname: string; avatar_url?: string }
interface Friend { friendshipId: string; id: string; nickname: string; avatar_url?: string }
interface IncomingRequest { id: string; created_at: string; requester: Profile }
interface OutgoingRequest { id: string; created_at: string; receiver: Profile }

function Skeleton({ width, height }: { width: string | number; height: number }) {
  return (
    <div style={{
      width, height, backgroundColor: '#f3f4f6', borderRadius: 2,
      animation: 'shimmer 1.4s ease infinite',
    }} />
  );
}

function Avatar({ nickname, avatarUrl, size = 40 }: { nickname: string; avatarUrl?: string; size?: number }) {
  const initials = nickname.replace(/[_0-9]/g, '').slice(0, 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', flexShrink: 0, fontSize: size * 0.28, color: '#9ca3af',
    }}>
      {avatarUrl
        ? <img src={avatarUrl} alt={nickname} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials || '?'
      }
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{ backgroundColor: 'white', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#f3f4f6', flexShrink: 0, animation: 'shimmer 1.4s ease infinite' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width={120} height={13} />
        <Skeleton width={80} height={11} />
      </div>
    </div>
  );
}

export default function NeighborsPage() {
  const [tab, setTab] = useState<'friends' | 'requests' | 'add'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [searchNick, setSearchNick] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const t = session?.access_token ?? null;
      setToken(t);
      if (t) loadFriends(t);
      else setLoading(false);
    });
  }, []);

  const loadFriends = useCallback(async (t: string) => {
    try {
      const res = await fetch('/api/friends', { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      if (res.ok) {
        setFriends(data.friends ?? []);
        setIncoming(data.incoming ?? []);
        setOutgoing(data.outgoing ?? []);
      }
    } catch { }
    setLoading(false);
  }, []);

  const withActionLoading = async (id: string, fn: () => Promise<void>) => {
    setActionLoading(p => ({ ...p, [id]: true }));
    await fn();
    setActionLoading(p => { const n = { ...p }; delete n[id]; return n; });
  };

  const handleSendRequest = async () => {
    if (!token || !searchNick.trim()) return;
    setSendLoading(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nickname: searchNick.trim() }),
      });
      const data = await res.json();
      setSendResult({ ok: res.ok, msg: data.message || data.error });
      if (res.ok) {
        setSearchNick('');
        loadFriends(token);
        setTab('requests');
      }
    } catch {
      setSendResult({ ok: false, msg: '요청 실패. 다시 시도해주세요.' });
    }
    setSendLoading(false);
  };

  const handleAccept = async (id: string) => {
    if (!token) return;
    await withActionLoading(id, async () => {
      const res = await fetch('/api/friends', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ friendshipId: id, action: 'accept' }),
      });
      if (res.ok) {
        // 낙관적 업데이트 — API 재호출 없이 즉시 반영
        const req = incoming.find(r => r.id === id);
        if (req) {
          setIncoming(p => p.filter(r => r.id !== id));
          setFriends(p => [...p, { friendshipId: id, ...req.requester }]);
        }
      }
    });
  };

  const handleReject = async (id: string) => {
    if (!token) return;
    await withActionLoading(id, async () => {
      await fetch('/api/friends', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ friendshipId: id, action: 'reject' }),
      });
      setIncoming(p => p.filter(r => r.id !== id));
    });
  };

  const handleCancelRequest = async (id: string) => {
    if (!token) return;
    await withActionLoading(id, async () => {
      await fetch('/api/friends', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ friendshipId: id }),
      });
      setOutgoing(p => p.filter(r => r.id !== id));
    });
  };

  const handleRemove = async (friendshipId: string) => {
    if (!token) return;
    await withActionLoading(friendshipId, async () => {
      await fetch('/api/friends', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ friendshipId }),
      });
      setFriends(p => p.filter(f => f.friendshipId !== friendshipId));
    });
  };

  const incomingCount = incoming.length;

  return (
    <div>
      <style>{`
        @keyframes shimmer {
          0% { opacity: 1 } 50% { opacity: 0.4 } 100% { opacity: 1 }
        }
      `}</style>

      {/* 서브탭 */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white', position: 'sticky', top: 0, zIndex: 1 }}>
        {([
          { key: 'friends', label: `이웃${!loading ? ` ${friends.length}` : ''}` },
          { key: 'requests', label: `요청${incomingCount > 0 ? ` · ${incomingCount}` : ''}` },
          { key: 'add', label: '+ 추가' },
        ] as { key: typeof tab; label: string }[]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '12px 0', fontSize: '12px', letterSpacing: '0.5px',
            border: 'none', cursor: 'pointer', backgroundColor: 'white',
            color: tab === t.key ? '#6B21A8' : '#9ca3af',
            borderBottom: tab === t.key ? '2px solid #6B21A8' : '2px solid transparent',
            transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px' }}>

        {/* 이웃 목록 */}
        {tab === 'friends' && (
          loading ? (
            <div style={{ border: '1px solid #e5e7eb' }}>
              {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
            </div>
          ) : friends.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: '60px' }}>
              <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '8px' }}>아직 이웃이 없습니다.</p>
              <button onClick={() => setTab('add')} style={{ fontSize: '12px', color: '#6B21A8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                이웃 추가하기
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e5e7eb' }}>
              {friends.map((f) => (
                <div key={f.friendshipId} style={{ backgroundColor: 'white', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f3f4f6' }}>
                  <Avatar nickname={f.nickname} avatarUrl={f.avatar_url} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', color: 'black' }}>{f.nickname}</p>
                  </div>
                  <button
                    onClick={() => handleRemove(f.friendshipId)}
                    disabled={!!actionLoading[f.friendshipId]}
                    style={{ background: 'none', border: '1px solid #e5e7eb', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#9ca3af', fontSize: '11px', opacity: actionLoading[f.friendshipId] ? 0.5 : 1 }}
                  >
                    <FaUserMinus size={11} /> {actionLoading[f.friendshipId] ? '...' : '삭제'}
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {/* 요청 목록 */}
        {tab === 'requests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
                받은 요청 {incomingCount > 0 && <span style={{ color: '#6B21A8' }}>{incomingCount}</span>}
              </p>
              {loading ? <div style={{ border: '1px solid #e5e7eb' }}><SkeletonRow /></div>
                : incoming.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#d1d5db' }}>받은 요청이 없습니다.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e5e7eb' }}>
                    {incoming.map((req) => (
                      <div key={req.id} style={{ backgroundColor: 'white', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f3f4f6' }}>
                        <Avatar nickname={req.requester.nickname} avatarUrl={req.requester.avatar_url} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '14px', color: 'black' }}>{req.requester.nickname}</p>
                          <p style={{ fontSize: '11px', color: '#9ca3af' }}>이웃 요청</p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleAccept(req.id)}
                            disabled={!!actionLoading[req.id]}
                            style={{ padding: '7px 12px', backgroundColor: '#6B21A8', color: 'white', border: 'none', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', opacity: actionLoading[req.id] ? 0.5 : 1 }}
                          >
                            <FaCheck size={10} /> {actionLoading[req.id] ? '...' : '수락'}
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={!!actionLoading[req.id]}
                            style={{ padding: '7px 12px', backgroundColor: 'white', color: '#9ca3af', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', opacity: actionLoading[req.id] ? 0.5 : 1 }}
                          >
                            <FaTimes size={10} /> 거절
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <div>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>보낸 요청</p>
              {loading ? <div style={{ border: '1px solid #e5e7eb' }}><SkeletonRow /></div>
                : outgoing.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#d1d5db' }}>보낸 요청이 없습니다.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e5e7eb' }}>
                    {outgoing.map((req) => (
                      <div key={req.id} style={{ backgroundColor: 'white', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f3f4f6' }}>
                        <Avatar nickname={req.receiver.nickname} avatarUrl={req.receiver.avatar_url} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '14px', color: 'black' }}>{req.receiver.nickname}</p>
                          <p style={{ fontSize: '11px', color: '#9ca3af' }}>수락 대기 중</p>
                        </div>
                        <button
                          onClick={() => handleCancelRequest(req.id)}
                          disabled={!!actionLoading[req.id]}
                          style={{ background: 'none', border: '1px solid #e5e7eb', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#9ca3af', fontSize: '11px', opacity: actionLoading[req.id] ? 0.5 : 1 }}
                        >
                          <FaUndo size={10} /> {actionLoading[req.id] ? '...' : '취소'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        )}

        {/* 이웃 추가 */}
        {tab === 'add' && (
          <div>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>닉네임으로 찾기</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                value={searchNick}
                onChange={e => { setSearchNick(e.target.value); setSendResult(null); }}
                onKeyDown={e => e.key === 'Enter' && handleSendRequest()}
                placeholder="예) 달달한바나나_123"
                style={{ flex: 1, padding: '12px 14px', border: '1px solid #e5e7eb', fontSize: '14px', outline: 'none', backgroundColor: 'white' }}
              />
              <button
                onClick={handleSendRequest}
                disabled={sendLoading || !searchNick.trim()}
                style={{
                  padding: '12px 16px', border: 'none',
                  backgroundColor: searchNick.trim() && !sendLoading ? '#6B21A8' : '#e5e7eb',
                  color: searchNick.trim() && !sendLoading ? 'white' : '#9ca3af',
                  cursor: searchNick.trim() && !sendLoading ? 'pointer' : 'not-allowed',
                  fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
                }}
              >
                <FaUserPlus size={12} />
                {sendLoading ? '...' : '요청'}
              </button>
            </div>

            {sendResult && (
              <div style={{
                padding: '12px 14px', fontSize: '13px',
                backgroundColor: sendResult.ok ? '#f5f3ff' : '#fef2f2',
                color: sendResult.ok ? '#6B21A8' : '#ef4444',
                border: `1px solid ${sendResult.ok ? '#e9d5ff' : '#fecaca'}`,
              }}>
                {sendResult.ok ? '✓ ' : '✗ '}{sendResult.msg}
              </div>
            )}

            <p style={{ fontSize: '11px', color: '#d1d5db', lineHeight: 1.8, marginTop: '24px' }}>
              상대방 닉네임을 정확히 입력하세요.<br />
              상대방이 수락하면 이웃이 됩니다.<br />
              이웃끼리는 식단을 공유하고 서로 응원할 수 있어요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
