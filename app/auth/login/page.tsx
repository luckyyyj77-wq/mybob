"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
    } else {
      router.push('/');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '48px 32px 0', borderBottom: '4px solid black' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 900, color: 'black', letterSpacing: '-2px', lineHeight: 1, marginBottom: '8px' }}>
          MYBOB
        </h1>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', paddingBottom: '24px' }}>
          식단 기록 & AI 분석
        </p>
      </div>

      {/* Form */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 900, color: 'black', marginBottom: '32px', letterSpacing: '-0.5px' }}>
          로그인
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6b7280', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
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
                padding: '14px 16px',
                fontSize: '15px',
                fontWeight: 600,
                border: '3px solid black',
                borderRadius: 0,
                outline: 'none',
                backgroundColor: 'white',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6b7280', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
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
                padding: '14px 16px',
                fontSize: '15px',
                fontWeight: 600,
                border: '3px solid black',
                borderRadius: 0,
                outline: 'none',
                backgroundColor: 'white',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: '13px', color: '#ef4444', fontWeight: 600, padding: '12px 16px', backgroundColor: '#fef2f2', border: '2px solid #ef4444' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '14px',
              fontWeight: 900,
              color: 'white',
              backgroundColor: loading ? '#9ca3af' : 'black',
              border: '3px solid black',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              marginTop: '8px',
              boxShadow: loading ? 'none' : '4px 4px 0px #6B21A8',
              transition: 'box-shadow 0.1s',
            }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p style={{ marginTop: '32px', fontSize: '14px', color: '#6b7280', fontWeight: 500, textAlign: 'center' }}>
          계정이 없으신가요?{' '}
          <Link href="/auth/signup" style={{ fontWeight: 900, color: '#6B21A8', textDecoration: 'none' }}>
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
