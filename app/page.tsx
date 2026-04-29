"use client";

import { useEffect, useState } from 'react';
import { FaSpinner, FaLightbulb, FaCircle } from 'react-icons/fa';
import { supabase } from '@/lib/supabase/client';
import { motion, Variants } from 'framer-motion';

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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100 }
  }
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

        if (combinedData.length >= 0) {
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
        }
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
    <motion.div 
      initial="hidden" animate="visible" variants={containerVariants}
      className="min-h-screen bg-white flex flex-col"
    >
      <main className="flex-grow flex flex-col">
        {/* Section 1: 무엇을 드시나요? */}
        <motion.section 
          variants={itemVariants}
          className="flex-1 flex flex-col items-center justify-center border-b-2 border-slate-900 px-10"
        >
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-4">무엇을 드시나요?</h1>
          {todayStats.count > 0 ? (
            <div className="text-indigo-600 font-bold uppercase tracking-widest text-xs">
              오늘 {todayStats.count}개의 식단이 기록되었습니다.
            </div>
          ) : (
            <div className="text-slate-300 font-bold uppercase tracking-widest text-xs">
              식단을 기록하고 분석을 시작하세요.
            </div>
          )}
        </motion.section>

        {/* Section 2: AI COACH */}
        <motion.section 
          variants={itemVariants}
          className="flex-1 flex flex-col p-10 bg-slate-50/30"
        >
          <div className="max-w-md mx-auto w-full">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 mb-10">
              <FaLightbulb className="text-indigo-600" /> AI COACH
            </h2>

            <ul className="space-y-8">
              <li className="flex items-start gap-5">
                <FaCircle className="text-[8px] mt-2.5 text-indigo-400" />
                <div>
                  <p className="text-sm font-bold text-slate-400 tracking-wider uppercase mb-1">오늘섭취 칼로리</p>
                  <p className="text-4xl font-black text-slate-900">{todayStats.totalCalories} <span className="text-sm font-bold text-slate-300">KCAL</span></p>
                </div>
              </li>
              
              <li className="flex items-start gap-5">
                <FaCircle className="text-[8px] mt-2.5 text-rose-400" />
                <div>
                  <p className="text-sm font-bold text-slate-400 tracking-wider uppercase mb-1">영양밸런스</p>
                  <div className="flex gap-4">
                    <span className="text-sm font-black text-indigo-600">C {todayStats.nutrients.carbs.toFixed(0)}g</span>
                    <span className="text-sm font-black text-rose-600">P {todayStats.nutrients.protein.toFixed(0)}g</span>
                    <span className="text-sm font-black text-emerald-600">F {todayStats.nutrients.fat.toFixed(0)}g</span>
                  </div>
                </div>
              </li>

              <li className="flex items-start gap-5">
                <FaCircle className="text-[8px] mt-2.5 text-amber-400" />
                <div className="flex-grow">
                  <p className="text-sm font-bold text-slate-400 tracking-wider uppercase mb-1">AI 코치 코멘트</p>
                  {loadingFeedback ? (
                    <div className="h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mt-2" />
                  ) : aiFeedback ? (
                    <p className="text-base font-bold text-slate-700 leading-relaxed italic">
                      "{aiFeedback.feedback}"
                    </p>
                  ) : (
                    <p className="text-sm text-slate-300 font-medium">기록이 쌓이면 코칭이 시작됩니다.</p>
                  )}
                </div>
              </li>
            </ul>
          </div>
        </motion.section>
      </main>
    </motion.div>
  );
}
