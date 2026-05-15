"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import { supabase } from '@/lib/supabase/client';

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [plan, setPlan] = useState<'free' | 'pro' | 'lifetime' | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);

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
          setNickname(data.nickname ?? null);
        } else {
          setPlan('free');
        }
      } catch {
        setPlan('free');
      }
    });
  }, []);

  if (plan === null) return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' }}>
      <div style={{ width: '22px', height: '22px', border: '2px solid #e5e7eb', borderTopColor: 'black', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const isPro = plan === 'pro' || plan === 'lifetime';

  return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '24px 24px 0', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>SOCIAL</p>
            <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>커뮤니티</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {nickname && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#6B21A8', letterSpacing: '0.5px' }}>{nickname}</span>
                {isPro && (
                  <span style={{ fontSize: '9px', backgroundColor: '#6B21A8', color: 'white', padding: '2px 5px', letterSpacing: '0.5px' }}>PRO</span>
                )}
              </div>
            )}
            <Link href="/" style={{ textDecoration: 'none' }}>
              <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FaArrowLeft size={13} color="black" />
              </div>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <nav style={{ display: 'flex' }}>
          {[
            { label: '추천', href: '/community/recommendation', proOnly: false },
            { label: '마이페이지', href: '/community/mypage', proOnly: false },
            { label: '이웃', href: '/community/neighbors', proOnly: false },
            { label: '챌린지', href: '/community/challenge', proOnly: true },
          ].map((tab, i) => {
            const active = pathname === tab.href || (tab.href === '/community/mypage' && pathname?.startsWith('/community/mypage'));
            const locked = tab.proOnly && !isPro;
            return (
              <Link
                key={tab.href}
                href={locked ? '#' : tab.href}
                style={{
                  flex: 1, padding: '10px 0', fontSize: '11px', textAlign: 'center',
                  color: active ? 'white' : locked ? '#d1d5db' : 'black',
                  backgroundColor: active ? 'black' : 'white',
                  textDecoration: 'none',
                  borderLeft: i === 0 ? '1px solid #e5e7eb' : 'none',
                  borderRight: '1px solid #e5e7eb',
                  letterSpacing: '0.5px',
                  cursor: locked ? 'default' : 'pointer',
                }}
              >
                {tab.label}{locked ? ' 🔒' : ''}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
