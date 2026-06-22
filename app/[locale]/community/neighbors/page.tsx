"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from '@/i18n/routing';
import { FaUserPlus, FaCheck, FaTimes, FaUserMinus, FaUndo } from 'react-icons/fa';
import { getStorageMode } from '@/lib/storage-mode';
import { useTranslations } from 'next-intl';

interface Profile { id: string; nickname: string; avatar_url?: string }
interface Friend { friendshipId: string; id: string; nickname: string; avatar_url?: string }
interface IncomingRequest { id: string; created_at: string; requester: Profile }
interface OutgoingRequest { id: string; created_at: string; receiver: Profile }

interface FeedMeal {
  id: string;
  user_id: string;
  food_name: string;
  calories: number;
  category?: string;
  photo_url?: string;
  created_at: string;
  portion?: number;
  nickname: string;
  avatar_url?: string;
}

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
  const { token } = useAuth();
  const router = useRouter();
  const t = useTranslations('Community');
  const timeAgoRaw = t.raw('timeAgo') as { justNow: string; minutes: string; hours: string; days: string };

  const timeAgo = useCallback((iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return timeAgoRaw.justNow;
    if (diff < 3600) return timeAgoRaw.minutes.replace('{n}', String(Math.floor(diff / 60)));
    if (diff < 86400) return timeAgoRaw.hours.replace('{n}', String(Math.floor(diff / 3600)));
    return timeAgoRaw.days.replace('{n}', String(Math.floor(diff / 86400)));
  }, [timeAgoRaw]);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [tab, setTab] = useState<'feed' | 'friends' | 'requests' | 'add'>('feed');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [searchNick, setSearchNick] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedMeal[]>([]);
  const [isPro, setIsPro] = useState<boolean | null>(null);

  useEffect(() => {
    setIsLocalMode(getStorageMode() === 'local');
  }, []);

  useEffect(() => {
    if (token === null) return;
    if (token) {
      loadAll(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const loadAll = useCallback(async (t: string) => {
    setLoading(true);
    try {
      const [friendsRes, feedRes] = await Promise.all([
        fetch('/api/friends', { headers: { Authorization: `Bearer ${t}` } }),
        fetch('/api/community?type=neighbors', { headers: { Authorization: `Bearer ${t}` } }),
      ]);

      const [friendsData, feedData] = await Promise.all([
        friendsRes.json(),
        feedRes.json(),
      ]);

      if (friendsRes.ok) {
        setFriends(friendsData.friends ?? []);
        setIncoming(friendsData.incoming ?? []);
        setOutgoing(friendsData.outgoing ?? []);
      }

      if (feedRes.status === 403) {
        setIsPro(false);
      } else if (feedRes.ok) {
        setIsPro(true);
        setFeed(feedData.data ?? []);
      }
    } catch { } finally {
      setLoading(false);
    }
  }, []);

  const reloadFriends = useCallback(async (t: string) => {
    try {
      const res = await fetch('/api/friends', { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      if (res.ok) {
        setFriends(data.friends ?? []);
        setIncoming(data.incoming ?? []);
        setOutgoing(data.outgoing ?? []);
      }
    } catch { }
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
        reloadFriends(token);
        setTab('requests');
      }
    } catch {
      setSendResult({ ok: false, msg: t('requestFailed') });
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
    if (confirmRemoveId !== friendshipId) {
      setConfirmRemoveId(friendshipId);
      return;
    }
    setConfirmRemoveId(null);
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

  if (isLocalMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', textAlign: 'center', height: '100%' }}>
        <p style={{ fontSize: '40px', marginBottom: '20px' }}>☁️</p>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>CLOUD ONLY</p>
        <p style={{ fontSize: '18px', fontWeight: 500, color: 'black', marginBottom: '12px' }}>{t('cloudOnlyTitle')}</p>
        <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.8, marginBottom: '32px' }}>
          {t('cloudOnlyDesc')}
        </p>
        <button
          onClick={() => router.push('/settings/storage')}
          style={{
            padding: '14px 28px', backgroundColor: '#6B21A8', color: 'white',
            border: 'none', cursor: 'pointer', fontSize: '13px', letterSpacing: '0.5px',
            marginBottom: '12px', width: '100%', maxWidth: '280px',
          }}
        >
          {t('switchToCloud')}
        </button>
        <p style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.7 }}>
          {t('switchNote')}
        </p>
      </div>
    );
  }

  return (
    <div>
      <style>{`
        @keyframes shimmer {
          0% { opacity: 1 } 50% { opacity: 0.4 } 100% { opacity: 1 }
        }
      `}</style>

      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white', position: 'sticky', top: 0, zIndex: 1 }}>
        {([
          { key: 'feed', label: t('feedTab') },
          { key: 'friends', label: `${t('friendsTab')}${!loading ? ` ${friends.length}` : ''}` },
          { key: 'requests', label: `${t('requestsTab')}${incomingCount > 0 ? ` · ${incomingCount}` : ''}` },
          { key: 'add', label: t('addTab') },
        ] as { key: typeof tab; label: string }[]).map((item) => (
          <button key={item.key} onClick={() => { setTab(item.key); setConfirmRemoveId(null); }} style={{
            flex: 1, padding: '12px 0', fontSize: '12px', letterSpacing: '0.5px',
            border: 'none', cursor: 'pointer', backgroundColor: 'white',
            color: tab === item.key ? '#6B21A8' : '#9ca3af',
            borderBottom: tab === item.key ? '2px solid #6B21A8' : '2px solid transparent',
            transition: 'all 0.15s',
          }}>
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px' }}>

        {/* 이웃 피드 */}
        {tab === 'feed' && (
          loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', border: '1px solid #e5e7eb', backgroundColor: '#e5e7eb' }}>
              {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
            </div>
          ) : !isPro ? (
            <div style={{ textAlign: 'center', paddingTop: '60px' }}>
              <p style={{ fontSize: '28px', marginBottom: '12px' }}>👥</p>
              <p style={{ fontSize: '15px', color: 'black', marginBottom: '6px' }}>{t('proFeedTitle')}</p>
              <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.7 }}>
                {t('proFeedDesc')}
              </p>
            </div>
          ) : feed.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: '60px' }}>
              <p style={{ fontSize: '28px', marginBottom: '12px' }}>🍽️</p>
              <p style={{ fontSize: '14px', color: '#9ca3af', lineHeight: 1.7 }}>
                {t('noFeedNeighbors')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', border: '1px solid #e5e7eb' }}>
              {feed.map(item => {
                const initials = item.nickname.replace(/[_0-9]/g, '').slice(0, 2);
                return (
                  <div key={item.id} style={{ backgroundColor: 'white', padding: '16px', borderBottom: '1px solid #f3f4f6' }}>
                    {/* 유저 헤더 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '50%',
                        backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 500, color: '#6b7280', flexShrink: 0,
                        overflow: 'hidden',
                      }}>
                        {item.avatar_url
                          ? <img src={item.avatar_url} alt={item.nickname} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : initials || '?'
                        }
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '13px', color: 'black', fontWeight: 500 }}>{item.nickname}</p>
                        <p style={{ fontSize: '11px', color: '#9ca3af' }}>{timeAgo(item.created_at)}</p>
                      </div>
                      {item.category && (
                        <span style={{
                          fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase',
                          color: '#9ca3af', border: '1px solid #e5e7eb', padding: '3px 7px',
                        }}>
                          {item.category}
                        </span>
                      )}
                    </div>
                    {/* 사진 (클라우드 식단만) */}
                    {item.photo_url && !item.photo_url.startsWith('local:') && (
                      <img
                        src={item.photo_url}
                        alt={item.food_name}
                        style={{ width: '100%', maxHeight: '320px', objectFit: 'cover', marginBottom: '12px', display: 'block' }}
                      />
                    )}
                    {/* 음식 정보 */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: '16px', fontWeight: 400, color: 'black' }}>{item.food_name}</p>
                      <p style={{ fontSize: '18px', color: '#6B21A8', lineHeight: 1 }}>
                        {Math.round(item.calories * (item.portion ?? 1))}
                        <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '3px' }}>kcal</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* 이웃 목록 */}
        {tab === 'friends' && (
          loading ? (
            <div style={{ border: '1px solid #e5e7eb' }}>
              {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
            </div>
          ) : friends.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: '60px' }}>
              <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '8px' }}>{t('noFriends')}</p>
              <button onClick={() => setTab('add')} style={{ fontSize: '12px', color: '#6B21A8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                {t('addNeighbors')}
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
                  {confirmRemoveId === f.friendshipId ? (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#ef4444', marginRight: '2px' }}>{t('confirmRemove')}</span>
                      <button
                        onClick={() => handleRemove(f.friendshipId)}
                        disabled={!!actionLoading[f.friendshipId]}
                        style={{ padding: '5px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontSize: '11px', opacity: actionLoading[f.friendshipId] ? 0.5 : 1 }}
                      >
                        {actionLoading[f.friendshipId] ? '...' : t('confirmBtn')}
                      </button>
                      <button
                        onClick={() => setConfirmRemoveId(null)}
                        style={{ padding: '5px 10px', background: 'none', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '11px', color: '#9ca3af' }}
                      >
                        {t('cancelBtn')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRemove(f.friendshipId)}
                      disabled={!!actionLoading[f.friendshipId]}
                      style={{ background: 'none', border: '1px solid #e5e7eb', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#9ca3af', fontSize: '11px', opacity: actionLoading[f.friendshipId] ? 0.5 : 1 }}
                    >
                      <FaUserMinus size={11} /> {t('removeBtn')}
                    </button>
                  )}
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
                {t('incomingRequests')} {incomingCount > 0 && <span style={{ color: '#6B21A8' }}>{incomingCount}</span>}
              </p>
              {loading ? <div style={{ border: '1px solid #e5e7eb' }}><SkeletonRow /></div>
                : incoming.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#d1d5db' }}>{t('noIncoming')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e5e7eb' }}>
                    {incoming.map((req) => (
                      <div key={req.id} style={{ backgroundColor: 'white', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f3f4f6' }}>
                        <Avatar nickname={req.requester.nickname} avatarUrl={req.requester.avatar_url} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '14px', color: 'black' }}>{req.requester.nickname}</p>
                          <p style={{ fontSize: '11px', color: '#9ca3af' }}>{t('neighborRequest')}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleAccept(req.id)}
                            disabled={!!actionLoading[req.id]}
                            style={{ padding: '7px 12px', backgroundColor: '#6B21A8', color: 'white', border: 'none', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', opacity: actionLoading[req.id] ? 0.5 : 1 }}
                          >
                            <FaCheck size={10} /> {actionLoading[req.id] ? '...' : t('accept')}
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={!!actionLoading[req.id]}
                            style={{ padding: '7px 12px', backgroundColor: 'white', color: '#9ca3af', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', opacity: actionLoading[req.id] ? 0.5 : 1 }}
                          >
                            <FaTimes size={10} /> {t('reject')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <div>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>{t('outgoingRequests')}</p>
              {loading ? <div style={{ border: '1px solid #e5e7eb' }}><SkeletonRow /></div>
                : outgoing.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#d1d5db' }}>{t('noOutgoing')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e5e7eb' }}>
                    {outgoing.map((req) => (
                      <div key={req.id} style={{ backgroundColor: 'white', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f3f4f6' }}>
                        <Avatar nickname={req.receiver.nickname} avatarUrl={req.receiver.avatar_url} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '14px', color: 'black' }}>{req.receiver.nickname}</p>
                          <p style={{ fontSize: '11px', color: '#9ca3af' }}>{t('pending')}</p>
                        </div>
                        <button
                          onClick={() => handleCancelRequest(req.id)}
                          disabled={!!actionLoading[req.id]}
                          style={{ background: 'none', border: '1px solid #e5e7eb', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#9ca3af', fontSize: '11px', opacity: actionLoading[req.id] ? 0.5 : 1 }}
                        >
                          <FaUndo size={10} /> {actionLoading[req.id] ? '...' : t('cancelRequest')}
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
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>{t('searchByNickname')}</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                value={searchNick}
                onChange={e => { setSearchNick(e.target.value); setSendResult(null); }}
                onKeyDown={e => e.key === 'Enter' && handleSendRequest()}
                placeholder={t('searchPlaceholder')}
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
                {sendLoading ? '...' : t('sendRequest')}
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
              {t('addGuide')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
