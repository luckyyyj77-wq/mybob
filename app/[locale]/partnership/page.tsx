"use client";

import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { FaArrowLeft, FaCopy, FaCheck } from 'react-icons/fa';
import { useTranslations } from 'next-intl';

const EMAIL = 'luckyyyj77@gmail.com';

export default function PartnershipPage() {
  const t = useTranslations('Partnership');
  const [copied, setCopied] = useState(false);

  const inquiryTypesCount = 4;
  const inquiryTypes = Array.from({ length: inquiryTypesCount }, (_, i) => t(`inquiryType.items.${i}`));

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
    } catch {
      const el = document.createElement('textarea');
      el.value = EMAIL;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '24px 24px 0', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>CONTACT</p>
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
      <div style={{ flex: 1, padding: '40px 28px', display: 'flex', flexDirection: 'column', gap: '40px' }}>

        {/* 소개 */}
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>{t('about.title')}</p>
          <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
            {t('about.content')}
          </p>
        </div>

        {/* 문의 유형 */}
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>{t('inquiryType.title')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {inquiryTypes.map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#6B21A8', flexShrink: 0 }} />
                <span style={{ fontSize: '14px', color: '#374151' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 이메일 */}
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>{t('email.title')}</p>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid #e5e7eb',
            padding: '16px 20px',
          }}>
            <span style={{ fontSize: '15px', color: 'black', letterSpacing: '0.3px' }}>{EMAIL}</span>
            <button
              onClick={handleCopy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                color: copied ? '#6B21A8' : '#9ca3af',
                fontSize: '12px',
                letterSpacing: '0.5px',
                transition: 'color 0.2s',
              }}
            >
              {copied ? <FaCheck size={12} /> : <FaCopy size={12} />}
              {copied ? t('email.copied') : t('email.copy')}
            </button>
          </div>
          <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>
            {t('email.guide')}
          </p>
        </div>

      </div>
    </div>
  );
}
