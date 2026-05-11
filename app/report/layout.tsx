"use client";

import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import { usePathname } from 'next/navigation';

export default function ReportLayout({ children }: { children: React.ReactNode }) {
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
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>ANALYSIS</p>
            <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>리포트</h1>
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
            { label: '일간', href: '/report/daily' },
            { label: '주간', href: '/report/weekly' },
            { label: '월간', href: '/report/monthly' },
            { label: '진단', href: '/report/diagnosis' },
          ].map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  fontSize: '12px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  textAlign: 'center',
                  color: active ? 'white' : 'black',
                  backgroundColor: active ? 'black' : 'white',
                  borderRight: '1px solid #e5e7eb',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </Link>
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
