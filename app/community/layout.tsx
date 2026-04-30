"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaArrowLeft } from 'react-icons/fa';

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{
      height: 'calc(100svh - 65px)',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'white',
      overflow: 'hidden',
    }}>
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
                padding: '10px 20px',
                fontSize: '12px',
                color: pathname === tab.href ? 'white' : '#9ca3af',
                backgroundColor: pathname === tab.href ? 'black' : 'white',
                textDecoration: 'none',
                borderRight: '1px solid #e5e7eb',
                letterSpacing: '1px',
                textTransform: 'uppercase',
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
