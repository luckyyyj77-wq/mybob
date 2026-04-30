"use client";

import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import { useState } from 'react';

export default function SettingsPage() {
  const [aiAlert, setAiAlert] = useState(true);
  const [notifFreq, setNotifFreq] = useState('1시간 후');

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '40px 32px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
            APP
          </p>
          <h1 style={{ fontSize: '30px', fontWeight: 400, color: 'black', letterSpacing: '-0.5px', lineHeight: 1 }}>
            설정
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

      {/* Content */}
      <main style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', gap: '0' }}>
        {/* 알림 설정 */}
        <section style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '32px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '20px' }}>
            알림 설정
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: 'white' }}>
              <span style={{ fontSize: '15px', color: 'black' }}>푸시 알림 주기</span>
              <select
                value={notifFreq}
                onChange={(e) => setNotifFreq(e.target.value)}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #e5e7eb',
                  fontSize: '13px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option>1시간 후</option>
                <option>2시간 후</option>
                <option>수동</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: 'white' }}>
              <span style={{ fontSize: '15px', color: 'black' }}>AI 분석 알림</span>
              <button
                onClick={() => setAiAlert(!aiAlert)}
                style={{
                  width: '48px',
                  height: '26px',
                  borderRadius: '13px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: aiAlert ? 'black' : 'white',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background-color 0.2s',
                  padding: 0,
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: '3px',
                  left: aiAlert ? '22px' : '3px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: aiAlert ? 'white' : '#d1d5db',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>
          </div>
        </section>

        {/* 개인 정보 */}
        <section>
          <h2 style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '20px' }}>
            개인 정보
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb' }}>
            <div style={{ padding: '16px', backgroundColor: 'white' }}>
              <p style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
                이메일 주소
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <p style={{ fontSize: '15px', color: 'black' }}>user@example.com</p>
                <button style={{
                  padding: '7px 14px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: 'white',
                  fontSize: '12px',
                  cursor: 'pointer',
                  letterSpacing: '1px',
                }}>
                  변경
                </button>
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'white' }}>
              <p style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' }}>
                위험 구역
              </p>
              <button style={{
                padding: '10px 18px',
                backgroundColor: 'white',
                color: '#ef4444',
                border: '1px solid #fca5a5',
                fontSize: '13px',
                cursor: 'pointer',
                letterSpacing: '1px',
              }}>
                회원 탈퇴
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
