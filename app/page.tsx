"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FaCamera, FaChartLine, FaHistory, FaUsers, FaCog, FaSignOutAlt, FaSpinner, FaLightbulb, FaCheckCircle, FaExclamationCircle, FaUtensils } from 'react-icons/fa';
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
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100
    }
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
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        let combinedData: Meal[] = [];

        // 1. Get Local Data
        const localData = localStorage.getItem('mybob_meals');
        if (localData) {
          combinedData = JSON.parse(localData);
        }

        // 2. Try Server Data
        try {
          const response = await fetch('/api/meals', { headers });
          const result = await response.json();
          if (result.success && Array.isArray(result.data)) {
            const serverMeals = result.data;
            const serverKeys = new Set(serverMeals.map((m: Meal) => `${m.food_name}_${m.calories}`));
            const uniqueLocal = combinedData.filter(m => !serverKeys.has(`${m.food_name}_${m.calories}`));
            combinedData = [...serverMeals, ...uniqueLocal];
          }
        } catch (err) {
          console.warn("Server stats failed, using local only");
        }

        if (combinedData.length >= 0) {
          const now = new Date();
          const todayStr = now.toLocaleDateString();
          
          const todayMeals = combinedData.filter((meal: Meal) => {
            const mealDate = new Date(meal.created_at).toLocaleDateString();
            return mealDate === todayStr;
          });

          const totalCalories = todayMeals.reduce((sum: number, meal: Meal) => sum + (Number(meal.calories) || 0), 0);
          const totalNutrients = todayMeals.reduce((acc: { carbs: number, protein: number, fat: number }, meal: Meal) => {
            acc.carbs += Number(meal.nutrient?.carbohydrates) || 0;
            acc.protein += Number(meal.nutrient?.protein) || 0;
            acc.fat += Number(meal.nutrient?.fat) || 0;
            return acc;
          }, { carbs: 0, protein: 0, fat: 0 });

          const stats = {
            totalCalories,
            mealNames: todayMeals.map((meal: Meal) => meal.food_name),
            count: todayMeals.length,
            nutrients: totalNutrients
          };

          setTodayStats(stats);
          if (todayMeals.length > 0) getAIFeedback(stats);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    const getAIFeedback = async (stats: any) => {
      setLoadingFeedback(true);
      try {
        const response = await fetch('/api/recommendation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nutrients: { 
            calories: stats.totalCalories, 
            ...stats.nutrients 
          } }),
        });
        const result = await response.json();
        if (result.success) setAiFeedback(result.data);
      } catch (error) {
        console.error('AI Feedback Error:', error);
      } finally {
        setLoadingFeedback(false);
      }
    };

    fetchTodayData();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) router.push('/auth/login');
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="min-h-screen bg-slate-50 flex flex-col p-4 pb-12"
    >
      <motion.header variants={itemVariants} className="w-full flex justify-between items-center py-6 px-2">
        <div>
          <h1 className="text-3xl font-black text-indigo-700 tracking-tighter">뭐먹었어</h1>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">AI Nutritionist</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleLogout}
          className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-400"
        >
          <FaSignOutAlt />
        </motion.button>
      </motion.header>

      <main className="w-full space-y-6">
        {/* 오늘의 섭취 기록 */}
        <motion.section variants={itemVariants} className="bg-white rounded-[2.5rem] shadow-sm p-8 border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Today</h2>
            <Link href="/history" className="text-xs font-black text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-full uppercase">Details</Link>
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center py-10">
              <FaSpinner className="animate-spin text-3xl text-indigo-400 mb-4" />
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Calculating...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black text-slate-900 tracking-tighter">{todayStats.totalCalories}</span>
                <span className="text-xl font-bold text-slate-300">kcal</span>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Carbs', value: todayStats.nutrients.carbs, color: 'bg-indigo-600' },
                  { label: 'Protein', value: todayStats.nutrients.protein, color: 'bg-rose-500' },
                  { label: 'Fat', value: todayStats.nutrients.fat, color: 'bg-emerald-500' }
                ].map((nut) => (
                  <div key={nut.label} className="bg-slate-50 p-3 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-tighter">{nut.label}</p>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-black text-slate-800">{nut.value.toFixed(1)}g</p>
                      <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full ${nut.color}`} style={{ width: `${Math.min(nut.value * 2, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {todayStats.mealNames.length > 0 ? todayStats.mealNames.map((name, idx) => (
                  <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg">{name}</span>
                )) : (
                   <p className="text-slate-300 text-xs font-bold italic">No meals recorded yet</p>
                )}
              </div>
            </div>
          )}
        </motion.section>

        {/* AI 영양사 피드백 카드 */}
        <motion.section variants={itemVariants} className="bg-indigo-700 rounded-[2.5rem] shadow-xl p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <FaUtensils className="text-8xl transform rotate-12" />
          </div>
          
          <h2 className="text-xl font-black mb-6 uppercase tracking-tight flex items-center relative z-10">
            Coach Insight
          </h2>
          
          {loadingFeedback ? (
            <div className="flex flex-col items-center py-6">
              <FaSpinner className="animate-spin text-3xl mb-4 opacity-50" />
            </div>
          ) : aiFeedback ? (
            <div className="space-y-6 relative z-10">
              <p className="text-lg font-bold leading-tight opacity-95">"{aiFeedback.feedback}"</p>
              
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <FaCheckCircle className="text-emerald-400 mt-1" />
                  <p className="text-xs font-medium leading-normal"><span className="font-black text-emerald-300 uppercase mr-1">Best:</span> {aiFeedback.goodPoint}</p>
                </div>
                <div className="flex items-start gap-3">
                  <FaExclamationCircle className="text-orange-400 mt-1" />
                  <p className="text-xs font-medium leading-normal"><span className="font-black text-orange-300 uppercase mr-1">Focus:</span> {aiFeedback.improvement}</p>
                </div>
              </div>

              <div className="bg-white text-indigo-700 p-5 rounded-3xl shadow-lg">
                <p className="text-[10px] font-black uppercase mb-1 opacity-60">Recommendation</p>
                <p className="text-xl font-black mb-1">{aiFeedback.recommendation.menu}</p>
                <p className="text-[10px] font-bold leading-tight opacity-80">{aiFeedback.recommendation.reason}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 opacity-60 relative z-10">
              <FaLightbulb className="text-4xl mx-auto mb-4" />
              <p className="text-xs font-bold uppercase tracking-widest">Waiting for data...</p>
            </div>
          )}
        </motion.section>

        <Link href="/capture" className="block">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-6 bg-slate-900 text-white rounded-[2rem] shadow-xl text-xl font-black transition-all flex items-center justify-center gap-4"
          >
            <FaCamera />
            SCAN NEW MEAL
          </motion.button>
        </Link>
      </main>
    </motion.div>
  );
}
}
