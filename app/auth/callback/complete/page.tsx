"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { isOnboardingDone } from '@/lib/storage-mode';

export default function CallbackComplete() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/auth/login');
        return;
      }
      // 프로필 초기화 + 천인회 슬롯 선점 (fire-and-forget)
      fetch('/api/upload-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
      router.replace(isOnboardingDone() ? '/' : '/onboarding');
    });
  }, [router]);

  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid #6B21A8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
