"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setStorageMode, markOnboardingDone } from '@/lib/storage-mode';

type Step = 'intro' | 'choose' | 'confirm';

export default function OnboardingPage() {
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

  /* ── Step: 인트로 ── */
  if (step === 'intro') return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '48px 32px 0' }}>
        <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '12px' }}>MYBOB</p>
        <h1 style={{ fontSize: '28px', fontWeight: 400, color: 'black', letterSpacing: '-0.5px', lineHeight: 1.3, marginBottom: '32px' }}>
          환영합니다
        </h1>
      </div>

      <div style={{ flex: 1, padding: '0 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[
          { icon: '📱', title: '내 기록은 내 것', desc: 'MyBob은 기본적으로 모든 데이터를 이 기기에만 저장합니다. 사진, 식단 기록, 영양 정보 — 서버로 보내지 않습니다.' },
          { icon: '☁️', title: '클라우드는 선택 사항', desc: '여러 기기에서 사용하거나 커뮤니티 기능을 원한다면 클라우드 저장을 선택할 수 있습니다. 추후 구독 서비스로 제공될 예정입니다.' },
          { icon: '🔄', title: '언제든지 변경 가능', desc: '설정 > 저장 방식에서 로컬 ↔ 클라우드를 자유롭게 전환할 수 있습니다. 데이터는 전환 시 함께 이동됩니다.' },
          { icon: '🗑️', title: '완전한 삭제 권리', desc: '클라우드 사용 중 언제든지 서버 데이터 삭제를 요청할 수 있습니다. 15일의 유예 기간 후 완전히 삭제됩니다.' },
        ].map(item => (
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
          저장 방식 선택하기 →
        </button>
      </div>
    </div>
  );

  /* ── Step: 선택 ── */
  if (step === 'choose') return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '48px 32px 24px' }}>
        <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '12px' }}>STEP 1 OF 1</p>
        <h1 style={{ fontSize: '24px', fontWeight: 400, color: 'black', letterSpacing: '-0.5px', lineHeight: 1.3 }}>
          어떻게 사용하실 건가요?
        </h1>
        <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '8px' }}>나중에 설정에서 언제든 바꿀 수 있습니다.</p>
      </div>

      <div style={{ flex: 1, padding: '0 32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* 로컬 카드 */}
        <div onClick={() => setSelected('local')} style={card(selected === 'local')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}>📱</span>
              <div>
                <p style={{ fontSize: '16px', fontWeight: 400, color: 'black' }}>이 기기에만 저장</p>
                <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase' }}>LOCAL · 무료</p>
              </div>
            </div>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${selected === 'local' ? 'black' : '#d1d5db'}`, backgroundColor: selected === 'local' ? 'black' : 'white', flexShrink: 0 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { text: '개인정보 보호 최우선 — 서버 전송 없음', warn: false },
              { text: '이 기기에서만 사용 가능', warn: false },
              { text: '이웃·피드 공유 등 커뮤니티 기능 제한', warn: false },
              { text: '기기 분실 시 데이터 복구 불가', warn: true },
            ].map((item) => (
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
                <p style={{ fontSize: '16px', fontWeight: 400, color: 'black' }}>클라우드 동기화</p>
                <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase' }}>CLOUD · 추후 구독</p>
              </div>
            </div>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${selected === 'cloud' ? 'black' : '#d1d5db'}`, backgroundColor: selected === 'cloud' ? 'black' : 'white', flexShrink: 0 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              '여러 기기에서 동기화',
              '이웃 추가 및 피드 공유 가능 (PRO)',
              '커뮤니티·챌린지 참여 가능',
              '기기 분실 시 복구 가능',
            ].map((t) => (
              <p key={t} style={{ fontSize: '12px', color: '#6b7280', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <span style={{ color: '#6B21A8', fontSize: '11px', flexShrink: 0, marginTop: '1px' }}>✓</span>
                {t}
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
          다음 →
        </button>
        <button
          onClick={() => setStep('intro')}
          style={{ width: '100%', padding: '12px', backgroundColor: 'white', color: '#9ca3af', border: 'none', fontSize: '13px', cursor: 'pointer' }}
        >
          뒤로
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
          {selected === 'local' ? '로컬 저장' : '클라우드 동기화'}으로 시작합니다
        </h2>
        <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.6 }}>
          {selected === 'local'
            ? '모든 데이터는 이 기기에만 저장됩니다.\n설정에서 언제든지 클라우드로 전환할 수 있습니다.'
            : '식단 기록이 서버에 동기화됩니다.\n설정에서 언제든지 로컬로 전환하고 서버 데이터를 삭제할 수 있습니다.'}
        </p>
      </div>

      {selected === 'cloud' && (
        <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', padding: '16px', marginBottom: '24px' }}>
          <p style={{ fontSize: '12px', color: '#9a3412', lineHeight: 1.6 }}>
            <strong>개인정보 동의:</strong> 클라우드 저장을 선택하면 식단 사진 및 영양 기록이 서버에 전송됩니다.
            커뮤니티 기능 활성화 시 일부 데이터가 다른 사용자에게 표시될 수 있습니다.
            언제든지 설정에서 삭제 요청할 수 있습니다.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={handleConfirm}
          style={{ width: '100%', padding: '16px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '14px', cursor: 'pointer', letterSpacing: '1px' }}
        >
          시작하기
        </button>
        <button
          onClick={() => setStep('choose')}
          style={{ width: '100%', padding: '12px', backgroundColor: 'white', color: '#9ca3af', border: 'none', fontSize: '13px', cursor: 'pointer' }}
        >
          다시 선택하기
        </button>
      </div>
    </div>
  );
}
