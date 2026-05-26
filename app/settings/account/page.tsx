"use client";

import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { clearAllPhotos } from '@/lib/indexed-db';
import { type StatusTemplate, pickRandom3 } from '@/lib/status-templates';
import { getPinHash, savePin, verifyPin, incrementBodyAttempts, resetBodyAttempts, getBodyAttempts, BODY_ENC_KEY, BODY_SALT_KEY, BODY_WARN_AT, BODY_MAX_ATTEMPTS, PIN_KEY } from '@/lib/settings/pin';
import { getStorageMode } from '@/lib/storage-mode';

// ── PIN 모달 ──────────────────────────────────────────────────
function PinModal({
  mode, context, onSuccess, onCancel, onForgot,
}: {
  mode: 'set' | 'verify'; context: 'body' | 'danger';
  onSuccess: (pin: string) => void; onCancel: () => void; onForgot?: () => void;
}) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(context === 'body' ? getBodyAttempts() : 0);
  const remaining = BODY_MAX_ATTEMPTS - attempts;
  const warned = context === 'body' && attempts >= BODY_WARN_AT && remaining > 0;
  const isLocked = context === 'body' && remaining <= 0;

  const handleDigit = (d: string) => {
    if (isLocked) return;
    if (mode === 'verify') {
      const next = (pin + d).slice(0, 4);
      setPin(next); setError('');
      if (next.length === 4) {
        if (verifyPin(next)) {
          if (context === 'body') resetBodyAttempts();
          requestAnimationFrame(() => setTimeout(() => onSuccess(next), 80));
        } else {
          if (context === 'body') {
            const count = incrementBodyAttempts(); setAttempts(count);
            const left = BODY_MAX_ATTEMPTS - count;
            if (left <= 0) { setError('10회 오류 — 신체정보가 초기화됩니다'); setTimeout(() => { localStorage.removeItem(BODY_ENC_KEY); localStorage.removeItem(BODY_SALT_KEY); resetBodyAttempts(); onCancel(); }, 1500); }
            else if (count >= BODY_WARN_AT) { setError(`PIN이 올바르지 않습니다 · ${left}회 남으면 초기화됩니다`); setTimeout(() => setPin(''), 600); }
            else { setError('PIN이 올바르지 않습니다'); setTimeout(() => setPin(''), 600); }
          } else { setError('PIN이 올바르지 않습니다'); setTimeout(() => setPin(''), 600); }
        }
      }
    } else {
      if (step === 'enter') { const next = (pin + d).slice(0, 4); setPin(next); if (next.length === 4) setStep('confirm'); }
      else {
        const next = (confirmPin + d).slice(0, 4); setConfirmPin(next);
        if (next.length === 4) {
          if (pin === next) requestAnimationFrame(() => setTimeout(() => onSuccess(pin), 80));
          else { setError('PIN이 일치하지 않습니다'); setTimeout(() => { setConfirmPin(''); setStep('enter'); setPin(''); setError(''); }, 800); }
        }
      }
    }
  };

  const handleBack = () => { if (step === 'enter' || mode === 'verify') setPin(p => p.slice(0, -1)); else setConfirmPin(p => p.slice(0, -1)); setError(''); };
  const current = (mode === 'set' && step === 'confirm') ? confirmPin : pin;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', width: '280px', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '18px', marginBottom: '6px' }}>{isLocked ? '⚠️' : '🔐'}</p>
          <p style={{ fontSize: '15px', color: 'black', marginBottom: '4px' }}>{mode === 'verify' ? 'PIN 입력' : step === 'enter' ? 'PIN 설정' : 'PIN 확인'}</p>
          <p style={{ fontSize: '11px', color: '#9ca3af' }}>{mode === 'verify' ? '4자리 PIN을 입력하세요' : step === 'enter' ? '사용할 4자리 PIN을 입력하세요' : '한 번 더 입력하세요'}</p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {[0,1,2,3].map(i => <div key={i} style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: i < current.length ? (warned || isLocked ? '#ef4444' : 'black') : '#e5e7eb', transition: 'background-color 0.1s' }} />)}
        </div>
        {warned && !error && <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '-12px', textAlign: 'center', lineHeight: 1.5 }}>{remaining}회 더 틀리면 신체정보가 초기화됩니다</p>}
        {error && <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '-12px', textAlign: 'center', lineHeight: 1.5 }}>{error}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', width: '100%' }}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
            <button key={i} onClick={() => d === '⌫' ? handleBack() : d ? handleDigit(d) : undefined} disabled={!d || isLocked}
              style={{ padding: '16px', fontSize: d === '⌫' ? '18px' : '20px', border: '1px solid #e5e7eb', backgroundColor: d ? 'white' : 'transparent', cursor: (d && !isLocked) ? 'pointer' : 'default', borderColor: d ? '#e5e7eb' : 'transparent', color: isLocked ? '#d1d5db' : 'black', fontWeight: 400 }}>{d}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <button onClick={onCancel} style={{ fontSize: '12px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>취소</button>
          {mode === 'verify' && context === 'danger' && onForgot && (
            <button onClick={onForgot} style={{ fontSize: '11px', color: '#6B21A8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>PIN을 잊으셨나요?</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 위험구역 PIN 분실 모달 ────────────────────────────────────
function DangerPinResetModal({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const { token: authToken } = useAuth();
  const [step, setStep] = useState<'send' | 'verify'>('send');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSend = async () => {
    setSending(true); setError('');
    if (!authToken) { setError('로그인이 필요합니다'); setSending(false); return; }
    const res = await fetch('/api/pin-reset', { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } });
    const result = await res.json();
    if (result.ok) { setEmail(result.email); setStep('verify'); }
    else setError('이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    setSending(false);
  };

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setVerifying(true); setError('');
    if (!authToken) { setError('로그인이 필요합니다'); setVerifying(false); return; }
    const res = await fetch('/api/pin-reset', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ otp }) });
    const result = await res.json();
    if (result.ok) onSuccess();
    else { const msg: Record<string, string> = { WRONG_OTP: '인증 코드가 올바르지 않습니다', OTP_EXPIRED: '인증 코드가 만료됐습니다. 다시 발송해 주세요' }; setError(msg[result.error] || '인증에 실패했습니다'); }
    setVerifying(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', width: '300px', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '20px', marginBottom: '8px' }}>📧</p>
          <p style={{ fontSize: '15px', color: 'black', marginBottom: '4px' }}>{step === 'send' ? '이메일로 인증' : '인증 코드 입력'}</p>
          <p style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.5 }}>{step === 'send' ? '가입한 이메일로 6자리 인증 코드를 보내드립니다. 인증 후 위험구역 PIN이 초기화됩니다.' : `${email}으로 발송된 6자리 코드를 입력하세요.`}</p>
        </div>
        {step === 'verify' && (
          <input type="number" inputMode="numeric" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.slice(0, 6))} placeholder="000000"
            style={{ padding: '12px', border: '1px solid #e5e7eb', fontSize: '20px', textAlign: 'center', letterSpacing: '8px', outline: 'none' }} />
        )}
        {error && <p style={{ fontSize: '11px', color: '#ef4444', textAlign: 'center' }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {step === 'send' ? (
            <button onClick={handleSend} disabled={sending} style={{ padding: '12px', border: 'none', backgroundColor: sending ? '#f3f4f6' : 'black', color: sending ? '#9ca3af' : 'white', fontSize: '13px', cursor: sending ? 'not-allowed' : 'pointer' }}>{sending ? '발송 중...' : '인증 코드 발송'}</button>
          ) : (
            <>
              <button onClick={handleVerify} disabled={verifying || otp.length !== 6} style={{ padding: '12px', border: 'none', backgroundColor: (verifying || otp.length !== 6) ? '#f3f4f6' : 'black', color: (verifying || otp.length !== 6) ? '#9ca3af' : 'white', fontSize: '13px', cursor: (verifying || otp.length !== 6) ? 'not-allowed' : 'pointer' }}>{verifying ? '확인 중...' : '확인'}</button>
              <button onClick={() => { setStep('send'); setOtp(''); setError(''); }} style={{ padding: '8px', border: '1px solid #e5e7eb', backgroundColor: 'white', fontSize: '12px', color: '#6b7280', cursor: 'pointer' }}>코드 재발송</button>
            </>
          )}
          <button onClick={onCancel} style={{ padding: '8px', background: 'none', border: 'none', fontSize: '12px', color: '#9ca3af', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { token, session } = useAuth();
  const [userEmail, setUserEmail] = useState('');
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
  const [planStatus, setPlanStatus] = useState<{ plan: string } | null>(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [storageMode, setStorageMode] = useState<'local' | 'cloud'>('local');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // 위험구역
  const [dangerUnlocked, setDangerUnlocked] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [logoutModal, setLogoutModal] = useState(false);
  const [hasPinSet, setHasPinSet] = useState(false);
  const [pinModal, setPinModal] = useState<{ mode: 'set' | 'verify'; context: 'body' | 'danger'; resolve: (ok: boolean, pin?: string) => void } | null>(null);
  const [showPinReset, setShowPinReset] = useState(false);

  useEffect(() => {
    setHasPinSet(!!getPinHash());
    if (session?.user?.email) setUserEmail(session.user.email);
    setStorageMode(getStorageMode());

    if (!token) { setPlanLoaded(true); return; }
    Promise.all([
      fetch('/api/upload-status', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } }),
    ]).then(async ([statusRes, profileRes]) => {
      if (statusRes.ok) { const d = await statusRes.json(); setPlanStatus(d); }
      if (profileRes.ok) {
        const p = await profileRes.json();
        setProfile({ nickname: p.nickname, avatar_url: p.avatar_url, nickname_changed: p.nickname_changed ?? false });
        setNicknameInput(p.nickname ?? '');
        const today = new Date().toLocaleDateString();
        const savedStatus = localStorage.getItem('mybob_status_msg') ?? '';
        setStatusMsg(savedStatus); setStatusInput(savedStatus);
        setAvatarChangedToday(localStorage.getItem('mybob_avatar_changed_date') === today);
        setStatusChangedToday(localStorage.getItem('mybob_status_changed_date') === today);
        setSuggestedMsgs(pickRandom3(savedStatus));
      }
    }).catch(() => {}).finally(() => setPlanLoaded(true));
  }, [token, session]);

  const requestAuth = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!hasPinSet) setPinModal({ mode: 'set', context: 'danger', resolve: (ok) => { setPinModal(null); resolve(ok); } });
      else setPinModal({ mode: 'verify', context: 'danger', resolve: (ok) => { setPinModal(null); resolve(ok); } });
    });
  }, [hasPinSet]);

  const handleDangerUnlock = async () => {
    if (dangerUnlocked) { setDangerUnlocked(false); setConfirmDelete(false); setConfirmWithdraw(false); return; }
    const ok = await requestAuth();
    if (ok) setDangerUnlocked(true);
  };

  const handleNicknameSave = async () => {
    const nick = nicknameInput.trim();
    if (nick.length < 2 || nick.length > 16) return alert('닉네임은 2~16자여야 합니다.');
    setNicknameSaving(true);
    if (!token) return;
    const res = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ nickname: nick }) });
    const result = await res.json();
    if (result.success) { setProfile(prev => ({ ...prev, nickname: nick, nickname_changed: true })); setNicknameSaved(true); setTimeout(() => setNicknameSaved(false), 1500); }
    else if (result.error === 'NICKNAME_ALREADY_CHANGED') alert('닉네임은 1회만 변경할 수 있습니다.');
    else alert(result.error || '저장 실패');
    setNicknameSaving(false);
  };

  const handleStatusSave = () => {
    if (statusChangedToday) return;
    setStatusSaving(true);
    const today = new Date().toLocaleDateString();
    localStorage.setItem('mybob_status_msg', statusInput.trim());
    localStorage.setItem('mybob_status_changed_date', today);
    setStatusMsg(statusInput.trim()); setStatusChangedToday(true);
    setStatusSaving(false); setStatusSaved(true);
    setTimeout(() => setStatusSaved(false), 1500);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || avatarChangedToday) return;
    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      if (!token) return;
      const res = await fetch('/api/profile/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ imageBase64: reader.result }) });
      const result = await res.json();
      if (result.success) { setProfile(prev => ({ ...prev, avatar_url: result.avatar_url })); const today = new Date().toLocaleDateString(); localStorage.setItem('mybob_avatar_changed_date', today); setAvatarChangedToday(true); }
      else alert(result.error || '업로드 실패');
      setAvatarUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleWithdraw = async () => {
    if (!token) return;
    setWithdrawing(true);
    try {
      const res = await fetch('/api/auth/delete', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      await clearAllPhotos();
      localStorage.clear();
      window.location.href = '/auth/login';
    } catch {
      setWithdrawing(false);
      setWithdrawModal(false);
      alert('탈퇴 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const handleLogout = async (clearData: boolean) => {
    setLogoutModal(false);
    await supabase.auth.signOut();
    if (clearData) {
      await clearAllPhotos();
      localStorage.clear();
    } else {
      localStorage.removeItem('mybob_storage_mode');
      localStorage.removeItem('mybob_onboarding_done');
    }
    window.location.href = '/auth/login';
  };

  const handleDeleteAll = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    localStorage.removeItem('mybob_meals');
    setConfirmDelete(false); setDangerUnlocked(false);
  };

  const PLAN_COLOR: Record<string, string> = { free: '#9ca3af', pro: '#6B21A8', lifetime: '#d97706' };
  const PLAN_LABEL: Record<string, string> = { free: 'FREE', pro: 'PRO', lifetime: 'LIFETIME' };

  return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden' }}>

      {pinModal && (
        <PinModal mode={pinModal.mode} context={pinModal.context}
          onSuccess={(pin) => { if (pinModal.mode === 'set') { savePin(pin); setHasPinSet(true); } pinModal.resolve(true, pin); }}
          onCancel={() => { pinModal.resolve(false); setPinModal(null); }}
          onForgot={pinModal.context === 'danger' ? () => { setPinModal(null); setShowPinReset(true); } : undefined}
        />
      )}
      {showPinReset && (
        <DangerPinResetModal
          onSuccess={() => { localStorage.removeItem(PIN_KEY); setHasPinSet(false); setShowPinReset(false); setDangerUnlocked(true); }}
          onCancel={() => setShowPinReset(false)}
        />
      )}

      <div style={{ flexShrink: 0, padding: '24px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>SETTINGS</p>
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>계정</h1>
        </div>
        <Link href="/settings" style={{ textDecoration: 'none' }}>
          <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaArrowLeft size={13} color="black" />
          </div>
        </Link>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

        {/* 프로필 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>프로필</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: '28px' }}>
          <div style={{ padding: '16px', backgroundColor: 'white' }}>
            {!planLoaded ? (
              <div style={{ height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid #e5e7eb', borderTopColor: '#6B21A8', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      {profile.avatar_url ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '22px' }}>👤</span>}
                      {avatarUploading && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>}
                    </div>
                    <div>
                      <p style={{ fontSize: '15px', color: 'black', marginBottom: '3px' }}>{profile.nickname || '닉네임 없음'}</p>
                      <p style={{ fontSize: '11px', color: planStatus?.plan === 'free' ? '#9ca3af' : '#6B21A8', letterSpacing: '0.5px' }}>
                        {PLAN_LABEL[planStatus?.plan ?? 'free'] ?? 'FREE'}
                      </p>
                    </div>
                  </div>
                  {planStatus?.plan !== 'free' && planStatus && (
                    <button onClick={() => setShowEditPopup(true)} style={{ fontSize: '12px', color: '#6B21A8', background: 'none', border: '1px solid #e9d5ff', padding: '6px 12px', cursor: 'pointer', letterSpacing: '0.5px' }}>수정</button>
                  )}
                </div>
                {statusMsg && <p style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic', paddingLeft: '2px' }}>"{statusMsg}"</p>}
                <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
              </div>
            )}
          </div>
        </div>

        {/* 개인정보 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>개인정보</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
          <button onClick={() => setShowPrivacyModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: 'white', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
            <span style={{ fontSize: '14px', color: 'black' }}>개인정보 처리방침</span>
            <span style={{ fontSize: '16px', color: '#9ca3af' }}>›</span>
          </button>
        </div>

        {/* 위험구역 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <p style={{ fontSize: '10px', color: '#ef4444', letterSpacing: '2px', textTransform: 'uppercase' }}>위험 구역</p>
          <button onClick={handleDangerUnlock} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', border: `1px solid ${dangerUnlocked ? '#ef4444' : '#e5e7eb'}`, backgroundColor: dangerUnlocked ? '#fef2f2' : 'white', cursor: 'pointer', fontSize: '11px', color: dangerUnlocked ? '#ef4444' : '#9ca3af', transition: 'all 0.2s' }}>
            <span style={{ fontSize: '13px' }}>{dangerUnlocked ? '🔓' : '🔒'}</span>
            {dangerUnlocked ? '잠금 해제됨' : '잠금'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '40px', opacity: dangerUnlocked ? 1 : 0.4, transition: 'opacity 0.2s', position: 'relative' }}>
          {!dangerUnlocked && <div style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'not-allowed' }} />}

          <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>이메일 주소</p>
            <p style={{ fontSize: '14px', color: 'black' }}>{userEmail || '로그인 필요'}</p>
          </div>

          <button onClick={() => setLogoutModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: 'white', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
            <span style={{ fontSize: '14px', color: 'black' }}>로그아웃</span>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>›</span>
          </button>

          {/* 로그아웃 모달 */}
          {logoutModal && (
            <div onClick={() => setLogoutModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', width: '100%', maxWidth: '360px', padding: '28px 24px 24px' }}>
                <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>LOGOUT</p>
                <h3 style={{ fontSize: '18px', fontWeight: 500, color: 'black', marginBottom: '8px' }}>로그아웃</h3>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '24px', lineHeight: 1.6 }}>
                  이 기기에 저장된 식단 기록과 사진을 어떻게 할까요?
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '16px' }}>
                  <button
                    onClick={() => handleLogout(false)}
                    style={{ padding: '16px', backgroundColor: 'white', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <p style={{ fontSize: '14px', color: 'black', marginBottom: '3px' }}>데이터 유지 후 로그아웃</p>
                    <p style={{ fontSize: '11px', color: '#9ca3af' }}>다음에 로그인하면 그대로 사용 가능</p>
                  </button>
                  <button
                    onClick={() => handleLogout(true)}
                    style={{ padding: '16px', backgroundColor: 'white', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <p style={{ fontSize: '14px', color: '#ef4444', marginBottom: '3px' }}>데이터 삭제 후 로그아웃</p>
                    <p style={{ fontSize: '11px', color: '#9ca3af' }}>이 기기의 모든 개인정보 완전 제거</p>
                  </button>
                </div>

                <button onClick={() => setLogoutModal(false)} style={{ width: '100%', padding: '12px', backgroundColor: 'white', border: '1px solid #e5e7eb', fontSize: '13px', color: '#6b7280', cursor: 'pointer' }}>
                  취소
                </button>
              </div>
            </div>
          )}

          <button onClick={() => setPinModal({ mode: 'set', context: 'danger', resolve: (ok, pin) => { setPinModal(null); if (ok && pin) { savePin(pin); setHasPinSet(true); } } })}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: 'white', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
            <span style={{ fontSize: '14px', color: 'black' }}>PIN 재설정</span>
            <span style={{ fontSize: '16px', color: '#9ca3af' }}>›</span>
          </button>

          <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '10px', lineHeight: 1.5 }}>이 기기에 저장된 모든 식단 기록을 삭제합니다. 되돌릴 수 없습니다.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleDeleteAll} disabled={!dangerUnlocked} style={{ padding: '8px 14px', backgroundColor: confirmDelete ? '#ef4444' : 'white', color: confirmDelete ? 'white' : '#ef4444', border: '1px solid #fca5a5', fontSize: '13px', cursor: dangerUnlocked ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
                {confirmDelete ? '한 번 더 누르면 삭제됩니다' : '로컬 기록 전체 삭제'}
              </button>
              {confirmDelete && <button onClick={() => setConfirmDelete(false)} style={{ padding: '8px 14px', backgroundColor: 'white', color: '#9ca3af', border: '1px solid #e5e7eb', fontSize: '13px', cursor: 'pointer' }}>취소</button>}
            </div>
          </div>

          <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '10px', lineHeight: 1.5 }}>계정과 모든 개인정보가 즉시 영구 삭제됩니다.</p>
            <button
              onClick={() => setWithdrawModal(true)}
              disabled={!dangerUnlocked}
              style={{ padding: '8px 14px', backgroundColor: 'white', color: '#ef4444', border: '1px solid #fca5a5', fontSize: '13px', cursor: dangerUnlocked ? 'pointer' : 'not-allowed' }}
            >
              회원 탈퇴
            </button>
          </div>

          {/* 탈퇴 확인 모달 */}
          {withdrawModal && (
            <div onClick={() => !withdrawing && setWithdrawModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', width: '100%', maxWidth: '360px', padding: '28px 24px 24px' }}>
                <p style={{ fontSize: '10px', color: '#ef4444', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>WITHDRAW</p>
                <h3 style={{ fontSize: '18px', fontWeight: 500, color: 'black', marginBottom: '16px' }}>정말 탈퇴하시겠습니까?</h3>

                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', padding: '14px 16px', marginBottom: '24px' }}>
                  <p style={{ fontSize: '13px', color: '#ef4444', fontWeight: 500, marginBottom: '8px' }}>⚠️ 탈퇴 시 아래 정보가 즉시 삭제됩니다</p>
                  <ul style={{ fontSize: '12px', color: '#6b7280', lineHeight: 2, paddingLeft: '16px', margin: 0 }}>
                    <li>계정 및 로그인 정보</li>
                    <li>모든 식단 기록 및 사진</li>
                    <li>AI 분석 기록</li>
                    <li>이웃 및 커뮤니티 정보</li>
                    <li>이 기기의 로컬 데이터</li>
                  </ul>
                  <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '10px', fontWeight: 500 }}>삭제된 데이터는 복구할 수 없습니다.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={handleWithdraw}
                    disabled={withdrawing}
                    style={{ width: '100%', padding: '14px', backgroundColor: withdrawing ? '#9ca3af' : '#ef4444', color: 'white', border: 'none', fontSize: '14px', fontWeight: 500, cursor: withdrawing ? 'not-allowed' : 'pointer' }}
                  >
                    {withdrawing ? '처리 중...' : '모두 삭제하고 탈퇴'}
                  </button>
                  <button
                    onClick={() => setWithdrawModal(false)}
                    disabled={withdrawing}
                    style={{ width: '100%', padding: '12px', backgroundColor: 'white', border: '1px solid #e5e7eb', fontSize: '13px', color: '#6b7280', cursor: 'pointer' }}
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 프로필 수정 팝업 */}
      {showEditPopup && (
        <div onClick={() => setShowEditPopup(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', width: '100%', borderRadius: '16px 16px 0 0', padding: '24px 24px 40px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <p style={{ fontSize: '15px', color: 'black' }}>프로필 수정</p>
              <button onClick={() => setShowEditPopup(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#9ca3af', cursor: 'pointer', padding: '4px', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', overflow: 'hidden', flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {profile.avatar_url ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '26px' }}>👤</span>}
                {avatarUploading && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: '18px', height: '18px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>}
              </div>
              <button onClick={() => !avatarChangedToday && avatarInputRef.current?.click()} style={{ fontSize: '13px', background: 'none', padding: '8px 16px', cursor: avatarChangedToday ? 'default' : 'pointer', border: '1px solid #e9d5ff', color: avatarChangedToday ? '#d1d5db' : '#6B21A8' }}>
                {avatarChangedToday ? '오늘 변경 완료' : '사진 변경'}
              </button>
            </div>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>닉네임</p>
            {profile.nickname_changed ? (
              <div style={{ padding: '12px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa', marginBottom: '24px' }}>
                <p style={{ fontSize: '14px', color: 'black' }}>{profile.nickname}</p>
              </div>
            ) : (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                  <input type="text" value={nicknameInput} onChange={e => setNicknameInput(e.target.value)} maxLength={16} placeholder="닉네임 (2~16자)"
                    style={{ flex: 1, padding: '11px 12px', border: '1px solid #e5e7eb', fontSize: '14px', outline: 'none', backgroundColor: 'white', color: 'black' }} />
                  <button onClick={handleNicknameSave} disabled={nicknameSaving || nicknameInput.trim() === (profile.nickname ?? '') || nicknameInput.trim().length < 2}
                    style={{ padding: '11px 16px', fontSize: '12px', border: 'none', cursor: 'pointer', backgroundColor: nicknameSaved ? '#6B21A8' : (nicknameSaving || nicknameInput.trim() === (profile.nickname ?? '') || nicknameInput.trim().length < 2) ? '#e5e7eb' : 'black', color: (nicknameSaving || (nicknameInput.trim() === (profile.nickname ?? '') || nicknameInput.trim().length < 2) && !nicknameSaved) ? '#9ca3af' : 'white', transition: 'all 0.2s' }}>
                    {nicknameSaved ? '저장됨' : '저장'}
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: '#ef4444' }}>저장 후 다시 변경할 수 없습니다</p>
              </div>
            )}
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>상태메시지</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input type="text" value={statusInput} onChange={e => setStatusInput(e.target.value)} maxLength={40} placeholder="상태메시지 (최대 40자)" disabled={statusChangedToday}
                style={{ flex: 1, padding: '11px 12px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none', backgroundColor: statusChangedToday ? '#fafafa' : 'white', color: statusChangedToday ? '#9ca3af' : 'black' }} />
              <button onClick={handleStatusSave} disabled={statusChangedToday || statusSaving || statusInput.trim() === statusMsg}
                style={{ padding: '11px 14px', fontSize: '12px', border: 'none', cursor: statusChangedToday ? 'default' : 'pointer', backgroundColor: statusSaved ? '#6B21A8' : statusChangedToday ? '#e5e7eb' : 'black', color: statusSaved || !statusChangedToday ? 'white' : '#9ca3af', transition: 'all 0.2s' }}>
                {statusSaved ? '저장됨' : statusChangedToday ? '완료' : '저장'}
              </button>
            </div>
            <div style={{ paddingBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase' }}>추천 문구</p>
                {!statusChangedToday && <button onClick={() => setSuggestedMsgs(pickRandom3(statusInput))} style={{ fontSize: '11px', color: '#6B21A8', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>다른 메시지 →</button>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {suggestedMsgs.map(t => (
                  <button key={t.id} onClick={() => !statusChangedToday && setStatusInput(t.text)}
                    style={{ padding: '11px 12px', border: `1px solid ${statusInput === t.text ? '#6B21A8' : '#e5e7eb'}`, backgroundColor: statusInput === t.text ? '#f3e8ff' : 'white', color: statusChangedToday ? '#9ca3af' : statusInput === t.text ? '#6B21A8' : '#6b7280', fontSize: '12px', cursor: statusChangedToday ? 'default' : 'pointer', textAlign: 'left', lineHeight: 1.5 }}>
                    {t.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 개인정보 모달 */}
      {showPrivacyModal && (
        <div onClick={() => setShowPrivacyModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', width: '100%', maxHeight: '75vh', overflowY: 'auto', borderRadius: '12px 12px 0 0', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 400 }}>개인정보 처리방침</h3>
              <button onClick={() => setShowPrivacyModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}>×</button>
            </div>
            {[
              { icon: '📁', title: '사진 저장 위치', content: storageMode === 'cloud' ? '사진은 암호화된 서버에 안전하게 저장됩니다. 본인 계정 외 접근이 불가합니다.' : '사진은 이 기기의 브라우저 저장소(IndexedDB)에만 보관됩니다. 서버로 전송되지 않습니다.' },
              { icon: '🔐', title: '인증 방식', content: 'JWT 토큰 기반 인증을 사용합니다. 로그인하지 않은 상태에서는 클라우드 저장이 이루어지지 않으며, 모든 기록은 이 기기에만 보관됩니다.' },
              { icon: '🗄️', title: '영양 데이터 저장', content: storageMode === 'cloud' ? '영양 기록은 암호화된 서버에 안전하게 저장됩니다. 본인 계정에 귀속되며 타인이 접근할 수 없습니다.' : '영양 기록은 이 기기의 로컬 스토리지(mybob_meals)에만 저장됩니다. 서버로 전송되지 않습니다.' },
              { icon: '🤖', title: 'AI 분석 데이터', content: '음식 사진은 Google Gemini API로 전송되어 분석됩니다. 분석 후 원본 이미지는 Gemini 서버에 저장되지 않습니다(Google 정책 기준).' },
              { icon: '🚫', title: '제3자 제공', content: '이름·이메일·식단 기록 등 개인 식별 정보는 제3자에게 제공되지 않습니다.' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
                <div><p style={{ fontSize: '12px', color: 'black', fontWeight: 500, marginBottom: '4px' }}>{item.title}</p><p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.6 }}>{item.content}</p></div>
              </div>
            ))}
            <div style={{ height: '20px' }} />
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
