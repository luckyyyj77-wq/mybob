"use client";

import { useState, useEffect } from 'react';
import { FaSpinner } from 'react-icons/fa';
import { supabase } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface Meal {
  id: string;
  created_at: string;
  food_name: string;
  calories: number;
  category?: string;
  nutrient?: { carbohydrates?: number; protein?: number; fat?: number; sodium?: number; fiber?: number; };
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

function calcTargetCalories(height: number, weight: number, goal: string): number {
  if (!height || !weight) return 2000;
  const bmr = 10 * weight + 6.25 * height - 5 * 30;
  const tdee = Math.round(bmr * 1.375);
  if (goal === '다이어트') return Math.round(tdee * 0.8);
  if (goal === '증량') return Math.round(tdee * 1.15);
  return tdee;
}

const SCORE_LABELS: Record<string, string> = {
  calories: '칼로리 관리', balance: '영양 균형', sodium: '나트륨', fiber: '식이섬유', consistency: '기록 일관성',
};
const SEVERITY_COLOR: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' };
const GRADE_COLOR: Record<string, string> = { 'A+': '#6B21A8', A: '#6B21A8', 'B+': '#000000', B: '#000000', 'C+': '#f59e0b', C: '#f59e0b', D: '#ef4444' };

// 점수 → 색상
function scoreColor(s: number) {
  if (s >= 80) return '#16a34a';
  if (s >= 60) return '#000000';
  if (s >= 40) return '#f59e0b';
  return '#ef4444';
}

// 원형 점수 게이지
function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
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

export default function DiagnosisPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ avgCal: number; days: number; meals: number } | null>(null);
  const [lastAnalyzed, setLastAnalyzed] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'detail' | 'plan'>('overview');
  const [plan, setPlan] = useState<string | null>(null); // null = 로딩 중

  useEffect(() => {
    // 캐시된 진단 결과 복원
    const cached = localStorage.getItem('mybob_diagnosis_cache');
    if (cached) {
      try {
        const { result, analyzedAt } = JSON.parse(cached);
        setDiagnosis(result.diagnosis);
        setStats(result.stats);
        setLastAnalyzed(analyzedAt);
      } catch { /* 무시 */ }
    }

    // 식단 데이터 + 플랜 로드
    const local: Meal[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
    setMeals(local);
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token;
      if (!token) { setPlan('free'); return; }

      // 플랜 확인
      fetch('/api/upload-status', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setPlan(d.plan || 'free')).catch(() => setPlan('free'));

      fetch('/api/meals', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then(r => r.json()).then(result => {
          if (result.success && Array.isArray(result.data)) {
            const serverIds = new Set(result.data.map((m: Meal) => m.id));
            setMeals([...result.data, ...local.filter(m => !serverIds.has(m.id))]);
          }
        }).catch(() => {});
    });
  }, []);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      // 최근 30일 데이터만
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const recentMeals = meals.filter(m => new Date(m.created_at) >= cutoff);

      const goalData = JSON.parse(localStorage.getItem('mybob_goal') || '{}');
      const targetCalories = calcTargetCalories(Number(goalData.height) || 0, Number(goalData.weight) || 0, goalData.goal || '유지');

      const res = await fetch('/api/diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meals: recentMeals, goal: goalData.goal || '유지', targetCalories }),
      });
      const data = await res.json();

      if (res.status === 422 && data.error === 'NO_DATA') {
        setError('분석할 식단 기록이 없습니다.\n식단을 먼저 기록해주세요.');
        return;
      }
      if (!res.ok) {
        setError(data.error || '분석 중 오류가 발생했습니다.');
        return;
      }
      setDiagnosis(data.diagnosis);
      setStats(data.stats);
      const now = new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      setLastAnalyzed(now);
      // 캐시 저장 (24시간 캐싱 목적)
      localStorage.setItem('mybob_diagnosis_cache', JSON.stringify({ result: data, analyzedAt: now, plan }));
    } catch (e: any) {
      setError(`오류: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const recentCount = meals.filter(m => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    return new Date(m.created_at) >= cutoff;
  }).length;

  // 플랜 로딩 중
  if (plan === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
        <FaSpinner style={{ fontSize: '22px', animation: 'spin 1s linear infinite', color: '#9ca3af' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // 무료 플랜 잠금 화면
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
          {['5개 지표 종합 건강 점수 (A+~D 등급)', '문제점 심층 분석 + 개선 방법', 'AI 맞춤 주간 식단 플랜', '나트륨 · 식이섬유 · 영양 균형 평가'].map(f => (
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
    <div style={{ padding: '20px 24px 40px' }}>

      {/* 진단 요청 카드 */}
      {!diagnosis && !loading && (
        <div style={{ border: '1px solid #e5e7eb', padding: '24px', marginBottom: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '32px', marginBottom: '8px' }}>🧬</p>
          <p style={{ fontSize: '15px', color: 'black', marginBottom: '6px' }}>AI 정밀 진단</p>
          <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.7, marginBottom: '20px' }}>
            최근 30일 식단 데이터를 분석해<br />
            칼로리 · 영양 균형 · 나트륨 · 식이섬유<br />
            5개 지표 종합 점수와 맞춤 코칭을 제공합니다.
          </p>
          <p style={{ fontSize: '11px', color: '#6B21A8', marginBottom: '16px' }}>
            분석 가능 데이터: {recentCount}개 기록
          </p>
          {error && (
            <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px', whiteSpace: 'pre-line' }}>{error}</p>
          )}
          <button
            onClick={handleAnalyze}
            disabled={recentCount === 0}
            style={{
              width: '100%', padding: '14px',
              backgroundColor: recentCount === 0 ? '#f3f4f6' : 'black',
              color: recentCount === 0 ? '#9ca3af' : 'white',
              border: 'none', fontSize: '13px', letterSpacing: '1px',
              cursor: recentCount === 0 ? 'not-allowed' : 'pointer',
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
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* 진단 결과 */}
      {diagnosis && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

          {/* 종합 점수 */}
          <div style={{ border: '1px solid #e5e7eb', padding: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <ScoreRing score={diagnosis.overall_score} size={88} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '22px', fontWeight: 600, color: scoreColor(diagnosis.overall_score), lineHeight: 1 }}>{diagnosis.overall_score}</span>
                <span style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px' }}>/ 100</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '24px', fontWeight: 700, color: GRADE_COLOR[diagnosis.grade] || 'black' }}>{diagnosis.grade}</span>
                <span style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px' }}>등급</span>
              </div>
              <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>{diagnosis.summary}</p>
              {lastAnalyzed && <p style={{ fontSize: '10px', color: '#d1d5db', marginTop: '6px' }}>분석: {lastAnalyzed}</p>}
            </div>
          </div>

          {/* 탭 */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: '16px' }}>
            {([['overview', '개요'], ['detail', '상세'], ['plan', '플랜']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{ flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '12px', letterSpacing: '1px',
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

                {/* 5개 지표 점수 */}
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>지표별 점수</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {Object.entries(diagnosis.scores).map(([key, val]) => (
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

                {/* 잘하고 있는 점 */}
                {diagnosis.strengths.length > 0 && (
                  <div style={{ border: '1px solid #dcfce7', backgroundColor: '#f0fdf4', padding: '14px', marginBottom: '12px' }}>
                    <p style={{ fontSize: '9px', color: '#16a34a', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>✓ 잘하고 있어요</p>
                    {diagnosis.strengths.map((s, i) => (
                      <p key={i} style={{ fontSize: '12px', color: '#15803d', marginBottom: '4px', lineHeight: 1.5 }}>• {s}</p>
                    ))}
                  </div>
                )}

                {/* AI 메시지 */}
                <div style={{ border: '1px solid #e9d5ff', backgroundColor: '#faf5ff', padding: '16px' }}>
                  <p style={{ fontSize: '9px', color: '#6B21A8', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>AI 코치 메시지</p>
                  <p style={{ fontSize: '13px', color: '#4c1d95', lineHeight: 1.8 }}>{diagnosis.ai_message}</p>
                </div>
              </motion.div>
            )}

            {/* 상세 탭 */}
            {activeTab === 'detail' && (
              <motion.div key="detail" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                {/* 문제점 */}
                {diagnosis.issues.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>개선이 필요한 점</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {diagnosis.issues.map((issue, i) => (
                        <div key={i} style={{ border: `1px solid ${SEVERITY_COLOR[issue.severity]}30`, padding: '14px', borderLeft: `3px solid ${SEVERITY_COLOR[issue.severity]}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '8px', color: SEVERITY_COLOR[issue.severity], letterSpacing: '1px', textTransform: 'uppercase',
                              backgroundColor: `${SEVERITY_COLOR[issue.severity]}15`, padding: '2px 6px' }}>
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

                {/* 권장 사항 */}
                <div>
                  <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>실천 방법</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {diagnosis.recommendations.map((rec, i) => (
                      <div key={i} style={{ border: '1px solid #e5e7eb', padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase',
                            color: rec.priority === 'high' ? '#6B21A8' : '#6b7280',
                            backgroundColor: rec.priority === 'high' ? '#f3e8ff' : '#f3f4f6',
                            padding: '2px 6px' }}>
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
                  {diagnosis.weekly_plan.map((item, i) => {
                    const today = ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()];
                    const isToday = item.day === today;
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px',
                        backgroundColor: isToday ? '#faf5ff' : 'white',
                        border: isToday ? '1px solid #d8b4fe' : '1px solid #e5e7eb',
                      }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: isToday ? '#6B21A8' : '#9ca3af',
                          width: '20px', flexShrink: 0, paddingTop: '1px' }}>{item.day}</span>
                        <p style={{ fontSize: '12px', color: isToday ? '#4c1d95' : '#6b7280', lineHeight: 1.6 }}>{item.tip}</p>
                      </div>
                    );
                  })}
                </div>

                {/* 재분석 버튼 */}
                <button
                  onClick={handleAnalyze}
                  style={{ width: '100%', padding: '12px', backgroundColor: 'white', color: 'black',
                    border: '1px solid #e5e7eb', fontSize: '12px', letterSpacing: '1px', cursor: 'pointer' }}
                >
                  🔄 재분석
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* 로딩 완료 후 에러 */}
      {!loading && !diagnosis && error && (
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
