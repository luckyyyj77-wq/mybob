"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { FaUserPlus, FaCheck, FaTimes, FaUserMinus } from 'react-icons/fa';

interface Profile {
  id: string;
  nickname: string;
  avatar_url?: string;
}

interface Friendship {
  friendshipId: string;
  id: string;
  nickname: string;
  avatar_url?: string;
}

interface IncomingRequest {
  id: string;
  created_at: string;
  requester: Profile;
}

interface OutgoingRequest {
  id: string;
  created_at: string;
  receiver: Profile;
}

function Avatar({ nickname, avatarUrl, size = 40 }: { nickname: string; avatarUrl?: string; size?: number }) {
  const initials = nickname.replace(/[^가-힣a-zA-Z]/g, '').slice(0, 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', flexShrink: 0,
    }}>
      {avatarUrl
        ? <img src={avatarUrl} alt={nickname} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: size * 0.3, color: '#9ca3af' }}>{initials || '?'}</span>
      }
    </div>
  );
}

export default function NeighborsPage() {
  const [tab, setTab] = useState<'friends' | 'requests' | 'add'>('friends');
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
  const [loading, setLoading] = useState(true);
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

  const loadFriends = async (t: string) => {
    setLoading(true);
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
      }
    } catch {
      setSendResult({ ok: false, msg: '요청 실패' });
    }
    setSendLoading(false);
  };

  const handleAccept = async (friendshipId: string) => {
    if (!token) return;
    await fetch('/api/friends', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ friendshipId, action: 'accept' }),
    });
    loadFriends(token);
  };

  const handleReject = async (friendshipId: string) => {
    if (!token) return;
    await fetch('/api/friends', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ friendshipId, action: 'reject' }),
    });
    loadFriends(token);
  };

  const handleRemove = async (friendshipId: string) => {
    if (!token) return;
    await fetch('/api/friends', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ friendshipId }),
    });
    loadFriends(token);
  };

  const incomingCount = incoming.length;

  return (
    <div>
      {/* 서브탭 */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>
        {([
          { key: 'friends', label: `이웃 ${friends.length}` },
          { key: 'requests', label: `요청${incomingCount > 0 ? ` · ${incomingCount}` : ''}` },
          { key: 'add', label: '추가' },
        ] as { key: typeof tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '12px 0', fontSize: '12px',
              letterSpacing: '0.5px', border: 'none', cursor: 'pointer',
              backgroundColor: 'white',
              color: tab === t.key ? '#6B21A8' : '#9ca3af',
              borderBottom: tab === t.key ? '2px solid #6B21A8' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px' }}>

        {/* 이웃 목록 */}
        {tab === 'friends' && (
          loading ? (
            <div style={{ textAlign: 'center', paddingTop: '40px', color: '#9ca3af', fontSize: '13px' }}>불러오는 중...</div>
          ) : friends.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: '60px' }}>
              <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '8px' }}>아직 이웃이 없습니다.</p>
              <button
                onClick={() => setTab('add')}
                style={{ fontSize: '12px', color: '#6B21A8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                이웃 추가하기
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb' }}>
              {friends.map((f) => (
                <div key={f.friendshipId} style={{ backgroundColor: 'white', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Avatar nickname={f.nickname} avatarUrl={f.avatar_url} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', color: 'black' }}>{f.nickname}</p>
                  </div>
                  <button
                    onClick={() => handleRemove(f.friendshipId)}
                    style={{ background: 'none', border: '1px solid #e5e7eb', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#9ca3af', fontSize: '11px' }}
                  >
                    <FaUserMinus size={11} /> 삭제
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {/* 요청 목록 */}
        {tab === 'requests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 받은 요청 */}
            <div>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>받은 요청</p>
              {incoming.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#d1d5db' }}>받은 요청이 없습니다.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb' }}>
                  {incoming.map((req) => (
                    <div key={req.id} style={{ backgroundColor: 'white', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Avatar nickname={req.requester.nickname} avatarUrl={req.requester.avatar_url} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', color: 'black' }}>{req.requester.nickname}</p>
                        <p style={{ fontSize: '11px', color: '#9ca3af' }}>이웃 요청</p>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleAccept(req.id)}
                          style={{ padding: '7px 12px', backgroundColor: '#6B21A8', color: 'white', border: 'none', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <FaCheck size={10} /> 수락
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          style={{ padding: '7px 12px', backgroundColor: 'white', color: '#9ca3af', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <FaTimes size={10} /> 거절
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 보낸 요청 */}
            <div>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>보낸 요청</p>
              {outgoing.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#d1d5db' }}>보낸 요청이 없습니다.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb' }}>
                  {outgoing.map((req) => (
                    <div key={req.id} style={{ backgroundColor: 'white', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Avatar nickname={req.receiver.nickname} avatarUrl={req.receiver.avatar_url} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', color: 'black' }}>{req.receiver.nickname}</p>
                        <p style={{ fontSize: '11px', color: '#9ca3af' }}>수락 대기 중...</p>
                      </div>
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
                style={{
                  flex: 1, padding: '12px 14px', border: '1px solid #e5e7eb',
                  fontSize: '14px', outline: 'none', backgroundColor: 'white',
                }}
              />
              <button
                onClick={handleSendRequest}
                disabled={sendLoading || !searchNick.trim()}
                style={{
                  padding: '12px 16px', border: 'none',
                  backgroundColor: searchNick.trim() && !sendLoading ? '#6B21A8' : '#e5e7eb',
                  color: searchNick.trim() && !sendLoading ? 'white' : '#9ca3af',
                  cursor: searchNick.trim() && !sendLoading ? 'pointer' : 'not-allowed',
                  fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'all 0.2s',
                }}
              >
                <FaUserPlus size={12} />
                {sendLoading ? '...' : '요청'}
              </button>
            </div>

            {sendResult && (
              <p style={{ fontSize: '13px', color: sendResult.ok ? '#6B21A8' : '#ef4444', padding: '10px 0' }}>
                {sendResult.ok ? '✓ ' : '✗ '}{sendResult.msg}
              </p>
            )}

            <p style={{ fontSize: '11px', color: '#d1d5db', lineHeight: 1.7, marginTop: '20px' }}>
              상대방이 요청을 수락하면 이웃이 됩니다.<br />
              이웃끼리는 식단을 공유하고 서로 응원할 수 있어요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
