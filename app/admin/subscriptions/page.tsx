'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type SubUser = {
  id: string;
  email: string;
  created_at: string | null;
  plan: 'pro' | 'lifetime';
  ls_subscription_id: string | null;
  ls_auto_cancel: boolean;
  plan_updated_at: string | null;
};

const PLAN_COLOR: Record<string, string> = { pro: '#6B21A8', lifetime: '#d97706' };
const PLAN_LABEL: Record<string, string> = { pro: 'PRO', lifetime: 'LIFETIME' };

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' });
}

export default function AdminSubscriptionsPage() {
  const [users, setUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<SubUser | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [msg, setMsg] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      setToken(session.access_token);
      const res = await fetch('/api/admin/subscriptions', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.success) setUsers(json.data);
      setLoading(false);
    });
  }, []);

  async function handleCancel() {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    setMsg('');
    const res = await fetch('/api/admin/subscriptions', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: cancelTarget.id }),
    });
    const json = await res.json();
    if (json.success) {
      setUsers(prev => prev.filter(u => u.id !== cancelTarget.id));
      setMsg(`${cancelTarget.email} 구독 해지 완료`);
    } else {
      setMsg('해지 실패: ' + (json.error ?? '알 수 없는 오류'));
    }
    setCancelTarget(null);
    setCancelling(false);
  }

  const proCount = users.filter(u => u.plan === 'pro').length;
  const lifetimeCount = users.filter(u => u.plan === 'lifetime').length;
  const autoCancelCount = users.filter(u => u.ls_auto_cancel).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '960px' }}>

      <div>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>SUBSCRIPTIONS</p>
        <h1 style={{ fontSize: '22px', fontWeight: 400, color: '#0f0f0f', lineHeight: 1 }}>구독 관리</h1>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', backgroundColor: '#e5e7eb' }}>
        {[
          { label: 'PRO 구독', value: proCount, color: '#6B21A8' },
          { label: 'LIFETIME', value: lifetimeCount, color: '#d97706' },
          { label: '자동 해지 예약', value: autoCancelCount, color: '#9ca3af' },
        ].map(card => (
          <div key={card.label} style={{ backgroundColor: 'white', padding: '20px' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>{card.label}</p>
            <p style={{ fontSize: '28px', fontWeight: 400, color: card.color, lineHeight: 1 }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* 피드백 메시지 */}
      {msg && (
        <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '12px', color: '#166534' }}>
          {msg}
        </div>
      )}

      {/* 구독자 테이블 */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase' }}>
            유료 회원 목록 ({users.length}명)
          </p>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ width: '20px', height: '20px', border: '2px solid #6B21A8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        ) : users.length === 0 ? (
          <p style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>유료 구독 회원이 없습니다.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  {['이메일', '플랜', '구독ID', '자동해지', '플랜 변경일', '관리'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 400, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} style={{ borderTop: '1px solid #f3f4f6', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#374151' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '10px', color: 'white', backgroundColor: PLAN_COLOR[u.plan], padding: '2px 7px', letterSpacing: '0.5px' }}>
                        {PLAN_LABEL[u.plan]}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>
                      {u.ls_subscription_id ? u.ls_subscription_id.slice(0, 8) + '…' : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {u.ls_auto_cancel
                        ? <span style={{ fontSize: '11px', color: '#6B21A8' }}>⏱ 예약됨</span>
                        : <span style={{ fontSize: '11px', color: '#9ca3af' }}>—</span>
                      }
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{fmt(u.plan_updated_at)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {u.plan === 'pro' && (
                        <button
                          onClick={() => setCancelTarget(u)}
                          style={{ fontSize: '11px', color: '#ef4444', border: '1px solid #fca5a5', backgroundColor: 'white', padding: '4px 10px', cursor: 'pointer' }}
                        >
                          해지
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 해지 확인 모달 */}
      {cancelTarget && (
        <div
          onClick={() => setCancelTarget(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: 'white', padding: '28px 24px', maxWidth: '400px', width: '100%' }}
          >
            <p style={{ fontSize: '15px', fontWeight: 500, color: 'black', marginBottom: '10px' }}>구독 강제 해지</p>
            <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.7, marginBottom: '20px' }}>
              <strong>{cancelTarget.email}</strong> 의 PRO 구독을 즉시 해지하고 FREE로 전환합니다.<br />
              Lemon Squeezy 구독도 함께 취소됩니다.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{ padding: '9px 18px', backgroundColor: '#ef4444', color: 'white', border: 'none', fontSize: '13px', cursor: cancelling ? 'not-allowed' : 'pointer', fontWeight: 500 }}
              >
                {cancelling ? '처리 중...' : '해지 확정'}
              </button>
              <button
                onClick={() => setCancelTarget(null)}
                style={{ padding: '9px 18px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', fontSize: '13px', cursor: 'pointer' }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
