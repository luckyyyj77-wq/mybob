"use client";

import { Link } from '@/i18n/routing';
import { FaArrowLeft, FaCheck } from 'react-icons/fa';
import { useTranslations } from 'next-intl';

export default function PricingPage() {
  const t = useTranslations('Pricing');
  const freeFeatures = t.raw('freeFeatures') as string[];
  const proFeatures = t.raw('proFeatures') as string[];

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white' }}>
      <div style={{ padding: '24px 24px 0', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>PRICING</p>
            <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>{t('title')}</h1>
          </div>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaArrowLeft size={13} color="black" />
            </div>
          </Link>
        </div>
      </div>

      <div style={{ padding: '40px 24px', maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.8 }}>
          {t('intro')}
        </p>

        <div style={{ border: '1px solid #e5e7eb', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', marginBottom: '4px' }}>FREE</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'black' }}>₩0</p>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>{t('freeForever')}</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {freeFeatures.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaCheck size={12} color="#9ca3af" />
                <span style={{ fontSize: '13px', color: '#374151' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ border: '2px solid #6B21A8', padding: '24px', backgroundColor: '#faf5ff', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: '-1px', right: '20px',
            backgroundColor: '#6B21A8', color: 'white',
            fontSize: '10px', letterSpacing: '1px', padding: '4px 10px',
          }}>
            {t('recommended')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <p style={{ fontSize: '10px', color: '#6B21A8', letterSpacing: '2px', marginBottom: '4px' }}>PRO</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'black' }}>₩900</p>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>{t('monthlySubscription')}</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {proFeatures.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaCheck size={12} color="#6B21A8" />
                <span style={{ fontSize: '13px', color: '#374151' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: '#f5f3ff', border: '1px solid #e9d5ff', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '20px', marginBottom: '8px' }}>🎖️</p>
          <p style={{ fontSize: '14px', color: '#6B21A8', fontWeight: 600, marginBottom: '6px' }}>{t('foundingBannerTitle')}</p>
          <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
            {t('foundingBannerDesc')}
          </p>
        </div>

        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{
            width: '100%', padding: '16px', backgroundColor: '#6B21A8',
            color: 'white', textAlign: 'center', fontSize: '14px', fontWeight: 600,
            letterSpacing: '0.5px', cursor: 'pointer',
          }}>
            {t('startApp')}
          </div>
        </Link>

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
          <p style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.7, textAlign: 'center', whiteSpace: 'pre-line' }}>
            {t('paymentNote')} <Link href="/refund" style={{ color: '#6B21A8' }}>{t('refundPolicy')}</Link> {t('paymentNoteEnd')}
          </p>
        </div>

      </div>
    </div>
  );
}
