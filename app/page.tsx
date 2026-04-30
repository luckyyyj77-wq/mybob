"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { motion } from 'framer-motion';

type Meal = {
  id: string;
  food_name: string;
  calories: number;
  created_at: string;
  nutrient: { carbohydrates: number; protein: number; fat: number };
};

type AIFeedback = {
  feedback: string;
  goodPoint: string;
  improvement: string;
  recommendation: { menu: string; reason: string };
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [todayStats, setTodayStats] = useState({
    totalCalories: 0,
    mealNames: [] as string[],
    count: 0,
    nutrients: { carbs: 0, protein: 0, fat: 0 },
  });
  const [aiFeedback, setAiFeedback] = useState<AIFeedback | null>(null);

  useEffect(() => {
    const fetchTodayData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let combined: Meal[] = [];
        const local = localStorage.getItem('mybob_meals');
        if (local) combined = JSON.parse(local);

        try {
          const res = await fetch('/api/meals', { headers });
          const r = await res.json();
          if (r.success && Array.isArray(r.data)) {
            const keys = new Set(r.data.map((m: Meal) => `${m.food_name}_${m.calories}`));
            combined = [...r.data, ...combined.filter(m => !keys.has(`${m.food_name}_${m.calories}`))];
          }
        } catch { console.warn('Server fetch failed'); }

        const todayStr = new Date().toLocaleDateString();
        const todayMeals = combined.filter(m => new Date(m.created_at).toLocaleDateString() === todayStr);
        const totalCalories = todayMeals.reduce((s, m) => s + (Number(m.calories) || 0), 0);
        const nutrients = todayMeals.reduce((acc, m) => {
          acc.carbs += Number(m.nutrient?.carbohydrates) || 0;
          acc.protein += Number(m.nutrient?.protein) || 0;
          acc.fat += Number(m.nutrient?.fat) || 0;
          return acc;
        }, { carbs: 0, protein: 0, fat: 0 });

        const stats = { totalCalories, mealNames: todayMeals.map(m => m.food_name), count: todayMeals.length, nutrients };
        setTodayStats(stats);
        if (todayMeals.length > 0) getAIFeedback(stats);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const getAIFeedback = async (stats: any) => {
      setLoadingFeedback(true);
      try {
        const res = await fetch('/api/recommendation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nutrients: { calories: stats.totalCalories, ...stats.nutrients } }),
        });
        const r = await res.json();
        if (r.success) setAiFeedback(r.data);
      } catch { } finally { setLoadingFeedback(false); }
    };

    fetchTodayData();
  }, []);

  if (loading) return null;

  return (
    /* 바텀 네비(65px)를 뺀 남은 높이를 꽉 채움 */
    <div style={{
      height: 'calc(100svh - 65px)',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'white',
      overflow: 'hidden',
    }}>
      {/* Section 1 */}
      <motion.section
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
        style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 28px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <h1 style={{ fontSize: '26px', fontWeight: 400, color: 'black', letterSpacing: '-0.3px', lineHeight: 1.2, marginBottom: '10px' }}>
          무엇을 드시나요?
        </h1>
        {todayStats.count > 0 ? (
          <p style={{ fontSize: '13px', color: '#6B21A8' }}>오늘 {todayStats.count}개의 식단이 기록되었습니다.</p>
        ) : (
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>식단을 기록하고 분석을 시작하세요.</p>
        )}
      </motion.section>

      {/* Section 2: AI COACH */}
      <motion.section
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}
        style={{
          flex: 2,
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <span style={{ fontSize: '16px' }}>💡</span>
          <h2 style={{ fontSize: '16px', fontWeight: 400, color: 'black' }}>AI COACH</h2>
        </div>

        <ul style={{ display: 'flex', flexDirection: 'column', gap: '16px', listStyle: 'none', padding: 0, margin: 0 }}>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6B21A8', flexShrink: 0, marginTop: '5px' }} />
            <div>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '3px' }}>오늘 섭취 칼로리</p>
              <p style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>
                {todayStats.totalCalories} <span style={{ fontSize: '11px', color: '#9ca3af' }}>KCAL</span>
              </p>
            </div>
          </li>

          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#9ca3af', flexShrink: 0, marginTop: '5px' }} />
            <div>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '3px' }}>영양 밸런스</p>
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
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '3px' }}>코치 코멘트</p>
              {loadingFeedback ? (
                <div style={{ width: '14px', height: '14px', border: '1.5px solid #d1d5db', borderTopColor: 'black', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : aiFeedback ? (
                <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>"{aiFeedback.feedback}"</p>
              ) : (
                <p style={{ fontSize: '13px', color: '#9ca3af' }}>기록이 쌓이면 코칭이 시작됩니다.</p>
              )}
            </div>
          </li>
        </ul>
      </motion.section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
