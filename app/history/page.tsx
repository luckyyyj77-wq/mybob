"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FaThList, FaThLarge, FaTh, FaPlus, FaMinus } from 'react-icons/fa';

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

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(d, today)) return '오늘';
  if (isSameDay(d, yesterday)) return '어제';
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

// 날짜별로 그룹화
function groupByDate(meals: Meal[]): { dateKey: string; label: string; meals: Meal[] }[] {
  const map = new Map<string, Meal[]>();
  meals.forEach(m => {
    const key = new Date(m.created_at).toLocaleDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  });
  return Array.from(map.entries()).map(([key, meals]) => ({
    dateKey: key,
    label: formatDateLabel(meals[0].created_at),
    meals,
  }));
}

export default function HistoryPage() {
  const router = useRouter();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('full');
  const [galleryScale, setGalleryScale] = useState(4);

  useEffect(() => {
    // 1단계: 로컬 즉시 렌더링
    const local: Meal[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
    const sorted = (arr: Meal[]) => arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setMeals(sorted(local));
    setLoading(false);

    // 2단계: 서버 백그라운드 동기화
    fetch('/api/meals').then(r => r.json()).then(result => {
      if (result.success && Array.isArray(result.data)) {
        const keys = new Set(result.data.map((m: Meal) => `${m.food_name}_${m.calories}`));
        const merged = [...result.data, ...local.filter(m => !keys.has(`${m.food_name}_${m.calories}`))];
        setMeals(sorted(merged));
      }
    }).catch(() => {});
  }, []);

  const handleZoom = (delta: number) => {
    setGalleryScale(prev => Math.max(3, Math.min(6, prev + delta)));
  };

  const groups = groupByDate(meals);

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>

      {/* Header — 상단 여백 축소 */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>TIMELINE</p>
          <h1 style={{ fontSize: '26px', fontWeight: 400, color: 'black', letterSpacing: '-1px', lineHeight: 1 }}>기록</h1>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => setViewMode('full')}
            style={{ background: viewMode === 'full' ? 'black' : 'none', border: '1px solid #e5e7eb', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <FaThList size={12} color={viewMode === 'full' ? 'white' : 'black'} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            style={{ background: viewMode === 'grid' ? 'black' : 'none', border: '1px solid #e5e7eb', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <FaThLarge size={12} color={viewMode === 'grid' ? 'white' : 'black'} />
          </button>
          <button
            onClick={() => setViewMode('gallery')}
            style={{ background: viewMode === 'gallery' ? 'black' : 'none', border: '1px solid #e5e7eb', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <FaTh size={12} color={viewMode === 'gallery' ? 'white' : 'black'} />
          </button>
        </div>
      </div>

      {/* Gallery 줌 컨트롤 */}
      {viewMode === 'gallery' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 24px', gap: '6px', borderBottom: '1px solid #e5e7eb' }}>
          <button onClick={() => handleZoom(-1)} style={{ background: 'none', border: '1px solid #e5e7eb', padding: '4px 10px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <FaPlus size={8} /> 크게
          </button>
          <button onClick={() => handleZoom(1)} style={{ background: 'none', border: '1px solid #e5e7eb', padding: '4px 10px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <FaMinus size={8} /> 작게
          </button>
        </div>
      )}

      {/* Content */}
      <main style={{ flex: 1, padding: viewMode === 'full' ? '20px 24px' : '0' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '80px' }}>
            <div style={{ width: '28px', height: '28px', border: '2px solid black', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', paddingTop: '60px' }}>
            <p style={{ color: '#ef4444', marginBottom: '16px' }}>{error}</p>
            <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', backgroundColor: 'black', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px', letterSpacing: '2px' }}>재시도</button>
          </div>
        ) : meals.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: '80px' }}>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>기록된 식단이 없습니다.</p>
            <Link href="/capture" style={{ fontSize: '13px', color: '#6B21A8', textDecoration: 'none', letterSpacing: '1px' }}>지금 기록 시작하기 →</Link>
          </div>
        ) : (
          <AnimatePresence mode="wait">

            {/* ── 타임라인 (날짜 구분선 포함) ── */}
            {viewMode === 'full' && (
              <motion.div key="full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {groups.map((group, gi) => (
                  <div key={group.dateKey}>
                    {/* 날짜 구분선 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', marginTop: gi > 0 ? '28px' : '0' }}>
                      <span style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '1px', whiteSpace: 'nowrap' }}>{group.label}</span>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
                    </div>

                    {/* 해당 날짜 카드들 */}
                    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                      {/* Timeline line */}
                      <div style={{ position: 'absolute', left: '4px', top: '12px', bottom: '12px', width: '1px', backgroundColor: '#e9d5ff' }} />

                      {group.meals.map((meal, index) => (
                        <motion.div
                          key={meal.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          style={{ display: 'flex', gap: '20px', marginBottom: '16px', position: 'relative' }}
                        >
                          {/* Timeline dot — 속 빈 보라색 */}
                          <div style={{ width: '9px', height: '9px', borderRadius: '50%', border: '2px solid #6B21A8', backgroundColor: 'white', flexShrink: 0, marginTop: '16px', zIndex: 1 }} />

                          {/* Card */}
                          <div
                            onClick={() => router.push(`/history/${meal.id}`)}
                            style={{ flex: 1, border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer', overflow: 'hidden' }}
                          >
                            {/* 사진 + 날짜 오버레이 */}
                            {meal.photo_url && (
                              <div style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden', position: 'relative' }}>
                                <img src={meal.photo_url} alt={meal.food_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                {/* 날짜 — 사진 상단 오버레이 */}
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 10px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), transparent)' }}>
                                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.9)', letterSpacing: '0.5px' }}>
                                    {new Date(meal.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                    {meal.category ? ` · ${meal.category}` : ''}
                                  </p>
                                </div>
                              </div>
                            )}
                            <div style={{ padding: '10px 14px' }}>
                              {/* 사진 없을 때만 날짜 텍스트 표시 */}
                              {!meal.photo_url && (
                                <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px', marginBottom: '6px' }}>
                                  {new Date(meal.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                  {meal.category ? ` · ${meal.category}` : ''}
                                </p>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <h3 style={{ fontSize: '17px', fontWeight: 400, color: 'black', letterSpacing: '-0.3px' }}>{meal.food_name}</h3>
                                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                                  <p style={{ fontSize: '18px', fontWeight: 400, color: '#6B21A8', lineHeight: 1 }}>{meal.calories}</p>
                                  <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px' }}>KCAL</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* ── 4분할 보기 ── */}
            {viewMode === 'grid' && (
              <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px', backgroundColor: '#e5e7eb' }}
              >
                {meals.map(meal => (
                  <div key={meal.id} onClick={() => router.push(`/history/${meal.id}`)}
                    style={{ position: 'relative', width: '100%', aspectRatio: '1/1', backgroundColor: '#f3f4f6', cursor: 'pointer', overflow: 'hidden' }}
                  >
                    {meal.photo_url && <img src={meal.photo_url} alt={meal.food_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    {/* 칼로리 — 하단 중앙, 그라데이션 배경으로 시인성 확보 */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 8px 8px', background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)', pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}>
                      <span style={{ fontSize: '17px', color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.5)', fontWeight: 400, letterSpacing: '0.5px' }}>
                        {meal.calories}
                      </span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* ── 갤러리 ── */}
            {viewMode === 'gallery' && (
              <motion.div key="gallery" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'grid', gridTemplateColumns: `repeat(${galleryScale}, 1fr)`, gap: '1px', backgroundColor: '#e5e7eb' }}
              >
                {meals.map(meal => (
                  <div key={meal.id} onClick={() => router.push(`/history/${meal.id}`)}
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
