"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getFoundingRewardMonths } from '@/lib/plan';

type FoundingMember = {
  id: string;
  email: string;
  founding_joined_at: string;
  daysUsed: number;
  rewardMonths: number;
};

type SlotInfo = {
  total_slots: number;
  used_slots: number;
  promotion_end: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' });
}

export default function AdminFoundingPage() {
  const [slots, setSlots] = useState<SlotInfo | null>(null);
  const [members, setMembers] = useState<FoundingMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const token = session.access_token;

      const [slotsRes, membersRes] = await Promise.all([
        fetch('/api/admin/founding/slots', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/founding/members', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (slotsRes.ok) setSlots(await slotsRes.json());
      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members || []);
      }
      setLoading(false);
    });
  }, []);

  const fillRate = slots ? Math.round((slots.used_slots / slots.total_slots) * 100) : 0;
  const daysLeft = slots
    ? Math.max(0, Math.ceil((new Date(slots.promotion_end).getTime() - Date.now()) / 86400000))
    : 0;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid #6B21A8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '960px' }}>

      <div>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>PROMOTION</p>
        <h1 style={{ fontSize: '22px', fontWeight: 400, color: '#0f0f0f', lineHeight: 1 }}>천인회 현황</h1>
      </div>

      {/* 슬롯 현황 카드 */}
      {slots && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px', backgroundColor: '#e5e7eb' }} className="slot-grid">
          <div style={{ backgroundColor: 'white', padding: '20px' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>점유 슬롯</p>
            <p style={{ fontSize: '32px', color: '#6B21A8', lineHeight: 1 }}>{slots.used_slots.toLocaleString()}</p>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>/ {slots.total_slots.toLocaleString()} 전체</p>
          </div>
          <div style={{ backgroundColor: 'white', padding: '20px' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>잔여 슬롯</p>
            <p style={{ fontSize: '32px', color: 'black', lineHeight: 1 }}>{(slots.total_slots - slots.used_slots).toLocaleString()}</p>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>종료 D-{daysLeft} · {slots.promotion_end}</p>
          </div>
        </div>
      )}

      {/* 점유율 바 */}
      {slots && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase' }}>슬롯 점유율</p>
            <p style={{ fontSize: '12px', color: '#6B21A8' }}>{fillRate}%</p>
          </div>
          <div style={{ height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${fillRate}%`, backgroundColor: '#6B21A8', borderRadius: '4px', transition: 'width 0.5s' }} />
          </div>
        </div>
      )}

      {/* 멤버 목록 */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '20px' }}>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>
          천인회 멤버 ({members.length}명)
        </p>
        {members.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#9ca3af' }}>멤버가 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#f3f4f6' }}>
            {/* 헤더 */}
            <div style={{ backgroundColor: '#f9fafb', padding: '8px 12px', display: 'grid', gridTemplateColumns: '1fr 80px 60px 100px', gap: '8px' }}>
              <span style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase' }}>이메일</span>
              <span style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase' }}>가입일</span>
              <span style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'right' }}>사용일</span>
              <span style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'right' }}>예상 보상</span>
            </div>
            {members.map(m => (
              <div key={m.id} style={{ backgroundColor: 'white', padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr 80px 60px 100px', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</span>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>{fmtDate(m.founding_joined_at)}</span>
                <span style={{ fontSize: '12px', color: 'black', textAlign: 'right' }}>{m.daysUsed}일</span>
                <span style={{ fontSize: '11px', textAlign: 'right', color: m.rewardMonths > 0 ? '#6B21A8' : '#9ca3af' }}>
                  {m.rewardMonths > 0 ? `${m.rewardMonths}개월` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 768px) { .slot-grid { grid-template-columns: repeat(4, 1fr) !important; } }
      `}</style>
    </div>
  );
}
