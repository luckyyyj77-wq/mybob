"use client";

import { FaLock } from 'react-icons/fa';

export default function CommunityChallengePage() {
  const challenges = [
    { title: "7일 클린 식단 챌린지", period: "1주" },
    { title: "노슈가(No Sugar) 도전", period: "14일" },
    { title: "매일 아침 샐러드 먹기", period: "30일" },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Coming Soon Banner */}
      <div style={{
        padding: '24px',
        border: '3px solid black',
        backgroundColor: 'black',
        color: 'white',
        boxShadow: '4px 4px 0px #6B21A8',
      }}>
        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px' }}>
          COMING SOON
        </p>
        <h2 style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.5px', marginBottom: '8px' }}>
          챌린지 시스템 준비 중
        </h2>
        <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.6 }}>
          친구들과 함께 목표를 달성하고 포인트와 뱃지를 획득하세요!
        </p>
      </div>

      {/* Challenge List */}
      {challenges.map((challenge, index) => (
        <div
          key={index}
          style={{
            padding: '20px',
            border: '3px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: 0.5,
          }}
        >
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
              {challenge.period}
            </p>
            <h3 style={{ fontSize: '16px', fontWeight: 900, color: 'black', letterSpacing: '-0.3px' }}>
              {challenge.title}
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaLock size={14} color="#9ca3af" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '1px' }}>준비 중</span>
          </div>
        </div>
      ))}
    </div>
  );
}
