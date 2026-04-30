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
        let all: Meal[] = [];
        const local = localStorage.getItem('mybob_meals');
        if (local) all = JSON.parse(local);

        try {
          const res = await fetch('/api/meals');
          if (res.ok) {
            const r = await res.json();
            if (r.success && Array.isArray(r.data)) {
              const keys = new Set(r.data.map((m: Meal) => `${m.food_name}_${m.calories}`));
              all = [...r.data, ...all.filter(m => !keys.has(`${m.food_name}_${m.calories}`))];
            }
          }
        } catch { console.warn('Server fetch failed'); }

        setMeals(all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMeals();
  }, []);

  return (
    <div style={{
      height: 'calc(100svh - 65px)',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'white',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        padding: '24px 24px 16px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>TIMELINE</p>
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>기록</h1>
        </div>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaArrowLeft size={13} color="black" />
          </div>
        </Link>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px' }}>
            <div style={{ width: '24px', height: '24px', border: '2px solid #e5e7eb', borderTopColor: 'black', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9ca3af' }}>Loading...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', paddingTop: '40px' }}>
            <p style={{ color: '#ef4444', marginBottom: '12px', fontSize: '14px' }}>{error}</p>
            <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', backgroundColor: 'black', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px' }}>재시도</button>
          </div>
        ) : meals.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: '60px' }}>
            <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '12px' }}>기록된 식단이 없습니다.</p>
            <Link href="/capture" style={{ fontSize: '13px', color: '#6B21A8', textDecoration: 'none' }}>지금 기록 시작하기 →</Link>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '10px', top: '20px', bottom: '20px', width: '1px', backgroundColor: '#e5e7eb' }} />
            {meals.map((meal, i) => (
              <motion.div
                key={meal.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                style={{ display: 'flex', gap: '20px', marginBottom: '16px', position: 'relative' }}
              >
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1px solid #e5e7eb', backgroundColor: 'white', flexShrink: 0, marginTop: '12px', zIndex: 1 }} />
                <div style={{ flex: 1, border: '1px solid #e5e7eb', padding: '12px' }}>
                  <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                    {new Date(meal.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {meal.photo_url && (
                    <img src={meal.photo_url} alt={meal.food_name} style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block', marginBottom: '8px' }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 400, color: 'black' }}>{meal.food_name}</h3>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '15px', color: '#6B21A8', lineHeight: 1 }}>{meal.calories}</p>
                      <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px' }}>KCAL</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
