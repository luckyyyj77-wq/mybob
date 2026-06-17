"use client";

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { setStorageMode, markOnboardingDone } from '@/lib/storage-mode';
import { useTranslations } from 'next-intl';

type Step = 'intro' | 'choose' | 'confirm';

export default function OnboardingPage() {
  const t = useTranslations('Onboarding');
  const router = useRouter();
  const [step, setStep] = useState<Step>('intro');
  const [selected, setSelected] = useState<'local' | 'cloud' | null>(null);

  const handleConfirm = () => {
    if (!selected) return;
    setStorageMode(selected);
    markOnboardingDone();
    router.replace('/');
  };

  /* ── 공통 스타일 ── */
  const card = (active: boolean): React.CSSProperties => ({
    border: `2px solid ${active ? 'black' : '#e5e7eb'}`,
    padding: '20px',
    cursor: 'pointer',
    backgroundColor: active ? '#fafafa' : 'white',
    transition: 'border-color 0.15s',
    textAlign: 'left',
  });

  const introItemsCount = 4;
  const introItems = Array.from({ length: introItemsCount }, (_, i) => ({
    icon: t(`intro.${i}.icon`),
    title: t(`intro.${i}.title`),
    desc: t(`intro.${i}.desc`),
  }));

  const localItemsCount = 4;
  const localItems = Array.from({ length: localItemsCount }, (_, i) => ({
    text: t(`local.items.${i}.text`),
    warn: t(`local.items.${i}.warn`) === 'true' || t(`local.items.${i}.warn`) === true,
  }));

  const cloudItemsCount = 4;
  const cloudItems = Array.from({ length: cloudItemsCount }, (_, i) => t(`cloud.items.${i}`));

  /* ── Step: 인트로 ── */
  if (step === 'intro') return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '48px 32px 0' }}>
        <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '12px' }}>MYBOB</p>
        <h1 style={{ fontSize: '28px', fontWeight: 400, color: 'black', letterSpacing: '-0.5px', lineHeight: 1.3, marginBottom: '32px' }}>
          {t('welcome')}
        </h1>
      </div>

      <div style={{ flex: 1, padding: '0 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {introItems.map(item => (
          <div key={item.title} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '20px', flexShrink: 0, lineHeight: 1.4 }}>{item.icon}</span>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'black', marginBottom: '4px' }}>{item.title}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '32px' }}>
        <button
          onClick={() => setStep('choose')}
          style={{ width: '100%', padding: '16px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '14px', cursor: 'pointer', letterSpacing: '1px' }}
        >
          {t('chooseBtn')}
        </button>
      </div>
    </div>
  );

  /* ── Step: 선택 ── */
  if (step === 'choose') return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '48px 32px 24px' }}>
        <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '12px' }}>{t('step1')}</p>
        <h1 style={{ fontSize: '24px', fontWeight: 400, color: 'black', letterSpacing: '-0.5px', lineHeight: 1.3 }}>
          {t('howToUse')}
        </h1>
        <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '8px' }}>{t('changeLater')}</p>
      </div>

      <div style={{ flex: 1, padding: '0 32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* 로컬 카드 */}
        <div onClick={() => setSelected('local')} style={card(selected === 'local')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}>📱</span>
              <div>
                <p style={{ fontSize: '16px', fontWeight: 400, color: 'black' }}>{t('local.title')}</p>
                <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase' }}>{t('local.tag')}</p>
              </div>
            </div>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${selected === 'local' ? 'black' : '#d1d5db'}`, backgroundColor: selected === 'local' ? 'black' : 'white', flexShrink: 0 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {localItems.map((item) => (
              <p key={item.text} style={{ fontSize: '12px', color: item.warn ? '#f97316' : '#6b7280', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <span style={{ color: item.warn ? '#f97316' : '#6B21A8', fontSize: '11px', flexShrink: 0, marginTop: '1px' }}>{item.warn ? '⚠' : '✓'}</span>
                {item.text}
              </p>
            ))}
          </div>
        </div>

        {/* 클라우드 카드 */}
        <div onClick={() => setSelected('cloud')} style={card(selected === 'cloud')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}>☁️</span>
              <div>
                <p style={{ fontSize: '16px', fontWeight: 400, color: 'black' }}>{t('cloud.title')}</p>
                <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase' }}>{t('cloud.tag')}</p>
              </div>
            </div>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${selected === 'cloud' ? 'black' : '#d1d5db'}`, backgroundColor: selected === 'cloud' ? 'black' : 'white', flexShrink: 0 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {cloudItems.map((text) => (
              <p key={text} style={{ fontSize: '12px', color: '#6b7280', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <span style={{ color: '#6B21A8', fontSize: '11px', flexShrink: 0, marginTop: '1px' }}>✓</span>
                {text}
              </p>
            ))}
          </div>
        </div>

      </div>

      <div style={{ padding: '24px 32px 32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={() => { if (selected) setStep('confirm'); }}
          disabled={!selected}
          style={{ width: '100%', padding: '16px', backgroundColor: selected ? 'black' : '#e5e7eb', color: selected ? 'white' : '#9ca3af', border: 'none', fontSize: '14px', cursor: selected ? 'pointer' : 'default', letterSpacing: '1px', transition: 'all 0.2s' }}
        >
          {t('next')}
        </button>
        <button
          onClick={() => setStep('intro')}
          style={{ width: '100%', padding: '12px', backgroundColor: 'white', color: '#9ca3af', border: 'none', fontSize: '13px', cursor: 'pointer' }}
        >
          {t('back')}
        </button>
      </div>
    </div>
  );

  /* ── Step: 확인 ── */
  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <span style={{ fontSize: '48px', display: 'block', marginBottom: '20px' }}>{selected === 'local' ? '📱' : '☁️'}</span>
        <h2 style={{ fontSize: '22px', fontWeight: 400, color: 'black', marginBottom: '8px' }}>
          {t('confirmTitle', { mode: selected === 'local' ? t('local.title') : t('cloud.title') })}
        </h2>
        <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {selected === 'local' ? t('confirmLocal') : t('confirmCloud')}
        </p>
      </div>

      {selected === 'cloud' && (
        <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', padding: '16px', marginBottom: '24px' }}>
          <p style={{ fontSize: '12px', color: '#9a3412', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {t('cloudConsent')}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={handleConfirm}
          style={{ width: '100%', padding: '16px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '14px', cursor: 'pointer', letterSpacing: '1px' }}
        >
          {t('startBtn')}
        </button>
        <button
          onClick={() => setStep('choose')}
          style={{ width: '100%', padding: '12px', backgroundColor: 'white', color: '#9ca3af', border: 'none', fontSize: '13px', cursor: 'pointer' }}
        >
          {t('reselect')}
        </button>
      </div>
    </div>
  );
}
