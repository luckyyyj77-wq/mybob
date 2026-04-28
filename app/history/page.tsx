"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FaSpinner, FaCalendarAlt, FaUtensils, FaArrowLeft, FaHistory } from 'react-icons/fa';
import { motion, AnimatePresence, Variants } from 'framer-motion';

type Meal = {
  id: string;
  food_name: string;
  calories: number;
  created_at: string;
  photo_url?: string;
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 100 }
  }
};

export default function HistoryPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMeals = async () => {
      try {
        const response = await fetch('/api/meals');
        if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
        const data = await response.json();
        
        if (data.success && Array.isArray(data.data)) {
            const sortedMeals = data.data.sort((a: Meal, b: Meal) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            setMeals(sortedMeals);
        } else {
            setMeals([]);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMeals();
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-4 sm:p-8">
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto text-center mb-16 pt-8"
      >
        <div className="inline-block p-4 bg-indigo-500/10 rounded-3xl mb-6 border border-indigo-500/20">
          <FaHistory className="text-4xl text-indigo-400" />
        </div>
        <h1 className="text-5xl font-black mb-2 tracking-tighter">HISTORY</h1>
        <p className="text-slate-400 font-medium uppercase tracking-widest text-xs">나의 모든 식단 기록</p>
      </motion.header>
      
      <main className="max-w-2xl mx-auto">
        {loading ? (
          <div className="flex flex-col justify-center items-center py-20 text-indigo-400">
            <FaSpinner className="animate-spin text-4xl mb-4" />
            <span className="font-black text-xs tracking-widest uppercase">Loading Timeline...</span>
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-red-500/10 rounded-3xl border border-red-500/20">
            <p className="text-red-400 font-bold mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-500 text-white rounded-full text-xs font-black">RETRY</button>
          </div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {meals.length > 0 ? (
              meals.map((meal) => (
                <motion.div 
                  key={meal.id} 
                  variants={itemVariants}
                  whileHover={{ x: 10 }}
                  className="group relative flex gap-6"
                >
                  {/* Timeline Line */}
                  <div className="absolute left-[19px] top-10 bottom-[-40px] w-0.5 bg-slate-800 group-last:hidden" />
                  
                  {/* Timeline Dot */}
                  <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-slate-800 border-4 border-[#0f172a] flex items-center justify-center group-hover:bg-indigo-500 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-slate-600 group-hover:bg-white" />
                  </div>

                  {/* Content Card */}
                  <div className="flex-grow bg-slate-800/40 backdrop-blur-sm rounded-[2rem] border border-slate-700/50 p-6 shadow-xl group-hover:bg-slate-800/60 transition-all">
                    <div className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
                      <FaCalendarAlt className="mr-2" />
                      <span>{new Date(meal.created_at).toLocaleString('ko-KR')}</span>
                    </div>

                    {meal.photo_url && (
                      <div className="mb-6 rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
                        <img 
                          src={meal.photo_url} 
                          alt={meal.food_name} 
                          className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    )}
                    
                    <div className="flex justify-between items-end">
                      <div>
                        <h3 className="text-2xl font-black text-white group-hover:text-indigo-400 transition-colors mb-1">{meal.food_name}</h3>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-tighter">Recorded Successfully</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-teal-400 mb-[-4px]">{meal.calories}</p>
                        <p className="text-[10px] font-black text-slate-500 uppercase">kcal</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-20 bg-slate-800/20 rounded-[3rem] border border-dashed border-slate-700">
                <p className="text-slate-500 font-bold uppercase tracking-widest text-sm mb-2">No records found</p>
                <Link href="/capture" className="text-indigo-400 hover:text-indigo-300 font-black text-xs underline">START RECORDING NOW</Link>
              </div>
            )}
          </motion.div>
        )}
      </main>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center mt-20 pb-20"
      >
        <Link href="/">
          <button className="inline-flex items-center px-8 py-4 bg-white text-slate-900 font-black rounded-full shadow-2xl hover:scale-105 transition-transform active:scale-95 text-sm uppercase">
            <FaArrowLeft className="mr-3" /> Dashboard
          </button>
        </Link>
      </motion.div>
    </div>
  );
}
