import { use } from 'react';
import { Link } from '@/i18n/routing';
import { FaArrowLeft } from 'react-icons/fa';
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

export default function RefundPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations('Refund');
  const tSettings = useTranslations('Settings');

  const summaryItemsCount = 3;
  const summaryItems = Array.from({ length: summaryItemsCount }, (_, i) => t(`summary.items.${i}`));

  const sectionsCount = 6;
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

        {/* 핵심 요약 */}
        <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', padding: '20px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#6B21A8', marginBottom: '12px' }}>{t('summary.title')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {summaryItems.map(text => (
              <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ color: '#6B21A8', fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>·</span>
                <span style={{ fontSize: '13px', color: '#374151' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {sections.map(({ title, body }) => (
          <div key={title}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'black', marginBottom: '10px' }}>{title}</p>
            <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.9, whiteSpace: 'pre-line' }}>{body}</p>
          </div>
        ))}

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px', display: 'flex', gap: '16px' }}>
          <Link href="/terms" style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'none' }}>{tSettings('legal.terms')}</Link>
          <Link href="/privacy" style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'none' }}>{tSettings('legal.privacy')}</Link>
        </div>

      </div>
    </div>
  );
}
