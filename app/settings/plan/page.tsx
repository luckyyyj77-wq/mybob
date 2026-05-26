"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FaArrowLeft } from 'react-icons/fa';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import dynamic from 'next/dynamic';

const UpgradeModal = dynamic(() => import('@/components/UpgradeModal'), { ssr: false });

type PlanStatus = {
  plan: 'free' | 'pro' | 'lifetime';
  upload: { used: number; limit: number; remaining: number };
  analysis: { used: number; limit: number; remaining: number };
};

const PLAN_LABEL: Record<string, string> = { free: '무료', pro: '구독 PRO', lifetime: '평생 이용권' };
const PLAN_COLOR: Record<string, string> = { free: '#9ca3af', pro: '#6B21A8', lifetime: '#d97706' };

export default function PlanPage() {
  const { token, session } = useAuth();
  const searchParams = useSearchParams();
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    if (session?.user?.email) setUserEmail(session.user.email);
    if (!token) { setPlanLoaded(true); return; }
    fetch('/api/upload-status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPlanStatus(data); })
      .finally(() => setPlanLoaded(true));
  }, [token, session]);

  useEffect(() => {
    if (searchParams.get('upgraded') !== '1' || !token) return;
    fetch('/api/upload-status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPlanStatus(data); });
    window.history.replaceState({}, '', '/settings/plan');
  }, [searchParams, token]);

  return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden' }}>

      <div style={{ flexShrink: 0, padding: '24px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>SETTINGS</p>
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>이용 플랜</h1>
        </div>
        <Link href="/settings" style={{ textDecoration: 'none' }}>
          <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaArrowLeft size={13} color="black" />
          </div>
        </Link>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>현재 플랜</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: '28px' }}>
          <div style={{ padding: '16px', backgroundColor: 'white' }}>
            {!planLoaded ? (
              <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid #e5e7eb', borderTopColor: '#6B21A8', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : planStatus ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'white', backgroundColor: PLAN_COLOR[planStatus.plan], padding: '3px 8px' }}>
                      {PLAN_LABEL[planStatus.plan]}
                    </span>
                    <span style={{ fontSize: '13px', color: 'black' }}>이용 중</span>
                  </div>
                  {planStatus.plan === 'free' && (
                    <button
                      style={{ padding: '6px 12px', backgroundColor: '#6B21A8', color: 'white', border: 'none', fontSize: '11px', cursor: 'pointer', letterSpacing: '0.5px' }}
                      onClick={() => setShowUpgradeModal(true)}
                    >
                      업그레이드
                    </button>
                  )}
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>오늘 AI 분석</span>
                    <span style={{ fontSize: '11px', color: planStatus.analysis.used >= planStatus.analysis.limit ? '#ef4444' : 'black' }}>
                      {planStatus.analysis.used} / {planStatus.analysis.limit}회
                    </span>
                  </div>
                  <div style={{ height: '3px', backgroundColor: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, (planStatus.analysis.used / planStatus.analysis.limit) * 100)}%`,
                      backgroundColor: planStatus.analysis.used >= planStatus.analysis.limit ? '#ef4444' : '#6B21A8',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>오늘 클라우드 저장</span>
                    <span style={{ fontSize: '11px', color: planStatus.upload.used >= planStatus.upload.limit ? '#ef4444' : 'black' }}>
                      {planStatus.upload.used} / {planStatus.upload.limit}장
                    </span>
                  </div>
                  <div style={{ height: '3px', backgroundColor: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, (planStatus.upload.used / planStatus.upload.limit) * 100)}%`,
                      backgroundColor: planStatus.upload.used >= planStatus.upload.limit ? '#ef4444' : '#9ca3af',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </div>

                {planStatus.plan === 'free' && (
                  <p style={{ fontSize: '10px', color: '#9ca3af', lineHeight: 1.5 }}>
                    PRO로 업그레이드하면 하루 25회 + 광고 없음 + 프리미엄 기능을 이용할 수 있습니다.
                  </p>
                )}
              </>
            ) : (
              <p style={{ fontSize: '13px', color: '#9ca3af' }}>로그인 후 확인 가능합니다.</p>
            )}
          </div>
        </div>

        {planStatus?.plan === 'free' && (
          <>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>PRO 혜택</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: '28px' }}>
              {[
                { icon: '🤖', text: 'AI 분석 하루 25회 (무료: 5회)' },
                { icon: '☁️', text: '클라우드 저장 하루 25장 (무료: 5장)' },
                { icon: '📊', text: '정밀 영양 진단 리포트' },
                { icon: '🎯', text: '맞춤 목표 칼로리 AI 코칭' },
                { icon: '👤', text: '프로필 닉네임 · 사진 변경' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', backgroundColor: 'white' }}>
                  <span style={{ fontSize: '18px' }}>{item.icon}</span>
                  <span style={{ fontSize: '13px', color: 'black' }}>{item.text}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowUpgradeModal(true)}
              style={{
                width: '100%', padding: '14px',
                backgroundColor: '#6B21A8', color: 'white',
                border: 'none', fontSize: '14px',
                cursor: 'pointer', letterSpacing: '0.5px',
              }}
            >
              PRO 업그레이드
            </button>
          </>
        )}
      </div>

      {showUpgradeModal && (
        <UpgradeModal
          userEmail={userEmail}
          userId={session?.user?.id ?? ''}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
