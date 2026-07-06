"use client";

import { Link } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { FaArrowLeft } from 'react-icons/fa';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { isNativeApp } from '@/lib/native-app';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';

const UpgradeModal = dynamic(() => import('@/components/UpgradeModal'), { ssr: false });

type FoundingInfo = {
  joinedAt: string;
  daysUsed: number;
  rewardMonths: number;
  daysLeft: number;
  promotionEndsAt: string;
};

type PlanStatus = {
  plan: 'free' | 'pro' | 'lifetime';
  upload: { used: number; limit: number; remaining: number };
  analysis: { used: number; limit: number; remaining: number };
  autoCancel: boolean;
  isFoundingMember?: boolean;
  foundingInfo?: FoundingInfo | null;
  remainingSlots?: number | null;
};

const PLAN_COLOR: Record<string, string> = { free: '#9ca3af', pro: '#6B21A8', lifetime: '#d97706' };

export default function PlanPage() {
  const { token, session } = useAuth();
  const t = useTranslations('Settings');
  const searchParams = useSearchParams();
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelMsg, setCancelMsg] = useState('');
  const [cancelStep, setCancelStep] = useState<0 | 1 | 2>(0); // 0=기본 1=1차확인 2=처리중
  // Google Play 정책: 앱 내에서 외부 결제(LS 체크아웃) 동선 노출 금지 → 업그레이드 섹션 숨김
  const [nativeApp, setNativeApp] = useState(false);
  useEffect(() => { setNativeApp(isNativeApp()); }, []);

  useEffect(() => {
    if (session?.user?.email) setUserEmail(session.user.email);
    if (!token) { setPlanLoaded(true); return; }
    fetch('/api/upload-status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPlanStatus(data); })
      .finally(() => setPlanLoaded(true));
  }, [token, session]);

  async function handleCancelConfirm() {
    if (!token || cancelling) return;
    setCancelling(true);
    setCancelStep(2);
    setCancelMsg('');
    try {
      const res = await fetch('/api/lemonsqueezy/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) {
        setCancelMsg(t('cancelSuccess'));
        setCancelStep(0);
        fetch('/api/upload-status', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data) setPlanStatus(data); });
      } else {
        setCancelMsg(json.error === 'NO_SUBSCRIPTION' ? t('cancelNoSub') : t('cancelError'));
        setCancelStep(0);
      }
    } catch {
      setCancelMsg(t('cancelNetworkError'));
      setCancelStep(0);
    } finally {
      setCancelling(false);
    }
  }

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
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>{t('planTitle')}</h1>
        </div>
        <Link href="/settings" style={{ textDecoration: 'none' }}>
          <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaArrowLeft size={13} color="black" />
          </div>
        </Link>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>{t('currentPlan')}</p>
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
                    {planStatus.isFoundingMember ? (
                      <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'white', backgroundColor: '#6B21A8', padding: '3px 8px' }}>
                        {t('foundingMemberPro')}
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'white', backgroundColor: PLAN_COLOR[planStatus.plan], padding: '3px 8px' }}>
                        {planStatus.plan === 'free' ? t('planLabelFree') : planStatus.plan === 'pro' ? t('planLabelPro') : t('planLabelLifetime')}
                      </span>
                    )}
                    <span style={{ fontSize: '13px', color: 'black' }}>{t('usingPlan')}</span>
                  </div>
                  {planStatus.plan === 'free' && !planStatus.isFoundingMember && planStatus.remainingSlots != null && planStatus.remainingSlots > 0 && (
                    <span style={{ fontSize: '11px', color: '#6B21A8', letterSpacing: '0.3px' }}>
                      {t('foundingSeats').replace('{n}', String(planStatus.remainingSlots))}
                    </span>
                  )}
                </div>

                {planStatus.isFoundingMember && planStatus.foundingInfo && (
                  <div style={{ backgroundColor: '#f5f3ff', border: '1px solid #e9d5ff', padding: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#6B21A8', letterSpacing: '0.5px' }}>{t('promotionDaysLeft')}</span>
                      <span style={{ fontSize: '11px', color: '#6B21A8', fontWeight: 600 }}>D-{planStatus.foundingInfo.daysLeft}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>{t('daysUsed')}</span>
                      <span style={{ fontSize: '11px', color: 'black' }}>{t('daysUnit').replace('{n}', String(planStatus.foundingInfo.daysUsed))}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>{t('estimatedReward')}</span>
                      <span style={{ fontSize: '11px', color: planStatus.foundingInfo.rewardMonths > 0 ? '#6B21A8' : '#9ca3af' }}>
                        {planStatus.foundingInfo.rewardMonths > 0
                          ? t('rewardMonths').replace('{n}', String(planStatus.foundingInfo.rewardMonths))
                          : t('rewardMinDays')}
                      </span>
                    </div>
                  </div>
                )}

                {!planStatus.isFoundingMember && planStatus.remainingSlots != null && planStatus.remainingSlots > 0 && planStatus.plan === 'free' && (
                  <div style={{ backgroundColor: '#f5f3ff', border: '1px solid #e9d5ff', padding: '12px', marginBottom: '12px' }}>
                    <p style={{ fontSize: '12px', color: '#6B21A8', marginBottom: '4px' }}>{t('seatsLeft').replace('{n}', String(planStatus.remainingSlots))}</p>
                    <p style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.5 }}>{t('seatsLeftDesc')}</p>
                  </div>
                )}

                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{t('aiAnalysisToday')}</span>
                    <span style={{ fontSize: '11px', color: planStatus.analysis.used >= planStatus.analysis.limit ? '#ef4444' : 'black' }}>
                      {planStatus.analysis.used} / {planStatus.analysis.limit}
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
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{t('cloudSaveToday')}</span>
                    <span style={{ fontSize: '11px', color: planStatus.upload.used >= planStatus.upload.limit ? '#ef4444' : 'black' }}>
                      {planStatus.upload.used} / {planStatus.upload.limit}
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

                {planStatus.plan === 'free' && !planStatus.isFoundingMember && (
                  <p style={{ fontSize: '10px', color: '#9ca3af', lineHeight: 1.5 }}>
                    {t('promotionNote')}
                  </p>
                )}
                {planStatus.plan === 'pro' && planStatus.autoCancel && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', marginBottom: '0', marginTop: '10px' }}>
                    <span style={{ fontSize: '13px', flexShrink: 0 }}>⏱️</span>
                    <p style={{ fontSize: '11px', color: '#6B21A8', lineHeight: 1.6, margin: 0 }}>
                      {t('autoCancelNote')}
                    </p>
                  </div>
                )}
                {planStatus.plan === 'pro' && (
                  <div style={{ marginTop: '12px', borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
                    {cancelStep === 0 && (
                      <button
                        onClick={() => setCancelStep(1)}
                        style={{
                          padding: '6px 12px', backgroundColor: 'white', color: '#9ca3af',
                          border: '1px solid #e5e7eb', fontSize: '11px', cursor: 'pointer',
                        }}
                      >
                        {t('cancelBtn')}
                      </button>
                    )}
                    {cancelStep === 1 && (
                      <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', padding: '14px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 500, color: '#92400e', marginBottom: '6px' }}>
                          {t('cancelConfirmTitle')}
                        </p>
                        <p style={{ fontSize: '11px', color: '#b45309', lineHeight: 1.6, marginBottom: '12px' }}>
                          {t('cancelConfirmDesc')}
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={handleCancelConfirm}
                            style={{
                              padding: '7px 14px', backgroundColor: '#ef4444', color: 'white',
                              border: 'none', fontSize: '11px', cursor: 'pointer', fontWeight: 500,
                            }}
                          >
                            {t('cancelConfirmBtn')}
                          </button>
                          <button
                            onClick={() => setCancelStep(0)}
                            style={{
                              padding: '7px 14px', backgroundColor: 'white', color: '#374151',
                              border: '1px solid #d1d5db', fontSize: '11px', cursor: 'pointer',
                            }}
                          >
                            {t('cancelKeepBtn')}
                          </button>
                        </div>
                      </div>
                    )}
                    {cancelStep === 2 && (
                      <p style={{ fontSize: '11px', color: '#9ca3af' }}>{t('cancelProcessing')}</p>
                    )}
                    {cancelMsg && (
                      <p style={{ fontSize: '11px', color: '#6B21A8', marginTop: '8px', lineHeight: 1.5 }}>{cancelMsg}</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p style={{ fontSize: '13px', color: '#9ca3af' }}>{t('loginRequired')}</p>
            )}
          </div>
        </div>

        {planStatus?.plan === 'free' && !nativeApp && (
          <>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>{t('proBenefits')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: '28px' }}>
              {(t.raw('proFeatures') as { icon: string; text: string }[]).map((item, i) => (
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
              {t('upgradeBtn')}
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
