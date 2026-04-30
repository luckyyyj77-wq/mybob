"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaArrowLeft } from 'react-icons/fa';

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '40px 32px 0', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
              SOCIAL
            </p>
            <h1 style={{ fontSize: '30px', fontWeight: 400, color: 'black', letterSpacing: '-0.5px', lineHeight: 1 }}>
              커뮤니티
            </h1>
          </div>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{
              padding: '10px 16px',
              border: '1px solid #e5e7eb',
              fontSize: '12px',
              color: 'black',
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <FaArrowLeft size={10} /> 홈
            </div>
          </Link>
        </div>

        {/* Tab Nav */}
        <nav style={{ display: 'flex', marginTop: '24px' }}>
          {[
            { label: '추천 피드', href: '/community/recommendation' },
            { label: '챌린지', href: '/community/challenge' },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: '12px 24px',
                fontSize: '13px',
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

      {/* Content */}
      <main style={{ flex: 1, padding: '32px' }}>
        {children}
      </main>
    </div>
  );
}
