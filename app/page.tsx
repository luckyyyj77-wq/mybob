"use client";

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { motion } from 'framer-motion';

type Meal = {
  id: string;
  food_name: string;
  calories: number;
  created_at: string;
  nutrient: { carbohydrates: number; protein: number; fat: number };
};

type DayStat = { date: string; calories: number; carbs: number; protein: number; fat: number };

type AIFeedback = {
  feedback: string;
  goodPoint: string;
  improvement: string;
  weeklyInsight?: string;
  recommendation: { menu: string; reason: string };
};

function computeTodayStats(meals: Meal[]) {
  const toKSTDate = (iso: string) => {
    const d = new Date(iso);
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  };
  const todayKST = toKSTDate(new Date().toISOString());
  const todayMeals = meals.filter(m => toKSTDate(m.created_at) === todayKST);
  const totalCalories = todayMeals.reduce((s, m) => s + (Number(m.calories) || 0), 0);
  const nutrients = todayMeals.reduce(
    (acc, m) => {
      acc.carbs   += Number(m.nutrient?.carbohydrates) || 0;
      acc.protein += Number(m.nutrient?.protein) || 0;
      acc.fat     += Number(m.nutrient?.fat) || 0;
      return acc;
    },
    { carbs: 0, protein: 0, fat: 0 }
  );
  return { totalCalories, mealNames: todayMeals.map(m => m.food_name), count: todayMeals.length, nutrients };
}

function buildWeekly(meals: Meal[]): DayStat[] {
  const toKSTDate = (iso: string) => {
    const d = new Date(iso);
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  };
  const weekly: DayStat[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayMeals = meals.filter(m => toKSTDate(m.created_at) === dateStr);
    weekly.push({
      date: dateStr,
      calories: dayMeals.reduce((s, m) => s + (Number(m.calories) || 0), 0),
      carbs:    dayMeals.reduce((s, m) => s + (Number(m.nutrient?.carbohydrates) || 0), 0),
      protein:  dayMeals.reduce((s, m) => s + (Number(m.nutrient?.protein) || 0), 0),
      fat:      dayMeals.reduce((s, m) => s + (Number(m.nutrient?.fat) || 0), 0),
    });
  }
  return weekly;
}

