"use client";

import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getStorageMode, type StorageMode } from '@/lib/storage-mode';
import { getCloudDeleteSchedule, cancelCloudDeleteSchedule, requestServerDataDeletion } from '@/lib/storage-migration';
import { StorageModeModal } from '@/components/StorageModeModal';
import { type StatusTemplate, pickRandom3 } from '@/lib/status-templates';

// ── AES-256-GCM 암호화 (Web Crypto API) ──────────────────────
const BODY_ENC_KEY = 'mybob_body_enc';
const BODY_SALT_KEY = 'mybob_body_salt';

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin).buffer as ArrayBuffer, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 10000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptBody(data: object, pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const blob = {
    salt: Array.from(salt),
    iv: Array.from(iv),
    ct: Array.from(new Uint8Array(ciphertext)),
  };
  localStorage.setItem(BODY_ENC_KEY, JSON.stringify(blob));
  localStorage.setItem(BODY_SALT_KEY, JSON.stringify(Array.from(salt)));
  // 구버전 평문 키 제거
  localStorage.removeItem('mybob_goal');
}

async function decryptBody(pin: string): Promise<BodyInfo | null> {
  const raw = localStorage.getItem(BODY_ENC_KEY);
  if (!raw) return null;
  try {
    const { salt, iv, ct } = JSON.parse(raw);
    const key = await deriveKey(pin, new Uint8Array(salt));
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(ct),
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return null;
  }
}

