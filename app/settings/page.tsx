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
      <div style={{ padding: '40px 32px 24px', borderBottom: '4px solid black', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '6px' }}>
            APP
          </p>
          <h1 style={{ fontSize: '36px', fontWeight: 900, color: 'black', letterSpacing: '-1.5px', lineHeight: 1 }}>
            설정
          </h1>
        </div>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{
            padding: '10px 16px',
            border: '3px solid black',
            fontSize: '12px',
            fontWeight: 900,
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
        <section style={{ borderBottom: '3px solid black', paddingBottom: '32px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#9ca3af', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '20px' }}>
            알림 설정
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '3px solid black' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'black' }}>푸시 알림 주기</span>
              <select
                value={notifFreq}
                onChange={(e) => setNotifFreq(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '2px solid black',
                  fontSize: '13px',
                  fontWeight: 700,
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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '3px solid black' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'black' }}>AI 분석 알림</span>
              <button
                onClick={() => setAiAlert(!aiAlert)}
                style={{
                  width: '52px',
                  height: '28px',
                  borderRadius: '14px',
                  border: '3px solid black',
                  backgroundColor: aiAlert ? 'black' : 'white',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background-color 0.2s',
                  padding: 0,
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: '2px',
                  left: aiAlert ? '22px' : '2px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: aiAlert ? 'white' : 'black',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>
          </div>
        </section>

        {/* 개인 정보 */}
        <section>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#9ca3af', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '20px' }}>
            개인 정보
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', border: '3px solid black' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
                이메일 주소
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <p style={{ fontSize: '15px', fontWeight: 700, color: 'black' }}>user@example.com</p>
                <button style={{
                  padding: '8px 16px',
                  border: '2px solid black',
                  backgroundColor: 'white',
                  fontSize: '12px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  letterSpacing: '1px',
                }}>
                  변경
                </button>
              </div>
            </div>

            <div style={{ padding: '16px', border: '3px solid #ef4444' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
                위험 구역
              </p>
              <button style={{
                padding: '12px 20px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: '2px solid #ef4444',
                fontSize: '13px',
                fontWeight: 900,
                cursor: 'pointer',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                boxShadow: '3px 3px 0px black',
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
