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
          setProgress({ phase: 'done', current: 0, total: 0, message: '전환 완료' });
        } else {
          await migrateCloudToLocal(token, setProgress);
        }
      }

      setStep('done');
      onModeChanged(target);
    } catch (e: any) {
      setErrorMsg(e.message || '전환 중 오류가 발생했습니다.');
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
              <h3 style={{ fontSize: '16px', fontWeight: 400 }}>저장 방식 변경</h3>
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
                    이 기기에만 저장
                    <span style={{ fontSize: '11px', color: '#6B21A8', marginLeft: '6px' }}>무료</span>
                  </p>
                  <p style={{ fontSize: '10px', color: '#9ca3af' }}>개인정보 보호 최우선</p>
                </div>
                {currentMode === 'local' && <span style={{ fontSize: '11px', color: '#6B21A8' }}>현재</span>}
              </div>
              {currentMode === 'cloud' && (
                <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.5 }}>
                  서버 데이터를 이 기기에 다운로드합니다.<br />
                  <span style={{ color: '#f97316' }}>⚠ 서버 데이터는 15일 후 자동 삭제됩니다.</span>
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
                    클라우드 동기화
                    <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '6px' }}>추후 구독</span>
                  </p>
                  <p style={{ fontSize: '10px', color: '#9ca3af' }}>여러 기기 · 커뮤니티 · 챌린지</p>
                </div>
                {currentMode === 'cloud' && <span style={{ fontSize: '11px', color: '#0ea5e9' }}>현재</span>}
              </div>
              {currentMode === 'local' && (
                <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.5 }}>
                  로컬 데이터를 서버로 업로드합니다.<br />
                  <span style={{ color: '#6B21A8' }}>Wi-Fi 환경 권장</span>
                </p>
              )}
              <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>베타 기간 중 무료 제공</p>
            </div>
            <div style={{ height: '8px' }} />
          </>
        )}

        {/* ── Wi-Fi 경고 ── */}
        {step === 'wifi-warn' && (
          <>
            <div style={{ textAlign: 'center', padding: '12px 0 24px' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>📶</span>
              <h3 style={{ fontSize: '16px', fontWeight: 400, marginBottom: '10px' }}>모바일 데이터 사용 중</h3>
              <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.7 }}>
                현재 네트워크: <strong>{getNetworkType()}</strong><br />
                사진 업로드 시 데이터 요금이 발생할 수 있습니다.<br />
                Wi-Fi 연결 후 진행을 권장합니다.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => startMigration(targetMode!)}
                style={{ width: '100%', padding: '14px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' }}
              >
                데이터 요금을 감수하고 계속
              </button>
              <button
                onClick={onClose}
                style={{ width: '100%', padding: '12px', backgroundColor: 'white', color: '#9ca3af', border: '1px solid #e5e7eb', fontSize: '13px', cursor: 'pointer' }}
              >
                취소 (나중에 Wi-Fi에서)
              </button>
            </div>
          </>
        )}

        {/* ── 진행 중 ── */}
        {step === 'migrating' && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#9ca3af', letterSpacing: '1px', marginBottom: '24px' }}>
              {targetMode === 'cloud' ? '☁️ 클라우드로 업로드 중' : '📱 기기로 다운로드 중'}
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
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '16px' }}>앱을 닫지 마세요</p>
            <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }`}</style>
          </div>
        )}

        {/* ── 완료 ── */}
        {step === 'done' && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>
              {targetMode === 'cloud' ? '☁️' : '📱'}
            </span>
            <h3 style={{ fontSize: '16px', fontWeight: 400, marginBottom: '8px' }}>전환 완료</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.7, marginBottom: '8px' }}>
              {progress.message}
            </p>
            {targetMode === 'local' && (
              <p style={{ fontSize: '12px', color: '#f97316', marginBottom: '20px' }}>
                서버 데이터는 15일 후 자동 삭제됩니다.<br />
                설정에서 언제든지 취소할 수 있습니다.
              </p>
            )}
            <button
              onClick={onClose}
              style={{ padding: '12px 32px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' }}
            >
              확인
            </button>
          </div>
        )}

        {/* ── 오류 ── */}
        {step === 'error' && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>⚠️</span>
            <h3 style={{ fontSize: '16px', fontWeight: 400, marginBottom: '8px' }}>전환 실패</h3>
            <p style={{ fontSize: '13px', color: '#ef4444', marginBottom: '20px' }}>{errorMsg}</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                onClick={() => setStep('select')}
                style={{ padding: '10px 20px', backgroundColor: 'white', color: 'black', border: '1px solid #e5e7eb', fontSize: '13px', cursor: 'pointer' }}
              >
                다시 시도
              </button>
              <button
                onClick={onClose}
                style={{ padding: '10px 20px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '13px', cursor: 'pointer' }}
              >
                닫기
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
