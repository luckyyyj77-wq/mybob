"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import { supabase } from '@/lib/supabase/client';

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [plan, setPlan] = useState<'free' | 'pro' | 'lifetime' | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.access_token) { setPlan('free'); return; }
      try {
        const res = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPlan(data.plan ?? 'free');
        } else {
          setPlan('free');
        }
      } catch {
        setPlan('free');
      }
    });
  }, []);

  // 플랜 확인 전 — 빈 화면 (레이아웃 깜빡임 방지)
  if (plan === null) return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' }}>
      <div style={{ width: '22px', height: '22px', border: '2px solid #e5e7eb', borderTopColor: 'black', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // 무료 플랜 — 잠금 화면
  if (plan === 'free') return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '24px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>SOCIAL</p>
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>커뮤니티</h1>
        </div>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaArrowLeft size={13} color="black" />
          </div>
        </Link>
      </div>

      {/* 잠금 본문 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', gap: '0' }}>
        <span style={{ fontSize: '48px', marginBottom: '20px' }}>🔒</span>
        <p style={{ fontSize: '18px', color: 'black', marginBottom: '8px', textAlign: 'center' }}>PRO 전용 기능입니다</p>
        <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', lineHeight: 1.7, marginBottom: '32px' }}>
          커뮤니티 피드, 챌린지, 소셜 기능은<br />PRO 플랜에서 사용할 수 있습니다.
        </p>

        {/* 업그레이드 유도 카드 */}
        <div style={{ width: '100%', maxWidth: '320px', border: '1px solid #e5e7eb', padding: '20px', textAlign: 'center', marginBottom: '16px' }}>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>PRO 플랜</p>
          <p style={{ fontSize: '28px', color: '#6B21A8', marginBottom: '4px' }}>월 900원</p>
          <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '16px' }}>광고 없음 · 하루 25회 분석 · 소셜 기능</p>
          <button
            onClick={() => alert('결제 기능 준비 중입니다.')}
            style={{ width: '100%', padding: '13px', backgroundColor: '#6B21A8', color: 'white', border: 'none', fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' }}
          >
            업그레이드 (준비 중)
          </button>
        </div>

        <Link href="/" style={{ fontSize: '12px', color: '#9ca3af', textDecoration: 'none' }}>홈으로 돌아가기</Link>
      </div>
    </div>
  );

  // PRO / lifetime — 정상 렌더
  return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '24px 24px 0', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>SOCIAL</p>
            <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>커뮤니티</h1>
          </div>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaArrowLeft size={13} color="black" />
            </div>
          </Link>
        </div>

        {/* Tabs */}
        <nav style={{ display: 'flex' }}>
          {[
            { label: '추천 피드', href: '/community/recommendation' },
            { label: '챌린지', href: '/community/challenge' },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: '10px 20px', fontSize: '12px',
                color: pathname === tab.href ? 'white' : '#9ca3af',
                backgroundColor: pathname === tab.href ? 'black' : 'white',
                textDecoration: 'none',
                borderRight: '1px solid #e5e7eb',
                letterSpacing: '1px', textTransform: 'uppercase',
              }}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {children}
      </div>
    </div>
  );
}
