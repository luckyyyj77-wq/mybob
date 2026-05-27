"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const router = useRouter();

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
    } else {
      setSentEmail(email);
      setShowEmailConfirm(true);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>

      {/* 이메일 인증 안내 팝업 */}
      {showEmailConfirm && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '24px',
        }}>
          <div style={{
            backgroundColor: 'white', width: '100%', maxWidth: '360px',
            padding: '36px 28px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>✉️</div>
            <h3 style={{ fontSize: '18px', fontWeight: 500, color: 'black', marginBottom: '12px' }}>
              이메일을 확인해주세요
            </h3>
            <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, marginBottom: '8px' }}>
              <span style={{ color: '#111', fontWeight: 500 }}>{sentEmail}</span>으로<br />
              인증 메일을 보냈습니다.
            </p>
            <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.6, marginBottom: '28px' }}>
              메일 속 링크를 클릭하면<br />가입이 완료됩니다.
            </p>
            <button
              onClick={() => router.push('/auth/login')}
              style={{
                width: '100%', padding: '14px', fontSize: '14px',
                color: 'white', backgroundColor: '#6B21A8',
                border: 'none', cursor: 'pointer', letterSpacing: '0.5px',
              }}
            >
              로그인 페이지로 이동
            </button>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '16px' }}>
              메일이 오지 않으면 스팸함을 확인해주세요
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <div style={{ padding: '48px 32px 0', borderBottom: '1px solid #e5e7eb' }}>
        <h1 style={{ fontSize: '40px', fontWeight: 400, color: 'black', letterSpacing: '-1px', lineHeight: 1, marginBottom: '8px' }}>
          MYBOB
        </h1>
        <p style={{ fontSize: '12px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', paddingBottom: '24px' }}>
          식단 기록 & AI 분석
        </p>
      </div>

      {/* Form */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 400, color: 'black', marginBottom: '32px' }}>
          회원가입
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
              이메일
            </label>
            <input
              type="email"
              required
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '13px 16px',
                fontSize: '15px',
                border: '1px solid #d1d5db',
                borderRadius: 0,
                outline: 'none',
                backgroundColor: 'white',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
              비밀번호
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '13px 16px',
                fontSize: '15px',
                border: '1px solid #d1d5db',
                borderRadius: 0,
                outline: 'none',
                backgroundColor: 'white',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: '13px', color: '#ef4444', padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '14px',
              color: 'white',
              backgroundColor: loading ? '#9ca3af' : 'black',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginTop: '8px',
            }}
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        {/* 구분선 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
          <span style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '1px' }}>OR</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
        </div>

        {/* 구글 로그인 */}
        <button
          onClick={handleGoogle}
          style={{
            width: '100%', padding: '14px', fontSize: '14px',
            color: '#374151', backgroundColor: 'white',
            border: '1px solid #d1d5db', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          Google로 계속하기
        </button>

        <p style={{ marginTop: '28px', fontSize: '14px', color: '#6b7280', textAlign: 'center' }}>
          이미 계정이 있으신가요?{' '}
          <Link href="/auth/login" style={{ color: '#6B21A8', textDecoration: 'none' }}>
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
