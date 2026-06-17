"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

function ResetPasswordContent() {
  const [step, setStep] = useState<'request' | 'update'>('request');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Supabase가 이메일 링크 클릭 후 #access_token 또는 type=recovery 쿼리로 리다이렉트
    const type = searchParams.get('type');
    if (type === 'recovery') setStep('update');

    // hash fragment 방식 처리
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('access_token')) setStep('update');
  }, [searchParams]);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password?type=recovery`,
    });
    if (error) {
      setMessage({ type: 'error', text: '이메일 전송에 실패했습니다. 다시 시도해주세요.' });
    } else {
      setMessage({ type: 'success', text: '이메일을 확인해주세요. 재설정 링크를 보내드렸습니다.' });
    }
    setLoading(false);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMessage({ type: 'error', text: '비밀번호가 일치하지 않습니다.' });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: '비밀번호는 6자 이상이어야 합니다.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage({ type: 'error', text: '비밀번호 변경에 실패했습니다. 링크가 만료되었을 수 있습니다.' });
    } else {
      setMessage({ type: 'success', text: '비밀번호가 변경되었습니다.' });
      setTimeout(() => router.push('/'), 1500);
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '48px 32px 0', borderBottom: '1px solid #e5e7eb' }}>
        <h1 style={{ fontSize: '40px', fontWeight: 400, color: 'black', letterSpacing: '-1px', lineHeight: 1, marginBottom: '8px' }}>
          MYBOB
        </h1>
        <p style={{ fontSize: '12px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', paddingBottom: '24px' }}>
          식단 기록 & AI 분석
        </p>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 400, color: 'black', marginBottom: '8px' }}>
          {step === 'request' ? '비밀번호 재설정' : '새 비밀번호 입력'}
        </h2>
        <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '32px' }}>
          {step === 'request'
            ? '가입한 이메일을 입력하면 재설정 링크를 보내드립니다.'
            : '새로 사용할 비밀번호를 입력해주세요.'}
        </p>

        {step === 'request' ? (
          <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
                이메일
              </label>
              <input
                type="email"
                required
                placeholder="user@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%', padding: '13px 16px', fontSize: '15px',
                  border: '1px solid #d1d5db', outline: 'none',
                  backgroundColor: 'white', boxSizing: 'border-box',
                }}
              />
            </div>

            {message && (
              <p style={{
                fontSize: '13px', padding: '10px 14px',
                color: message.type === 'success' ? '#059669' : '#ef4444',
                backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${message.type === 'success' ? '#6ee7b7' : '#fca5a5'}`,
              }}>
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '15px', fontSize: '14px',
                color: 'white', backgroundColor: loading ? '#9ca3af' : 'black',
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '1px', textTransform: 'uppercase', marginTop: '8px',
              }}
            >
              {loading ? '전송 중...' : '재설정 링크 보내기'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
                새 비밀번호
              </label>
              <input
                type="password"
                required
                placeholder="6자 이상"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%', padding: '13px 16px', fontSize: '15px',
                  border: '1px solid #d1d5db', outline: 'none',
                  backgroundColor: 'white', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
                비밀번호 확인
              </label>
              <input
                type="password"
                required
                placeholder="동일하게 입력"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                style={{
                  width: '100%', padding: '13px 16px', fontSize: '15px',
                  border: '1px solid #d1d5db', outline: 'none',
                  backgroundColor: 'white', boxSizing: 'border-box',
                }}
              />
            </div>

            {message && (
              <p style={{
                fontSize: '13px', padding: '10px 14px',
                color: message.type === 'success' ? '#059669' : '#ef4444',
                backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${message.type === 'success' ? '#6ee7b7' : '#fca5a5'}`,
              }}>
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '15px', fontSize: '14px',
                color: 'white', backgroundColor: loading ? '#9ca3af' : 'black',
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '1px', textTransform: 'uppercase', marginTop: '8px',
              }}
            >
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        )}

        <p style={{ marginTop: '28px', fontSize: '14px', color: '#6b7280', textAlign: 'center' }}>
          <a href="/auth/login" style={{ color: '#6B21A8', textDecoration: 'none' }}>
            로그인으로 돌아가기
          </a>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
