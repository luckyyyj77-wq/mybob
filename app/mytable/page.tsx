"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

interface Profile {
  nickname: string | null;
  avatar_url: string | null;
  plan: string;
  is_public: boolean;
}

interface Meal {
  id: string;
  food_name: string;
  calories: number;
  created_at: string;
  category?: string;
  photo_url?: string;
}

function toKSTDate(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}일 전`;
  if (h > 0) return `${h}시간 전`;
  if (m > 0) return `${m}분 전`;
  return '방금';
}

export default function MyTablePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusInput, setStatusInput] = useState('');
  const [editingStatus, setEditingStatus] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const t = session?.access_token ?? null;
      setToken(t);
      if (!t) { setLoading(false); return; }

      try {
        const [profileRes, mealsRes] = await Promise.all([
          fetch('/api/profile', { headers: { Authorization: `Bearer ${t}` } }),
          fetch('/api/meals', { headers: { Authorization: `Bearer ${t}` } }),
        ]);

        if (profileRes.ok) {
          const p = await profileRes.json();
          setProfile({ nickname: p.nickname, avatar_url: p.avatar_url, plan: p.plan ?? 'free', is_public: p.is_public ?? false });
          setIsPublic(p.is_public ?? false);
          setStatusMsg(p.status_message ?? '');
          setStatusInput(p.status_message ?? '');
        }

        if (mealsRes.ok) {
          const m = await mealsRes.json();
          if (m.success && Array.isArray(m.data)) {
            setMeals(m.data.slice(0, 12));
          }
        }
      } catch { }
      setLoading(false);
    });
  }, []);

  const handlePublicToggle = async () => {
    const next = !isPublic;
    setIsPublic(next);
    // TODO: PATCH /api/profile { is_public: next } — is_public 컬럼 추가 후 활성화
  };

  const handleStatusSave = () => {
    setStatusMsg(statusInput);
    setEditingStatus(false);
    // TODO: PATCH /api/profile { status_message: statusInput } — status_message 컬럼 추가 후 활성화
  };

  const todayMeals = meals.filter(m => toKSTDate(m.created_at) === toKSTDate(new Date().toISOString()));
  const recentMeals = meals.slice(0, 6);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
        <div style={{ width: '22px', height: '22px', border: '2px solid #e5e7eb', borderTopColor: 'black', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px 40px' }}>

      {/* 프로필 카드 */}
      <div style={{ border: '1px solid #e5e7eb', padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          {/* 아바타 */}
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: '24px' }}>👤</span>
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <p style={{ fontSize: '16px', color: 'black' }}>{profile?.nickname || '닉네임 없음'}</p>
              {profile?.plan !== 'free' && (
                <span style={{ fontSize: '9px', backgroundColor: '#6B21A8', color: 'white', padding: '2px 5px' }}>PRO</span>
              )}
            </div>
            <p style={{ fontSize: '11px', color: '#9ca3af' }}>오늘 {todayMeals.length}개 기록</p>
          </div>

          {/* 공개 토글 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={handlePublicToggle}
              style={{
                width: '44px', height: '24px', borderRadius: '12px', border: '1px solid #e5e7eb',
                backgroundColor: isPublic ? 'black' : 'white',
                cursor: 'pointer', position: 'relative', padding: 0,
              }}
            >
              <span style={{ position: 'absolute', top: '3px', left: isPublic ? '20px' : '3px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: isPublic ? 'white' : '#d1d5db', transition: 'left 0.2s' }} />
            </button>
            <p style={{ fontSize: '9px', color: isPublic ? '#6B21A8' : '#9ca3af', letterSpacing: '0.5px' }}>
              {isPublic ? '공개' : '비공개'}
            </p>
          </div>
        </div>

        {/* 상태 메시지 */}
        <div>
          <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>상태 메시지</p>
          {editingStatus ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={statusInput}
                onChange={e => setStatusInput(e.target.value)}
                maxLength={40}
                placeholder="한 줄 상태 메시지 (40자)"
                style={{ flex: 1, padding: '8px 10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }}
              />
              <button onClick={handleStatusSave} style={{ padding: '8px 12px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '11px', cursor: 'pointer' }}>저장</button>
              <button onClick={() => { setEditingStatus(false); setStatusInput(statusMsg); }} style={{ padding: '8px 10px', backgroundColor: 'white', color: '#9ca3af', border: '1px solid #e5e7eb', fontSize: '11px', cursor: 'pointer' }}>취소</button>
            </div>
          ) : (
            <button
              onClick={() => setEditingStatus(true)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa', fontSize: '13px', color: statusMsg ? '#374151' : '#d1d5db', textAlign: 'left', cursor: 'pointer' }}
            >
              {statusMsg || '상태 메시지를 입력하세요...'}
            </button>
          )}
        </div>
      </div>

      {/* 오늘 식단 */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase' }}>오늘 식단</p>
          <Link href="/history" style={{ fontSize: '10px', color: '#6B21A8', textDecoration: 'none' }}>전체 보기 ›</Link>
        </div>
        {todayMeals.length === 0 ? (
          <div style={{ border: '1px solid #e5e7eb', padding: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>오늘 기록된 식단이 없습니다.</p>
            <Link href="/capture" style={{ display: 'inline-block', marginTop: '10px', padding: '8px 16px', backgroundColor: 'black', color: 'white', fontSize: '11px', textDecoration: 'none', letterSpacing: '1px' }}>
              식단 기록하기
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {todayMeals.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid #e5e7eb' }}>
                <div>
                  <p style={{ fontSize: '13px', color: 'black', marginBottom: '2px' }}>{m.food_name}</p>
                  <p style={{ fontSize: '10px', color: '#9ca3af' }}>{m.category} · {timeAgo(m.created_at)}</p>
                </div>
                <p style={{ fontSize: '13px', color: '#6B21A8' }}>{m.calories} kcal</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 최근 기록 */}
      {recentMeals.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>최근 기록</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            {recentMeals.map(m => (
              <Link key={m.id} href={`/history/${m.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <div style={{ aspectRatio: '1', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {m.photo_url && !m.photo_url.startsWith('local:')
                      ? <img src={m.photo_url} alt={m.food_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '24px' }}>🍽</span>
                    }
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <p style={{ fontSize: '10px', color: 'black', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.food_name}</p>
                    <p style={{ fontSize: '9px', color: '#9ca3af' }}>{m.calories} kcal</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 준비 중 섹션들 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[
          { icon: '❤️', label: '좋아요 받은 식단', desc: '공개 식단에 이웃이 좋아요를 누르면 표시됩니다.' },
          { icon: '💬', label: '댓글', desc: '이웃과 식단 이야기를 나눠보세요.' },
          { icon: '🏆', label: '챌린지 현황', desc: '진행 중인 챌린지 달성률을 확인하세요.' },
        ].map(item => (
          <div key={item.label} style={{ border: '1px solid #e5e7eb', padding: '16px', opacity: 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <p style={{ fontSize: '13px', color: 'black' }}>{item.label}</p>
              <span style={{ fontSize: '9px', color: '#9ca3af', backgroundColor: '#f3f4f6', padding: '2px 6px', letterSpacing: '1px' }}>준비 중</span>
            </div>
            <p style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.5, paddingLeft: '26px' }}>{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
