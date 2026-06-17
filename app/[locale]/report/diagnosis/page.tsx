"use client";

import { useState, useEffect } from 'react';
import { FaSpinner } from 'react-icons/fa';
import { useAuth } from '@/lib/auth-context';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';

interface Meal {
  id: string;
  created_at: string;
  food_name: string;
  calories: number;
  category?: string;
  nutrient?: { carbohydrates?: number; protein?: number; fat?: number; sodium?: number; fiber?: number };
}

interface DiagnosisResult {
  overall_score: number;
  grade: string;
  summary: string;
  scores: Record<string, { score: number; comment: string }>;
  strengths: string[];
  issues: { title: string; description: string; severity: 'high' | 'medium' | 'low' }[];
  recommendations: { title: string; description: string; priority: 'high' | 'medium' | 'low' }[];
  weekly_plan: { day: string; tip: string }[];
  ai_message: string;
}

interface DiagnosisStats {
  avgCal: number;
  days: number;
  meals: number;
  periodStart: string;
  periodEnd: string;
  targetCalories: number;
}

interface DiagnosisRecord {
  diagnosis: DiagnosisResult;
  stats: DiagnosisStats;
  analyzedAt: string;      // ISO
  analyzedAtLabel: string; // 표시용
  plan: string;
  mealCountAtAnalysis: number;
}

const SEVERITY_COLOR: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' };
const GRADE_COLOR: Record<string, string> = {
  'A+': '#6B21A8', A: '#6B21A8', 'B+': '#000', B: '#000', 'C+': '#f59e0b', C: '#f59e0b', D: '#ef4444',
};

function scoreColor(s: number) {
  if (s >= 80) return '#16a34a';
  if (s >= 60) return '#000';
  if (s >= 40) return '#f59e0b';
  return '#ef4444';
}

function ScoreRing({ score, size = 88 }: { score: number; size?: number }) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={scoreColor(score)} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
    </svg>
  );
}

// KST 기준 날짜 비교
function toKSTDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function todayKST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

// 표시용 날짜 포맷: "2026-05-15" → "5월 15일"
function fmtDate(iso: string) {
  const [, m, d] = iso.split('-');
  return `${parseInt(m)}월 ${parseInt(d)}일`;
}