export default function Home() {
  const [todayStats, setTodayStats] = useState({
    totalCalories: 0,
    mealNames: [] as string[],
    count: 0,
    nutrients: { carbs: 0, protein: 0, fat: 0 },
  });
  const [aiFeedback, setAiFeedback] = useState<AIFeedback | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const aiFetchedRef = useRef(false);

  useEffect(() => {
    // 1단계: 로컬 데이터 즉시 렌더링 (블로킹 없음)
    const localRaw = localStorage.getItem('mybob_meals');
    const localMeals: Meal[] = localRaw ? JSON.parse(localRaw) : [];
    setTodayStats(computeTodayStats(localMeals));

    // 2단계: 서버 동기화 완료 후 최종 데이터로 AI 1회만 호출
    syncFromServer(localMeals);
  }, []);

  const syncFromServer = async (localMeals: Meal[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      let merged = localMeals;

      if (session?.access_token) {
        const res = await fetch('/api/meals', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const result = await res.json();
          if (result.success && Array.isArray(result.data)) {
            const serverIds = new Set(result.data.map((m: Meal) => m.id));
            const uniqueLocal = localMeals.filter(m => !serverIds.has(m.id));
            merged = [...result.data, ...uniqueLocal];
            localStorage.setItem('mybob_meals', JSON.stringify(merged));
            setTodayStats(computeTodayStats(merged));
          }
        }
      }

      // 서버 동기화 완료 후 AI 1회만 호출 (중복 방지)
      if (!aiFetchedRef.current) {
        const finalStats = computeTodayStats(merged);
        if (finalStats.count >= 5) {
          aiFetchedRef.current = true;
          const weekly = buildWeekly(merged);
          const goalData = JSON.parse(localStorage.getItem('mybob_goal') || '{"goal":"유지"}');
          fetchAI(finalStats, weekly, goalData);
        }
      }
    } catch { /* 서버 실패 시 로컬 데이터 유지 */ }
  };

  const fetchAI = async (stats: ReturnType<typeof computeTodayStats>, weekly: DayStat[], goalData: any) => {
    const todayKey = `mybob_coach_${new Date().toISOString().slice(0, 10)}`;

    // 1) 오늘치 일반 캐시 확인
    const cached = localStorage.getItem(todayKey);
    if (cached) {
      try {
        setAiFeedback(JSON.parse(cached));
        return;
      } catch { }
    }

    // 2) PRO 진단 캐시 확인
    const diagRaw = localStorage.getItem('mybob_diagnosis_cache');
    if (diagRaw) {
      try {
        const { result, plan } = JSON.parse(diagRaw);
        if ((plan === 'pro' || plan === 'lifetime') && result?.ai_message) {
          const fromDiag: AIFeedback = {
            feedback: result.ai_message,
            goodPoint: result.strengths?.[0] ?? '',
            improvement: result.issues?.[0]?.description ?? '',
            recommendation: {
              menu: result.recommendations?.[0]?.title ?? '',
              reason: result.recommendations?.[0]?.description ?? '',
            },
          };
          setAiFeedback(fromDiag);
          return;
        }
      } catch { }
    }

    // 3) API 호출 (캐시 없을 때)
    setLoadingFeedback(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/recommendation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          today: { calories: stats.totalCalories, ...stats.nutrients },
          weekly,
          goal: goalData,
        }),
      });
      const r = await res.json();
      if (r.success) {
        setAiFeedback(r.data);
        localStorage.setItem(todayKey, JSON.stringify(r.data));
      }
    } catch { } finally {
      setLoadingFeedback(false);
    }
  };

  return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden' }}>

      {/* Section 1: 인삿말 */}
      <motion.section
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
        style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '28px 28px 20px', borderBottom: '1px solid #e5e7eb' }}
      >
        <h1 style={{ fontSize: '26px', fontWeight: 400, color: 'black', letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: '8px' }}>
          무엇을 드시나요?
        </h1>
        {todayStats.count > 0 ? (
          <p style={{ fontSize: '12px', color: '#6B21A8', letterSpacing: '0.5px' }}>
            오늘 {todayStats.count}개의 식단이 기록되었습니다.
          </p>
        ) : (
          <p style={{ fontSize: '12px', color: '#9ca3af' }}>
            식단을 기록하고 분석을 시작하세요.
          </p>
        )}
      </motion.section>

      {/* Section 2: AI COACH */}
      <motion.section
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 28px', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <span style={{ fontSize: '16px' }}>💡</span>
          <h2 style={{ fontSize: '16px', fontWeight: 400, color: 'black', letterSpacing: '0.5px' }}>AI COACH</h2>
        </div>

        <ul style={{ display: 'flex', flexDirection: 'column', gap: '18px', listStyle: 'none', padding: 0, margin: 0 }}>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6B21A8', flexShrink: 0, marginTop: '5px' }} />
            <div>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>오늘 섭취 칼로리</p>
              <p style={{ fontSize: '24px', color: 'black', lineHeight: 1 }}>
                {todayStats.totalCalories} <span style={{ fontSize: '11px', color: '#9ca3af' }}>KCAL</span>
              </p>
            </div>
          </li>

          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#9ca3af', flexShrink: 0, marginTop: '5px' }} />
            <div>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>영양 밸런스</p>
              <div style={{ display: 'flex', gap: '14px' }}>
                <span style={{ fontSize: '13px', color: 'black' }}>탄 {todayStats.nutrients.carbs.toFixed(0)}g</span>
                <span style={{ fontSize: '13px', color: 'black' }}>단 {todayStats.nutrients.protein.toFixed(0)}g</span>
                <span style={{ fontSize: '13px', color: 'black' }}>지 {todayStats.nutrients.fat.toFixed(0)}g</span>
              </div>
            </div>
          </li>

          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#d1d5db', flexShrink: 0, marginTop: '5px' }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>코치 코멘트</p>
              {loadingFeedback ? (
                <div style={{ width: '14px', height: '14px', border: '1.5px solid black', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : aiFeedback ? (
                <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6 }}>"{aiFeedback.feedback}"</p>
              ) : (
                <p style={{ fontSize: '12px', color: '#9ca3af' }}>기록이 쌓이면 코칭이 시작됩니다.</p>
              )}
            </div>
          </li>
        </ul>
      </motion.section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
