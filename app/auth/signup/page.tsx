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
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
    } else {
      alert('회원가입 성공! 이메일을 확인하여 계정을 활성화해주세요.');
      router.push('/auth/login');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
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
