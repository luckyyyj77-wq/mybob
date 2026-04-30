import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '40px 32px 0', borderBottom: '4px solid black' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '0' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '6px' }}>
              ANALYSIS
            </p>
            <h1 style={{ fontSize: '36px', fontWeight: 900, color: 'black', letterSpacing: '-1.5px', lineHeight: 1 }}>
              리포트
            </h1>
          </div>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{
              padding: '10px 16px',
              border: '3px solid black',
              fontSize: '12px',
              fontWeight: 900,
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
        <nav style={{ display: 'flex', gap: '0', marginTop: '24px' }}>
          {[
            { label: '일간', href: '/report/daily' },
            { label: '주간', href: '/report/weekly' },
            { label: '월간', href: '/report/monthly' },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: '12px 24px',
                fontSize: '13px',
                fontWeight: 900,
                color: 'black',
                textDecoration: 'none',
                borderRight: '3px solid black',
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
