"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { FaUsers, FaUtensils, FaCalendarDay, FaCalendarWeek } from 'react-icons/fa';

type Stats = {
  totalMeals: number;
  todayMeals: number;
  weekMeals: number;
  totalUsers: number;
  recentUsers: { id: string; email?: string; created_at: string; last_sign_in_at?: string }[];
  categoryStats: { name: string; count: number }[];
  dailyStats: { date: string; count: number }[];
  signupStats: { date: string; count: number }[];
};

function StatCard({ icon: Icon, label, value, sub, color = 'black' }: {
  icon: any; label: string; value: number | string; sub?: string; color?: string;
}) {
  return (
    <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{label}</p>
        <Icon size={14} color="#9ca3af" />
      </div>
      <p style={{ fontSize: '28px', fontWeight: 400, color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '11px', color: '#9ca3af' }}>{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await res.json();
      if (result.success) setStats(result.data);
      else setError(result.error || '데이터 로드 실패');
      setLoading(false);
    });
  }, []);

  const now = new Date().toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid #6B21A8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444', fontSize: '13px' }}>{error}</div>
  );

  if (!stats) return null;

  const maxCount = Math.max(...stats.dailyStats.map(d => d.count), 1);
  const maxSignup = Math.max(...stats.signupStats.map(d => d.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '960px' }}>

      {/* 페이지 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>OVERVIEW</p>
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: '#0f0f0f', lineHeight: 1 }}>대시보드</h1>
        </div>
        <p style={{ fontSize: '11px', color: '#9ca3af' }}>업데이트 {now}</p>
      </div>

      {/* 요약 카드 4개 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px', backgroundColor: '#e5e7eb' }} className="stat-grid">
        <StatCard icon={FaUsers}       label="전체 회원"      value={stats.totalUsers.toLocaleString()}  sub="가입 누적" />
        <StatCard icon={FaUtensils}    label="전체 기록"      value={stats.totalMeals.toLocaleString()}  sub="식단 누적" />
        <StatCard icon={FaCalendarDay} label="오늘 기록"      value={stats.todayMeals}  color={stats.todayMeals > 0 ? '#6B21A8' : 'black'} />
        <StatCard icon={FaCalendarWeek}label="최근 7일 기록"  value={stats.weekMeals}   sub={`일 평균 ${(stats.weekMeals / 7).toFixed(1)}건`} />
      </div>

      {/* 최근 7일 기록 추이 */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '20px' }}>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>최근 7일 기록 추이</p>
        <div style={{ height: '160px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.dailyStats} barSize={28} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 0, fontSize: '11px' }}
                formatter={(v) => [`${v}건`, '기록']}
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {stats.dailyStats.map((entry, i) => (
                  <Cell key={i} fill={entry.count === maxCount ? '#6B21A8' : '#e5e7eb'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 신규 가입자 추이 */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '20px' }}>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>최근 14일 신규 가입자</p>
        <div style={{ height: '160px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.signupStats} barSize={14} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9ca3af' }} interval={1} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 0, fontSize: '11px' }}
                formatter={(v) => [`${v}명`, '신규 가입']}
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {stats.signupStats.map((entry, i) => (
                  <Cell key={i} fill={entry.count === maxSignup && maxSignup > 0 ? '#6B21A8' : '#e5e7eb'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 하단 2열: 카테고리 분포 + 최근 가입 회원 */}
      <div style={{ display: 'grid', gap: '1px', backgroundColor: '#e5e7eb' }} className="bottom-grid">

        {/* 카테고리 분포 */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '20px' }}>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>카테고리 분포</p>
          {stats.categoryStats.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>데이터 없음</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats.categoryStats.map((cat, i) => {
                const pct = Math.round((cat.count / stats.totalMeals) * 100);
                return (
                  <div key={cat.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#374151' }}>{cat.name}</span>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>{cat.count}건 · {pct}%</span>
                    </div>
                    <div style={{ height: '3px', backgroundColor: '#f3f4f6', borderRadius: '2px' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: i === 0 ? '#6B21A8' : i === 1 ? '#a855f7' : '#e5e7eb', borderRadius: '2px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 최근 가입 회원 */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '20px' }}>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>최근 가입 회원</p>
          {stats.recentUsers.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>데이터 없음</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#f3f4f6' }}>
              {stats.recentUsers.map(user => (
                <div key={user.id} style={{ backgroundColor: 'white', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: '#374151' }}>{user.email || '—'}</p>
                    <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>
                      가입 {new Date(user.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  {user.last_sign_in_at && (
                    <p style={{ fontSize: '10px', color: '#9ca3af' }}>
                      최근 {new Date(user.last_sign_in_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* 데스크탑: 4카드 4열, 하단 2열 */
        @media (min-width: 768px) {
          .stat-grid { grid-template-columns: repeat(4, 1fr) !important; }
          .bottom-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
