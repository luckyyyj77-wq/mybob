"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FaCamera, FaChartLine, FaHistory, FaUsers, FaCog, FaSignOutAlt, FaSpinner, FaLightbulb, FaCheckCircle, FaExclamationCircle, FaUtensils } from 'react-icons/fa';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
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

        const response = await fetch('/api/meals', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
          const now = new Date();
          const todayStr = now.toLocaleDateString();
          
          const todayMeals = result.data.filter((meal: Meal) => {
            const mealDate = new Date(meal.created_at).toLocaleDateString();
            return mealDate === todayStr;
          });

          const totalCalories = todayMeals.reduce((sum: number, meal: Meal) => sum + (Number(meal.calories) || 0), 0);
          const totalNutrients = todayMeals.reduce((acc, meal) => {
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
      className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center p-4 sm:p-6 md:p-8"
    >
      <motion.header variants={itemVariants} className="w-full max-w-4xl text-center py-6">
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-blue-600 mb-2">뭐먹었어</h1>
        <p className="text-xl text-indigo-500 font-medium">내 손안의 똑똑한 AI 영양사</p>
      </motion.header>

      <main className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        {/* 오늘의 섭취 기록 */}
        <motion.section variants={itemVariants} className="bg-white/70 backdrop-blur-md rounded-3xl shadow-xl p-8 border border-white/40">
          <h2 className="text-2xl font-black text-gray-800 mb-6 uppercase tracking-wider">Today's Summary</h2>
          {loading ? (
            <div className="flex flex-col items-center py-10">
              <FaSpinner className="animate-spin text-4xl text-indigo-400 mb-4" />
              <p className="text-indigo-400 font-medium italic">Analyzing your intake...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-200">
                <p className="text-indigo-100 text-xs font-bold uppercase mb-1 tracking-widest">Total Energy</p>
                <p className="text-5xl font-black text-white">{todayStats.totalCalories} <span className="text-xl font-light">kcal</span></p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Carbs', value: todayStats.nutrients.carbs, color: 'bg-yellow-400', textColor: 'text-yellow-900' },
                  { label: 'Protein', value: todayStats.nutrients.protein, color: 'bg-rose-400', textColor: 'text-rose-900' },
                  { label: 'Fat', value: todayStats.nutrients.fat, color: 'bg-blue-400', textColor: 'text-blue-900' }
                ].map((nut) => (
                  <div key={nut.label} className={`${nut.color} bg-opacity-10 p-3 rounded-xl border border-white`}>
                    <p className={`text-[10px] ${nut.textColor} font-black uppercase mb-1`}>{nut.label}</p>
                    <p className={`text-lg font-black ${nut.textColor}`}>{nut.value.toFixed(1)}g</p>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50/50 p-4 rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-[10px] font-bold uppercase mb-2">Today's Menu</p>
                <p className="text-gray-700 font-bold leading-relaxed">
                  {todayStats.count > 0 ? todayStats.mealNames.join(', ') : 'No meals recorded today yet.'}
                </p>
              </div>
            </div>
          )}
          <Link href="/history">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-8 w-full py-4 bg-gray-900 text-white rounded-2xl shadow-xl hover:bg-black text-lg font-black transition-all"
            >
              VIEW FULL HISTORY
            </motion.button>
          </Link>
        </motion.section>

        {/* AI 영양사 피드백 카드 */}
        <motion.section variants={itemVariants} className="bg-white/70 backdrop-blur-md rounded-3xl shadow-xl p-8 border border-white/40 flex flex-col">
          <h2 className="text-2xl font-black text-gray-800 mb-6 uppercase tracking-wider flex items-center">
            <FaLightbulb className="mr-3 text-yellow-500" /> AI Coach
          </h2>
          
          {loadingFeedback ? (
            <div className="flex flex-col items-center justify-center flex-grow py-10">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              >
                <FaSpinner className="text-5xl text-teal-400 mb-4" />
              </motion.div>
              <p className="text-teal-600 font-black animate-pulse uppercase text-xs tracking-widest">Generating Insight...</p>
            </div>
          ) : aiFeedback ? (
            <div className="space-y-6 flex-grow">
              <motion.div 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="bg-white p-5 rounded-2xl shadow-sm border border-teal-50"
              >
                <p className="text-teal-900 font-bold leading-relaxed">"{aiFeedback.feedback}"</p>
              </motion.div>
              
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center bg-green-50/50 p-3 rounded-xl">
                  <FaCheckCircle className="text-green-500 mr-3 text-xl" />
                  <p className="text-gray-700 text-xs"><span className="font-black text-green-700 uppercase mr-2">Good</span> {aiFeedback.goodPoint}</p>
                </div>
                <div className="flex items-center bg-orange-50/50 p-3 rounded-xl">
                  <FaExclamationCircle className="text-orange-500 mr-3 text-xl" />
                  <p className="text-gray-700 text-xs"><span className="font-black text-orange-700 uppercase mr-2">Tip</span> {aiFeedback.improvement}</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-purple-200">
                <p className="text-[10px] font-black uppercase mb-2 opacity-80 flex items-center">
                  <FaUtensils className="mr-1" /> Next Meal Recommendation
                </p>
                <p className="text-2xl font-black mb-1">{aiFeedback.recommendation.menu}</p>
                <p className="text-xs opacity-90 leading-tight font-medium">{aiFeedback.recommendation.reason}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-grow py-10 text-center">
              <div className="bg-gray-50 p-8 rounded-full mb-6 border border-white">
                <FaCamera className="text-5xl text-gray-200" />
              </div>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Ready to analyze<br/>your first meal</p>
            </div>
          )}
          
          <Link href="/capture" className="mt-auto pt-6">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 bg-teal-500 text-white rounded-2xl shadow-xl hover:bg-teal-600 text-lg font-black transition-all"
            >
              RECORD MEAL
            </motion.button>
          </Link>
        </motion.section>
      </main>

      {/* Main Navigation */}
      <motion.nav variants={itemVariants} className="w-full max-w-4xl grid grid-cols-5 gap-4 mt-12 pb-10">
        {[
          { icon: FaCamera, label: 'Capture', href: '/capture', color: 'text-indigo-600' },
          { icon: FaChartLine, label: 'Report', href: '/report/daily', color: 'text-green-600' },
          { icon: FaHistory, label: 'History', href: '/history', color: 'text-purple-600' },
          { icon: FaUsers, label: 'Social', href: '/community/recommendation', color: 'text-orange-600' },
          { icon: FaCog, label: 'Settings', href: '/settings', color: 'text-gray-600' }
        ].map((nav) => (
          <Link key={nav.label} href={nav.href}>
            <motion.div 
              whileHover={{ y: -5, backgroundColor: "rgba(255, 255, 255, 1)" }}
              className="flex flex-col items-center justify-center p-4 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm border border-white transition-colors group cursor-pointer"
            >
              <nav.icon className={`text-2xl mb-2 ${nav.color} group-hover:scale-110 transition-transform`} />
              <span className="text-[10px] font-black uppercase tracking-tighter text-gray-400 group-hover:text-gray-800">{nav.label}</span>
            </motion.div>
          </Link>
        ))}
      </motion.nav>

      <motion.button
        variants={itemVariants}
        onClick={handleLogout}
        whileHover={{ opacity: 1 }}
        className="mb-10 flex items-center px-6 py-2 bg-red-50 text-red-500 rounded-full text-xs font-black opacity-60 transition-all uppercase tracking-widest"
      >
        <FaSignOutAlt className="mr-2" /> Sign Out
      </motion.button>
    </motion.div>
  );
}
