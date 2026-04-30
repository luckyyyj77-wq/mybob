"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { motion } from 'framer-motion';

type Meal = {
  id: string;
  food_name: string;
  calories: number;
  created_at: string;
  nutrient: {
    carbohydrates: number;
    protein: number;
    fat: number;
  };
};

type AIFeedback = {
  feedback: string;
  goodPoint: string;
  improvement: string;
  recommendation: {
    menu: string;
    reason: string;
  };
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [todayStats, setTodayStats] = useState({
    totalCalories: 0,
    mealNames: [] as string[],
    count: 0,
    nutrients: { carbs: 0, protein: 0, fat: 0 }
  });
  const [aiFeedback, setAiFeedback] = useState<AIFeedback | null>(null);

  useEffect(() => {
    const fetchTodayData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let combinedData: Meal[] = [];
        const localData = localStorage.getItem('mybob_meals');
        if (localData) combinedData = JSON.parse(localData);

        try {
          const response = await fetch('/api/meals', { headers });
          const result = await response.json();
          if (result.success && Array.isArray(result.data)) {
            const serverMeals = result.data;
            const serverKeys = new Set(serverMeals.map((m: Meal) => `${m.food_name}_${m.calories}`));
            const uniqueLocal = combinedData.filter(m => !serverKeys.has(`${m.food_name}_${m.calories}`));
            combinedData = [...serverMeals, ...uniqueLocal];
          }
        } catch (err) { console.warn("Server fetch failed"); }

        const now = new Date();
        const todayStr = now.toLocaleDateString();
        const todayMeals = combinedData.filter((meal: Meal) => new Date(meal.created_at).toLocaleDateString() === todayStr);
        const totalCalories = todayMeals.reduce((sum, meal) => sum + (Number(meal.calories) || 0), 0);
        const totalNutrients = todayMeals.reduce((acc, meal) => {
          acc.carbs += Number(meal.nutrient?.carbohydrates) || 0;
          acc.protein += Number(meal.nutrient?.protein) || 0;
          acc.fat += Number(meal.nutrient?.fat) || 0;
          return acc;
        }, { carbs: 0, protein: 0, fat: 0 });

        const stats = {
          totalCalories,
          mealNames: todayMeals.map(m => m.food_name),
          count: todayMeals.length,
          nutrients: totalNutrients
        };
        setTodayStats(stats);
        if (todayMeals.length > 0) getAIFeedback(stats);
      } catch (error) { console.error('Error:', error); } finally { setLoading(false); }
    };

    const getAIFeedback = async (stats: any) => {
      setLoadingFeedback(true);
      try {
        const response = await fetch('/api/recommendation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nutrients: { calories: stats.totalCalories, ...stats.nutrients } }),
        });
        const result = await response.json();
        if (result.success) setAiFeedback(result.data);
      } catch (error) { console.error('AI Error:', error); } finally { setLoadingFeedback(false); }
    };

    fetchTodayData();
  }, []);

  if (loading) return null;

  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>

      {/* Section 1: 무엇을 드시나요? */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '40px 32px',
          borderBottom: '4px solid black',
        }}
      >
        <h1 style={{
          fontSize: '32px',
          fontWeight: 900,
          color: 'black',
          letterSpacing: '-1px',
          lineHeight: 1.1,
          marginBottom: '16px',
        }}>
          무엇을 드시나요?
        </h1>
        {todayStats.count > 0 ? (
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#6B21A8', letterSpacing: '1px' }}>
            오늘 {todayStats.count}개의 식단이 기록되었습니다.
          </p>
        ) : (
          <p style={{ fontSize: '13px', fontWeight: 500, color: '#9ca3af' }}>
            식단을 기록하고 분석을 시작하세요.
          </p>
        )}
      </motion.section>

      {/* Section 2: AI COACH */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '40px 32px',
          backgroundColor: 'white',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
          <span style={{ fontSize: '20px' }}>&#128161;</span>
          <h2 style={{ fontSize: '22px', fontWeight: 900, color: 'black', letterSpacing: '-0.5px' }}>
            AI COACH
          </h2>
        </div>

        <ul style={{ display: 'flex', flexDirection: 'column', gap: '20px', listStyle: 'none', padding: 0, margin: 0 }}>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6B21A8', flexShrink: 0, marginTop: '6px' }} />
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
                오늘섭취 칼로리
              </p>
              <p style={{ fontSize: '28px', fontWeight: 900, color: 'black', lineHeight: 1 }}>
                {todayStats.totalCalories} <span style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af' }}>KCAL</span>
              </p>
            </div>
          </li>

          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#9ca3af', flexShrink: 0, marginTop: '6px' }} />
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
                영양밸런스
              </p>
              <div style={{ display: 'flex', gap: '16px' }}>
                <span style={{ fontSize: '14px', fontWeight: 900, color: 'black' }}>탄 {todayStats.nutrients.carbs.toFixed(0)}g</span>
                <span style={{ fontSize: '14px', fontWeight: 900, color: 'black' }}>단 {todayStats.nutrients.protein.toFixed(0)}g</span>
                <span style={{ fontSize: '14px', fontWeight: 900, color: 'black' }}>지 {todayStats.nutrients.fat.toFixed(0)}g</span>
              </div>
            </div>
          </li>

          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d1d5db', flexShrink: 0, marginTop: '6px' }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
                코치 코멘트
              </p>
              {loadingFeedback ? (
                <div style={{ width: '16px', height: '16px', border: '2px solid black', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : aiFeedback ? (
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', lineHeight: 1.6 }}>
                  "{aiFeedback.feedback}"
                </p>
              ) : (
                <p style={{ fontSize: '13px', color: '#9ca3af' }}>기록이 쌓이면 코칭이 시작됩니다.</p>
              )}
            </div>
          </li>
        </ul>
      </motion.section>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
