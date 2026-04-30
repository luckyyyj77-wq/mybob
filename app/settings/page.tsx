"use client";

import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import { useState } from 'react';

export default function SettingsPage() {
  const [aiAlert, setAiAlert] = useState(true);
  const [notifFreq, setNotifFreq] = useState('1시간 후');

  return (
    <div style={{
      height: 'calc(100svh - 65px)',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'white',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        padding: '24px 24px 16px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>APP</p>
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>설정</h1>
        </div>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaArrowLeft size={13} color="black" />
          </div>
        </Link>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {/* 알림 설정 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>알림 설정</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: 'white' }}>
            <span style={{ fontSize: '14px', color: 'black' }}>푸시 알림 주기</span>
            <select
              value={notifFreq}
              onChange={(e) => setNotifFreq(e.target.value)}
              style={{ padding: '5px 8px', border: '1px solid #e5e7eb', fontSize: '13px', backgroundColor: 'white', cursor: 'pointer', outline: 'none' }}
            >
              <option>1시간 후</option>
              <option>2시간 후</option>
              <option>수동</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: 'white' }}>
            <span style={{ fontSize: '14px', color: 'black' }}>AI 분석 알림</span>
            <button
              onClick={() => setAiAlert(!aiAlert)}
              style={{
                width: '44px', height: '24px', borderRadius: '12px',
                border: '1px solid #e5e7eb',
                backgroundColor: aiAlert ? 'black' : 'white',
                cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s', padding: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: '3px',
                left: aiAlert ? '20px' : '3px',
                width: '16px', height: '16px', borderRadius: '50%',
                backgroundColor: aiAlert ? 'white' : '#d1d5db',
                transition: 'left 0.2s',
              }} />
            </button>
          </div>
        </div>

        {/* 개인 정보 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>개인 정보</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb' }}>
          <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>이메일 주소</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '14px', color: 'black' }}>user@example.com</p>
              <button style={{ padding: '6px 12px', border: '1px solid #e5e7eb', backgroundColor: 'white', fontSize: '12px', cursor: 'pointer' }}>변경</button>
            </div>
          </div>
          <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>위험 구역</p>
            <button style={{ padding: '8px 14px', backgroundColor: 'white', color: '#ef4444', border: '1px solid #fca5a5', fontSize: '13px', cursor: 'pointer' }}>
              회원 탈퇴
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
