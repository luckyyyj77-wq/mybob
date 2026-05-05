"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaChevronLeft, FaChevronRight, FaTh, FaThLarge } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

type Meal = {
  id: string;
  food_name: string;
  calories: number;
  created_at: string;
  photo_url?: string;
  category?: string;
  nutrient?: {
    carbohydrates: number;
    protein: number;
    fat: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
    vitaminA?: number;
    vitaminC?: number;
    vitaminD?: number;
    calcium?: number;
    iron?: number;
    potassium?: number;
  };
};

type GalleryMode = 'detail' | 'grid4' | 'grid16';

export default function MealDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [meal, setMeal] = useState<Meal | null>(null);
  const [allMeals, setAllMeals] = useState<Meal[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [galleryMode, setGalleryMode] = useState<GalleryMode>('detail');

  useEffect(() => {
    const loadData = async () => {
      let all: Meal[] = [];
      const localStr = localStorage.getItem('mybob_meals');
      if (localStr) all = JSON.parse(localStr);

      try {
        const res = await fetch('/api/meals');
        if (res.ok) {
          const r = await res.json();
          if (r.success && Array.isArray(r.data)) {
            const keys = new Set(r.data.map((m: Meal) => `${m.food_name}_${m.calories}`));
            all = [...r.data, ...all.filter((m: Meal) => !keys.has(`${m.food_name}_${m.calories}`))];
          }
        }
      } catch { /* use local only */ }

      const sorted = all.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setAllMeals(sorted);

      const idx = sorted.findIndex(m => m.id === id);
      if (idx !== -1) {
        setMeal(sorted[idx]);
        setCurrentIndex(idx);
      }
      setLoading(false);
    };
    loadData();
  }, [id]);

  const navigateTo = (idx: number) => {
    if (idx >= 0 && idx < allMeals.length) {
      router.push(`/history/${allMeals[idx].id}`);
    }
  };

  if (loading) return null;
  if (!meal) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <p>기록을 찾을 수 없습니다.</p>
      <Link href="/history">목록으로 돌아가기</Link>
    </div>
  );

  const cols = galleryMode === 'grid4' ? 2 : galleryMode === 'grid16' ? 4 : 1;

  return (
    <div style={{ height: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => router.push('/history')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <FaArrowLeft size={18} color="black" />
        </button>
        <span style={{ fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase' }}>Meal Detail</span>
        <div style={{ width: '18px' }} />
      </div>

      {galleryMode === 'detail' ? (
        /* ── 상세 보기 ── */
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* 반투명 뷰 모드 오버레이 */}
          <div style={{
            position: 'fixed',
            bottom: '80px',
            right: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 50,
          }}>
            <button
              onClick={() => setGalleryMode('grid4')}
              style={{
                width: '44px', height: '44px',
                backgroundColor: 'rgba(0,0,0,0.45)',
                border: 'none', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(6px)',
              }}
              title="4분할 보기"
            >
              <FaThLarge size={16} color="white" />
            </button>
            <button
              onClick={() => setGalleryMode('grid16')}
              style={{
                width: '44px', height: '44px',
                backgroundColor: 'rgba(0,0,0,0.45)',
                border: 'none', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(6px)',
              }}
              title="16분할 보기"
            >
              <FaTh size={16} color="white" />
            </button>
          </div>

          {/* 사진 */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', backgroundColor: '#f3f4f6', flexShrink: 0 }}>
            {meal.photo_url ? (
              <img src={meal.photo_url} alt={meal.food_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>이미지 없음</div>
            )}
            <button
              onClick={() => navigateTo(currentIndex - 1)}
              disabled={currentIndex <= 0}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: currentIndex <= 0 ? 0.3 : 1 }}
            >
              <FaChevronLeft color="black" />
            </button>
            <button
              onClick={() => navigateTo(currentIndex + 1)}
              disabled={currentIndex >= allMeals.length - 1}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: currentIndex >= allMeals.length - 1 ? 0.3 : 1 }}
            >
              <FaChevronRight color="black" />
            </button>
          </div>

          {/* 정보 */}
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {new Date(meal.created_at).toLocaleString('ko-KR', { dateStyle: 'long', timeStyle: 'short' })}
                </p>
                <h2 style={{ fontSize: '24px', fontWeight: 400 }}>{meal.food_name}</h2>
                <p style={{ fontSize: '14px', color: '#6B21A8' }}>{meal.category || '기타'}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '28px', color: 'black', lineHeight: 1 }}>{meal.calories}</p>
                <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px' }}>KCAL</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
              <p style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>Nutritional Info</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb' }}>
                {[
                  { label: '탄수화물', value: meal.nutrient?.carbohydrates, unit: 'g' },
                  { label: '단백질', value: meal.nutrient?.protein, unit: 'g' },
                  { label: '지방', value: meal.nutrient?.fat, unit: 'g' },
                  { label: '식이섬유', value: meal.nutrient?.fiber, unit: 'g' },
                  { label: '당류', value: meal.nutrient?.sugar, unit: 'g' },
                  { label: '나트륨', value: meal.nutrient?.sodium, unit: 'mg' },
                ].map(n => (
                  <div key={n.label} style={{ padding: '16px 8px', backgroundColor: 'white', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>{n.label}</p>
                    <p style={{ fontSize: '15px' }}>{n.value ?? 0}{n.unit}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <p style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>Vitamins & Minerals</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {[
                  { label: '비타민A', value: meal.nutrient?.vitaminA, unit: 'μg' },
                  { label: '비타민C', value: meal.nutrient?.vitaminC, unit: 'mg' },
                  { label: '비타민D', value: meal.nutrient?.vitaminD, unit: 'μg' },
                  { label: '칼슘', value: meal.nutrient?.calcium, unit: 'mg' },
                  { label: '철분', value: meal.nutrient?.iron, unit: 'mg' },
                  { label: '칼륨', value: meal.nutrient?.potassium, unit: 'mg' },
                ].filter(n => n.value).map(n => (
                  <div key={n.label} style={{ padding: '6px 12px', border: '1px solid #e5e7eb', fontSize: '12px' }}>
                    <span style={{ color: '#9ca3af', marginRight: '4px' }}>{n.label}</span>
                    <span>{n.value}{n.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── 그리드 보기 (4분할 / 16분할) ── */
        <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          {/* 닫기 오버레이 버튼 */}
          <div style={{
            position: 'fixed',
            bottom: '80px',
            right: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 50,
          }}>
            <button
              onClick={() => setGalleryMode('detail')}
              style={{
                width: '44px', height: '44px',
                backgroundColor: 'rgba(0,0,0,0.65)',
                border: 'none', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(6px)',
                color: 'white', fontSize: '10px', letterSpacing: '0.5px',
              }}
            >
              ✕
            </button>
            <button
              onClick={() => setGalleryMode(galleryMode === 'grid4' ? 'grid16' : 'grid4')}
              style={{
                width: '44px', height: '44px',
                backgroundColor: 'rgba(0,0,0,0.45)',
                border: 'none', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(6px)',
              }}
            >
              {galleryMode === 'grid4' ? <FaTh size={16} color="white" /> : <FaThLarge size={16} color="white" />}
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: '2px',
            backgroundColor: '#e5e7eb',
          }}>
            {allMeals.slice().reverse().map((m) => (
              <div
                key={m.id}
                onClick={() => router.push(`/history/${m.id}`)}
                style={{
                  position: 'relative',
                  paddingBottom: '100%', // 정사각형 유지
                  backgroundColor: m.id === id ? '#d1d5db' : 'white',
                  cursor: 'pointer',
                  outline: m.id === id ? '2px solid black' : 'none',
                  outlineOffset: '-2px',
                }}
              >
                {m.photo_url ? (
                  <img src={m.photo_url} alt={m.food_name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, backgroundColor: '#f3f4f6' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
