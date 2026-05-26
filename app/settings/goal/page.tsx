"use client";

import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  getPinHash, savePin, verifyPin,
  encryptBody, decryptBody,
  incrementBodyAttempts, resetBodyAttempts, getBodyAttempts,
  BODY_ENC_KEY, BODY_SALT_KEY, BODY_WARN_AT, BODY_MAX_ATTEMPTS, PIN_KEY,
} from '@/lib/settings/pin';
import { useAuth } from '@/lib/auth-context';

// ── PIN 모달 ──────────────────────────────────────────────────
function PinModal({
  mode, context, onSuccess, onCancel, onForgot,
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
              setTimeout(() => { localStorage.removeItem(BODY_ENC_KEY); localStorage.removeItem(BODY_SALT_KEY); resetBodyAttempts(); onCancel(); }, 1500);
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
          if (pin === next) { requestAnimationFrame(() => setTimeout(() => onSuccess(pin), 80)); }
          else { setError('PIN이 일치하지 않습니다'); setTimeout(() => { setConfirmPin(''); setStep('enter'); setPin(''); setError(''); }, 800); }
        }
      }
    }
  };

  const handleBack = () => {
    if (step === 'enter' || mode === 'verify') setPin(p => p.slice(0, -1));
    else setConfirmPin(p => p.slice(0, -1));
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
        <div style={{ display: 'flex', gap: '16px' }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: i < current.length ? (warned || isLocked ? '#ef4444' : 'black') : '#e5e7eb', transition: 'background-color 0.1s' }} />
          ))}
        </div>
        {warned && !error && <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '-12px', textAlign: 'center', lineHeight: 1.5 }}>{remaining}회 더 틀리면 신체정보가 초기화됩니다</p>}
        {error && <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '-12px', textAlign: 'center', lineHeight: 1.5 }}>{error}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', width: '100%' }}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
            <button key={i} onClick={() => d === '⌫' ? handleBack() : d ? handleDigit(d) : undefined} disabled={!d || isLocked}
              style={{ padding: '16px', fontSize: d === '⌫' ? '18px' : '20px', border: '1px solid #e5e7eb', backgroundColor: d ? 'white' : 'transparent', cursor: (d && !isLocked) ? 'pointer' : 'default', borderColor: d ? '#e5e7eb' : 'transparent', color: isLocked ? '#d1d5db' : 'black', fontWeight: 400 }}>
              {d}
            </button>
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

// ── 신체정보 타입 ─────────────────────────────────────────────
type BodyInfo = {
  gender: 'male' | 'female' | '';
  age: string;
  height: string;
  weight: string;
  targetWeight: string;
  activity: 'sedentary' | 'light' | 'moderate' | 'active' | '';
  goal: '다이어트' | '유지' | '증량';
  customCalories: string;
};

const EMPTY_BODY: BodyInfo = { gender: '', age: '', height: '', weight: '', targetWeight: '', activity: '', goal: '유지', customCalories: '' };

const ACTIVITY_MULTIPLIER: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
const ACTIVITY_LABEL: Record<string, string> = {
  sedentary: '좌식 (거의 운동 안 함)', light: '가벼운 활동 (주 1~2회)',
  moderate: '보통 활동 (주 3~5회)', active: '활동적 (매일 운동)',
};

const TARGET_CALORIES_KEY = 'mybob_target_calories';
const GOAL_ACHIEVED_KEY = 'mybob_goal_achieved';

function calcRecommendedCalories(b: BodyInfo): number | null {
  const h = parseFloat(b.height), w = parseFloat(b.weight), a = parseFloat(b.age);
  if (!h || !w) return null;
  const age = isFinite(a) ? a : 30;
  const bmr = b.gender === 'female' ? 10 * w + 6.25 * h - 5 * age - 161 : 10 * w + 6.25 * h - 5 * age + 5;
  const multiplier = ACTIVITY_MULTIPLIER[b.activity] ?? 1.375;
  const tdee = Math.round(bmr * multiplier);
  if (b.goal === '다이어트') return Math.round(tdee * 0.8);
  if (b.goal === '증량') return Math.round(tdee * 1.15);
  return tdee;
}

