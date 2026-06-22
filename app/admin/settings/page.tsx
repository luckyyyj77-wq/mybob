"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type BannerType = 'info' | 'warning' | 'event';

const BANNER_TYPE_LABEL: Record<BannerType, string> = {
  info: '📢 공지',
  warning: '⚠️ 점검',
  event: '🎉 이벤트',
};

const BANNER_TYPE_COLOR: Record<BannerType, string> = {
  info: '#1e40af',
  warning: '#b45309',
  event: '#6B21A8',
};

export default function AdminSettingsPage() {
  const [message, setMessage] = useState('');
  const [type, setType] = useState<BannerType>('info');
  const [active, setActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/banner')
      .then(r => r.json())
      .then(data => {
        if (data.banner) {
          setMessage(data.banner.message || '');
          setType(data.banner.type || 'info');
          setActive(data.banner.active || false);
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/admin/banner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ message, type, active }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid #6B21A8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '640px' }}>

      <div>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>SETTINGS</p>
        <h1 style={{ fontSize: '22px', fontWeight: 400, color: '#0f0f0f', lineHeight: 1 }}>앱 설정</h1>
      </div>

      {/* 공지 배너 설정 */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase' }}>공지 배너</p>

        {/* 미리보기 */}
        {message && (
          <div style={{ padding: '12px 16px', backgroundColor: BANNER_TYPE_COLOR[type], color: 'white', fontSize: '13px', lineHeight: 1.5 }}>
            {BANNER_TYPE_LABEL[type]} {message}
          </div>
        )}

        {/* 타입 선택 */}
        <div>
          <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>배너 종류</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(Object.keys(BANNER_TYPE_LABEL) as BannerType[]).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  padding: '8px 14px', fontSize: '12px', border: '1px solid',
                  borderColor: type === t ? BANNER_TYPE_COLOR[t] : '#e5e7eb',
                  backgroundColor: type === t ? BANNER_TYPE_COLOR[t] : 'white',
                  color: type === t ? 'white' : '#6b7280',
                  cursor: 'pointer',
                }}
              >
                {BANNER_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        {/* 메시지 입력 */}
        <div>
          <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>메시지 <span style={{ color: '#9ca3af' }}>({message.length}/200)</span></p>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value.slice(0, 200))}
            placeholder="앱 상단에 표시될 공지 내용을 입력하세요"
            rows={3}
            style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #e5e7eb', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>

        {/* 활성화 토글 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '13px', color: '#374151' }}>배너 표시</p>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>비활성화 시 배너가 앱에 노출되지 않습니다</p>
          </div>
          <button
            onClick={() => setActive(v => !v)}
            style={{
              width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
              backgroundColor: active ? '#6B21A8' : '#e5e7eb', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: '3px', left: active ? '23px' : '3px',
              width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white', transition: 'left 0.2s',
            }} />
          </button>
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '12px', backgroundColor: saved ? '#16a34a' : 'black', color: 'white', border: 'none', fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: '1px', transition: 'background 0.2s' }}
        >
          {saved ? '✓ 저장 완료' : saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
