import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '40px 32px 0', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
              ANALYSIS
            </p>
            <h1 style={{ fontSize: '30px', fontWeight: 400, color: 'black', letterSpacing: '-0.5px', lineHeight: 1 }}>
              리포트
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
                color: 'black',
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
