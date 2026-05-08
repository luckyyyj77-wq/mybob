"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';

type ReportData = {
  planCount: { free: number; pro: number; lifetime: number };
  totalUsers: number;
  dailyMeals: { date: string; count: number }[];
  activeAnalyzers: number;
  categoryStats: { name: string; count: number }[];
};

const PLAN_COLOR = { free: '#e5e7eb', pro: '#6B21A8', lifetime: '#d97706' };
const PLAN_LABEL = { free: '무료', pro: 'PRO 구독', lifetime: '평생 이용권' };

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const res = await fetch('/api/admin/reports', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await res.json();
      if (result.success) setData(result.data);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid #6B21A8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!data) return null;

  const maxMeal = Math.max(...data.dailyMeals.map(d => d.count), 1);
  const proRevenue = data.planCount.pro * 900;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '960px' }}>

      {/* 헤더 */}
      <div>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>REPORTS</p>
        <h1 style={{ fontSize: '22px', fontWeight: 400, color: '#0f0f0f', lineHeight: 1 }}>통계 리포트</h1>
      </div>

      {/* 수익 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb' }} className="report-grid">
        {[
          { label: '전체 회원', value: `${data.totalUsers}명`, sub: '누적 가입' },
          { label: '오늘 활성 분석', value: `${data.activeAnalyzers}명`, sub: 'AI 분석 사용자' },
          { label: 'PRO 구독', value: `${data.planCount.pro}명`, sub: `월 ${proRevenue.toLocaleString()}원 예상`, color: '#6B21A8' },
          { label: '평생 이용권', value: `${data.planCount.lifetime}명`, sub: `누적 ${(data.planCount.lifetime * 9000).toLocaleString()}원`, color: '#d97706' },
        ].map(card => (
          <div key={card.label} style={{ backgroundColor: 'white', padding: '20px' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>{card.label}</p>
            <p style={{ fontSize: '26px', fontWeight: 400, color: card.color ?? 'black', lineHeight: 1, marginBottom: '4px' }}>{card.value}</p>
            {card.sub && <p style={{ fontSize: '11px', color: '#9ca3af' }}>{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* 플랜 분포 */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '20px' }}>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>플랜 분포</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(['free', 'pro', 'lifetime'] as const).map(plan => {
            const count = data.planCount[plan];
            const pct = data.totalUsers > 0 ? Math.round((count / data.totalUsers) * 100) : 0;
            return (
              <div key={plan}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', color: '#374151' }}>{PLAN_LABEL[plan]}</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{count}명 · {pct}%</span>
                </div>
                <div style={{ height: '6px', backgroundColor: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, backgroundColor: PLAN_COLOR[plan], borderRadius: '3px', transition: 'width 0.5s' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 14일 기록 추이 */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '20px' }}>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>최근 14일 식단 기록 추이</p>
        <div style={{ height: '180px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.dailyMeals} barSize={18} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} interval={1} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 0, fontSize: '11px' }}
                formatter={(v) => [`${v}건`, '식단 기록']}
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {data.dailyMeals.map((entry, i) => (
                  <Cell key={i} fill={entry.count === maxMeal ? '#6B21A8' : '#e5e7eb'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 카테고리 분포 */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '20px' }}>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>카테고리 분포 (전체 누적)</p>
        {data.categoryStats.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#9ca3af' }}>데이터 없음</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.categoryStats.map((cat, i) => {
              const total = data.categoryStats.reduce((s, c) => s + c.count, 0);
              const pct = total > 0 ? Math.round((cat.count / total) * 100) : 0;
              const colors = ['#6B21A8', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff', '#f3e8ff', '#faf5ff', '#f9fafb'];
              return (
                <div key={cat.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#374151' }}>{cat.name}</span>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{cat.count}건 · {pct}%</span>
                  </div>
                  <div style={{ height: '4px', backgroundColor: '#f3f4f6', borderRadius: '2px' }}>
                    <div style={{ height: '100%', width: `${pct}%`, backgroundColor: colors[i] ?? '#e5e7eb', borderRadius: '2px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 768px) { .report-grid { grid-template-columns: repeat(4, 1fr) !important; } }
      `}</style>
    </div>
  );
}
