"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FaCamera, FaChartLine, FaHistory, FaCog, FaSignOutAlt, FaSpinner, FaLightbulb, FaCheckCircle, FaExclamationCircle, FaUtensils } from 'react-icons/fa';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
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
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants: Variants = {
  hidden: { y: 10, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 120 }
  }
};

export default function Home() {
  const router = useRouter();
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <motion.div 
      initial="hidden" animate="visible" variants={containerVariants}
      className="min-h-screen bg-slate-50 flex flex-col p-4"
    >
      <motion.header variants={itemVariants} className="w-full flex justify-between items-center py-4 mb-2">
        <h1 className="text-3xl font-black text-indigo-700 tracking-tighter">뭐먹었어</h1>
        <button onClick={handleLogout} className="text-slate-300 text-sm font-bold uppercase tracking-widest">Sign Out</button>
      </motion.header>

      <main className="w-full space-y-4">
        {/* 요약 카드 */}
        <motion.section variants={itemVariants} className="bg-white rounded-3xl shadow-sm p-6 border border-slate-100">
          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-5xl font-black text-slate-900 tracking-tighter">{todayStats.totalCalories}</span>
            <span className="text-lg font-bold text-slate-300 uppercase">kcal</span>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Carb', value: todayStats.nutrients.carbs, color: 'bg-indigo-500' },
              { label: 'Prot', value: todayStats.nutrients.protein, color: 'bg-rose-500' },
              { label: 'Fat', value: todayStats.nutrients.fat, color: 'bg-emerald-500' }
            ].map((nut) => (
              <div key={nut.label} className="bg-slate-50 p-2.5 rounded-2xl">
                <p className="text-[9px] text-slate-400 font-black uppercase mb-1">{nut.label}</p>
                <p className="text-sm font-black text-slate-800">{nut.value.toFixed(1)}g</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* AI 피드백 - 더 콤팩트하게 */}
        <motion.section variants={itemVariants} className="bg-indigo-600 rounded-3xl shadow-lg p-6 text-white overflow-hidden">
          <h2 className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2">
            <FaLightbulb className="text-yellow-300" /> AI Coach
          </h2>
          
          {loadingFeedback ? (
            <div className="py-2 flex justify-center"><FaSpinner className="animate-spin text-xl opacity-50" /></div>
          ) : aiFeedback ? (
            <div className="space-y-4">
              <p className="text-sm font-bold leading-snug">"{aiFeedback.feedback}"</p>
              
              <div className="grid grid-cols-1 gap-2 bg-white/10 rounded-2xl p-3">
                <div className="flex gap-2 items-center text-[10px]">
                  <FaCheckCircle className="text-emerald-400 flex-shrink-0" />
                  <p className="opacity-90">{aiFeedback.goodPoint}</p>
                </div>
                <div className="flex gap-2 items-center text-[10px]">
                  <FaExclamationCircle className="text-orange-400 flex-shrink-0" />
                  <p className="opacity-90">{aiFeedback.improvement}</p>
                </div>
              </div>

              <div className="bg-white text-indigo-700 p-4 rounded-2xl">
                <p className="text-[9px] font-black uppercase mb-1 opacity-50">Recommended</p>
                <p className="text-lg font-black">{aiFeedback.recommendation.menu}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 opacity-40"><p className="text-[10px] font-black uppercase">Ready for your meal</p></div>
          )}
        </motion.section>

        {/* 하단 바로가기 버튼 */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
          <Link href="/capture" className="bg-slate-900 text-white p-5 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-xl active:scale-95 transition-transform">
            <FaCamera className="text-xl" />
            <span className="text-[10px] font-black uppercase">Start Scan</span>
          </Link>
          <Link href="/history" className="bg-white text-slate-900 p-5 rounded-3xl flex flex-col items-center justify-center gap-2 border border-slate-100 shadow-sm active:scale-95 transition-transform">
            <FaHistory className="text-xl" />
            <span className="text-[10px] font-black uppercase">Timeline</span>
          </Link>
        </motion.div>
      </main>
    </motion.div>
  );
}
