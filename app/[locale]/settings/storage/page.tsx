"use client";

import { Link } from '@/i18n/routing';
import { FaArrowLeft } from 'react-icons/fa';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getStorageMode, type StorageMode } from '@/lib/storage-mode';
import { getCloudDeleteSchedule, cancelCloudDeleteSchedule, requestServerDataDeletion } from '@/lib/storage-migration';
import { StorageModeModal } from '@/components/StorageModeModal';

export default function StoragePage() {
  const { token } = useAuth();
  const [storageMode, setStorageModeState] = useState<StorageMode>('local');
  const [showModeModal, setShowModeModal] = useState(false);
  const [deleteSchedule, setDeleteSchedule] = useState<{ scheduledAt: Date; daysLeft: number } | null>(null);

  useEffect(() => {
    setStorageModeState(getStorageMode());
    setDeleteSchedule(getCloudDeleteSchedule());
  }, []);

  return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden' }}>

      <div style={{ flexShrink: 0, padding: '24px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>SETTINGS</p>
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>저장 방식</h1>
        </div>
        <Link href="/settings" style={{ textDecoration: 'none' }}>
          <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaArrowLeft size={13} color="black" />
          </div>
        </Link>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>현재 저장 방식</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: deleteSchedule ? '12px' : '28px' }}>
          <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>{storageMode === 'local' ? '📱' : '☁️'}</span>
                <div>
                  <p style={{ fontSize: '14px', color: 'black' }}>{storageMode === 'local' ? '로컬 저장' : '클라우드 동기화'}</p>
                  <p style={{ fontSize: '10px', color: storageMode === 'local' ? '#6B21A8' : '#0ea5e9', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    {storageMode === 'local' ? 'LOCAL · 이 기기에만 보관' : 'CLOUD · 서버 동기화 중'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowModeModal(true)} style={{ padding: '6px 12px', border: '1px solid #e5e7eb', backgroundColor: 'white', fontSize: '12px', cursor: 'pointer', color: '#6b7280', letterSpacing: '0.5px' }}>변경</button>
            </div>
            <p style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.5 }}>
              {storageMode === 'local'
                ? '모든 식단 기록과 사진은 이 기기에만 저장됩니다. 서버로 전송되지 않습니다.'
                : '식단 기록이 서버에 동기화됩니다. 여러 기기에서 같은 데이터를 볼 수 있습니다.'}
            </p>
          </div>
        </div>

        {deleteSchedule && (
          <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', padding: '14px 16px', marginBottom: '28px' }}>
            <p style={{ fontSize: '12px', color: '#9a3412', marginBottom: '8px', lineHeight: 1.5 }}>
              ⏳ 서버 데이터가 <strong>{deleteSchedule.daysLeft}일 후</strong> 삭제될 예정입니다.<br />
              ({deleteSchedule.scheduledAt.toLocaleDateString('ko-KR')} 예정)
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={async () => { if (!token) return; if (confirm('지금 즉시 서버 데이터를 삭제하시겠습니까?')) { await requestServerDataDeletion(token); setDeleteSchedule(null); } }}
                style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', fontSize: '11px', cursor: 'pointer' }}>
                지금 삭제
              </button>
              <button onClick={() => { cancelCloudDeleteSchedule(); setDeleteSchedule(null); setStorageModeState('cloud'); }}
                style={{ padding: '6px 12px', backgroundColor: 'white', color: '#6b7280', border: '1px solid #e5e7eb', fontSize: '11px', cursor: 'pointer' }}>
                취소 (클라우드 유지)
              </button>
            </div>
          </div>
        )}

        {/* 모드별 기능 비교 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>기능 비교</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
          {[
            { label: '식단 저장', local: '이 기기에만', cloud: '모든 기기 동기화' },
            { label: '식단 편집', local: '❌ 불가', cloud: '✅ PRO 전용' },
            { label: '다기기 접속', local: '❌ 불가', cloud: '✅ 가능' },
            { label: '이웃 추가/관리', local: '❌ 불가', cloud: '✅ 가능' },
            { label: '이웃 피드 공유', local: '❌ 불가', cloud: '✅ PRO 전용' },
            { label: '커뮤니티 추천 탭', local: '✅ (광고 포함)', cloud: '✅ PRO는 광고 없음' },
          ].map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', backgroundColor: 'white', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ padding: '11px 12px', borderRight: '1px solid #f3f4f6' }}>
                <p style={{ fontSize: '12px', color: '#374151' }}>{row.label}</p>
              </div>
              <div style={{ padding: '11px 12px', borderRight: '1px solid #f3f4f6', backgroundColor: storageMode === 'local' ? '#fafafa' : 'white' }}>
                <p style={{ fontSize: '11px', color: row.local.startsWith('❌') ? '#9ca3af' : '#374151' }}>{row.local}</p>
              </div>
              <div style={{ padding: '11px 12px', backgroundColor: storageMode === 'cloud' ? '#fafafa' : 'white' }}>
                <p style={{ fontSize: '11px', color: row.cloud.startsWith('❌') ? '#9ca3af' : '#374151' }}>{row.cloud}</p>
              </div>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', backgroundColor: '#f9fafb' }}>
            <div style={{ padding: '8px 12px' }} />
            <div style={{ padding: '8px 12px', borderRight: '1px solid #f3f4f6', borderLeft: '1px solid #f3f4f6', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: storageMode === 'local' ? '#6B21A8' : '#9ca3af', letterSpacing: '1px', fontWeight: storageMode === 'local' ? 600 : 400 }}>📱 로컬</p>
            </div>
            <div style={{ padding: '8px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: storageMode === 'cloud' ? '#0ea5e9' : '#9ca3af', letterSpacing: '1px', fontWeight: storageMode === 'cloud' ? 600 : 400 }}>☁️ 클라우드</p>
            </div>
          </div>
        </div>

        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>알림 설정</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: 'white' }}>
            <div>
              <p style={{ fontSize: '14px', color: 'black', marginBottom: '2px' }}>푸시 알림</p>
              <p style={{ fontSize: '11px', color: '#9ca3af' }}>식단 기록 알림 주기 설정</p>
            </div>
            <select defaultValue="1시간 후" style={{ padding: '5px 8px', border: '1px solid #e5e7eb', fontSize: '13px', backgroundColor: 'white', cursor: 'pointer', outline: 'none' }}>
              <option>1시간 후</option>
              <option>2시간 후</option>
              <option>수동</option>
            </select>
          </div>
        </div>
      </div>

      {showModeModal && (
        <StorageModeModal
          currentMode={storageMode}
          onClose={() => setShowModeModal(false)}
          onModeChanged={(mode) => { setStorageModeState(mode); setDeleteSchedule(getCloudDeleteSchedule()); setShowModeModal(false); }}
        />
      )}
    </div>
  );
}
