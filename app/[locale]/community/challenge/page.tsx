"use client";

import { FaLock } from 'react-icons/fa';
import { useTranslations } from 'next-intl';

export default function CommunityChallengePage() {
  const t = useTranslations('Community');
  const challengeList = t.raw('challengeList') as { title: string; period: string }[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      <div style={{
        padding: '24px',
        backgroundColor: 'black',
        color: 'white',
        marginBottom: '1px',
      }}>
        <p style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
          COMING SOON
        </p>
        <h2 style={{ fontSize: '20px', fontWeight: 400, marginBottom: '8px' }}>
          {t('comingSoon')}
        </h2>
        <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
          {t('comingSoonDesc')}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb' }}>
        {challengeList.map((challenge, index) => (
          <div
            key={index}
            style={{
              padding: '20px',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: 0.5,
            }}
          >
            <div>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
                {challenge.period}
              </p>
              <h3 style={{ fontSize: '15px', fontWeight: 400, color: 'black' }}>
                {challenge.title}
              </h3>
            </div>
            <FaLock size={13} color="#d1d5db" />
          </div>
        ))}
      </div>
    </div>
  );
}
