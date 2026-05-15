"use client";

import { FaLock } from 'react-icons/fa';

export default function CommunityChallengePage() {
  const challenges = [
    { title: "7일 클린 식단 챌린지", period: "1주" },
    { title: "노슈가(No Sugar) 도전", period: "14일" },
    { title: "매일 아침 샐러드 먹기", period: "30일" },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Coming Soon Banner */}
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
          챌린지 시스템 준비 중
        </h2>
        <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
          친구들과 함께 목표를 달성하고 포인트와 뱃지를 획득하세요!
        </p>
      </div>

      {/* Challenge List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb' }}>
        {challenges.map((challenge, index) => (
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
