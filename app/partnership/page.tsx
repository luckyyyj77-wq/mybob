"use client";

import { useState } from 'react';
import Link from 'next/link';
import { FaArrowLeft, FaCopy, FaCheck } from 'react-icons/fa';

const EMAIL = 'luckyyyj77@gmail.com';

export default function PartnershipPage() {
  const [copied, setCopied] = useState(false);

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
            <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>제휴문의</h1>
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
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>ABOUT</p>
          <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.8 }}>
            MyBob은 AI 기반 식단 분석 및 건강 관리 플랫폼입니다.<br />
            광고 제휴, 브랜드 콜라보, 서비스 파트너십 등<br />
            다양한 형태의 협업을 환영합니다.
          </p>
        </div>

        {/* 문의 유형 */}
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>INQUIRY TYPE</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {['광고 & 스폰서십', '브랜드 콜라보레이션', '데이터 파트너십', '기타 비즈니스 문의'].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#6B21A8', flexShrink: 0 }} />
                <span style={{ fontSize: '14px', color: '#374151' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 이메일 */}
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>EMAIL</p>
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
              {copied ? '복사됨' : '복사'}
            </button>
          </div>
          <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>
            메일 제목에 <strong style={{ color: '#374151' }}>[제휴문의]</strong>를 포함해 보내주세요.
          </p>
        </div>

      </div>
    </div>
  );
}
