"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaArrowLeft } from 'react-icons/fa';

type Meal = {
  id: string;
  food_name: string;
  calories: number;
  created_at: string;
  photo_url?: string;
};

export default function HistoryPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMeals = async () => {
      try {
        let allMeals: Meal[] = [];

        const localData = localStorage.getItem('mybob_meals');
        if (localData) {
          allMeals = JSON.parse(localData);
        }

        try {
          const response = await fetch('/api/meals');
          if (response.ok) {
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
              const serverMeals = result.data;
              const serverKeys = new Set(serverMeals.map((m: Meal) => `${m.food_name}_${m.calories}`));
              const uniqueLocal = allMeals.filter(m => !serverKeys.has(`${m.food_name}_${m.calories}`));
              allMeals = [...serverMeals, ...uniqueLocal];
            }
          }
        } catch (serverErr) {
          console.warn("Server fetch failed, using local data only:", serverErr);
        }

        const sortedMeals = allMeals.sort((a: Meal, b: Meal) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setMeals(sortedMeals);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMeals();
  }, []);

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '40px 32px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
            TIMELINE
          </p>
          <h1 style={{ fontSize: '30px', fontWeight: 400, color: 'black', letterSpacing: '-0.5px', lineHeight: 1 }}>
            기록
          </h1>
        </div>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{
            padding: '10px 16px',
            border: '1px solid #e5e7eb',
            fontSize: '12px',
            color: 'black',
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <FaArrowLeft size={10} /> 홈
          </div>
        </Link>
      </div>

      {/* Content */}
      <main style={{ flex: 1, padding: '32px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '80px', gap: '12px' }}>
            <div style={{ width: '28px', height: '28px', border: '2px solid #e5e7eb', borderTopColor: 'black', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9ca3af' }}>Loading...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', paddingTop: '60px' }}>
            <p style={{ color: '#ef4444', marginBottom: '16px' }}>{error}</p>
            <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', backgroundColor: 'black', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px', letterSpacing: '1px' }}>
              재시도
            </button>
          </div>
        ) : meals.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: '80px' }}>
            <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px' }}>기록된 식단이 없습니다.</p>
            <Link href="/capture" style={{ fontSize: '13px', color: '#6B21A8', textDecoration: 'none' }}>
              지금 기록 시작하기 →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Timeline line */}
            <div style={{ position: 'absolute', left: '11px', top: '24px', bottom: '24px', width: '1px', backgroundColor: '#e5e7eb' }} />

            {meals.map((meal, index) => (
              <motion.div
                key={meal.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                style={{ display: 'flex', gap: '24px', marginBottom: '24px', position: 'relative' }}
              >
                {/* Timeline dot */}
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  border: '1px solid #e5e7eb',
                  backgroundColor: 'white',
                  flexShrink: 0,
                  marginTop: '14px',
                  zIndex: 1,
                }} />

                {/* Card */}
                <div style={{
                  flex: 1,
                  border: '1px solid #e5e7eb',
                  padding: '16px',
                  backgroundColor: 'white',
                }}>
                  <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
                    {new Date(meal.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>

                  {meal.photo_url && (
                    <div style={{ marginBottom: '12px', overflow: 'hidden' }}>
                      <img
                        src={meal.photo_url}
                        alt={meal.food_name}
                        style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <h3 style={{ fontSize: '17px', fontWeight: 400, color: 'black' }}>
                      {meal.food_name}
                    </h3>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '18px', fontWeight: 400, color: '#6B21A8', lineHeight: 1 }}>{meal.calories}</p>
                      <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px' }}>KCAL</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