// 신체정보 localStorage에서 읽기 (암호화 안 된 goal 필드만)
function loadBodyInfo() {
  try {
    const raw = localStorage.getItem('mybob_goal');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

// 진단 히스토리: localStorage "mybob_diagnosis_history_v2" (최대 12개)
function loadHistory(): DiagnosisRecord[] {
  try {
    return JSON.parse(localStorage.getItem('mybob_diagnosis_history_v2') || '[]');
  } catch { return []; }
}

function saveHistory(record: DiagnosisRecord) {
  const history = loadHistory();
  // 같은 날 분석 결과는 덮어씀
  const today = todayKST();
  const filtered = history.filter(r => toKSTDate(r.analyzedAt) !== today);
  const next = [record, ...filtered].slice(0, 12);
  localStorage.setItem('mybob_diagnosis_history_v2', JSON.stringify(next));
  // 현재 캐시도 갱신
  localStorage.setItem('mybob_diagnosis_v2', JSON.stringify(record));
}

export default function DiagnosisPage() {
  const { token } = useAuth();
  const t = useTranslations('Report');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<DiagnosisRecord | null>(null);
  const [history, setHistory] = useState<DiagnosisRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'detail' | 'plan' | 'trend'>('overview');
  const [plan, setPlan] = useState<string | null>(null);
  const [refreshBanner, setRefreshBanner] = useState<string | null>(null);
  const SCORE_LABELS: Record<string, string> = t.raw('scoreLabels') as Record<string, string>;

  useEffect(() => {
    const cached = localStorage.getItem('mybob_diagnosis_v2');
    if (cached) {
      try { setCurrent(JSON.parse(cached)); } catch { }
    }
    setHistory(loadHistory());

    const local: Meal[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
    setMeals(local);

    if (token === null) return;
    if (!token) { setPlan('free'); return; }

    // 플랜 + 식단 병렬 조회
    Promise.all([
      fetch('/api/upload-status', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/meals', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([statusData, mealsData]) => {
      setPlan(statusData.plan || 'free');
      if (mealsData.success && Array.isArray(mealsData.data)) {
        const serverIds = new Set(mealsData.data.map((m: Meal) => m.id));
        const merged = [...mealsData.data, ...local.filter(m => !serverIds.has(m.id))];
        setMeals(merged);
        localStorage.setItem('mybob_meals', JSON.stringify(merged));
      }
    }).catch(() => setPlan('free'));
  }, [token]);

  // 갱신 필요 여부 판단 (meals, current 둘 다 준비된 후)
  useEffect(() => {
    if (!current) return;
    const today = todayKST();
    const lastDate = toKSTDate(current.analyzedAt);
    const daysSince = Math.floor((Date.now() - new Date(current.analyzedAt).getTime()) / 86400000);
    const newMealsSince = meals.filter(m => toKSTDate(m.created_at) > lastDate).length;

    if (daysSince >= 7) {
      setRefreshBanner(`마지막 진단으로부터 ${daysSince}일이 지났어요. 재분석을 추천합니다.`);
    } else if (newMealsSince >= 20) {
      setRefreshBanner(`진단 이후 ${newMealsSince}개의 식단이 새로 추가됐어요. 재분석을 추천합니다.`);
    }
  }, [meals, current]);

  // 오늘 이미 분석했는지
  const analyzedToday = current ? toKSTDate(current.analyzedAt) === todayKST() : false;

  // 최근 30일 식단
  const recentMeals = meals.filter(m => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    return new Date(m.created_at) >= cutoff;
  });

  const handleAnalyze = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setRefreshBanner(null);
    try {
      const bodyInfo = loadBodyInfo();
      const previousScores = history.slice(0, 3).map(r => ({
        date: fmtDate(toKSTDate(r.analyzedAt)),
        overall_score: r.diagnosis.overall_score,
        grade: r.diagnosis.grade,
      }));

      // 달성 기록 로드
      let achievedStreak = 0, totalAchievedDays = 0;
      try {
        const { getAchievedStreak, getTotalAchievedDays } = await import('@/lib/goal-achievement');
        achievedStreak = getAchievedStreak();
        totalAchievedDays = getTotalAchievedDays();
      } catch { }

      const res = await fetch('/api/diagnosis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          meals: recentMeals,
          goal: bodyInfo?.goal || '유지',
          bodyInfo,
          previousScores,
          achievedStreak,
          totalAchievedDays,
        }),
      });
      const data = await res.json();

      if (res.status === 403) { setError(t('proOnly')); return; }
      if (res.status === 422 && data.error === 'NO_DATA') { setError(t('noMealData')); return; }
      if (!res.ok) { setError(data.error || t('noData')); return; }

      const now = new Date().toISOString();
      const label = new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const record: DiagnosisRecord = {
        diagnosis: data.diagnosis,
        stats: data.stats,
        analyzedAt: now,
        analyzedAtLabel: label,
        plan: plan || 'pro',
        mealCountAtAnalysis: recentMeals.length,
      };

      setCurrent(record);
      saveHistory(record);
      setHistory(loadHistory());
      setActiveTab('overview');
    } catch (e: any) {
      setError(`오류: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 플랜 로딩 중
  if (plan === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
        <FaSpinner style={{ fontSize: '22px', animation: 'spin 1s linear infinite', color: '#9ca3af' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // 무료 플랜 잠금
  if (plan === 'free') {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</p>
        <p style={{ fontSize: '15px', color: 'black', marginBottom: '8px' }}>PRO 전용 기능</p>
        <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.8, marginBottom: '24px' }}>
          AI 정밀 진단은 PRO 플랜 이상에서<br />사용할 수 있습니다.
        </p>
        <div style={{ border: '1px solid #e5e7eb', padding: '20px', marginBottom: '20px', textAlign: 'left' }}>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>PRO 진단 포함 기능</p>
          {['5개 지표 종합 건강 점수 (A+~D 등급)', '문제점 심층 분석 + 개선 방법', 'AI 맞춤 주간 식단 플랜', '나트륨 · 식이섬유 · 영양 균형 평가', '장기 트렌드 점수 변화 추적'].map(f => (
            <p key={f} style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>✓ {f}</p>
          ))}
        </div>
        <div style={{ backgroundColor: '#f3f4f6', padding: '14px', fontSize: '12px', color: '#9ca3af' }}>
          업그레이드 준비 중
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px 60px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* 갱신 추천 배너 */}
      {refreshBanner && !loading && (
        <div style={{ backgroundColor: '#faf5ff', border: '1px solid #d8b4fe', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <p style={{ fontSize: '12px', color: '#6B21A8', lineHeight: 1.5, flex: 1 }}>{refreshBanner}</p>
          <button onClick={handleAnalyze} style={{ flexShrink: 0, padding: '6px 12px', backgroundColor: '#6B21A8', color: 'white', border: 'none', fontSize: '11px', cursor: 'pointer' }}>
            재분석
          </button>
        </div>
      )}

      {/* 진단 요청 카드 (결과 없을 때) */}
      {!current && !loading && (
        <div style={{ border: '1px solid #e5e7eb', padding: '24px', marginBottom: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '32px', marginBottom: '8px' }}>🧬</p>
          <p style={{ fontSize: '15px', color: 'black', marginBottom: '6px' }}>AI 정밀 진단</p>
          <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.7, marginBottom: '20px' }}>
            최근 30일 식단 데이터를 분석해<br />
            칼로리 · 영양 균형 · 나트륨 · 식이섬유<br />
            5개 지표 종합 점수와 맞춤 코칭을 제공합니다.
          </p>
          <p style={{ fontSize: '11px', color: '#6B21A8', marginBottom: '16px' }}>분석 가능 데이터: {recentMeals.length}개 기록</p>
          {error && <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px', whiteSpace: 'pre-line' }}>{error}</p>}
          <button
            onClick={handleAnalyze}
            disabled={recentMeals.length === 0 || !token}
            style={{
              width: '100%', padding: '14px',
              backgroundColor: recentMeals.length === 0 ? '#f3f4f6' : 'black',
              color: recentMeals.length === 0 ? '#9ca3af' : 'white',
              border: 'none', fontSize: '13px', letterSpacing: '1px',
              cursor: recentMeals.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            진단 시작
          </button>
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <FaSpinner style={{ fontSize: '28px', animation: 'spin 1s linear infinite', color: '#9ca3af', marginBottom: '16px' }} />
          <p style={{ fontSize: '13px', color: '#9ca3af', letterSpacing: '1px' }}>AI가 식단을 분석하고 있습니다...</p>
          <p style={{ fontSize: '11px', color: '#d1d5db', marginTop: '6px' }}>약 10~20초 소요</p>
        </div>
      )}

      {/* 진단 결과 */}
      {current && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

          {/* 분석 기준 정보 */}
          <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', padding: '10px 14px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>
              📅 분석 기간: <span style={{ color: '#374151' }}>{fmtDate(current.stats.periodStart)} ~ {fmtDate(current.stats.periodEnd)} ({current.stats.days}일)</span>
            </span>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>
              🍽 기준 식단: <span style={{ color: '#374151' }}>{current.stats.meals}개</span>
            </span>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>
              🕐 분석 시각: <span style={{ color: '#374151' }}>{current.analyzedAtLabel}</span>
            </span>
          </div>

          {/* 종합 점수 */}
          <div style={{ border: '1px solid #e5e7eb', padding: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <ScoreRing score={current.diagnosis.overall_score} size={88} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '22px', fontWeight: 600, color: scoreColor(current.diagnosis.overall_score), lineHeight: 1 }}>{current.diagnosis.overall_score}</span>
                <span style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px' }}>/ 100</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '24px', fontWeight: 700, color: GRADE_COLOR[current.diagnosis.grade] || 'black' }}>{current.diagnosis.grade}</span>
                <span style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px' }}>등급</span>
                {/* 이전 진단 대비 변화 */}
                {history.length > 1 && (() => {
                  const prev = history[1];
                  const diff = current.diagnosis.overall_score - prev.diagnosis.overall_score;
                  if (diff === 0) return null;
                  return (
                    <span style={{ fontSize: '11px', color: diff > 0 ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                      {diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`}
                    </span>
                  );
                })()}
              </div>
              <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>{current.diagnosis.summary}</p>
            </div>
          </div>

          {/* 탭 */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: '16px' }}>
            {([['overview', '개요'], ['detail', '상세'], ['plan', '플랜'], ['trend', '트렌드']] as const).map(([key, label]) => (
              <button key={key} onPointerDown={() => setActiveTab(key)}
                style={{
                  flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '11px', letterSpacing: '1px', minHeight: '44px', touchAction: 'manipulation',
                  color: activeTab === key ? 'black' : '#9ca3af',
                  borderBottom: activeTab === key ? '2px solid black' : '2px solid transparent',
                  marginBottom: '-1px',
                }}>
                {label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">

            {/* 개요 탭 */}
            {activeTab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>지표별 점수</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {Object.entries(current.diagnosis.scores).map(([key, val]) => (
                      <div key={key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'black' }}>{SCORE_LABELS[key] || key}</span>
                          <span style={{ fontSize: '12px', color: scoreColor(val.score), fontWeight: 600 }}>{val.score}</span>
                        </div>
                        <div style={{ height: '5px', backgroundColor: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${val.score}%`, backgroundColor: scoreColor(val.score), borderRadius: '3px', transition: 'width 0.6s' }} />
                        </div>
                        <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '3px' }}>{val.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {current.diagnosis.strengths.length > 0 && (
                  <div style={{ border: '1px solid #dcfce7', backgroundColor: '#f0fdf4', padding: '14px', marginBottom: '12px' }}>
                    <p style={{ fontSize: '9px', color: '#16a34a', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>✓ 잘하고 있어요</p>
                    {current.diagnosis.strengths.map((s, i) => (
                      <p key={i} style={{ fontSize: '12px', color: '#15803d', marginBottom: '4px', lineHeight: 1.5 }}>• {s}</p>
                    ))}
                  </div>
                )}

                <div style={{ border: '1px solid #e9d5ff', backgroundColor: '#faf5ff', padding: '16px', marginBottom: '16px' }}>
                  <p style={{ fontSize: '9px', color: '#6B21A8', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>AI 코치 메시지</p>
                  <p style={{ fontSize: '13px', color: '#4c1d95', lineHeight: 1.8 }}>{current.diagnosis.ai_message}</p>
                </div>

                {/* 수동 재분석 버튼 */}
                <button
                  onClick={handleAnalyze}
                  disabled={analyzedToday}
                  style={{
                    width: '100%', padding: '12px', border: '1px solid #e5e7eb',
                    backgroundColor: analyzedToday ? '#f9fafb' : 'white',
                    color: analyzedToday ? '#9ca3af' : 'black',
                    fontSize: '12px', letterSpacing: '1px',
                    cursor: analyzedToday ? 'not-allowed' : 'pointer',
                  }}
                >
                  {analyzedToday ? '오늘 분석 완료 (내일 재분석 가능)' : '🔄 재분석'}
                </button>
                {error && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px', textAlign: 'center' }}>{error}</p>}
              </motion.div>
            )}

            {/* 상세 탭 */}
            {activeTab === 'detail' && (
              <motion.div key="detail" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {/* 핵심 수치 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                  {[
                    { label: '일 평균 칼로리', value: `${current.stats.avgCal} kcal` },
                    { label: '목표 칼로리', value: `${current.stats.targetCalories} kcal` },
                    { label: '분석 일수', value: `${current.stats.days}일` },
                    { label: '총 기록 수', value: `${current.stats.meals}개` },
                  ].map(item => (
                    <div key={item.label} style={{ border: '1px solid #e5e7eb', padding: '12px' }}>
                      <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', marginBottom: '4px' }}>{item.label}</p>
                      <p style={{ fontSize: '15px', color: 'black', fontWeight: 500 }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {current.diagnosis.issues.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>개선이 필요한 점</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {current.diagnosis.issues.map((issue, i) => (
                        <div key={i} style={{ border: `1px solid ${SEVERITY_COLOR[issue.severity]}30`, padding: '14px', borderLeft: `3px solid ${SEVERITY_COLOR[issue.severity]}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '8px', color: SEVERITY_COLOR[issue.severity], letterSpacing: '1px', textTransform: 'uppercase', backgroundColor: `${SEVERITY_COLOR[issue.severity]}15`, padding: '2px 6px' }}>
                              {issue.severity === 'high' ? '높음' : issue.severity === 'medium' ? '보통' : '낮음'}
                            </span>
                            <span style={{ fontSize: '13px', color: 'black', fontWeight: 500 }}>{issue.title}</span>
                          </div>
                          <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>{issue.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>실천 방법</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {current.diagnosis.recommendations.map((rec, i) => (
                      <div key={i} style={{ border: '1px solid #e5e7eb', padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: rec.priority === 'high' ? '#6B21A8' : '#6b7280', backgroundColor: rec.priority === 'high' ? '#f3e8ff' : '#f3f4f6', padding: '2px 6px' }}>
                            {rec.priority === 'high' ? '우선' : rec.priority === 'medium' ? '권장' : '참고'}
                          </span>
                          <span style={{ fontSize: '13px', color: 'black' }}>{rec.title}</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>{rec.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* 플랜 탭 */}
            {activeTab === 'plan' && (
              <motion.div key="plan" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' }}>이번 주 실천 플랜</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                  {current.diagnosis.weekly_plan.map((item, i) => {
                    const today = ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()];
                    const isToday = item.day === today;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', backgroundColor: isToday ? '#faf5ff' : 'white', border: isToday ? '1px solid #d8b4fe' : '1px solid #e5e7eb' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: isToday ? '#6B21A8' : '#9ca3af', width: '20px', flexShrink: 0, paddingTop: '1px' }}>{item.day}</span>
                        <p style={{ fontSize: '12px', color: isToday ? '#4c1d95' : '#6b7280', lineHeight: 1.6 }}>{item.tip}</p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* 트렌드 탭 */}
            {activeTab === 'trend' && (
              <motion.div key="trend" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {history.length < 2 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.8 }}>
                      트렌드는 2회 이상 진단 후 확인할 수 있습니다.<br />
                      꾸준히 기록하고 재분석해보세요.
                    </p>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' }}>종합 점수 변화</p>

                    {/* 점수 타임라인 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                      {history.map((r, i) => {
                        const prev = history[i + 1];
                        const diff = prev ? r.diagnosis.overall_score - prev.diagnosis.overall_score : null;
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: i === 0 ? '1px solid #d8b4fe' : '1px solid #e5e7eb', backgroundColor: i === 0 ? '#faf5ff' : 'white' }}>
                            <div style={{ flexShrink: 0, textAlign: 'center', width: '48px' }}>
                              <p style={{ fontSize: '18px', fontWeight: 700, color: scoreColor(r.diagnosis.overall_score), lineHeight: 1 }}>{r.diagnosis.overall_score}</p>
                              <p style={{ fontSize: '9px', color: GRADE_COLOR[r.diagnosis.grade] || 'black' }}>{r.diagnosis.grade}</p>
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>{fmtDate(toKSTDate(r.analyzedAt))} · {r.stats.days}일 · {r.stats.meals}개</p>
                              <p style={{ fontSize: '11px', color: '#374151', lineHeight: 1.5 }}>{r.diagnosis.summary.split('.')[0]}.</p>
                            </div>
                            {diff !== null && (
                              <span style={{ fontSize: '12px', fontWeight: 600, color: diff > 0 ? '#16a34a' : diff < 0 ? '#ef4444' : '#9ca3af', flexShrink: 0 }}>
                                {diff > 0 ? `▲${diff}` : diff < 0 ? `▼${Math.abs(diff)}` : '−'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* 지표별 최신 vs 이전 비교 */}
                    <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>지표별 변화 (최신 vs 직전)</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {Object.entries(current.diagnosis.scores).map(([key, val]) => {
                        const prevVal = history[1]?.diagnosis.scores[key]?.score;
                        const diff = prevVal != null ? val.score - prevVal : null;
                        return (
                          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '11px', color: '#374151', width: '70px', flexShrink: 0 }}>{SCORE_LABELS[key]}</span>
                            <div style={{ flex: 1, height: '5px', backgroundColor: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${val.score}%`, backgroundColor: scoreColor(val.score), borderRadius: '3px' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: scoreColor(val.score), width: '24px', textAlign: 'right' }}>{val.score}</span>
                            {diff !== null && (
                              <span style={{ fontSize: '10px', color: diff > 0 ? '#16a34a' : diff < 0 ? '#ef4444' : '#9ca3af', width: '28px', textAlign: 'right' }}>
                                {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '±0'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* 결과 없고 에러 있을 때 */}
      {!loading && !current && error && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ fontSize: '13px', color: '#ef4444', whiteSpace: 'pre-line', marginBottom: '16px' }}>{error}</p>
          <button onClick={handleAnalyze} style={{ padding: '12px 24px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '12px', cursor: 'pointer' }}>
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
