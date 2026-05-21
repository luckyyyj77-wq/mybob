"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type UserRow = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  plan: 'free' | 'pro' | 'lifetime';
  meal_count: number;
  analyses_today: number;
};

const PLAN_COLOR: Record<string, string> = { free: '#9ca3af', pro: '#6B21A8', lifetime: '#d97706' };
const PLAN_LABEL: Record<string, string> = { free: 'FREE', pro: 'PRO', lifetime: 'LIFE' };

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: '2-digit' });
}

function fmtRelative(iso: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filtered, setFiltered] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'pro' | 'lifetime'>('all');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await res.json();
      if (result.success) {
        setUsers(result.data);
        setFiltered(result.data);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let list = users;
    if (planFilter !== 'all') list = list.filter(u => u.plan === planFilter);
    if (search) list = list.filter(u => u.email.toLowerCase().includes(search.toLowerCase()));
    setFiltered(list);
  }, [search, planFilter, users]);

  const planCounts = { all: users.length, free: 0, pro: 0, lifetime: 0 };
  users.forEach(u => { planCounts[u.plan]++; });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid #6B21A8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* 헤더 */}
      <div>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>USERS</p>
        <h1 style={{ fontSize: '22px', fontWeight: 400, color: '#0f0f0f', lineHeight: 1 }}>회원 관리</h1>
      </div>

      {/* 플랜별 필터 탭 */}
      <div style={{ display: 'flex', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb' }}>
        {(['all', 'free', 'pro', 'lifetime'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPlanFilter(p)}
            style={{
              flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer', fontSize: '11px',
              backgroundColor: planFilter === p ? '#0f0f0f' : 'white',
              color: planFilter === p ? 'white' : '#9ca3af',
              letterSpacing: '0.3px',
            }}
          >
            {p === 'all' ? '전체' : PLAN_LABEL[p]} ({planCounts[p]})
          </button>
        ))}
      </div>

      {/* 검색 */}
      <input
        type="text"
        placeholder="이메일 검색..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb',
          fontSize: '13px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white',
        }}
      />

      {/* 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb' }}>

        {filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'white' }}>
            <p style={{ fontSize: '13px', color: '#9ca3af' }}>회원이 없습니다.</p>
          </div>
        ) : (
          filtered.map(u => (
            <div key={u.id} className="user-row" style={{ backgroundColor: 'white', padding: '12px 14px' }}>
              {/* 모바일: 카드형 레이아웃 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{
                  fontSize: '9px', letterSpacing: '1px', color: 'white',
                  backgroundColor: PLAN_COLOR[u.plan], padding: '2px 5px', flexShrink: 0,
                }}>
                  {PLAN_LABEL[u.plan]}
                </span>
                <span style={{ fontSize: '12px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {u.email}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>가입 {fmtDate(u.created_at)}</span>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>접속 {fmtRelative(u.last_sign_in_at)}</span>
                <span style={{ fontSize: '11px', color: '#374151' }}>식단 {u.meal_count}건</span>
                <span style={{ fontSize: '11px', color: u.analyses_today > 0 ? '#6B21A8' : '#9ca3af' }}>오늘 {u.analyses_today}회</span>
              </div>
            </div>
          ))
        )}
      </div>

      <p style={{ fontSize: '11px', color: '#9ca3af' }}>총 {filtered.length}명</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