// 구버전 평문 데이터 읽기 (마이그레이션용)
function readLegacyGoal(): Partial<BodyInfo> | null {
  const raw = localStorage.getItem('mybob_goal');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ── PIN 인증 ──────────────────────────────────────────────────
const PIN_KEY = 'mybob_security_pin';
const BODY_ATTEMPT_KEY = 'mybob_body_pin_attempts'; // 신체정보 오류 횟수
const BODY_WARN_AT = 5;   // 5회: 경고
const BODY_MAX_ATTEMPTS = 10; // 10회: 초기화

function hashPin(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    hash = ((hash << 5) - hash) + pin.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

function getPinHash(): string | null {
  return localStorage.getItem(PIN_KEY);
}

function savePin(pin: string) {
  localStorage.setItem(PIN_KEY, hashPin(pin));
}

function verifyPin(pin: string): boolean {
  const stored = getPinHash();
  return stored !== null && stored === hashPin(pin);
}

function getBodyAttempts(): number {
  return parseInt(localStorage.getItem(BODY_ATTEMPT_KEY) || '0', 10);
}

function incrementBodyAttempts(): number {
  const next = getBodyAttempts() + 1;
  localStorage.setItem(BODY_ATTEMPT_KEY, String(next));
  return next;
}

function resetBodyAttempts() {
  localStorage.removeItem(BODY_ATTEMPT_KEY);
}

// PIN 입력 모달 컴포넌트
function PinModal({
  mode,
  context,
  onSuccess,
  onCancel,
  onForgot,
}: {
  mode: 'set' | 'verify';
  context: 'body' | 'danger';
  onSuccess: (pin: string) => void;
  onCancel: () => void;
  onForgot?: () => void;
}) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(context === 'body' ? getBodyAttempts() : 0);

  const remaining = BODY_MAX_ATTEMPTS - attempts;
  const warned = context === 'body' && attempts >= BODY_WARN_AT && remaining > 0;
  const nearLimit = context === 'body' && remaining <= 2 && remaining > 0;
  const isLocked = context === 'body' && remaining <= 0;

  const handleDigit = (d: string) => {
    if (isLocked) return;
    if (mode === 'verify') {
      const next = (pin + d).slice(0, 4);
      setPin(next);
      setError('');
      if (next.length === 4) {
        if (verifyPin(next)) {
          if (context === 'body') resetBodyAttempts();
          requestAnimationFrame(() => setTimeout(() => onSuccess(next), 80));
        } else {
          if (context === 'body') {
            const count = incrementBodyAttempts();
            setAttempts(count);
            const left = BODY_MAX_ATTEMPTS - count;
            if (left <= 0) {
              setError('10회 오류 — 신체정보가 초기화됩니다');
              setTimeout(() => {
                localStorage.removeItem(BODY_ENC_KEY);
                localStorage.removeItem(BODY_SALT_KEY);
                resetBodyAttempts();
                onCancel();
              }, 1500);
            } else if (count >= BODY_WARN_AT) {
              setError(`PIN이 올바르지 않습니다 · ${left}회 남으면 초기화됩니다`);
              setTimeout(() => setPin(''), 600);
            } else {
              setError('PIN이 올바르지 않습니다');
              setTimeout(() => setPin(''), 600);
            }
          } else {
            setError('PIN이 올바르지 않습니다');
            setTimeout(() => setPin(''), 600);
          }
        }
      }
    } else {
      if (step === 'enter') {
        const next = (pin + d).slice(0, 4);
        setPin(next);
        if (next.length === 4) setStep('confirm');
      } else {
        const next = (confirmPin + d).slice(0, 4);
        setConfirmPin(next);
        if (next.length === 4) {
          if (pin === next) {
            requestAnimationFrame(() => setTimeout(() => onSuccess(pin), 80));
          } else {
            setError('PIN이 일치하지 않습니다');
            setTimeout(() => { setConfirmPin(''); setStep('enter'); setPin(''); setError(''); }, 800);
          }
        }
      }
    }
  };

  const handleBack = () => {
    if (step === 'enter' || mode === 'verify') {
      setPin(p => p.slice(0, -1));
    } else {
      setConfirmPin(p => p.slice(0, -1));
    }
    setError('');
  };

  const current = (mode === 'set' && step === 'confirm') ? confirmPin : pin;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', width: '280px', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '18px', marginBottom: '6px' }}>{isLocked ? '⚠️' : '🔐'}</p>
          <p style={{ fontSize: '15px', color: 'black', marginBottom: '4px' }}>
            {mode === 'verify' ? 'PIN 입력' : step === 'enter' ? 'PIN 설정' : 'PIN 확인'}
          </p>
          <p style={{ fontSize: '11px', color: '#9ca3af' }}>
            {mode === 'verify' ? '4자리 PIN을 입력하세요' : step === 'enter' ? '사용할 4자리 PIN을 입력하세요' : '한 번 더 입력하세요'}
          </p>
        </div>

        {/* 점 표시 */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: '14px', height: '14px', borderRadius: '50%',
              backgroundColor: i < current.length ? (warned || isLocked ? '#ef4444' : 'black') : '#e5e7eb',
              transition: 'background-color 0.1s',
            }} />
          ))}
        </div>

        {/* 경고/오류 메시지 */}
        {warned && !error && (
          <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '-12px', textAlign: 'center', lineHeight: 1.5 }}>
            {remaining}회 더 틀리면 신체정보가 초기화됩니다
          </p>
        )}
        {error && (
          <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '-12px', textAlign: 'center', lineHeight: 1.5 }}>
            {error}
          </p>
        )}

        {/* 키패드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', width: '100%' }}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
            <button
              key={i}
              onClick={() => d === '⌫' ? handleBack() : d ? handleDigit(d) : undefined}
              disabled={!d || isLocked}
              style={{
                padding: '16px', fontSize: d === '⌫' ? '18px' : '20px',
                border: '1px solid #e5e7eb', backgroundColor: d ? 'white' : 'transparent',
                cursor: (d && !isLocked) ? 'pointer' : 'default', borderColor: d ? '#e5e7eb' : 'transparent',
                color: isLocked ? '#d1d5db' : 'black', fontWeight: 400,
              }}
            >
              {d}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onCancel}
            style={{ fontSize: '12px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            취소
          </button>
          {mode === 'verify' && context === 'danger' && onForgot && (
            <button
              onClick={onForgot}
              style={{ fontSize: '11px', color: '#6B21A8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
            >
              PIN을 잊으셨나요?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 위험구역 PIN 분실 — 이메일 OTP 인증 모달
function DangerPinResetModal({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<'send' | 'verify'>('send');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSend = async () => {
    setSending(true);
    setError('');
    const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession();
    if (!session) { setError('로그인이 필요합니다'); setSending(false); return; }
    const res = await fetch('/api/pin-reset', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const result = await res.json();
    if (result.ok) {
      setEmail(result.email);
      setStep('verify');
    } else {
      setError('이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
    setSending(false);
  };

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setVerifying(true);
    setError('');
    const { data: { session } } = await (await import('@/lib/supabase/client')).supabase.auth.getSession();
    if (!session) { setError('로그인이 필요합니다'); setVerifying(false); return; }
    const res = await fetch('/api/pin-reset', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ otp }),
    });
    const result = await res.json();
    if (result.ok) {
      onSuccess();
    } else {
      const msg: Record<string, string> = {
        WRONG_OTP: '인증 코드가 올바르지 않습니다',
        OTP_EXPIRED: '인증 코드가 만료됐습니다. 다시 발송해 주세요',
      };
      setError(msg[result.error] || '인증에 실패했습니다');
    }
    setVerifying(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', width: '300px', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '20px', marginBottom: '8px' }}>📧</p>
          <p style={{ fontSize: '15px', color: 'black', marginBottom: '4px' }}>
            {step === 'send' ? '이메일로 인증' : '인증 코드 입력'}
          </p>
          <p style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.5 }}>
            {step === 'send'
              ? '가입한 이메일로 6자리 인증 코드를 보내드립니다. 인증 후 위험구역 PIN이 초기화됩니다.'
              : `${email}으로 발송된 6자리 코드를 입력하세요.`}
          </p>
        </div>

        {step === 'verify' && (
          <input
            type="number"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={e => setOtp(e.target.value.slice(0, 6))}
            placeholder="000000"
            style={{
              padding: '12px', border: '1px solid #e5e7eb', fontSize: '20px',
              textAlign: 'center', letterSpacing: '8px', outline: 'none',
            }}
          />
        )}

        {error && <p style={{ fontSize: '11px', color: '#ef4444', textAlign: 'center' }}>{error}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {step === 'send' ? (
            <button
              onClick={handleSend}
              disabled={sending}
              style={{
                padding: '12px', border: 'none',
                backgroundColor: sending ? '#f3f4f6' : 'black',
                color: sending ? '#9ca3af' : 'white',
                fontSize: '13px', cursor: sending ? 'not-allowed' : 'pointer',
              }}
            >
              {sending ? '발송 중...' : '인증 코드 발송'}
            </button>
          ) : (
            <>
              <button
                onClick={handleVerify}
                disabled={verifying || otp.length !== 6}
                style={{
                  padding: '12px', border: 'none',
                  backgroundColor: (verifying || otp.length !== 6) ? '#f3f4f6' : 'black',
                  color: (verifying || otp.length !== 6) ? '#9ca3af' : 'white',
                  fontSize: '13px', cursor: (verifying || otp.length !== 6) ? 'not-allowed' : 'pointer',
                }}
              >
                {verifying ? '확인 중...' : '확인'}
              </button>
              <button
                onClick={() => { setStep('send'); setOtp(''); setError(''); }}
                style={{ padding: '8px', border: '1px solid #e5e7eb', backgroundColor: 'white', fontSize: '12px', color: '#6b7280', cursor: 'pointer' }}
              >
                코드 재발송
              </button>
            </>
          )}
          <button
            onClick={onCancel}
            style={{ padding: '8px', background: 'none', border: 'none', fontSize: '12px', color: '#9ca3af', cursor: 'pointer' }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}


// ── 신체정보 타입 ─────────────────────────────────────────────
type BodyInfo = {
  gender: 'male' | 'female' | '';
  age: string;
  height: string;
  weight: string;
  targetWeight: string;
  activity: 'sedentary' | 'light' | 'moderate' | 'active' | '';
  goal: '다이어트' | '유지' | '증량';
};

const EMPTY_BODY: BodyInfo = {
  gender: '', age: '', height: '', weight: '',
  targetWeight: '', activity: '', goal: '유지',
};

const ACTIVITY_LABEL: Record<string, string> = {
  sedentary: '좌식 (거의 운동 안 함)',
  light: '가벼운 활동 (주 1~2회)',
  moderate: '보통 활동 (주 3~5회)',
  active: '활동적 (매일 운동)',
};

// ── GoalSettings 컴포넌트 ─────────────────────────────────────
function GoalSettings({ onRequestAuth }: { onRequestAuth: (cb: (pin: string) => void) => void }) {
  const [unlocked, setUnlocked] = useState(false);
  const [body, setBody] = useState<BodyInfo>(EMPTY_BODY);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authing, setAuthing] = useState(false);
  const [decryptErr, setDecryptErr] = useState(false);
  const currentPin = useRef('');

  const handleUnlock = () => {
    onRequestAuth(async (pin) => {
      currentPin.current = pin;
      setAuthing(true);
      // 암호화된 데이터 복호화 시도
      const enc = localStorage.getItem(BODY_ENC_KEY);
      if (enc) {
        const data = await decryptBody(pin);
        if (data) {
          setBody(data);
          setDecryptErr(false);
          setUnlocked(true);
        } else {
          // iterations 변경 등으로 복호화 실패 시 기존 데이터 제거 후 재입력 유도
          localStorage.removeItem(BODY_ENC_KEY);
          localStorage.removeItem(BODY_SALT_KEY);
          setBody(EMPTY_BODY);
          setDecryptErr(true);
        }
      } else {
        // 최초 or 구버전 마이그레이션
        const legacy = readLegacyGoal();
        if (legacy) {
          setBody({ ...EMPTY_BODY, height: legacy.height || '', weight: legacy.weight || '', goal: (legacy.goal as BodyInfo['goal']) || '유지' });
        } else {
          setBody(EMPTY_BODY);
        }
        setDecryptErr(false);
        setUnlocked(true);
      }
      setAuthing(false);
    });
  };

  const handleSave = async () => {
    const err = validateBody();
    if (err) { alert(err); return; }
    setSaving(true);
    await encryptBody(body, currentPin.current);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const LIMITS = {
    age:          { min: 1,  max: 99,  label: '나이',      unit: '세' },
    height:       { min: 50, max: 250, label: '키',        unit: 'cm' },
    weight:       { min: 20, max: 300, label: '몸무게',    unit: 'kg' },
    targetWeight: { min: 20, max: 300, label: '목표 체중', unit: 'kg' },
  } as const;

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof LIMITS, string>>>({});

  const set = (field: keyof BodyInfo) => (val: string) => {
    setBody(prev => ({ ...prev, [field]: val }));
    if (field in LIMITS) {
      setFieldErrors(prev => { const next = { ...prev }; delete next[field as keyof typeof LIMITS]; return next; });
    }
  };

  const checkField = (field: keyof typeof LIMITS) => (val: string) => {
    const { min, max, label, unit } = LIMITS[field];
    const num = parseFloat(val);
    if (val !== '' && (!isFinite(num) || num < min || num > max)) {
      setFieldErrors(prev => ({ ...prev, [field]: `${label}는 ${min}~${max}${unit} 사이로 입력해 주세요` }));
    }
  };

  const validateBody = (): string | null => {
    for (const [field, { min, max, label, unit }] of Object.entries(LIMITS) as [keyof typeof LIMITS, typeof LIMITS[keyof typeof LIMITS]][]) {
      const val = body[field];
      if (val === '') continue;
      const num = parseFloat(val as string);
      if (!isFinite(num) || num < min || num > max)
        return `${label}는 ${min}~${max}${unit} 사이로 입력해 주세요`;
    }
    return null;
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
    fontSize: '14px', backgroundColor: 'white', outline: 'none', boxSizing: 'border-box',
  };

  const chipStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px 6px', border: '1px solid', fontSize: '12px', cursor: 'pointer',
    borderColor: active ? 'black' : '#e5e7eb',
    backgroundColor: active ? 'black' : 'white',
    color: active ? 'white' : 'black',
    textAlign: 'center',
  });

  if (!unlocked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
        <div style={{ padding: '20px 16px', backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px' }}>🔒</span>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'black', marginBottom: '4px' }}>신체정보가 잠겨 있습니다</p>
            <p style={{ fontSize: '11px', color: '#9ca3af' }}>PIN을 입력해 잠금을 해제하세요</p>
            {decryptErr && (
              <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', lineHeight: 1.5 }}>
                저장된 데이터를 불러올 수 없어 초기화했습니다.<br />다시 잠금 해제 후 정보를 입력해 주세요.
              </p>
            )}
          </div>
          <button
            onClick={handleUnlock}
            disabled={authing}
            style={{
              padding: '10px 24px', border: '1px solid black',
              backgroundColor: authing ? '#f3f4f6' : 'black',
              color: authing ? '#9ca3af' : 'white',
              fontSize: '12px', cursor: authing ? 'not-allowed' : 'pointer',
              letterSpacing: '1px', transition: 'all 0.2s',
            }}
          >
            {authing ? '확인 중...' : '잠금 해제'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
      <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase' }}>신체 정보</p>
          <button
            onClick={() => { setUnlocked(false); currentPin.current = ''; }}
            style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
          >
            🔓 잠금
          </button>
        </div>

        {/* 성별 */}
        <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>성별</p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {[['male', '남성'], ['female', '여성']].map(([val, label]) => (
            <button key={val} onClick={() => set('gender')(val)} style={chipStyle(body.gender === val)}>{label}</button>
          ))}
        </div>

        {/* 나이 */}
        <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>나이</p>
        <input
          type="number" inputMode="numeric" value={body.age} min={1} max={99}
          onChange={e => set('age')(e.target.value)}
          onBlur={e => checkField('age')(e.target.value)}
          placeholder="25"
          style={{ ...inputStyle, marginBottom: fieldErrors.age ? '4px' : '14px', borderColor: fieldErrors.age ? '#ef4444' : '#e5e7eb' }}
        />
        {fieldErrors.age && <p style={{ fontSize: '10px', color: '#ef4444', marginBottom: '10px' }}>{fieldErrors.age}</p>}

        {/* 키 / 몸무게 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>키 (cm)</p>
            <input type="number" inputMode="decimal" value={body.height} min={50} max={250}
              onChange={e => set('height')(e.target.value)}
              onBlur={e => checkField('height')(e.target.value)}
              placeholder="170"
              style={{ ...inputStyle, borderColor: fieldErrors.height ? '#ef4444' : '#e5e7eb' }} />
            {fieldErrors.height && <p style={{ fontSize: '10px', color: '#ef4444', marginTop: '4px' }}>{fieldErrors.height}</p>}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>몸무게 (kg)</p>
            <input type="number" inputMode="decimal" value={body.weight} min={20} max={300}
              onChange={e => set('weight')(e.target.value)}
              onBlur={e => checkField('weight')(e.target.value)}
              placeholder="65"
              style={{ ...inputStyle, borderColor: fieldErrors.weight ? '#ef4444' : '#e5e7eb' }} />
            {fieldErrors.weight && <p style={{ fontSize: '10px', color: '#ef4444', marginTop: '4px' }}>{fieldErrors.weight}</p>}
          </div>
        </div>
        <div style={{ marginBottom: '14px' }} />

        {/* 목표 체중 */}
        <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>목표 체중 (kg)</p>
        <input
          type="number" inputMode="decimal" value={body.targetWeight} min={20} max={300}
          onChange={e => set('targetWeight')(e.target.value)}
          onBlur={e => checkField('targetWeight')(e.target.value)}
          placeholder="60"
          style={{ ...inputStyle, marginBottom: fieldErrors.targetWeight ? '4px' : '14px', borderColor: fieldErrors.targetWeight ? '#ef4444' : '#e5e7eb' }}
        />
        {fieldErrors.targetWeight && <p style={{ fontSize: '10px', color: '#ef4444', marginBottom: '10px' }}>{fieldErrors.targetWeight}</p>}

        {/* 활동량 */}
        <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>활동량</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
          {(['sedentary', 'light', 'moderate', 'active'] as const).map(val => (
            <button
              key={val}
              onClick={() => set('activity')(val)}
              style={{
                padding: '10px 12px', border: '1px solid', fontSize: '12px', cursor: 'pointer', textAlign: 'left',
                borderColor: body.activity === val ? 'black' : '#e5e7eb',
                backgroundColor: body.activity === val ? 'black' : 'white',
                color: body.activity === val ? 'white' : 'black',
              }}
            >
              {ACTIVITY_LABEL[val]}
            </button>
          ))}
        </div>

        {/* 목표 */}
        <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>목표</p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {(['다이어트', '유지', '증량'] as const).map(g => (
            <button key={g} onClick={() => set('goal')(g)} style={chipStyle(body.goal === g)}>{g}</button>
          ))}
        </div>

        {/* 저장 */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', padding: '12px', border: '1px solid black',
            backgroundColor: saved ? 'black' : saving ? '#f3f4f6' : 'white',
            color: saved ? 'white' : saving ? '#9ca3af' : 'black',
            fontSize: '12px', cursor: saving ? 'not-allowed' : 'pointer',
            letterSpacing: '1px', transition: 'all 0.2s',
          }}
        >
          {saved ? '저장됨 ✓' : saving ? '암호화 중...' : '저장'}
        </button>

        <p style={{ fontSize: '10px', color: '#d1d5db', marginTop: '8px', textAlign: 'center' }}>
          🔐 AES-256 암호화 · 이 기기에만 저장
        </p>
      </div>
    </div>
  );
}

