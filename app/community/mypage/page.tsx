"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// ── 암호화 ────────────────────────────────────────────────────────
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
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin).buffer as ArrayBuffer, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 10000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}
async function encryptWeight(data: WeightRecord[], pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data)));
  localStorage.setItem(WEIGHT_ENC_KEY, JSON.stringify({ salt: Array.from(salt), iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) }));
}
async function decryptWeight(pin: string): Promise<WeightRecord[] | null> {
  const raw = localStorage.getItem(WEIGHT_ENC_KEY);
  if (!raw) return [];
  try {
    const { salt, iv, ct } = JSON.parse(raw);
    const key = await deriveKey(pin, new Uint8Array(salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, new Uint8Array(ct));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch { return null; }
}

// ── 타입 ──────────────────────────────────────────────────────────
interface WeightRecord { date: string; weight: number; note?: string; }
interface Meal { id: string; food_name: string; calories: number; created_at: string; category?: string; nutrient?: { protein?: number; carbohydrates?: number; fat?: number }; }

function todayKST() { return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); }
function toKSTDate(iso: string) { return new Date(new Date(iso).getTime() + 9 * 3600000).toISOString().slice(0, 10); }
function fmtDate(d: string) { const [, m, day] = d.split('-'); return `${parseInt(m)}/${parseInt(day)}`; }
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000), m = Math.floor(diff / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}일 전`;
  if (h > 0) return `${h}시간 전`;
  if (m > 0) return `${m}분 전`;
  return '방금';
}
function calcBMI(w: number, h: number) { return h ? w / ((h / 100) ** 2) : 0; }
function bmiStatus(bmi: number) {
  if (!bmi) return { label: '-', color: '#9ca3af' };
  if (bmi < 18.5) return { label: '저체중', color: '#3b82f6' };
  if (bmi < 23)   return { label: '정상',   color: '#16a34a' };
  if (bmi < 25)   return { label: '과체중', color: '#f59e0b' };
  return { label: '비만', color: '#ef4444' };
}

// PIN 키패드 모달
function PinModal({ onSuccess, onCancel }: { onSuccess: (pin: string) => void; onCancel: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const hasPinSet = !!localStorage.getItem(PIN_KEY);

  const handleDigit = (d: string) => {
    const next = (pin + d).slice(0, 4);
    setPin(next); setError('');
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
      <div style={{ backgroundColor: 'white', width: '280px', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '18px', marginBottom: '6px' }}>🔐</p>
          <p style={{ fontSize: '14px', color: 'black', marginBottom: '4px' }}>PIN 입력</p>
          <p style={{ fontSize: '11px', color: '#9ca3af' }}>체중 기록은 PIN으로 보호됩니다</p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {[0,1,2,3].map(i => <div key={i} style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: i < pin.length ? 'black' : '#e5e7eb' }} />)}
        </div>
        {error && <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '-8px' }}>{error}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', width: '100%' }}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
            <button key={i} onClick={() => d === '⌫' ? setPin(p => p.slice(0,-1)) : d ? handleDigit(d) : undefined}
              disabled={!d}
              style={{ padding: '14px', fontSize: d === '⌫' ? '16px' : '18px', border: '1px solid', borderColor: d ? '#e5e7eb' : 'transparent', backgroundColor: d ? 'white' : 'transparent', cursor: d ? 'pointer' : 'default' }}>
              {d}
            </button>
          ))}
        </div>
        <button onClick={onCancel} style={{ fontSize: '12px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>취소</button>
      </div>
    </div>
  );
}

type SubTab = 'myinfo' | 'meals' | 'weight';

export default function MyPage() {
  const [subTab, setSubTab] = useState<SubTab>('myinfo');

  // 프로필
  const [profile, setProfile] = useState<{ nickname: string | null; avatar_url: string | null; plan: string } | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusInput, setStatusInput] = useState('');
  const [editingStatus, setEditingStatus] = useState(false);

  // 식단
  const [meals, setMeals] = useState<Meal[]>([]);

  // 체중
  const [weightUnlocked, setWeightUnlocked] = useState(false);
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

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const t = session?.access_token;
      if (!t) { setLoading(false); return; }
      try {
        const [profileRes, mealsRes] = await Promise.all([
          fetch('/api/profile', { headers: { Authorization: `Bearer ${t}` } }),
          fetch('/api/meals', { headers: { Authorization: `Bearer ${t}` } }),
        ]);
        if (profileRes.ok) {
          const p = await profileRes.json();
          setProfile({ nickname: p.nickname, avatar_url: p.avatar_url, plan: p.plan ?? 'free' });
          setIsPublic(p.is_public ?? false);
          setStatusMsg(p.status_message ?? '');
          setStatusInput(p.status_message ?? '');
        }
        if (mealsRes.ok) {
          const m = await mealsRes.json();
          if (m.success && Array.isArray(m.data)) setMeals(m.data);
        }
      } catch { }
      setLoading(false);
    });
  }, []);

  // 체중 PIN 인증
  const onPinSuccess = async (pin: string) => {
    pinRef.current = pin;
    setShowPin(false);
    const data = await decryptWeight(pin);
    if (data !== null) {
      setRecords(data);
      setWeightUnlocked(true);
      try {
        const goal = JSON.parse(localStorage.getItem('mybob_goal') || '{}');
        setHeight(Number(goal.height) || 0);
        setTargetWeight(Number(goal.targetWeight) || 0);
      } catch { }
    }
  };

  const handleWeightSave = async () => {
    const w = parseFloat(weightInput);
    if (!w || w < 20 || w > 300) return;
    setSaving(true);
    const today = todayKST();
    const next = [{ date: today, weight: w, note: noteInput.trim() || undefined }, ...records.filter(r => r.date !== today)];
    next.sort((a, b) => b.date.localeCompare(a.date));
    await encryptWeight(next, pinRef.current);
    setRecords(next);
    setWeightInput(''); setNoteInput('');
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleWeightDelete = async (date: string) => {
    const next = records.filter(r => r.date !== date);
    await encryptWeight(next, pinRef.current);
    setRecords(next);
    setDeleteConfirm(null);
  };

  // 파생 데이터
  const todayMeals = meals.filter(m => toKSTDate(m.created_at) === todayKST());
  const recentMeals = meals.slice(0, 20);
  const latest = records[0];
  const bmi = latest && height ? calcBMI(latest.weight, height) : 0;
  const bmiInfo = bmiStatus(bmi);
  const chartData = records.slice(0, 30).reverse().map(r => ({ date: fmtDate(r.date), weight: r.weight }));

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
      <div style={{ width: '20px', height: '20px', border: '2px solid #e5e7eb', borderTopColor: 'black', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {showPin && <PinModal onSuccess={onPinSuccess} onCancel={() => setShowPin(false)} />}

      {/* 서브 탭 */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>
        {([['myinfo', '내 정보'], ['meals', '식단'], ['weight', '체중']] as const).map(([key, label]) => (
          <button key={key} onPointerDown={() => setSubTab(key)}
            style={{
              flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', minHeight: '44px', touchAction: 'manipulation',
              color: subTab === key ? 'black' : '#9ca3af',
              borderBottom: subTab === key ? '2px solid black' : '2px solid transparent',
            }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 20px 40px' }}>

        {/* ── 내 정보 탭 ─────────────────────────────────────────── */}
        {subTab === 'myinfo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* 프로필 카드 */}
            <div style={{ border: '1px solid #e5e7eb', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '20px' }}>👤</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <p style={{ fontSize: '15px', color: 'black' }}>{profile?.nickname || '-'}</p>
                    {profile?.plan !== 'free' && <span style={{ fontSize: '8px', backgroundColor: '#6B21A8', color: 'white', padding: '2px 5px' }}>PRO</span>}
                  </div>
                  <p style={{ fontSize: '11px', color: '#9ca3af' }}>오늘 {todayMeals.length}개 기록</p>
                </div>
                {/* 공개 토글 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <button onPointerDown={() => setIsPublic(v => !v)}
                    style={{ width: '40px', height: '22px', borderRadius: '11px', border: '1px solid #e5e7eb', backgroundColor: isPublic ? 'black' : 'white', cursor: 'pointer', position: 'relative', padding: 0, touchAction: 'manipulation' }}>
                    <span style={{ position: 'absolute', top: '2px', left: isPublic ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: isPublic ? 'white' : '#d1d5db', transition: 'left 0.15s' }} />
                  </button>
                  <p style={{ fontSize: '9px', color: isPublic ? '#6B21A8' : '#9ca3af' }}>{isPublic ? '공개' : '비공개'}</p>
                </div>
              </div>

              {/* 상태 메시지 */}
              <div>
                <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>상태 메시지</p>
                {editingStatus ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input type="text" value={statusInput} onChange={e => setStatusInput(e.target.value)} maxLength={40}
                      placeholder="한 줄 상태 메시지 (40자)"
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid #e5e7eb', fontSize: '12px', outline: 'none' }} />
                    <button onPointerDown={() => { setStatusMsg(statusInput); setEditingStatus(false); }}
                      style={{ padding: '8px 12px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '11px', cursor: 'pointer', touchAction: 'manipulation' }}>저장</button>
                    <button onPointerDown={() => { setStatusInput(statusMsg); setEditingStatus(false); }}
                      style={{ padding: '8px 10px', border: '1px solid #e5e7eb', backgroundColor: 'white', color: '#9ca3af', fontSize: '11px', cursor: 'pointer', touchAction: 'manipulation' }}>취소</button>
                  </div>
                ) : (
                  <button onPointerDown={() => setEditingStatus(true)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa', fontSize: '12px', color: statusMsg ? '#374151' : '#d1d5db', textAlign: 'left', cursor: 'pointer', touchAction: 'manipulation' }}>
                    {statusMsg || '상태 메시지를 입력하세요...'}
                  </button>
                )}
              </div>
            </div>

            {/* 준비 중 섹션 */}
            {[
              { icon: '❤️', label: '좋아요 받은 식단', desc: '공개 식단에 이웃이 좋아요를 누르면 표시됩니다.' },
              { icon: '💬', label: '댓글', desc: '이웃과 식단 이야기를 나눠보세요.' },
              { icon: '🏆', label: '챌린지 현황', desc: '진행 중인 챌린지 달성률을 확인하세요.' },
            ].map(item => (
              <div key={item.label} style={{ border: '1px solid #e5e7eb', padding: '14px', opacity: 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px' }}>{item.icon}</span>
                  <p style={{ fontSize: '12px', color: 'black' }}>{item.label}</p>
                  <span style={{ fontSize: '8px', color: '#9ca3af', backgroundColor: '#f3f4f6', padding: '2px 5px', letterSpacing: '1px' }}>준비 중</span>
                </div>
                <p style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.5, paddingLeft: '22px' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── 식단 탭 ────────────────────────────────────────────── */}
        {subTab === 'meals' && (
          <div>
            {/* 오늘 요약 */}
            {todayMeals.length > 0 && (
              <div style={{ border: '1px solid #e5e7eb', padding: '12px 14px', marginBottom: '14px', display: 'flex', gap: '16px' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', marginBottom: '3px' }}>오늘 식사</p>
                  <p style={{ fontSize: '16px', color: 'black' }}>{todayMeals.length}개</p>
                </div>
                <div style={{ textAlign: 'center', flex: 1, borderLeft: '1px solid #e5e7eb' }}>
                  <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', marginBottom: '3px' }}>총 칼로리</p>
                  <p style={{ fontSize: '16px', color: '#6B21A8' }}>{todayMeals.reduce((s, m) => s + (m.calories || 0), 0)} kcal</p>
                </div>
                <div style={{ textAlign: 'center', flex: 1, borderLeft: '1px solid #e5e7eb' }}>
                  <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', marginBottom: '3px' }}>단백질</p>
                  <p style={{ fontSize: '16px', color: 'black' }}>{Math.round(todayMeals.reduce((s, m) => s + (m.nutrient?.protein || 0), 0))}g</p>
                </div>
              </div>
            )}

            {/* 공개 여부 안내 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase' }}>최근 식단</p>
              <span style={{ fontSize: '10px', color: isPublic ? '#6B21A8' : '#9ca3af' }}>
                {isPublic ? '이웃에게 공개 중' : '비공개'}
              </span>
            </div>

            {recentMeals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontSize: '13px', color: '#9ca3af' }}>기록된 식단이 없습니다.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb' }}>
                {recentMeals.map(m => (
                  <div key={m.id} style={{ backgroundColor: 'white', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: '13px', color: 'black', marginBottom: '3px' }}>{m.food_name}</p>
                      <p style={{ fontSize: '10px', color: '#9ca3af' }}>
                        {m.category && `${m.category} · `}{timeAgo(m.created_at)}
                        {m.nutrient?.protein ? ` · 단백질 ${Math.round(m.nutrient.protein)}g` : ''}
                      </p>
                    </div>
                    <p style={{ fontSize: '13px', color: '#6B21A8', flexShrink: 0 }}>{m.calories} kcal</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 체중 탭 ────────────────────────────────────────────── */}
        {subTab === 'weight' && (
          <div>
            {!weightUnlocked ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 0', gap: '14px' }}>
                <span style={{ fontSize: '36px' }}>🔒</span>
                <p style={{ fontSize: '14px', color: 'black' }}>체중 기록이 잠겨 있습니다</p>
                <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', lineHeight: 1.6 }}>
                  신체정보와 동일한 PIN으로 보호됩니다.<br />AES-256 암호화 · 이 기기에만 저장
                </p>
                <button onPointerDown={() => setShowPin(true)}
                  style={{ padding: '11px 28px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '12px', cursor: 'pointer', letterSpacing: '1px', touchAction: 'manipulation' }}>
                  잠금 해제
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* 현재 상태 */}
                {latest && (
                  <div style={{ border: '1px solid #e5e7eb', padding: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center' }}>
                      <div style={{ borderRight: '1px solid #e5e7eb' }}>
                        <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', marginBottom: '4px' }}>현재 체중</p>
                        <p style={{ fontSize: '20px', color: 'black', lineHeight: 1 }}>{latest.weight}</p>
                        <p style={{ fontSize: '10px', color: '#9ca3af' }}>kg</p>
                      </div>
                      <div style={{ borderRight: '1px solid #e5e7eb' }}>
                        <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', marginBottom: '4px' }}>BMI</p>
                        <p style={{ fontSize: '20px', color: bmiInfo.color, lineHeight: 1 }}>{bmi > 0 ? bmi.toFixed(1) : '-'}</p>
                        <p style={{ fontSize: '10px', color: bmiInfo.color }}>{bmiInfo.label}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', marginBottom: '4px' }}>목표까지</p>
                        {targetWeight > 0 ? (
                          <>
                            <p style={{ fontSize: '20px', color: latest.weight > targetWeight ? '#ef4444' : '#16a34a', lineHeight: 1 }}>
                              {Math.abs(latest.weight - targetWeight).toFixed(1)}
                            </p>
                            <p style={{ fontSize: '10px', color: '#9ca3af' }}>kg {latest.weight > targetWeight ? '감량' : '증량'}</p>
                          </>
                        ) : <p style={{ fontSize: '13px', color: '#d1d5db', paddingTop: '6px' }}>미설정</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* 차트 */}
                {chartData.length > 1 && (
                  <div style={{ border: '1px solid #e5e7eb', padding: '14px' }}>
                    <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>체중 변화</p>
                    <ResponsiveContainer width="100%" height={130}>
                      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} interval="preserveStartEnd" />
                        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#9ca3af' }} />
                        <Tooltip contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 0, fontSize: '11px' }} formatter={(v: any) => [`${v} kg`, '체중']} />
                        {targetWeight > 0 && <ReferenceLine y={targetWeight} stroke="#6B21A8" strokeDasharray="4 4" />}
                        <Line type="monotone" dataKey="weight" stroke="black" strokeWidth={1.5} dot={{ r: 3, fill: 'black' }} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 입력 */}
                <div style={{ border: '1px solid #e5e7eb', padding: '14px' }}>
                  <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>오늘 체중 기록</p>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input type="number" inputMode="decimal" value={weightInput} onChange={e => setWeightInput(e.target.value)}
                      placeholder="체중 (kg)"
                      style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', fontSize: '16px', outline: 'none' }} />
                    <button onPointerDown={handleWeightSave} disabled={saving || !weightInput}
                      style={{ padding: '10px 18px', border: 'none', fontSize: '13px', touchAction: 'manipulation',
                        backgroundColor: saved ? '#6B21A8' : !weightInput ? '#f3f4f6' : 'black',
                        color: saved || weightInput ? 'white' : '#9ca3af',
                        cursor: !weightInput ? 'not-allowed' : 'pointer' }}>
                      {saved ? '✓' : saving ? '...' : '저장'}
                    </button>
                  </div>
                  <input type="text" value={noteInput} onChange={e => setNoteInput(e.target.value)} maxLength={30}
                    placeholder="메모 (선택)"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                {/* 기록 목록 */}
                {records.length > 0 && (
                  <div>
                    <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>기록 내역</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb' }}>
                      {records.map((r, i) => {
                        const prev = records[i + 1];
                        const diff = prev ? r.weight - prev.weight : null;
                        const isToday = r.date === todayKST();
                        return (
                          <div key={r.date} style={{ backgroundColor: 'white', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                <p style={{ fontSize: '13px', color: 'black' }}>{r.weight} kg</p>
                                {diff !== null && (
                                  <span style={{ fontSize: '11px', fontWeight: 500, color: diff > 0 ? '#ef4444' : diff < 0 ? '#16a34a' : '#9ca3af' }}>
                                    {diff > 0 ? `+${diff.toFixed(1)}` : diff < 0 ? diff.toFixed(1) : '±0'}
                                  </span>
                                )}
                                {isToday && <span style={{ fontSize: '8px', backgroundColor: '#6B21A8', color: 'white', padding: '1px 5px' }}>오늘</span>}
                              </div>
                              <p style={{ fontSize: '10px', color: '#9ca3af' }}>{r.date}{r.note ? ` · ${r.note}` : ''}</p>
                            </div>
                            {deleteConfirm === r.date ? (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button onPointerDown={() => handleWeightDelete(r.date)} style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: 'white', border: 'none', fontSize: '10px', cursor: 'pointer', touchAction: 'manipulation' }}>삭제</button>
                                <button onPointerDown={() => setDeleteConfirm(null)} style={{ padding: '4px 8px', border: '1px solid #e5e7eb', backgroundColor: 'white', color: '#9ca3af', fontSize: '10px', cursor: 'pointer', touchAction: 'manipulation' }}>취소</button>
                              </div>
                            ) : (
                              <button onPointerDown={() => setDeleteConfirm(r.date)} style={{ background: 'none', border: 'none', fontSize: '14px', color: '#d1d5db', cursor: 'pointer', padding: '4px', touchAction: 'manipulation' }}>×</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {records.length === 0 && (
                  <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', padding: '20px 0' }}>첫 체중을 기록해보세요.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
