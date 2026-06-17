"use client";

import { Link } from '@/i18n/routing';
import { FaArrowLeft } from 'react-icons/fa';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTranslations, useLocale } from 'next-intl';
import { getStorageMode, type StorageMode } from '@/lib/storage-mode';
import { getCloudDeleteSchedule, cancelCloudDeleteSchedule, requestServerDataDeletion } from '@/lib/storage-migration';
import { StorageModeModal } from '@/components/StorageModeModal';

export default function StoragePage() {
  const { token } = useAuth();
  const t = useTranslations('Settings');
  const locale = useLocale();
  const [storageMode, setStorageModeState] = useState<StorageMode>('local');
  const [showModeModal, setShowModeModal] = useState(false);
  const [deleteSchedule, setDeleteSchedule] = useState<{ scheduledAt: Date; daysLeft: number } | null>(null);

  const features = t.raw('features') as { label: string; local: string; cloud: string }[];
  const notifOptions = t.raw('notifOptions') as string[];

  useEffect(() => {
    setStorageModeState(getStorageMode());
    setDeleteSchedule(getCloudDeleteSchedule());
  }, []);

  return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden' }}>

      <div style={{ flexShrink: 0, padding: '24px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>SETTINGS</p>
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>{t('storageTitle')}</h1>
        </div>
        <Link href="/settings" style={{ textDecoration: 'none' }}>
          <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaArrowLeft size={13} color="black" />
          </div>
        </Link>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>{t('currentStorage')}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: deleteSchedule ? '12px' : '28px' }}>
          <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>{storageMode === 'local' ? '📱' : '☁️'}</span>
                <div>
                  <p style={{ fontSize: '14px', color: 'black' }}>{storageMode === 'local' ? t('localMode') : t('cloudMode')}</p>
                  <p style={{ fontSize: '10px', color: storageMode === 'local' ? '#6B21A8' : '#0ea5e9', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    {storageMode === 'local' ? t('localBadge') : t('cloudBadge')}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowModeModal(true)} style={{ padding: '6px 12px', border: '1px solid #e5e7eb', backgroundColor: 'white', fontSize: '12px', cursor: 'pointer', color: '#6b7280', letterSpacing: '0.5px' }}>{t('changeBtn')}</button>
            </div>
            <p style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.5 }}>
              {storageMode === 'local' ? t('localDesc') : t('cloudDesc')}
            </p>
          </div>
        </div>

        {deleteSchedule && (
          <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', padding: '14px 16px', marginBottom: '28px' }}>
            <p style={{ fontSize: '12px', color: '#9a3412', marginBottom: '8px', lineHeight: 1.5 }}>
              ⏳ {t('deleteWarning').replace('{days}', String(deleteSchedule.daysLeft))}<br />
              ({deleteSchedule.scheduledAt.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')} scheduled)
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={async () => { if (!token) return; if (confirm(t('deleteConfirm'))) { await requestServerDataDeletion(token); setDeleteSchedule(null); } }}
                style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', fontSize: '11px', cursor: 'pointer' }}>
                {t('deleteNow')}
              </button>
              <button onClick={() => { cancelCloudDeleteSchedule(); setDeleteSchedule(null); setStorageModeState('cloud'); }}
                style={{ padding: '6px 12px', backgroundColor: 'white', color: '#6b7280', border: '1px solid #e5e7eb', fontSize: '11px', cursor: 'pointer' }}>
                {t('cancelDelete')}
              </button>
            </div>
          </div>
        )}

        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>{t('featureCompare')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
          {features.map((row, i) => (
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
              <p style={{ fontSize: '10px', color: storageMode === 'local' ? '#6B21A8' : '#9ca3af', letterSpacing: '1px', fontWeight: storageMode === 'local' ? 600 : 400 }}>{t('localLabel')}</p>
            </div>
            <div style={{ padding: '8px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: storageMode === 'cloud' ? '#0ea5e9' : '#9ca3af', letterSpacing: '1px', fontWeight: storageMode === 'cloud' ? 600 : 400 }}>{t('cloudLabel')}</p>
            </div>
          </div>
        </div>

        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>{t('notificationSettings')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: 'white' }}>
            <div>
              <p style={{ fontSize: '14px', color: 'black', marginBottom: '2px' }}>{t('pushNotif')}</p>
              <p style={{ fontSize: '11px', color: '#9ca3af' }}>{t('pushNotifDesc')}</p>
            </div>
            <select defaultValue={notifOptions[0]} style={{ padding: '5px 8px', border: '1px solid #e5e7eb', fontSize: '13px', backgroundColor: 'white', cursor: 'pointer', outline: 'none' }}>
              {notifOptions.map(opt => <option key={opt}>{opt}</option>)}
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
