"use client";

import { Link, usePathname } from '@/i18n/routing';
import { useEffect, useState } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import { useAuth } from '@/lib/auth-context';

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { token } = useAuth();
  const [plan, setPlan] = useState<'free' | 'pro' | 'lifetime'>('free');
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setPlan(data.plan ?? 'free');
          setNickname(data.nickname ?? null);
        }
      })
      .catch(() => {});
  }, [token]);

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
            { label: '이웃', href: '/community/neighbors', proOnly: false },
            { label: '챌린지', href: '/community/challenge', proOnly: true },
          ].map((tab, i) => {
            const active = pathname === tab.href;
            const locked = tab.proOnly && !isPro;
            return (
              <Link
                key={tab.href}
                href={locked ? '#' : tab.href}
                style={{
                  flex: 1, padding: '10px 0', fontSize: '12px', textAlign: 'center',
                  color: active ? 'white' : locked ? '#d1d5db' : 'black',
                  backgroundColor: active ? 'black' : 'white',
                  textDecoration: 'none',
                  borderLeft: i === 0 ? '1px solid #e5e7eb' : 'none',
                  borderRight: '1px solid #e5e7eb',
                  letterSpacing: '1px', textTransform: 'uppercase',
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