type Meal = {
  id: string;
  food_name: string;
  calories: number;
  created_at: string;
  photo_url?: string;
  category?: string;
  nutrient?: {
    carbohydrates?: number;
    protein?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  };
};

type Stats = {
  total: number;
  avgCaloriesPerDay: number;
  topFood: { mealType: string; category: string; foodName: string } | null;
  firstDate: string | null;
  lastDate: string | null;
  topCategory: string | null;
};

const MEAL_TYPE: Record<string, string> = {
  한식: '주식', 중식: '주식', 일식: '주식', 양식: '주식', 기타: '주식',
  간식: '간식',
  음료: '음료',
};

function computeStats(meals: Meal[]): Stats {
  if (meals.length === 0) {
    return { total: 0, avgCaloriesPerDay: 0, topFood: null, firstDate: null, lastDate: null, topCategory: null };
  }
  const sorted = [...meals].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // 1일 평균 칼로리: 날짜별로 합산 후 평균
  const dayCalMap: Record<string, number> = {};
  meals.forEach(m => {
    const day = m.created_at.slice(0, 10);
    dayCalMap[day] = (dayCalMap[day] || 0) + (m.calories || 0);
  });
  const dayVals = Object.values(dayCalMap);
  const avgCaloriesPerDay = Math.round(dayVals.reduce((s, v) => s + v, 0) / dayVals.length);

  // 가장 많이 먹은 카테고리
  const catCount: Record<string, number> = {};
  meals.forEach(m => { if (m.category) catCount[m.category] = (catCount[m.category] || 0) + 1; });
  const topCategory = Object.keys(catCount).sort((a, b) => catCount[b] - catCount[a])[0] || null;

  // 가장 많이 먹은 음식 (카테고리+음식명 조합 기준)
  const foodCount: Record<string, number> = {};
  meals.forEach(m => {
    const key = `${m.category || '기타'}::${m.food_name}`;
    foodCount[key] = (foodCount[key] || 0) + 1;
  });
  const topFoodKey = Object.keys(foodCount).sort((a, b) => foodCount[b] - foodCount[a])[0] || null;
  let topFood: Stats['topFood'] = null;
  if (topFoodKey) {
    const [cat, name] = topFoodKey.split('::');
    topFood = { mealType: MEAL_TYPE[cat] ?? '주식', category: cat, foodName: name };
  }

  return {
    total: meals.length,
    avgCaloriesPerDay,
    topFood,
    firstDate: sorted[0].created_at,
    lastDate: sorted[sorted.length - 1].created_at,
    topCategory,
  };
}

