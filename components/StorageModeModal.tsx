"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  migrateLocalToCloud,
  migrateCloudToLocal,
  isOnWifi,
  getNetworkType,
  type MigrationProgress,
} from '@/lib/storage-migration';
import { type StorageMode } from '@/lib/storage-mode';
import { useTranslations } from 'next-intl';

interface Props {
  currentMode: StorageMode;
  onClose: () => void;
  onModeChanged: (mode: StorageMode) => void;
}

type ModalStep = 'select' | 'wifi-warn' | 'migrating' | 'done' | 'error';

export function StorageModeModal({ currentMode, onClose, onModeChanged }: Props) {
  const [step, setStep] = useState<ModalStep>('select');
  const [targetMode, setTargetMode] = useState<StorageMode | null>(null);
  const [progress, setProgress] = useState<MigrationProgress>({
    phase: 'idle', current: 0, total: 0, message: '',
  });
  const [errorMsg, setErrorMsg] = useState('');
  const t = useTranslations('Storage');
  const tc = useTranslations('Common');

  const startMigration = async (target: StorageMode) => {
    setStep('migrating');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (target === 'cloud') {
        if (!token) throw new Error('로그인이 필요합니다.');
        await migrateLocalToCloud(token, setProgress);
      } else {
        if (!token) {
          // 로그인 안 된 경우 — 모드만 전환 (서버 데이터 없음)
          setProgress({ phase: 'done', current: 0, total: 0, message: tc('confirm') });
        } else {
          await migrateCloudToLocal(token, setProgress);
        }
      }

      setStep('done');
      onModeChanged(target);
    } catch (e: any) {
      setErrorMsg(e.message || t('error.title'));
      setStep('error');
    }
  };

  const handleSelectTarget = (target: StorageMode) => {
    if (target === currentMode) { onClose(); return; }
    setTargetMode(target);

    if (target === 'cloud' && !isOnWifi()) {
      setStep('wifi-warn');
    } else {
      startMigration(target);
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div
      onClick={() => step === 'select' && onClose()}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: 'white', width: '100%', borderRadius: '12px 12px 0 0', padding: '24px', maxHeight: '80vh', overflowY: 'auto' }}
      >

        {/* ── 선택 화면 ── */}
        {step === 'select' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 400 }}>{t('title')}</h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#9ca3af', cursor: 'pointer' }}>×</button>
            </div>

            {/* 로컬 카드 */}
            <div
              onClick={() => handleSelectTarget('local')}
              style={{ border: `2px solid ${currentMode === 'local' ? 'black' : '#e5e7eb'}`, padding: '16px', marginBottom: '10px', cursor: 'pointer', backgroundColor: currentMode === 'local' ? '#fafafa' : 'white' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '20px' }}>📱</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', color: 'black' }}>
                    {t('local.title')}
                    <span style={{ fontSize: '11px', color: '#6B21A8', marginLeft: '6px' }}>{t('local.tag')}</span>
                  </p>
                  <p style={{ fontSize: '10px', color: '#9ca3af' }}>{t('local.desc')}</p>
                </div>
                {currentMode === 'local' && <span style={{ fontSize: '11px', color: '#6B21A8' }}>{t('local.current')}</span>}
              </div>
              {currentMode === 'cloud' && (
                <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                  {t('local.detail')}
                </p>
              )}
            </div>

            {/* 클라우드 카드 */}
            <div
              onClick={() => handleSelectTarget('cloud')}
              style={{ border: `2px solid ${currentMode === 'cloud' ? 'black' : '#e5e7eb'}`, padding: '16px', cursor: 'pointer', backgroundColor: currentMode === 'cloud' ? '#fafafa' : 'white' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '20px' }}>☁️</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', color: 'black' }}>
                    {t('cloud.title')}
                    <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '6px' }}>{t('cloud.tag')}</span>
                  </p>
                  <p style={{ fontSize: '10px', color: '#9ca3af' }}>{t('cloud.desc')}</p>
                </div>
                {currentMode === 'cloud' && <span style={{ fontSize: '11px', color: '#0ea5e9' }}>{t('cloud.current')}</span>}
              </div>
              {currentMode === 'local' && (
                <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                  {t('cloud.detail')}
                </p>
              )}
              <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{t('cloud.beta')}</p>
            </div>
            <div style={{ height: '8px' }} />
          </>
        )}

        {/* ── Wi-Fi 경고 ── */}
        {step === 'wifi-warn' && (
          <>
            <div style={{ textAlign: 'center', padding: '12px 0 24px' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>📶</span>
              <h3 style={{ fontSize: '16px', fontWeight: 400, marginBottom: '10px' }}>{t('wifi.title')}</h3>
              <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                {t('wifi.desc', { type: getNetworkType() })}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => startMigration(targetMode!)}
                style={{ width: '100%', padding: '14px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' }}
              >
                {t('wifi.continue')}
              </button>
              <button
                onClick={onClose}
                style={{ width: '100%', padding: '12px', backgroundColor: 'white', color: '#9ca3af', border: '1px solid #e5e7eb', fontSize: '13px', cursor: 'pointer' }}
              >
                {t('wifi.cancel')}
              </button>
            </div>
          </>
        )}

        {/* ── 진행 중 ── */}
        {step === 'migrating' && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#9ca3af', letterSpacing: '1px', marginBottom: '24px' }}>
              {targetMode === 'cloud' ? t('migrating.uploading') : t('migrating.downloading')}
            </p>

            {/* 진행 바 */}
            <div style={{ height: '4px', backgroundColor: '#f3f4f6', borderRadius: '2px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{
                height: '100%',
                width: `${progress.total > 0 ? pct : 30}%`,
                backgroundColor: '#6B21A8',
                transition: 'width 0.4s ease',
                animation: progress.total === 0 ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }} />
            </div>

            <p style={{ fontSize: '12px', color: '#6b7280' }}>{progress.message}</p>
            {progress.total > 0 && (
              <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{pct}%</p>
            )}
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '16px' }}>{t('migrating.dontClose')}</p>
            <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }`}</style>
          </div>
        )}

        {/* ── 완료 ── */}
        {step === 'done' && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>
              {targetMode === 'cloud' ? '☁️' : '📱'}
            </span>
            <h3 style={{ fontSize: '16px', fontWeight: 400, marginBottom: '8px' }}>{t('done.title')}</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.7, marginBottom: '8px' }}>
              {progress.message}
            </p>
            {targetMode === 'local' && (
              <p style={{ fontSize: '12px', color: '#f97316', marginBottom: '20px', whiteSpace: 'pre-line' }}>
                {t('done.localDetail')}
              </p>
            )}
            <button
              onClick={onClose}
              style={{ padding: '12px 32px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' }}
            >
              {tc('confirm')}
            </button>
          </div>
        )}

        {/* ── 오류 ── */}
        {step === 'error' && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>⚠️</span>
            <h3 style={{ fontSize: '16px', fontWeight: 400, marginBottom: '8px' }}>{t('error.title')}</h3>
            <p style={{ fontSize: '13px', color: '#ef4444', marginBottom: '20px' }}>{errorMsg}</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                onClick={() => setStep('select')}
                style={{ padding: '10px 20px', backgroundColor: 'white', color: 'black', border: '1px solid #e5e7eb', fontSize: '13px', cursor: 'pointer' }}
              >
                {tc('retry')}
              </button>
              <button
                onClick={onClose}
                style={{ padding: '10px 20px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '13px', cursor: 'pointer' }}
              >
                {tc('close')}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
