'use client';

import { useState } from 'react';
import { LS_VARIANT_IDS, getLSCheckoutUrl, type LSPlan } from '@/lib/lemonsqueezy';
import { useTranslations } from 'next-intl';

type Props = {
  userEmail: string;
  userId: string;
  onClose: () => void;
};

const PLANS: { key: LSPlan }[] = [
  { key: 'pro_monthly' },
  { key: 'pro_6months' },
  { key: 'pro_yearly' },
];

export default function UpgradeModal({ userEmail, userId, onClose }: Props) {
  const [selected, setSelected] = useState<LSPlan>('pro_monthly');
  const [autoCancel, setAutoCancel] = useState(false);
  const t = useTranslations('Upgrade');
  const tl = useTranslations('LSP');

  function handleCheckout() {
    const variantId = LS_VARIANT_IDS[selected];
    const url = getLSCheckoutUrl(variantId, userEmail, userId, autoCancel);
    window.open(url, '_blank');
  }

  const features = t.raw('features') as string[];
  const notes = t.raw('notes') as string[];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'white', width: '100%', maxWidth: '480px',
          borderRadius: '16px', padding: '28px 24px 32px',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <p style={{ fontSize: '11px', letterSpacing: '2px', color: '#6B21A8', marginBottom: '4px' }}>UPGRADE</p>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'black' }}>{t('title')}</h2>
          </div>
          <button onClick={onClose} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>

        {/* 혜택 목록 */}
        <div style={{ backgroundColor: '#faf5ff', padding: '16px', marginBottom: '20px' }}>
          {features.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ color: '#6B21A8', fontSize: '14px' }}>✓</span>
              <span style={{ fontSize: '13px', color: '#374151' }}>{f}</span>
            </div>
          ))}
        </div>

        {/* 플랜 선택 */}
        <p style={{ fontSize: '11px', letterSpacing: '1px', color: '#9ca3af', marginBottom: '10px' }}>{t('planSelect')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {PLANS.map(({ key }) => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', border: `2px solid ${selected === key ? '#6B21A8' : '#e5e7eb'}`,
                backgroundColor: selected === key ? '#faf5ff' : 'white',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                position: 'relative',
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
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'black' }}>{tl(`labels.${key}`)}</span>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{tl(`descriptions.${key}`)}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: selected === key ? '#6B21A8' : '#374151' }}>
                  {tl(`prices.${key}`)}
                </div>
                {tl(`perMonth.${key}`) && (
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>{tl(`perMonth.${key}`)}</div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* 자동해지 옵션 */}
        <button
          onClick={() => setAutoCancel(v => !v)}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            width: '100%', padding: '12px 14px', marginBottom: '20px',
            backgroundColor: autoCancel ? '#faf5ff' : '#f9fafb',
            border: `1px solid ${autoCancel ? '#a855f7' : '#e5e7eb'}`,
            cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
          }}
        >
          <div style={{
            width: '16px', height: '16px', border: `2px solid ${autoCancel ? '#6B21A8' : '#d1d5db'}`,
            backgroundColor: autoCancel ? '#6B21A8' : 'transparent',
            flexShrink: 0, marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {autoCancel && <span style={{ color: 'white', fontSize: '10px', lineHeight: 1 }}>✓</span>}
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'black', marginBottom: '2px' }}>
              {t('autoCancel.title', { label: tl(`cancelLabels.${selected}`) })}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.5 }}>
              {t('autoCancel.desc', { label: tl(`cancelLabels.${selected}`) })}
            </div>
          </div>
        </button>

        {/* 결제 버튼 */}
        <button
          onClick={handleCheckout}
          style={{
            width: '100%', padding: '16px',
            backgroundColor: '#6B21A8', color: 'white',
            border: 'none', fontSize: '14px', fontWeight: 600,
            cursor: 'pointer', letterSpacing: '0.5px', transition: 'all 0.2s',
          }}
        >
          {t('payBtn', { price: tl(`prices.${selected}`) })}
        </button>

        <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#f9fafb', border: '1px solid #f3f4f6' }}>
          {notes.map((note, i) => (
            <p key={i} style={{ fontSize: '10px', color: '#9ca3af', lineHeight: 1.8, margin: 0 }}>
              · {note}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
