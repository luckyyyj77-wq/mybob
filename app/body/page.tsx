"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// ── 암호화 (신체정보와 같은 PIN 재사용) ──────────────────────────
const WEIGHT_ENC_KEY = 'mybob_weight_enc';
const PIN_KEY = 'mybob_security_pin';

function hashPin(pin: string): string {
  let h = 0;
  for (let i = 0; i < pin.length; i++) { h = ((h << 5) - h) + pin.charCodeAt(i); h |= 0; }
  return String(h);
}
function verifyPin(pin: string): boolean {
  const stored = localStorage.getItem(PIN_KEY);
  return stored !== null && stored === hashPin(pin);
}

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(pin).buffer as ArrayBuffer, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 10000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

async function encryptData(data: object, pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data)));
  localStorage.setItem(WEIGHT_ENC_KEY, JSON.stringify({ salt: Array.from(salt), iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) }));
}

async function decryptData(pin: string): Promise<WeightRecord[] | null> {
  const raw = localStorage.getItem(WEIGHT_ENC_KEY);
  if (!raw) return [];
  try {
    const { salt, iv, ct } = JSON.parse(raw);
    const key = await deriveKey(pin, new Uint8Array(salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, new Uint8Array(ct));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch { return null; }
}

// ── 타입 ─────────────────────────────────────────────────────────
interface WeightRecord {
  date: string;   // "YYYY-MM-DD"
  weight: number; // kg
  note?: string;
}

function calcBMI(weight: number, height: number): number {
  if (!height) return 0;
  return weight / ((height / 100) ** 2);
}

function bmiStatus(bmi: number): { label: string; color: string } {
  if (bmi === 0) return { label: '-', color: '#9ca3af' };
  if (bmi < 18.5) return { label: '저체중', color: '#3b82f6' };
  if (bmi < 23) return { label: '정상', color: '#16a34a' };
  if (bmi < 25) return { label: '과체중', color: '#f59e0b' };
  return { label: '비만', color: '#ef4444' };
}

function todayKST() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
}

function fmtDate(d: string) {
  const [, m, day] = d.split('-');
  return `${parseInt(m)}/${parseInt(day)}`;
}

// PIN 키패드 모달
function PinModal({ onSuccess, onCancel }: { onSuccess: (pin: string) => void; onCancel: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const hasPinSet = !!localStorage.getItem(PIN_KEY);

  const handleDigit = (d: string) => {
    const next = (pin + d).slice(0, 4);
    setPin(next);
    setError('');
    if (next.length === 4) {
      if (!hasPinSet || verifyPin(next)) {
        requestAnimationFrame(() => setTimeout(() => onSuccess(next), 80));
      } else {
        setError('PIN이 올바르지 않습니다');
        setTimeout(() => setPin(''), 600);
      }
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', width: '280px', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '18px', marginBottom: '6px' }}>🔐</p>
          <p style={{ fontSize: '15px', color: 'black' }}>PIN 입력</p>
          <p style={{ fontSize: '11px', color: '#9ca3af' }}>체중 기록은 PIN으로 보호됩니다</p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: i < pin.length ? 'black' : '#e5e7eb' }} />
          ))}
        </div>
        {error && <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '-12px' }}>{error}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', width: '100%' }}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
            <button key={i} onClick={() => d === '⌫' ? setPin(p => p.slice(0, -1)) : d ? handleDigit(d) : undefined}
              disabled={!d} style={{ padding: '16px', fontSize: d === '⌫' ? '18px' : '20px', border: '1px solid', borderColor: d ? '#e5e7eb' : 'transparent', backgroundColor: d ? 'white' : 'transparent', cursor: d ? 'pointer' : 'default' }}>
              {d}
            </button>
          ))}
        </div>
        <button onClick={onCancel} style={{ fontSize: '12px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>취소</button>
      </div>
    </div>
  );
}