function buildJSONBlob(meals: Meal[]) {
  const payload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    app: 'MyBob',
    description: '개인 식단 영양 기록 — 온디바이스 AI 분석용',
    meals,
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

function buildCSVBlob(meals: Meal[]) {
  const header = ['날짜', '음식명', '카테고리', '칼로리(kcal)', '탄수화물(g)', '단백질(g)', '지방(g)', '식이섬유(g)', '당류(g)', '나트륨(mg)'];
  const rows = meals.map(m => [
    new Date(m.created_at).toLocaleString('ko-KR'),
    m.food_name,
    m.category || '',
    m.calories,
    m.nutrient?.carbohydrates ?? '',
    m.nutrient?.protein ?? '',
    m.nutrient?.fat ?? '',
    m.nutrient?.fiber ?? '',
    m.nutrient?.sugar ?? '',
    m.nutrient?.sodium ?? '',
  ]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  return new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
}

async function shareOrDownload(meals: Meal[], type: 'json' | 'csv') {
  if (meals.length === 0) { alert('내보낼 데이터가 없습니다.'); return; }
  const date = new Date().toISOString().split('T')[0];
  const filename = `mybob_${date}.${type}`;
  const blob = type === 'json' ? buildJSONBlob(meals) : buildCSVBlob(meals);
  const file = new File([blob], filename, { type: blob.type });

  // Web Share API — 메신저/메일 공유 지원 기기
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'MyBob 식단 데이터' });
      return;
    } catch (e: any) {
      if (e.name === 'AbortError') return; // 사용자가 취소
    }
  }

  // 폴백 — 저장 위치 선택 (File System Access API 지원 시)
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: type.toUpperCase(), accept: { [blob.type]: [`.${type}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e: any) {
      if (e.name === 'AbortError') return;
    }
  }

  // 최종 폴백 — 기본 다운로드
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type PlanStatus = {
  plan: 'free' | 'pro' | 'lifetime';
  upload: { used: number; limit: number; remaining: number };
  analysis: { used: number; limit: number; remaining: number };
};

const PLAN_LABEL: Record<string, string> = { free: '무료', pro: '구독 PRO', lifetime: '평생 이용권' };
const PLAN_COLOR: Record<string, string> = { free: '#9ca3af', pro: '#6B21A8', lifetime: '#d97706' };

type CoachPersona = 'robot' | 'cat' | 'dog';

const COACH_OPTIONS: { id: CoachPersona; emoji: string; name: string; desc: string }[] = [
  { id: 'robot', emoji: '🤖', name: '분석형', desc: '수치와 데이터로 말합니다' },
  { id: 'cat',   emoji: '🐱', name: '직관형', desc: '예상 못한 한마디를 던집니다' },
  { id: 'dog',   emoji: '🐶', name: '응원형', desc: '무조건 당신 편이에요' },
];


export default function SettingsPage() {
  const [aiAlert, setAiAlert] = useState(true);
  const [notifFreq, setNotifFreq] = useState('1시간 후');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, avgCaloriesPerDay: 0, topFood: null, firstDate: null, lastDate: null, topCategory: null });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [dangerUnlocked, setDangerUnlocked] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [storageMode, setStorageModeState] = useState<StorageMode>('local');
  const [showModeModal, setShowModeModal] = useState(false);
  const [deleteSchedule, setDeleteSchedule] = useState<{ scheduledAt: Date; daysLeft: number } | null>(null);
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [profile, setProfile] = useState<{ nickname: string | null; avatar_url: string | null; nickname_changed: boolean }>({ nickname: null, avatar_url: null, nickname_changed: false });
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameSaved, setNicknameSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarChangedToday, setAvatarChangedToday] = useState(false);
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusInput, setStatusInput] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusSaved, setStatusSaved] = useState(false);
  const [statusChangedToday, setStatusChangedToday] = useState(false);
  const [suggestedMsgs, setSuggestedMsgs] = useState<StatusTemplate[]>([]);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [coachPersona, setCoachPersona] = useState<CoachPersona>('dog');

  // ── 보안 인증 상태 ──────────────────────────────────────────
  const [pinModal, setPinModal] = useState<{ mode: 'set' | 'verify'; context: 'body' | 'danger'; resolve: (ok: boolean, pin?: string) => void } | null>(null);
  const [showPinReset, setShowPinReset] = useState(false);
  const [hasPinSet, setHasPinSet] = useState(false);

  useEffect(() => {
    setHasPinSet(!!getPinHash());
  }, []);

  // PIN 인증 요청 — boolean 반환 (위험구역용)
  const requestAuth = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!hasPinSet) {
        setPinModal({ mode: 'set', context: 'danger', resolve: (ok) => { setPinModal(null); resolve(ok); } });
      } else {
        setPinModal({ mode: 'verify', context: 'danger', resolve: (ok) => { setPinModal(null); resolve(ok); } });
      }
    });
  }, [hasPinSet]);

  // PIN 인증 요청 — PIN 문자열을 콜백으로 전달 (신체정보 복호화용)
  const requestAuthWithPin = useCallback((cb: (pin: string) => void) => {
    if (!hasPinSet) {
      setPinModal({
        mode: 'set', context: 'body',
        resolve: (ok, pin) => { setPinModal(null); if (ok && pin) cb(pin); },
      });
    } else {
      setPinModal({
        mode: 'verify', context: 'body',
        resolve: (ok, pin) => { setPinModal(null); if (ok && pin) cb(pin); },
      });
    }
  }, [hasPinSet]);

  // 위험구역 잠금 해제 with 인증
  const handleDangerUnlock = async () => {
    if (dangerUnlocked) {
      setDangerUnlocked(false);
      setConfirmDelete(false);
      setConfirmWithdraw(false);
      return;
    }
    const ok = await requestAuth();
    if (ok) setDangerUnlocked(true);
  };

  useEffect(() => {
    const savedPersona = (localStorage.getItem('mybob_coach_persona') as CoachPersona) || 'dog';
    setCoachPersona(savedPersona);

    const raw = localStorage.getItem('mybob_meals');
    const parsed: Meal[] = raw ? JSON.parse(raw) : [];
    setMeals(parsed);
    setStats(computeStats(parsed));

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email) setUserEmail(session.user.email);
      if (session?.access_token) {
        try {
          const [statusRes, profileRes] = await Promise.all([
            fetch('/api/upload-status', { headers: { Authorization: `Bearer ${session.access_token}` } }),
            fetch('/api/profile', { headers: { Authorization: `Bearer ${session.access_token}` } }),
          ]);
          if (statusRes.ok) setPlanStatus(await statusRes.json());
          if (profileRes.ok) {
            const p = await profileRes.json();
            setProfile({ nickname: p.nickname, avatar_url: p.avatar_url, nickname_changed: p.nickname_changed ?? false });
            setNicknameInput(p.nickname ?? '');
            const today = new Date().toLocaleDateString();
            const savedStatus = localStorage.getItem('mybob_status_msg') ?? '';
            setStatusMsg(savedStatus);
            setStatusInput(savedStatus);
            setAvatarChangedToday(localStorage.getItem('mybob_avatar_changed_date') === today);
            setStatusChangedToday(localStorage.getItem('mybob_status_changed_date') === today);
            setSuggestedMsgs(pickRandom3(savedStatus));
          }
        } catch { /* 무시 */ }
      }
      setPlanLoaded(true);
    });
    setStorageModeState(getStorageMode());
    setDeleteSchedule(getCloudDeleteSchedule());
  }, []);

  const handleDeleteAll = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    localStorage.removeItem('mybob_meals');
    setMeals([]);
    setStats(computeStats([]));
    setConfirmDelete(false);
    setDangerUnlocked(false);
  };

  const handleNicknameSave = async () => {
    const nick = nicknameInput.trim();
    if (nick.length < 2 || nick.length > 16) return alert('닉네임은 2~16자여야 합니다.');
    setNicknameSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ nickname: nick }),
    });
    const result = await res.json();
    if (result.success) {
      setProfile(prev => ({ ...prev, nickname: nick, nickname_changed: true }));
      setNicknameSaved(true);
      setTimeout(() => setNicknameSaved(false), 1500);
    } else if (result.error === 'NICKNAME_ALREADY_CHANGED') {
      alert('닉네임은 1회만 변경할 수 있습니다.');
    } else {
      alert(result.error || '저장 실패');
    }
    setNicknameSaving(false);
  };

  const handleStatusSave = () => {
    if (statusChangedToday) return;
    setStatusSaving(true);
    const today = new Date().toLocaleDateString();
    localStorage.setItem('mybob_status_msg', statusInput.trim());
    localStorage.setItem('mybob_status_changed_date', today);
    setStatusMsg(statusInput.trim());
    setStatusChangedToday(true);
    setStatusSaving(false);
    setStatusSaved(true);
    setTimeout(() => setStatusSaved(false), 1500);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || avatarChangedToday) return;
    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ imageBase64: reader.result }),
      });
      const result = await res.json();
      if (result.success) {
        setProfile(prev => ({ ...prev, avatar_url: result.avatar_url }));
        const today = new Date().toLocaleDateString();
        localStorage.setItem('mybob_avatar_changed_date', today);
        setAvatarChangedToday(true);
      } else {
        alert(result.error || '업로드 실패');
      }
      setAvatarUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleLogout = async () => {
    if (!confirmLogout) { setConfirmLogout(true); return; }
    await supabase.auth.signOut();
    localStorage.removeItem('mybob_meals');
    localStorage.removeItem('mybob_storage_mode');
    localStorage.removeItem('mybob_onboarding_done');
    window.location.href = '/auth/login';
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden' }}>

      {/* PIN 모달 */}
      {pinModal && (
        <PinModal
          mode={pinModal.mode}
          context={pinModal.context}
          onSuccess={(pin) => {
            if (pinModal.mode === 'set') {
              savePin(pin);
              setHasPinSet(true);
            }
            pinModal.resolve(true, pin);
          }}
          onCancel={() => {
            pinModal.resolve(false);
            setPinModal(null);
          }}
          onForgot={pinModal.context === 'danger' ? () => {
            setPinModal(null);
            setShowPinReset(true);
          } : undefined}
        />
      )}

      {showPinReset && (
        <DangerPinResetModal
          onSuccess={() => {
            // PIN 초기화 — 새 PIN 설정 모달로 연결
            localStorage.removeItem(PIN_KEY);
            setHasPinSet(false);
            setShowPinReset(false);
            setDangerUnlocked(true);
          }}
          onCancel={() => setShowPinReset(false)}
        />
      )}
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '24px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

        {/* 프로필 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>프로필</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: '28px' }}>
          <div style={{ padding: '16px', backgroundColor: 'white' }}>

            {!planLoaded ? (
              <div style={{ height: '72px' }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* 프로필 행 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {/* 아바타 */}
                    <div style={{
                      width: '56px', height: '56px', borderRadius: '50%',
                      backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb',
                      overflow: 'hidden', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative',
                    }}>
                      {profile.avatar_url
                        ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '22px' }}>👤</span>
                      }
                      {avatarUploading && (
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        </div>
                      )}
                    </div>
                    {/* 닉네임 + 플랜 */}
                    <div>
                      <p style={{ fontSize: '15px', color: 'black', marginBottom: '3px' }}>{profile.nickname || '닉네임 없음'}</p>
                      <p style={{ fontSize: '11px', color: planStatus?.plan === 'free' ? '#9ca3af' : '#6B21A8', letterSpacing: '0.5px' }}>
                        {planStatus?.plan === 'free' ? 'FREE' : planStatus?.plan === 'lifetime' ? 'LIFETIME' : 'PRO'}
                      </p>
                    </div>
                  </div>
                  {/* 수정 버튼 — PRO만 */}
                  {planStatus?.plan !== 'free' && planStatus && (
                    <button
                      onClick={() => setShowEditPopup(true)}
                      style={{ fontSize: '12px', color: '#6B21A8', background: 'none', border: '1px solid #e9d5ff', padding: '6px 12px', cursor: 'pointer', letterSpacing: '0.5px' }}
                    >
                      수정
                    </button>
                  )}
                </div>

                {/* 상태메시지 표시 */}
                {statusMsg && (
                  <p style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic', paddingLeft: '2px' }}>
                    "{statusMsg}"
                  </p>
                )}

                <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
              </div>
            )}
          </div>
        </div>

        {/* 코치 선택 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>코치 스타일</p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {COACH_OPTIONS.map(opt => {
            const isSelected = coachPersona === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => setCoachPersona(opt.id)}
                style={{
                  flex: 1,
                  padding: '14px 8px',
                  border: `2px solid ${isSelected ? '#6B21A8' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  backgroundColor: isSelected ? '#f3e8ff' : 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: '26px', lineHeight: 1 }}>{opt.emoji}</span>
                <span style={{ fontSize: '12px', color: isSelected ? '#6B21A8' : 'black', fontWeight: isSelected ? 600 : 400 }}>{opt.name}</span>
                <span style={{ fontSize: '10px', color: '#9ca3af', lineHeight: 1.4, textAlign: 'center' }}>{opt.desc}</span>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => {
            localStorage.setItem('mybob_coach_persona', coachPersona);
            const keys = Object.keys(localStorage);
            keys.forEach(k => { if (k.startsWith('mybob_coach_') && k !== 'mybob_coach_persona') localStorage.removeItem(k); });
            alert(`${COACH_OPTIONS.find(o => o.id === coachPersona)?.emoji} 코치가 변경되었습니다.`);
          }}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: '#6B21A8',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            marginBottom: '28px',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          적용
        </button>

        {/* 플랜 현황 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>이용 플랜</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: '28px' }}>
          <div style={{ padding: '16px', backgroundColor: 'white' }}>
            {planStatus ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'white', backgroundColor: PLAN_COLOR[planStatus.plan], padding: '3px 8px' }}>
                      {PLAN_LABEL[planStatus.plan]}
                    </span>
                    <span style={{ fontSize: '13px', color: 'black' }}>이용 중</span>
                  </div>
                  {planStatus.plan === 'free' && (
                    <button
                      style={{ padding: '6px 12px', backgroundColor: '#6B21A8', color: 'white', border: 'none', fontSize: '11px', cursor: 'pointer', letterSpacing: '0.5px' }}
                      onClick={() => alert('결제 기능 준비 중입니다.')}
                    >
                      업그레이드
                    </button>
                  )}
                </div>

                {/* AI 분석 사용량 */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>오늘 AI 분석</span>
                    <span style={{ fontSize: '11px', color: planStatus.analysis.used >= planStatus.analysis.limit ? '#ef4444' : 'black' }}>
                      {planStatus.analysis.used} / {planStatus.analysis.limit}회
                    </span>
                  </div>
                  <div style={{ height: '3px', backgroundColor: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, (planStatus.analysis.used / planStatus.analysis.limit) * 100)}%`,
                      backgroundColor: planStatus.analysis.used >= planStatus.analysis.limit ? '#ef4444' : '#6B21A8',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </div>

                {/* 클라우드 저장 사용량 */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>오늘 클라우드 저장</span>
                    <span style={{ fontSize: '11px', color: planStatus.upload.used >= planStatus.upload.limit ? '#ef4444' : 'black' }}>
                      {planStatus.upload.used} / {planStatus.upload.limit}장
                    </span>
                  </div>
                  <div style={{ height: '3px', backgroundColor: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, (planStatus.upload.used / planStatus.upload.limit) * 100)}%`,
                      backgroundColor: planStatus.upload.used >= planStatus.upload.limit ? '#ef4444' : '#9ca3af',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </div>

                {planStatus.plan === 'free' && (
                  <p style={{ fontSize: '10px', color: '#9ca3af', lineHeight: 1.5 }}>
                    PRO로 업그레이드하면 하루 25회 + 광고 없음 + 프리미엄 기능을 이용할 수 있습니다.
                  </p>
                )}
              </>
            ) : (
              <p style={{ fontSize: '13px', color: '#9ca3af' }}>로그인 후 확인 가능합니다.</p>
            )}
          </div>
        </div>

        {/* 기록 통계 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>기록 현황</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: '28px' }}>
          <div style={{ padding: '14px 8px', backgroundColor: 'white', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '6px' }}>총 기록</p>
            <p style={{ fontSize: '14px', color: 'black' }}>{stats.total}건</p>
          </div>
          <div style={{ padding: '14px 8px', backgroundColor: 'white', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '6px' }}>1일 평균</p>
            <p style={{ fontSize: '14px', color: 'black' }}>{stats.avgCaloriesPerDay > 0 ? `${stats.avgCaloriesPerDay.toLocaleString()}kcal` : '-'}</p>
          </div>
          <div style={{ padding: '14px 8px', backgroundColor: 'white', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '6px' }}>자주 먹는 음식</p>
            {stats.topFood ? (
              <div>
                <p style={{ fontSize: '9px', color: '#9ca3af', marginBottom: '2px' }}>{stats.topFood.mealType} · {stats.topFood.category}</p>
                <p style={{ fontSize: '12px', color: '#6B21A8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stats.topFood.foodName}</p>
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: 'black' }}>-</p>
            )}
          </div>
        </div>
        {stats.firstDate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: 'white' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>첫 기록일</span>
              <span style={{ fontSize: '12px', color: 'black' }}>{fmt(stats.firstDate)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: 'white' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>최근 기록일</span>
              <span style={{ fontSize: '12px', color: 'black' }}>{fmt(stats.lastDate!)}</span>
            </div>
            {stats.topCategory && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: 'white' }}>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>가장 많은 카테고리</span>
                <span style={{ fontSize: '12px', color: '#6B21A8' }}>{stats.topCategory}</span>
              </div>
            )}
          </div>
        )}

        {/* 데이터 내보내기 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>데이터 내보내기</p>
        <div style={{ display: 'flex', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
          <button
            onClick={() => shareOrDownload(meals, 'json')}
            style={{ flex: 1, padding: '14px 8px', border: 'none', backgroundColor: 'white', fontSize: '13px', cursor: 'pointer', letterSpacing: '0.5px' }}
          >
            JSON
          </button>
          <button
            onClick={() => shareOrDownload(meals, 'csv')}
            style={{ flex: 1, padding: '14px 8px', border: 'none', backgroundColor: 'white', fontSize: '13px', cursor: 'pointer', letterSpacing: '0.5px' }}
          >
            CSV
          </button>
        </div>

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
              style={{ width: '44px', height: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: aiAlert ? 'black' : 'white', cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s', padding: 0 }}
            >
              <span style={{ position: 'absolute', top: '3px', left: aiAlert ? '20px' : '3px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: aiAlert ? 'white' : '#d1d5db', transition: 'left 0.2s' }} />
            </button>
          </div>
        </div>

        {/* 저장 방식 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>저장 방식</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: deleteSchedule ? '12px' : '28px' }}>
          <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>{storageMode === 'local' ? '📱' : '☁️'}</span>
                <div>
                  <p style={{ fontSize: '14px', color: 'black' }}>{storageMode === 'local' ? '로컬 저장' : '클라우드 동기화'}</p>
                  <p style={{ fontSize: '10px', color: storageMode === 'local' ? '#6B21A8' : '#0ea5e9', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    {storageMode === 'local' ? 'LOCAL · 이 기기에만 보관' : 'CLOUD · 서버 동기화 중'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModeModal(true)}
                style={{ padding: '6px 12px', border: '1px solid #e5e7eb', backgroundColor: 'white', fontSize: '12px', cursor: 'pointer', color: '#6b7280', letterSpacing: '0.5px' }}
              >
                변경
              </button>
            </div>
            <p style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.5 }}>
              {storageMode === 'local'
                ? '모든 식단 기록과 사진은 이 기기에만 저장됩니다. 서버로 전송되지 않습니다.'
                : '식단 기록이 서버에 동기화됩니다. 여러 기기에서 같은 데이터를 볼 수 있습니다.'}
            </p>
          </div>
        </div>

        {/* 15일 삭제 예약 배너 */}
        {deleteSchedule && (
          <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', padding: '14px 16px', marginBottom: '28px' }}>
            <p style={{ fontSize: '12px', color: '#9a3412', marginBottom: '8px', lineHeight: 1.5 }}>
              ⏳ 서버 데이터가 <strong>{deleteSchedule.daysLeft}일 후</strong> 삭제될 예정입니다.<br />
              ({deleteSchedule.scheduledAt.toLocaleDateString('ko-KR')} 예정)
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) return;
                  if (confirm('지금 즉시 서버 데이터를 삭제하시겠습니까?')) {
                    await requestServerDataDeletion(session.access_token);
                    setDeleteSchedule(null);
                  }
                }}
                style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', fontSize: '11px', cursor: 'pointer' }}
              >
                지금 삭제
              </button>
              <button
                onClick={() => {
                  cancelCloudDeleteSchedule();
                  setDeleteSchedule(null);
                  setStorageModeState('cloud');
                }}
                style={{ padding: '6px 12px', backgroundColor: 'white', color: '#6b7280', border: '1px solid #e5e7eb', fontSize: '11px', cursor: 'pointer' }}
              >
                취소 (클라우드 유지)
              </button>
            </div>
          </div>
        )}

        {/* 저장 방식 변경 모달 */}
        {showModeModal && (
          <StorageModeModal
            currentMode={storageMode}
            onClose={() => setShowModeModal(false)}
            onModeChanged={(mode) => {
              setStorageModeState(mode);
              setDeleteSchedule(getCloudDeleteSchedule());
              setShowModeModal(false);
            }}
          />
        )}

        {/* 보안 및 개인정보 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>보안 및 개인정보</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
          <button
            onClick={() => setShowPrivacyModal(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: 'white', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
          >
            <span style={{ fontSize: '14px', color: 'black' }}>개인정보 처리방침</span>
            <span style={{ fontSize: '16px', color: '#9ca3af' }}>›</span>
          </button>
        </div>

        {/* 개인정보 팝업 모달 */}
        {showPrivacyModal && (
          <div
            onClick={() => setShowPrivacyModal(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ backgroundColor: 'white', width: '100%', maxHeight: '75vh', overflowY: 'auto', borderRadius: '12px 12px 0 0', padding: '24px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 400 }}>개인정보 처리방침</h3>
                <button onClick={() => setShowPrivacyModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}>×</button>
              </div>

              {/* 사진 저장 위치 */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>📁</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '12px', color: 'black', fontWeight: 500, marginBottom: '4px' }}>사진 저장 위치</p>
                  {storageMode === 'cloud' ? (
                    <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.6 }}>사진은 암호화된 서버에 안전하게 저장됩니다. 본인 계정 외 접근이 불가합니다.</p>
                  ) : (
                    <div>
                      <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.6, marginBottom: '6px' }}>사진은 이 기기의 브라우저 저장소(IndexedDB)에만 보관됩니다. 서버로 전송되지 않습니다.</p>
                      <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px', fontFamily: 'monospace' }}>경로: IndexedDB › mybob-photos</p>
                      <button
                        onClick={() => alert('브라우저 개발자 도구 → Application → IndexedDB → mybob-photos 에서 확인할 수 있습니다.')}
                        style={{ fontSize: '10px', color: '#6B21A8', background: 'none', border: '1px solid #e5e7eb', padding: '3px 8px', cursor: 'pointer' }}
                      >
                        경로 안내
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 인증 방식 */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>🔐</span>
                <div>
                  <p style={{ fontSize: '12px', color: 'black', fontWeight: 500, marginBottom: '4px' }}>인증 방식</p>
                  <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.6 }}>JWT 토큰 기반 인증을 사용합니다. 로그인하지 않은 상태에서는 클라우드 저장이 이루어지지 않으며, 모든 기록은 이 기기에만 보관됩니다.</p>
                </div>
              </div>

              {/* 영양 데이터 저장 */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>🗄️</span>
                <div>
                  <p style={{ fontSize: '12px', color: 'black', fontWeight: 500, marginBottom: '4px' }}>영양 데이터 저장</p>
                  {storageMode === 'cloud' ? (
                    <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.6 }}>영양 기록은 암호화된 서버에 안전하게 저장됩니다. 본인 계정에 귀속되며 타인이 접근할 수 없습니다.</p>
                  ) : (
                    <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.6 }}>영양 기록은 이 기기의 로컬 스토리지(mybob_meals)에만 저장됩니다. 서버로 전송되지 않습니다.</p>
                  )}
                </div>
              </div>

              {/* AI 분석 */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>🤖</span>
                <div>
                  <p style={{ fontSize: '12px', color: 'black', fontWeight: 500, marginBottom: '4px' }}>AI 분석 데이터</p>
                  <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.6 }}>음식 사진은 Google Gemini API로 전송되어 분석됩니다. 분석 후 원본 이미지는 Gemini 서버에 저장되지 않습니다(Google 정책 기준).</p>
                </div>
              </div>

              {/* 제3자 제공 */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>🚫</span>
                <div>
                  <p style={{ fontSize: '12px', color: 'black', fontWeight: 500, marginBottom: '4px' }}>제3자 제공</p>
                  <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.6 }}>
                    이름·이메일·식단 기록 등 개인 식별 정보는 제3자에게 제공되지 않습니다.{'\n'}
                    단, AI 분석 정확도·카테고리 분포 등 개인을 특정할 수 없는 통계 데이터는 서비스 품질 개선 목적으로 내부에서 활용될 수 있습니다.
                  </p>
                </div>
              </div>

              <div style={{ height: '20px' }} />
            </div>
          </div>
        )}

        {/* 목표 설정 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>목표 설정</p>
        <GoalSettings onRequestAuth={requestAuthWithPin} />

        {/* 개인 정보 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>개인 정보</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
          <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>이메일 주소</p>
            <p style={{ fontSize: '14px', color: 'black' }}>{userEmail || '로그인 필요'}</p>
          </div>
          {/* 로그아웃 */}
          {!confirmLogout ? (
            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', backgroundColor: 'white', border: 'none',
                cursor: 'pointer', width: '100%', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '14px', color: 'black' }}>로그아웃</span>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>›</span>
            </button>
          ) : (
            <div style={{ padding: '12px 16px', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>정말 로그아웃할까요?</span>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button
                  onClick={handleLogout}
                  style={{ padding: '6px 14px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '12px', cursor: 'pointer' }}
                >
                  확인
                </button>
                <button
                  onClick={() => setConfirmLogout(false)}
                  style={{ padding: '6px 14px', backgroundColor: 'white', color: '#6b7280', border: '1px solid #e5e7eb', fontSize: '12px', cursor: 'pointer' }}
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 위험 구역 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <p style={{ fontSize: '10px', color: '#ef4444', letterSpacing: '2px', textTransform: 'uppercase' }}>위험 구역</p>
          {/* 자물쇠 토글 — 잠금 해제 시 생체인증 */}
          <button
            onClick={handleDangerUnlock}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 10px', border: `1px solid ${dangerUnlocked ? '#ef4444' : '#e5e7eb'}`,
              backgroundColor: dangerUnlocked ? '#fef2f2' : 'white',
              cursor: 'pointer', fontSize: '11px',
              color: dangerUnlocked ? '#ef4444' : '#9ca3af',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: '13px' }}>{dangerUnlocked ? '🔓' : '🔒'}</span>
            {dangerUnlocked ? '잠금 해제됨' : '잠금'}
          </button>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: '1px',
          backgroundColor: '#e5e7eb', marginBottom: '40px',
          opacity: dangerUnlocked ? 1 : 0.4,
          transition: 'opacity 0.2s',
          position: 'relative',
        }}>
          {/* 잠긴 상태 오버레이 — 클릭 차단 */}
          {!dangerUnlocked && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'not-allowed' }} />
          )}

          {/* 로컬 기록 전체 삭제 */}
          <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '10px', lineHeight: 1.5 }}>
              이 기기에 저장된 모든 식단 기록을 삭제합니다. 되돌릴 수 없습니다.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDeleteAll}
                disabled={!dangerUnlocked}
                style={{
                  padding: '8px 14px',
                  backgroundColor: confirmDelete ? '#ef4444' : 'white',
                  color: confirmDelete ? 'white' : '#ef4444',
                  border: '1px solid #fca5a5', fontSize: '13px',
                  cursor: dangerUnlocked ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                {confirmDelete ? '한 번 더 누르면 삭제됩니다' : '로컬 기록 전체 삭제'}
              </button>
              {confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{ padding: '8px 14px', backgroundColor: 'white', color: '#9ca3af', border: '1px solid #e5e7eb', fontSize: '13px', cursor: 'pointer' }}
                >
                  취소
                </button>
              )}
            </div>
          </div>

          {/* 회원 탈퇴 */}
          <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '10px', lineHeight: 1.5 }}>
              계정과 서버에 저장된 모든 데이터가 영구 삭제됩니다.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setConfirmWithdraw(v => !v)}
                disabled={!dangerUnlocked}
                style={{
                  padding: '8px 14px',
                  backgroundColor: confirmWithdraw ? '#ef4444' : 'white',
                  color: confirmWithdraw ? 'white' : '#ef4444',
                  border: '1px solid #fca5a5', fontSize: '13px',
                  cursor: dangerUnlocked ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                {confirmWithdraw ? '정말 탈퇴하시겠습니까?' : '회원 탈퇴'}
              </button>
              {confirmWithdraw && (
                <button
                  onClick={async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) await requestServerDataDeletion(session.access_token);
                    await supabase.auth.signOut();
                    localStorage.clear();
                    window.location.href = '/auth/login';
                  }}
                  style={{ padding: '8px 14px', backgroundColor: '#ef4444', color: 'white', border: 'none', fontSize: '13px', cursor: 'pointer' }}
                >
                  최종 확인 · 탈퇴
                </button>
              )}
              {confirmWithdraw && (
                <button
                  onClick={() => setConfirmWithdraw(false)}
                  style={{ padding: '8px 14px', backgroundColor: 'white', color: '#9ca3af', border: '1px solid #e5e7eb', fontSize: '13px', cursor: 'pointer' }}
                >
                  취소
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* 프로필 수정 팝업 */}
      {showEditPopup && (
        <div
          onClick={() => setShowEditPopup(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: 'white', width: '100%', borderRadius: '16px 16px 0 0', padding: '24px 24px 40px', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <p style={{ fontSize: '15px', color: 'black' }}>프로필 수정</p>
              <button onClick={() => setShowEditPopup(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#9ca3af', cursor: 'pointer', padding: '4px', lineHeight: 1 }}>×</button>
            </div>

            {/* 사진 변경 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb',
                overflow: 'hidden', flexShrink: 0, position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '26px' }}>👤</span>
                }
                {avatarUploading && (
                  <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '18px', height: '18px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                )}
              </div>
              <button
                onClick={() => !avatarChangedToday && avatarInputRef.current?.click()}
                style={{
                  fontSize: '13px', background: 'none', padding: '8px 16px', cursor: avatarChangedToday ? 'default' : 'pointer',
                  border: '1px solid #e9d5ff',
                  color: avatarChangedToday ? '#d1d5db' : '#6B21A8',
                }}
              >
                {avatarChangedToday ? '오늘 변경 완료' : '사진 변경'}
              </button>
            </div>

            {/* 닉네임 변경 */}
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>닉네임</p>
            {profile.nickname_changed ? (
              <div style={{ padding: '12px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa', marginBottom: '24px' }}>
                <p style={{ fontSize: '14px', color: 'black' }}>{profile.nickname}</p>
              </div>
            ) : (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                  <input
                    type="text"
                    value={nicknameInput}
                    onChange={e => setNicknameInput(e.target.value)}
                    maxLength={16}
                    placeholder="닉네임 (2~16자)"
                    style={{ flex: 1, padding: '11px 12px', border: '1px solid #e5e7eb', fontSize: '14px', outline: 'none', backgroundColor: 'white', color: 'black' }}
                  />
                  <button
                    onClick={async () => { await handleNicknameSave(); }}
                    disabled={nicknameSaving || nicknameInput.trim() === (profile.nickname ?? '') || nicknameInput.trim().length < 2}
                    style={{
                      padding: '11px 16px', fontSize: '12px', border: 'none', cursor: 'pointer',
                      backgroundColor: nicknameSaved ? '#6B21A8' : (nicknameSaving || nicknameInput.trim() === (profile.nickname ?? '') || nicknameInput.trim().length < 2) ? '#e5e7eb' : 'black',
                      color: (nicknameSaving || (nicknameInput.trim() === (profile.nickname ?? '') || nicknameInput.trim().length < 2) && !nicknameSaved) ? '#9ca3af' : 'white',
                      transition: 'all 0.2s',
                    }}
                  >
                    {nicknameSaved ? '저장됨' : '저장'}
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: '#ef4444' }}>저장 후 다시 변경할 수 없습니다</p>
              </div>
            )}

            {/* 상태메시지 */}
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>상태메시지</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input
                type="text"
                value={statusInput}
                onChange={e => setStatusInput(e.target.value)}
                maxLength={40}
                placeholder="상태메시지 (최대 40자)"
                disabled={statusChangedToday}
                style={{
                  flex: 1, padding: '11px 12px', border: '1px solid #e5e7eb',
                  fontSize: '13px', outline: 'none', backgroundColor: statusChangedToday ? '#fafafa' : 'white',
                  color: statusChangedToday ? '#9ca3af' : 'black',
                }}
              />
              <button
                onClick={handleStatusSave}
                disabled={statusChangedToday || statusSaving || statusInput.trim() === statusMsg}
                style={{
                  padding: '11px 14px', fontSize: '12px', border: 'none', cursor: statusChangedToday ? 'default' : 'pointer',
                  backgroundColor: statusSaved ? '#6B21A8' : statusChangedToday ? '#e5e7eb' : 'black',
                  color: statusSaved || !statusChangedToday ? 'white' : '#9ca3af',
                  transition: 'all 0.2s',
                }}
              >
                {statusSaved ? '저장됨' : statusChangedToday ? '완료' : '저장'}
              </button>
            </div>

            {/* 추천 문구 — 변경 가능/불가 모두 표시 */}
            <div style={{ paddingBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase' }}>추천 문구</p>
                {!statusChangedToday && (
                  <button
                    onClick={() => setSuggestedMsgs(pickRandom3(statusInput))}
                    style={{ fontSize: '11px', color: '#6B21A8', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
                  >
                    다른 메시지 →
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {suggestedMsgs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => !statusChangedToday && setStatusInput(t.text)}
                    style={{
                      padding: '11px 12px',
                      border: `1px solid ${statusInput === t.text ? '#6B21A8' : '#e5e7eb'}`,
                      backgroundColor: statusInput === t.text ? '#f3e8ff' : 'white',
                      color: statusChangedToday ? '#9ca3af' : statusInput === t.text ? '#6B21A8' : '#6b7280',
                      fontSize: '12px', cursor: statusChangedToday ? 'default' : 'pointer',
                      textAlign: 'left', lineHeight: 1.5,
                    }}
                  >
                    {t.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
