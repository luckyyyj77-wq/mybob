import { use } from 'react';
import { Link } from '@/i18n/routing';
import { FaArrowLeft } from 'react-icons/fa';
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

export default function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations('Privacy');
  const tSettings = useTranslations('Settings');

  const sectionsCount = 9;
  const sections = Array.from({ length: sectionsCount }, (_, i) => ({
    title: t(`sections.${i}.title`),
    body: t(`sections.${i}.content`),
  }));

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white' }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 0', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>LEGAL</p>
            <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>{t('title')}</h1>
          </div>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaArrowLeft size={13} color="black" />
            </div>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '40px 24px', maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        <p style={{ fontSize: '12px', color: '#9ca3af' }}>{t('lastUpdated')}</p>

        {sections.map(({ title, body }) => (
          <div key={title}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'black', marginBottom: '10px' }}>{title}</p>
            <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.9, whiteSpace: 'pre-line' }}>{body}</p>
          </div>
        ))}

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px', display: 'flex', gap: '16px' }}>
          <Link href="/terms" style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'none' }}>{tSettings('legal.terms')}</Link>
          <Link href="/refund" style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'none' }}>{tSettings('legal.refund')}</Link>
        </div>

      </div>
    </div>
  );
}
