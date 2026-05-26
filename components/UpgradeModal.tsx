'use client';

import { useState, useEffect } from 'react';
import { initializePaddle, type Paddle } from '@paddle/paddle-js';
import { PADDLE_PRODUCTS, PLAN_PRICE, PLAN_DESCRIPTION, type PaddlePlan } from '@/lib/paddle';

type Props = {
  userEmail: string;
  userId: string;
  onClose: () => void;
};

const PLANS: { key: PaddlePlan; label: string; badge?: string }[] = [
  { key: 'pro_monthly', label: 'PRO 월간', badge: '월 ₩900' },
];

const FEATURES = [
  '하루 AI 분석 25회 (무료 10회)',
  '클라우드 저장 & 다기기 동기화',
  'AI 정밀 진단 리포트',
  '닉네임 & 아바타 커스텀',
  '광고 없음',
];

export default function UpgradeModal({ userEmail, userId, onClose }: Props) {
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [selected, setSelected] = useState<PaddlePlan>('pro_monthly');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const env = process.env.NEXT_PUBLIC_PADDLE_ENV as 'sandbox' | 'production' ?? 'sandbox';
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!;
    console.log('[Paddle] env:', env, '/ token prefix:', token?.slice(0, 10));
    initializePaddle({ environment: env, token })
      .then(p => {
        console.log('[Paddle] initializePaddle result:', p);
        if (p) setPaddle(p);
        else console.error('[Paddle] initializePaddle returned null/undefined');
      })
      .catch(err => console.error('[Paddle] initializePaddle error:', err));
  }, []);

  async function handleCheckout() {
    console.log('[Paddle] handleCheckout called, paddle:', paddle, '/ priceId:', PADDLE_PRODUCTS[selected]);
    if (!paddle) return;
    setLoading(true);
    try {
      paddle.Checkout.open({
        items: [{ priceId: PADDLE_PRODUCTS[selected], quantity: 1 }],
        customer: { email: userEmail },
        customData: { user_id: userId },
        settings: {
          displayMode: 'overlay',
          locale: 'ko',
          successUrl: `${window.location.origin}/settings?upgraded=1`,
        },
      });
    } catch (err) {
      console.error('[Paddle] Checkout.open error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'white', width: '100%', maxWidth: '480px',
          borderRadius: '16px 16px 0 0', padding: '28px 24px 40px',
          maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <p style={{ fontSize: '11px', letterSpacing: '2px', color: '#6B21A8', marginBottom: '4px' }}>UPGRADE</p>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'black' }}>PRO로 업그레이드</h2>
          </div>
          <button onClick={onClose} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>

        {/* 혜택 목록 */}
        <div style={{ backgroundColor: '#faf5ff', padding: '16px', marginBottom: '20px' }}>
          {FEATURES.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ color: '#6B21A8', fontSize: '14px' }}>✓</span>
              <span style={{ fontSize: '13px', color: '#374151' }}>{f}</span>
            </div>
          ))}
        </div>

        {/* 플랜 선택 */}
        <p style={{ fontSize: '11px', letterSpacing: '1px', color: '#9ca3af', marginBottom: '10px' }}>플랜 선택</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          {PLANS.map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', border: `2px solid ${selected === key ? '#6B21A8' : '#e5e7eb'}`,
                backgroundColor: selected === key ? '#faf5ff' : 'white',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  border: `2px solid ${selected === key ? '#6B21A8' : '#d1d5db'}`,
                  backgroundColor: selected === key ? '#6B21A8' : 'transparent',
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'black' }}>{label}</span>
                    {badge && (
                      <span style={{
                        fontSize: '10px', padding: '2px 6px',
                        backgroundColor: '#6B21A8', color: 'white', letterSpacing: '0.5px',
                      }}>{badge}</span>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{PLAN_DESCRIPTION[key]}</span>
                </div>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: selected === key ? '#6B21A8' : '#374151' }}>
                {PLAN_PRICE[key]}
              </span>
            </button>
          ))}
        </div>

        {/* 결제 버튼 */}
        <button
          onClick={handleCheckout}
          disabled={loading || !paddle}
          style={{
            width: '100%', padding: '16px',
            backgroundColor: loading || !paddle ? '#e5e7eb' : '#6B21A8',
            color: loading || !paddle ? '#9ca3af' : 'white',
            border: 'none', fontSize: '14px', fontWeight: 600,
            cursor: loading || !paddle ? 'not-allowed' : 'pointer',
            letterSpacing: '0.5px', transition: 'all 0.2s',
          }}
        >
          {loading ? '처리 중...' : !paddle ? '로딩 중...' : `${PLAN_PRICE[selected]} 결제하기`}
        </button>

        <p style={{ fontSize: '10px', color: '#9ca3af', textAlign: 'center', marginTop: '12px', lineHeight: 1.6 }}>
          Paddle을 통해 안전하게 처리됩니다 · 구독은 언제든 해지 가능
        </p>
      </div>
    </div>
  );
}
