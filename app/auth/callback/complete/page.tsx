"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { isOnboardingDone } from '@/lib/storage-mode';

function getLocalePrefix() {
  if (typeof window === 'undefined') return '';
  const lang = navigator.language || '';
  return lang.startsWith('ko') ? '/ko' : '';
}

export default function CallbackComplete() {
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const prefix = getLocalePrefix();

      // code가 있으면 클라이언트에서 세션 교환
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace(`${prefix}/auth/login`);
        return;
      }
      // 프로필 초기화 + 천인회 슬롯 선점 (fire-and-forget)
      fetch('/api/upload-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
      router.replace(isOnboardingDone() ? `${prefix}/` : `${prefix}/onboarding`);
    }
    init();
  }, [router]);

  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid #6B21A8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