export default function BodyPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [height, setHeight] = useState(0);
  const [targetWeight, setTargetWeight] = useState(0);
  const [weightInput, setWeightInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const pinRef = useRef('');

  const handleUnlock = () => setShowPin(true);

  const onPinSuccess = async (pin: string) => {
    pinRef.current = pin;
    setShowPin(false);
    const data = await decryptData(pin);
    if (data !== null) {
      setRecords(data);
      setUnlocked(true);
      // 신체정보에서 키/목표체중 읽기 (비암호화 fallback: mybob_goal)
      try {
        const goal = JSON.parse(localStorage.getItem('mybob_goal') || '{}');
        setHeight(Number(goal.height) || 0);
        setTargetWeight(Number(goal.targetWeight) || 0);
      } catch { }
    }
  };

  const handleSave = async () => {
    const w = parseFloat(weightInput);
    if (!w || w < 20 || w > 300) return;
    setSaving(true);
    const today = todayKST();
    const next = records.filter(r => r.date !== today);
    next.unshift({ date: today, weight: w, note: noteInput.trim() || undefined });
    next.sort((a, b) => b.date.localeCompare(a.date));
    await encryptData(next, pinRef.current);
    setRecords(next);
    setWeightInput('');
    setNoteInput('');
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleDelete = async (date: string) => {
    const next = records.filter(r => r.date !== date);
    await encryptData(next, pinRef.current);
    setRecords(next);
    setDeleteConfirm(null);
  };

  const latest = records[0];
  const bmi = latest && height ? calcBMI(latest.weight, height) : 0;
  const bmiInfo = bmiStatus(bmi);
  const chartData = records.slice(0, 30).reverse().map(r => ({ date: fmtDate(r.date), weight: r.weight }));

  return (
    <div style={{ backgroundColor: 'white', minHeight: 'calc(100svh - 65px)' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {showPin && <PinModal onSuccess={onPinSuccess} onCancel={() => setShowPin(false)} />}

      {/* Header */}
      <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>BODY</p>
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>체중 기록</h1>
        </div>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaArrowLeft size={13} color="black" />
          </div>
        </Link>
      </div>

      <div style={{ padding: '20px 24px 40px' }}>
        {!unlocked ? (
          /* 잠금 화면 */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: '16px' }}>
            <span style={{ fontSize: '40px' }}>🔒</span>
            <p style={{ fontSize: '14px', color: 'black' }}>체중 기록이 잠겨 있습니다</p>
            <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', lineHeight: 1.6 }}>
              신체정보와 동일한 PIN으로 보호됩니다.<br />
              AES-256 암호화 · 이 기기에만 저장
            </p>
            <button
              onClick={handleUnlock}
              style={{ padding: '12px 32px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' }}
            >
              잠금 해제
            </button>
          </div>
        ) : (
          <>
            {/* 현재 상태 카드 */}
            {latest && (
              <div style={{ border: '1px solid #e5e7eb', padding: '20px', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0', textAlign: 'center' }}>
                  <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: '16px' }}>
                    <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', marginBottom: '6px' }}>현재 체중</p>
                    <p style={{ fontSize: '22px', color: 'black', lineHeight: 1 }}>{latest.weight}</p>
                    <p style={{ fontSize: '10px', color: '#9ca3af' }}>kg</p>
                  </div>
                  <div style={{ borderRight: '1px solid #e5e7eb', padding: '0 16px' }}>
                    <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', marginBottom: '6px' }}>BMI</p>
                    <p style={{ fontSize: '22px', color: bmiInfo.color, lineHeight: 1 }}>{bmi > 0 ? bmi.toFixed(1) : '-'}</p>
                    <p style={{ fontSize: '10px', color: bmiInfo.color }}>{bmiInfo.label}</p>
                  </div>
                  <div style={{ paddingLeft: '16px' }}>
                    <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', marginBottom: '6px' }}>목표까지</p>
                    {targetWeight > 0 ? (
                      <>
                        <p style={{ fontSize: '22px', color: latest.weight > targetWeight ? '#ef4444' : '#16a34a', lineHeight: 1 }}>
                          {Math.abs(latest.weight - targetWeight).toFixed(1)}
                        </p>
                        <p style={{ fontSize: '10px', color: '#9ca3af' }}>kg {latest.weight > targetWeight ? '감량' : '증량'}</p>
                      </>
                    ) : (
                      <p style={{ fontSize: '13px', color: '#d1d5db', paddingTop: '4px' }}>미설정</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 차트 */}
            {chartData.length > 1 && (
              <div style={{ border: '1px solid #e5e7eb', padding: '16px', marginBottom: '16px' }}>
                <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' }}>체중 변화</p>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} interval="preserveStartEnd" />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#9ca3af' }} />
                    <Tooltip
                      contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 0, fontSize: '11px' }}
                      formatter={(v: any) => [`${v} kg`, '체중']}
                    />
                    {targetWeight > 0 && (
                      <ReferenceLine y={targetWeight} stroke="#6B21A8" strokeDasharray="4 4" label={{ value: `목표 ${targetWeight}kg`, fontSize: 9, fill: '#6B21A8', position: 'right' }} />
                    )}
                    <Line type="monotone" dataKey="weight" stroke="black" strokeWidth={1.5} dot={{ r: 3, fill: 'black' }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 오늘 체중 입력 */}
            <div style={{ border: '1px solid #e5e7eb', padding: '16px', marginBottom: '16px' }}>
              <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' }}>오늘 체중 기록</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="number" inputMode="decimal" value={weightInput}
                  onChange={e => setWeightInput(e.target.value)}
                  placeholder="체중 (kg)"
                  style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', fontSize: '16px', outline: 'none' }}
                />
                <button
                  onClick={handleSave}
                  disabled={saving || !weightInput}
                  style={{
                    padding: '10px 20px', border: 'none', fontSize: '13px', letterSpacing: '0.5px',
                    backgroundColor: saved ? '#6B21A8' : (!weightInput || saving) ? '#f3f4f6' : 'black',
                    color: saved || (weightInput && !saving) ? 'white' : '#9ca3af',
                    cursor: !weightInput ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saved ? '✓' : saving ? '...' : '저장'}
                </button>
              </div>
              <input
                type="text" value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                maxLength={30}
                placeholder="메모 (선택)"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', fontSize: '12px', outline: 'none', boxSizing: 'border-box', color: '#374151' }}
              />
            </div>

            {/* 기록 목록 */}
            {records.length > 0 && (
              <div>
                <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>기록 내역 ({records.length}개)</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb' }}>
                  {records.map((r, i) => {
                    const prev = records[i + 1];
                    const diff = prev ? r.weight - prev.weight : null;
                    const isToday = r.date === todayKST();
                    return (
                      <div key={r.date} style={{ backgroundColor: 'white', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <p style={{ fontSize: '13px', color: 'black' }}>{r.weight} kg</p>
                            {diff !== null && (
                              <span style={{ fontSize: '11px', color: diff > 0 ? '#ef4444' : diff < 0 ? '#16a34a' : '#9ca3af', fontWeight: 500 }}>
                                {diff > 0 ? `+${diff.toFixed(1)}` : diff < 0 ? diff.toFixed(1) : '±0'}
                              </span>
                            )}
                            {isToday && <span style={{ fontSize: '9px', backgroundColor: '#6B21A8', color: 'white', padding: '1px 5px' }}>오늘</span>}
                          </div>
                          <p style={{ fontSize: '10px', color: '#9ca3af' }}>{r.date}{r.note ? ` · ${r.note}` : ''}</p>
                        </div>
                        {deleteConfirm === r.date ? (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => handleDelete(r.date)} style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: 'white', border: 'none', fontSize: '10px', cursor: 'pointer' }}>삭제</button>
                            <button onClick={() => setDeleteConfirm(null)} style={{ padding: '4px 8px', backgroundColor: 'white', color: '#9ca3af', border: '1px solid #e5e7eb', fontSize: '10px', cursor: 'pointer' }}>취소</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(r.date)} style={{ padding: '4px 8px', background: 'none', border: 'none', fontSize: '12px', color: '#d1d5db', cursor: 'pointer' }}>×</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {records.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontSize: '13px', color: '#9ca3af' }}>체중 기록이 없습니다.<br />오늘 첫 기록을 시작해보세요.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
