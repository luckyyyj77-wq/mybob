"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FaArrowLeft, FaThList, FaThLarge, FaTh, FaPlus, FaMinus } from 'react-icons/fa';

type Meal = {
  id: string;
  food_name: string;
  calories: number;
  created_at: string;
  photo_url?: string;
  category?: string;
  nutrient?: any;
};

type ViewMode = 'full' | 'grid' | 'gallery';

export default function HistoryPage() {
  const router = useRouter();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('full');
  const [galleryScale, setGalleryScale] = useState(4);

  useEffect(() => {
    const fetchMeals = async () => {
      try {
        let allMeals: Meal[] = [];
        const localData = localStorage.getItem('mybob_meals');
        if (localData) allMeals = JSON.parse(localData);

        try {
          const response = await fetch('/api/meals');
          if (response.ok) {
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
              const serverKeys = new Set(result.data.map((m: Meal) => `${m.food_name}_${m.calories}`));
              const uniqueLocal = allMeals.filter(m => !serverKeys.has(`${m.food_name}_${m.calories}`));
              allMeals = [...result.data, ...uniqueLocal];
            }
          }
        } catch { console.warn('Server fetch failed, using local data only'); }

        setMeals(allMeals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMeals();
  }, []);

  const handleZoom = (delta: number) => {
    setGalleryScale(prev => Math.max(3, Math.min(6, prev + delta)));
  };

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '40px 32px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 400, color: '#9ca3af', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '6px' }}>TIMELINE</p>
          <h1 style={{ fontSize: '36px', fontWeight: 400, color: 'black', letterSpacing: '-1.5px', lineHeight: 1 }}>기록</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* 뷰 모드 버튼 */}
          <button
            onClick={() => setViewMode('full')}
            style={{ background: viewMode === 'full' ? 'black' : 'none', border: '1px solid #e5e7eb', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <FaThList size={13} color={viewMode === 'full' ? 'white' : 'black'} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            style={{ background: viewMode === 'grid' ? 'black' : 'none', border: '1px solid #e5e7eb', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <FaThLarge size={13} color={viewMode === 'grid' ? 'white' : 'black'} />
          </button>
          <button
            onClick={() => setViewMode('gallery')}
            style={{ background: viewMode === 'gallery' ? 'black' : 'none', border: '1px solid #e5e7eb', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <FaTh size={13} color={viewMode === 'gallery' ? 'white' : 'black'} />
          </button>
        </div>
      </div>

      {/* Gallery 줌 컨트롤 */}
      {viewMode === 'gallery' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 32px', gap: '8px', borderBottom: '1px solid #e5e7eb' }}>
          <button onClick={() => handleZoom(1)} style={{ background: 'none', border: '1px solid #e5e7eb', padding: '4px 10px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <FaPlus size={8} /> 축소
          </button>
          <button onClick={() => handleZoom(-1)} style={{ background: 'none', border: '1px solid #e5e7eb', padding: '4px 10px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <FaMinus size={8} /> 확대
          </button>
        </div>
      )}

      {/* Content */}
      <main style={{ flex: 1, padding: viewMode === 'full' ? '32px' : '0' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '80px', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid black', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '11px', fontWeight: 400, letterSpacing: '3px', textTransform: 'uppercase', color: '#9ca3af' }}>Loading...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', paddingTop: '60px' }}>
            <p style={{ color: '#ef4444', fontWeight: 400, marginBottom: '16px' }}>{error}</p>
            <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', backgroundColor: 'black', color: 'white', border: 'none', fontWeight: 400, cursor: 'pointer', fontSize: '12px', letterSpacing: '2px' }}>재시도</button>
          </div>
        ) : meals.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: '80px' }}>
            <p style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 600, marginBottom: '16px' }}>기록된 식단이 없습니다.</p>
            <Link href="/capture" style={{ fontSize: '13px', fontWeight: 400, color: '#6B21A8', textDecoration: 'none', letterSpacing: '1px' }}>지금 기록 시작하기 →</Link>
          </div>
        ) : (
          <AnimatePresence mode="wait">

            {/* ── 전체보기: 기존 타임라인 카드 ── */}
            {viewMode === 'full' && (
              <motion.div key="full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
              >
                {/* Timeline line */}
                <div style={{ position: 'absolute', left: '4px', top: '24px', bottom: '24px', width: '1px', backgroundColor: '#e5e7eb' }} />

                {meals.map((meal, index) => (
                  <motion.div
                    key={meal.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    style={{ display: 'flex', gap: '24px', marginBottom: '28px', position: 'relative' }}
                  >
                    {/* Timeline dot */}
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: '1px solid #d1d5db', backgroundColor: 'white', flexShrink: 0, marginTop: '20px', zIndex: 1 }} />

                    {/* Card */}
                    <div
                      onClick={() => router.push(`/history/${meal.id}`)}
                      style={{ flex: 1, border: '1px solid #e5e7eb', padding: '16px', backgroundColor: 'white', cursor: 'pointer' }}
                    >
                      <p style={{ fontSize: '10px', fontWeight: 400, color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
                        {new Date(meal.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {meal.photo_url && (
                        <div style={{ marginBottom: '12px', overflow: 'hidden' }}>
                          <img src={meal.photo_url} alt={meal.food_name} style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} />
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 400, color: 'black', letterSpacing: '-0.5px' }}>{meal.food_name}</h3>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '20px', fontWeight: 400, color: '#6B21A8', lineHeight: 1 }}>{meal.calories}</p>
                          <p style={{ fontSize: '10px', fontWeight: 400, color: '#9ca3af', letterSpacing: '1px' }}>KCAL</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* ── 4분할 보기: 상세페이지 grid4 모드로 이동 ── */}
            {viewMode === 'grid' && (
              <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px', backgroundColor: '#e5e7eb' }}
              >
                {meals.map(meal => (
                  <div key={meal.id} onClick={() => router.push(`/history/${meal.id}?mode=grid4`)}
                    style={{ position: 'relative', width: '100%', aspectRatio: '1/1', backgroundColor: '#f3f4f6', cursor: 'pointer', overflow: 'hidden' }}
                  >
                    {meal.photo_url && <img src={meal.photo_url} alt={meal.food_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 4px rgba(0,0,0,0.6)', fontWeight: 400 }}>
                        {meal.calories}
                      </span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* ── 여러개 보기 (갤러리): 상세페이지 grid16 모드로 이동 ── */}
            {viewMode === 'gallery' && (
              <motion.div key="gallery" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'grid', gridTemplateColumns: `repeat(${galleryScale}, 1fr)`, gap: '1px', backgroundColor: '#e5e7eb' }}
              >
                {meals.map(meal => (
                  <div key={meal.id} onClick={() => router.push(`/history/${meal.id}?mode=grid16`)}
                    style={{ width: '100%', aspectRatio: '1/1', backgroundColor: '#f3f4f6', cursor: 'pointer', overflow: 'hidden' }}
                  >
                    {meal.photo_url && <img src={meal.photo_url} alt={meal.food_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                ))}
              </motion.div>
            )}

          </AnimatePresence>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
