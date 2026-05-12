"use client";

import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import { usePathname, useRouter } from 'next/navigation';

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

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
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>ANALYSIS</p>
            <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>리포트</h1>
          </div>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaArrowLeft size={13} color="black" />
            </div>
          </Link>
        </div>

        {/* Tabs — button 기반으로 터치 반응성 개선 */}
        <nav style={{ display: 'flex' }}>
          {[
            { label: '일간', href: '/report/daily' },
            { label: '주간', href: '/report/weekly' },
            { label: '월간', href: '/report/monthly' },
            { label: '진단', href: '/report/diagnosis' },
          ].map((tab, i) => {
            const active = pathname === tab.href;
            return (
              <button
                key={tab.href}
                onPointerDown={() => router.push(tab.href)}
                style={{
                  flex: 1,
                  minHeight: '48px',
                  padding: '0',
                  fontSize: '12px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  color: active ? 'white' : 'black',
                  backgroundColor: active ? 'black' : 'white',
                  borderLeft: i === 0 ? '1px solid #e5e7eb' : 'none',
                  borderRight: '1px solid #e5e7eb',
                  borderTop: 'none',
                  borderBottom: 'none',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  transition: 'all 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1px 0 0' }}>
        {children}
      </div>
    </div>
  );
}