function readLegacyGoal(): Partial<BodyInfo> | null {
  const raw = localStorage.getItem('mybob_goal');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function checkDailyGoalAchievement() {
  try {
    const targetStr = localStorage.getItem(TARGET_CALORIES_KEY);
    if (!targetStr) return;
    const target = parseInt(targetStr);
    if (!target) return;
    const meals: { calories: number; created_at: string }[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
    const todayKey = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todayCalories = meals
      .filter(m => new Date(new Date(m.created_at).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) === todayKey)
      .reduce((s, m) => s + (Number(m.calories) || 0), 0);
    const ratio = todayCalories / target;
    const achieved: Record<string, boolean> = JSON.parse(localStorage.getItem(GOAL_ACHIEVED_KEY) || '{}');
    if (ratio >= 0.9 && ratio <= 1.1) achieved[todayKey] = true;
    else delete achieved[todayKey];
    localStorage.setItem(GOAL_ACHIEVED_KEY, JSON.stringify(achieved));
  } catch { }
}

export default function GoalPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [body, setBody] = useState<BodyInfo>(EMPTY_BODY);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authing, setAuthing] = useState(false);
  const [decryptErr, setDecryptErr] = useState(false);
  const [useCustom, setUseCustom] = useState(false);
  const [hasPinSet, setHasPinSet] = useState(false);
  const [pinModal, setPinModal] = useState<{ mode: 'set' | 'verify'; context: 'body' | 'danger'; resolve: (ok: boolean, pin?: string) => void } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'age'|'height'|'weight'|'targetWeight', string>>>({});
  const currentPin = useRef('');

  useEffect(() => {
    setHasPinSet(!!getPinHash());
  }, []);

  const requestAuthWithPin = useCallback((cb: (pin: string) => void) => {
    if (!hasPinSet) {
      setPinModal({ mode: 'set', context: 'body', resolve: (ok, pin) => { setPinModal(null); if (ok && pin) cb(pin); } });
    } else {
      setPinModal({ mode: 'verify', context: 'body', resolve: (ok, pin) => { setPinModal(null); if (ok && pin) cb(pin); } });
    }
  }, [hasPinSet]);

  const handleUnlock = () => {
    requestAuthWithPin(async (pin) => {
      currentPin.current = pin;
      setAuthing(true);
      const enc = localStorage.getItem(BODY_ENC_KEY);
      if (enc) {
        const data = await decryptBody<BodyInfo>(pin);
        if (data) {
          setBody({ ...EMPTY_BODY, ...data });
          setUseCustom(!!data.customCalories);
          setDecryptErr(false);
          setUnlocked(true);
        } else {
          localStorage.removeItem(BODY_ENC_KEY);
          localStorage.removeItem(BODY_SALT_KEY);
          setBody(EMPTY_BODY);
          setDecryptErr(true);
        }
      } else {
        const legacy = readLegacyGoal();
        if (legacy) setBody({ ...EMPTY_BODY, height: legacy.height || '', weight: legacy.weight || '', goal: (legacy.goal as BodyInfo['goal']) || '유지' });
        else setBody(EMPTY_BODY);
        setDecryptErr(false);
        setUnlocked(true);
      }
      setAuthing(false);
    });
  };

  const LIMITS = {
    age:          { min: 1,  max: 99,  label: '나이',      unit: '세' },
    height:       { min: 50, max: 250, label: '키',        unit: 'cm' },
    weight:       { min: 20, max: 300, label: '몸무게',    unit: 'kg' },
    targetWeight: { min: 20, max: 300, label: '목표 체중', unit: 'kg' },
  } as const;

  const set = (field: keyof BodyInfo) => (val: string) => {
    setBody(prev => ({ ...prev, [field]: val }));
    if (field in LIMITS) setFieldErrors(prev => { const next = { ...prev }; delete next[field as keyof typeof LIMITS]; return next; });
  };

  const checkField = (field: keyof typeof LIMITS) => (val: string) => {
    const { min, max, label, unit } = LIMITS[field];
    const num = parseFloat(val);
    if (val !== '' && (!isFinite(num) || num < min || num > max))
      setFieldErrors(prev => ({ ...prev, [field]: `${label}는 ${min}~${max}${unit} 사이로 입력해 주세요` }));
  };

  const validateBody = (): string | null => {
    for (const [field, { min, max, label, unit }] of Object.entries(LIMITS) as [keyof typeof LIMITS, typeof LIMITS[keyof typeof LIMITS]][]) {
      const val = body[field];
      if (val === '') continue;
      const num = parseFloat(val as string);
      if (!isFinite(num) || num < min || num > max) return `${label}는 ${min}~${max}${unit} 사이로 입력해 주세요`;
    }
    return null;
  };

  const handleSave = async () => {
    const err = validateBody();
    if (err) { alert(err); return; }
    if (useCustom && body.customCalories) {
      const val = parseInt(body.customCalories);
      if (!isFinite(val) || val < 500 || val > 9999) { alert('목표 칼로리는 500~9999 kcal 사이로 입력해 주세요'); return; }
    }
    setSaving(true);
    await encryptBody(body, currentPin.current);
    const recommended = calcRecommendedCalories(body);
    const finalCalories = (useCustom && body.customCalories) ? parseInt(body.customCalories) : (recommended ?? 2000);
    localStorage.setItem(TARGET_CALORIES_KEY, String(finalCalories));
    checkDailyGoalAchievement();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', fontSize: '14px', backgroundColor: 'white', outline: 'none', boxSizing: 'border-box' };
  const chipStyle = (active: boolean): React.CSSProperties => ({ flex: 1, padding: '10px 6px', border: '1px solid', fontSize: '12px', cursor: 'pointer', borderColor: active ? 'black' : '#e5e7eb', backgroundColor: active ? 'black' : 'white', color: active ? 'white' : 'black', textAlign: 'center' });

  return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden' }}>

      {pinModal && (
        <PinModal
          mode={pinModal.mode}
          context={pinModal.context}
          onSuccess={(pin) => {
            if (pinModal.mode === 'set') { savePin(pin); setHasPinSet(true); }
            pinModal.resolve(true, pin);
          }}
          onCancel={() => { pinModal.resolve(false); setPinModal(null); }}
        />
      )}

      <div style={{ flexShrink: 0, padding: '24px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>SETTINGS</p>
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>목표 설정</h1>
        </div>
        <Link href="/settings" style={{ textDecoration: 'none' }}>
          <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaArrowLeft size={13} color="black" />
          </div>
        </Link>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>목표 설정</p>

        {!unlocked ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
            <div style={{ padding: '20px 16px', backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '28px' }}>🔒</span>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: 'black', marginBottom: '4px' }}>신체정보가 잠겨 있습니다</p>
                <p style={{ fontSize: '11px', color: '#9ca3af' }}>PIN을 입력해 잠금을 해제하세요</p>
                {decryptErr && <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', lineHeight: 1.5 }}>저장된 데이터를 불러올 수 없어 초기화했습니다.<br />다시 잠금 해제 후 정보를 입력해 주세요.</p>}
              </div>
              <button
                onClick={handleUnlock}
                disabled={authing}
                style={{ padding: '10px 24px', border: '1px solid black', backgroundColor: authing ? '#f3f4f6' : 'black', color: authing ? '#9ca3af' : 'white', fontSize: '12px', cursor: authing ? 'not-allowed' : 'pointer', letterSpacing: '1px', transition: 'all 0.2s' }}
              >
                {authing ? '확인 중...' : '잠금 해제'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
            <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase' }}>신체 정보</p>
                <button onClick={() => { setUnlocked(false); currentPin.current = ''; }} style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>🔓 잠금</button>
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
              <input type="number" inputMode="numeric" value={body.age} min={1} max={99}
                onChange={e => set('age')(e.target.value)} onBlur={e => checkField('age')(e.target.value)} placeholder="25"
                style={{ ...inputStyle, marginBottom: fieldErrors.age ? '4px' : '14px', borderColor: fieldErrors.age ? '#ef4444' : '#e5e7eb' }} />
              {fieldErrors.age && <p style={{ fontSize: '10px', color: '#ef4444', marginBottom: '10px' }}>{fieldErrors.age}</p>}

              {/* 키 / 몸무게 */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>키 (cm)</p>
                  <input type="number" inputMode="decimal" value={body.height} min={50} max={250}
                    onChange={e => set('height')(e.target.value)} onBlur={e => checkField('height')(e.target.value)} placeholder="170"
                    style={{ ...inputStyle, borderColor: fieldErrors.height ? '#ef4444' : '#e5e7eb' }} />
                  {fieldErrors.height && <p style={{ fontSize: '10px', color: '#ef4444', marginTop: '4px' }}>{fieldErrors.height}</p>}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>몸무게 (kg)</p>
                  <input type="number" inputMode="decimal" value={body.weight} min={20} max={300}
                    onChange={e => set('weight')(e.target.value)} onBlur={e => checkField('weight')(e.target.value)} placeholder="65"
                    style={{ ...inputStyle, borderColor: fieldErrors.weight ? '#ef4444' : '#e5e7eb' }} />
                  {fieldErrors.weight && <p style={{ fontSize: '10px', color: '#ef4444', marginTop: '4px' }}>{fieldErrors.weight}</p>}
                </div>
              </div>
              <div style={{ marginBottom: '14px' }} />

              {/* 목표 체중 */}
              <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>목표 체중 (kg)</p>
              <input type="number" inputMode="decimal" value={body.targetWeight} min={20} max={300}
                onChange={e => set('targetWeight')(e.target.value)} onBlur={e => checkField('targetWeight')(e.target.value)} placeholder="60"
                style={{ ...inputStyle, marginBottom: fieldErrors.targetWeight ? '4px' : '14px', borderColor: fieldErrors.targetWeight ? '#ef4444' : '#e5e7eb' }} />
              {fieldErrors.targetWeight && <p style={{ fontSize: '10px', color: '#ef4444', marginBottom: '10px' }}>{fieldErrors.targetWeight}</p>}

              {/* 활동량 */}
              <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>활동량</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                {(['sedentary', 'light', 'moderate', 'active'] as const).map(val => (
                  <button key={val} onClick={() => set('activity')(val)}
                    style={{ padding: '10px 12px', border: '1px solid', fontSize: '12px', cursor: 'pointer', textAlign: 'left', borderColor: body.activity === val ? 'black' : '#e5e7eb', backgroundColor: body.activity === val ? 'black' : 'white', color: body.activity === val ? 'white' : 'black' }}>
                    {ACTIVITY_LABEL[val]}
                  </button>
                ))}
              </div>

              {/* 목표 */}
              <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>목표</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {(['다이어트', '유지', '증량'] as const).map(g => (
                  <button key={g} onClick={() => set('goal')(g)} style={chipStyle(body.goal === g)}>{g}</button>
                ))}
              </div>

              {/* 목표 칼로리 */}
              {(() => {
                const recommended = calcRecommendedCalories(body);
                return (
                  <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', padding: '14px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <p style={{ fontSize: '11px', color: '#6B21A8', letterSpacing: '1px' }}>일일 목표 칼로리</p>
                      {recommended && <span style={{ fontSize: '10px', color: '#9ca3af' }}>권장 <strong style={{ color: '#6B21A8' }}>{recommended.toLocaleString()} kcal</strong></span>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                      <button onClick={() => { setUseCustom(false); setBody(prev => ({ ...prev, customCalories: '' })); }}
                        style={{ flex: 1, padding: '8px', fontSize: '11px', border: '1px solid', borderColor: !useCustom ? '#6B21A8' : '#e5e7eb', backgroundColor: !useCustom ? '#6B21A8' : 'white', color: !useCustom ? 'white' : '#6b7280', cursor: 'pointer' }}>
                        권장값 사용
                      </button>
                      <button onClick={() => setUseCustom(true)}
                        style={{ flex: 1, padding: '8px', fontSize: '11px', border: '1px solid', borderColor: useCustom ? '#6B21A8' : '#e5e7eb', backgroundColor: useCustom ? '#6B21A8' : 'white', color: useCustom ? 'white' : '#6b7280', cursor: 'pointer' }}>
                        직접 입력
                      </button>
                    </div>
                    {useCustom ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="number" inputMode="numeric" value={body.customCalories}
                          onChange={e => setBody(prev => ({ ...prev, customCalories: e.target.value }))}
                          placeholder={recommended ? String(recommended) : '2000'}
                          style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
                        <span style={{ fontSize: '12px', color: '#9ca3af', flexShrink: 0 }}>kcal</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', backgroundColor: 'white', border: '1px solid #e9d5ff' }}>
                        {recommended
                          ? <span style={{ fontSize: '20px', fontWeight: 600, color: '#6B21A8' }}>{recommended.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 400 }}>kcal/일</span></span>
                          : <span style={{ fontSize: '12px', color: '#9ca3af' }}>키·몸무게·활동량을 입력하면 계산됩니다</span>
                        }
                      </div>
                    )}
                    {!useCustom && recommended && (
                      <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '8px', lineHeight: 1.6 }}>
                        Harris-Benedict BMR × 활동량 계수{body.goal === '다이어트' ? ' × 0.8 (다이어트)' : body.goal === '증량' ? ' × 1.15 (증량)' : ' (유지)'}
                      </p>
                    )}
                  </div>
                );
              })()}

              <button onClick={handleSave} disabled={saving}
                style={{ width: '100%', padding: '12px', border: '1px solid black', backgroundColor: saved ? 'black' : saving ? '#f3f4f6' : 'white', color: saved ? 'white' : saving ? '#9ca3af' : 'black', fontSize: '12px', cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: '1px', transition: 'all 0.2s' }}>
                {saved ? '저장됨 ✓' : saving ? '암호화 중...' : '저장'}
              </button>
              <p style={{ fontSize: '10px', color: '#d1d5db', marginTop: '8px', textAlign: 'center' }}>🔐 AES-256 암호화 · 이 기기에만 저장</p>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
