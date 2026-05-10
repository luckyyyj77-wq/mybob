"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaChevronLeft, FaChevronRight, FaTh, FaThLarge } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { MealPhoto } from '@/components/MealPhoto';

type Nutrient = {
  carbohydrates: number;
  protein: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  caffeine?: number | null;
  vitaminA?: number;
  vitaminC?: number;
  vitaminD?: number;
  calcium?: number;
  iron?: number;
  potassium?: number;
};

type Meal = {
  id: string;
  food_name: string;
  calories: number;
  created_at: string;
  photo_url?: string;
  category?: string;
  nutrient?: Nutrient;
  rating?: number | null;
  portion?: number;
  original_nutrition?: { calories: number; nutrients: Nutrient } | null;
  edited_nutrition?: Nutrient | null;
  is_edited?: boolean;
};

type GalleryMode = 'detail' | 'grid4' | 'grid16';

const RATING_OPTIONS = [
  { value: 2, emoji: '😊', label: '좋음' },
  { value: 1, emoji: '😐', label: '보통' },
  { value: 0, emoji: '😞', label: '나쁨' },
];

function MealDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const [meal, setMeal] = useState<Meal | null>(null);
  const [allMeals, setAllMeals] = useState<Meal[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const initialMode = (searchParams?.get('mode') as GalleryMode) || 'detail';
  const [galleryMode, setGalleryMode] = useState<GalleryMode>(initialMode);

  // 편집 관련 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editFoodName, setEditFoodName] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editNutrient, setEditNutrient] = useState<Record<string, string>>({});
  const [showOriginal, setShowOriginal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingRating, setSavingRating] = useState(false);
  const [userPlan, setUserPlan] = useState<string>('free');

  useEffect(() => {
    const loadData = async () => {
      let all: Meal[] = [];
      const localStr = localStorage.getItem('mybob_meals');
      if (localStr) all = JSON.parse(localStr);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch('/api/meals', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) {
          const r = await res.json();
          if (r.success && Array.isArray(r.data)) {
            const serverIds = new Set(r.data.map((m: Meal) => m.id));
            all = [...r.data, ...all.filter((m: Meal) => !serverIds.has(m.id))];
          }
        }
        // 플랜 조회
        if (token) {
          const profileRes = await fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } });
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            setUserPlan(profileData.plan || 'free');
          }
        }
      } catch { /* use local only */ }

      const sorted = all.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setAllMeals(sorted);

      const idx = sorted.findIndex(m => m.id === id);
      if (idx !== -1) {
        const found = sorted[idx];
        setMeal(found);
        setCurrentIndex(idx);
        // 편집 초기값 세팅
        setEditFoodName(found.food_name);
        setEditCalories(String(found.calories));
        setEditNutrient(
          Object.fromEntries(
            Object.entries(found.nutrient || {}).map(([k, v]) => [k, v != null ? String(v) : ''])
          )
        );
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

  const handleRatingChange = async (newRating: number | null) => {
    if (!meal) return;
    const updated = { ...meal, rating: newRating };
    setMeal(updated);
    setSavingRating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        await fetch('/api/meals', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mealId: meal.id, updates: { rating: newRating } }),
        });
      }
      // 로컬 캐시 동기화
      const existing: Meal[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
      localStorage.setItem('mybob_meals', JSON.stringify(
        existing.map(m => m.id === meal.id ? { ...m, rating: newRating } : m)
      ));
    } catch { /* 무시 */ } finally {
      setSavingRating(false);
    }
  };

  const handleEditSave = async () => {
    if (!meal) return;
    setSavingEdit(true);
    const newNutrient = Object.fromEntries(
      Object.entries(editNutrient).map(([k, v]) => {
        const n = parseFloat(v);
        return [k, isNaN(n) ? null : n];
      })
    );
    const newCalories = parseInt(editCalories) || meal.calories;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        const res = await fetch('/api/meals', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            mealId: meal.id,
            updates: { food_name: editFoodName, calories: newCalories, nutrient: newNutrient },
          }),
        });
        if (!res.ok) {
          const r = await res.json();
          if (r.error === 'PRO_REQUIRED') { alert('PRO 플랜에서만 편집 가능합니다.'); return; }
          throw new Error(r.error);
        }
      }
      const updatedMeal = {
        ...meal,
        food_name: editFoodName,
        calories: newCalories,
        nutrient: newNutrient as Nutrient,
        edited_nutrition: newNutrient as Nutrient,
        is_edited: true,
        original_nutrition: meal.original_nutrition ?? { calories: meal.calories, nutrients: meal.nutrient! },
      };
      setMeal(updatedMeal);
      // 로컬 캐시 동기화
      const existing: Meal[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
      localStorage.setItem('mybob_meals', JSON.stringify(
        existing.map(m => m.id === meal.id ? updatedMeal : m)
      ));
      setIsEditing(false);
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const startEdit = () => {
    if (!meal) return;
    setEditFoodName(meal.food_name);
    setEditCalories(String(meal.calories));
    setEditNutrient(
      Object.fromEntries(
        Object.entries(meal.nutrient || {}).map(([k, v]) => [k, v != null ? String(v) : ''])
      )
    );
    setIsEditing(true);
    setShowOriginal(false);
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
              <MealPhoto photoUrl={meal.photo_url} alt={meal.food_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

          {/* 사진 하단: AI 평가 (이모지만, 간결하게) */}
          <div style={{ padding: '10px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px' }}>AI 평가</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {RATING_OPTIONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => handleRatingChange(meal.rating === r.value ? null : r.value)}
                  disabled={savingRating}
                  style={{
                    width: '36px', height: '36px',
                    backgroundColor: meal.rating === r.value ? '#f3e8ff' : 'transparent',
                    border: meal.rating === r.value ? '1.5px solid #6B21A8' : '1.5px solid transparent',
                    borderRadius: '50%',
                    cursor: 'pointer', fontSize: '20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* 정보 */}
          <div style={{ padding: '20px 24px' }}>

            {/* 날짜 행 — 우측에 식사량 + 편집 버튼 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                {new Date(meal.created_at).toLocaleString('ko-KR', { dateStyle: 'long', timeStyle: 'short' })}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* 식사량 표시 */}
                {meal.portion != null && meal.portion !== 1 && (
                  <span style={{ fontSize: '11px', color: '#6B21A8' }}>
                    {meal.portion === 0.5 ? '½' : '¼'}
                  </span>
                )}
                {/* 원본↔수정 스위칭 (수정된 경우만) */}
                {meal.is_edited && meal.original_nutrition && (
                  <button
                    onClick={() => setShowOriginal(p => !p)}
                    title={showOriginal ? 'AI 원본 보는 중' : '수정값 보는 중'}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '16px', padding: '2px',
                      filter: showOriginal ? 'none' : 'grayscale(1)',
                      opacity: showOriginal ? 1 : 0.5,
                    }}
                  >
                    🔄
                  </button>
                )}
                {/* 편집 버튼 */}
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                      onClick={() => setIsEditing(false)}
                      title="취소"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '2px' }}
                    >
                      ↩️
                    </button>
                    <button
                      onClick={handleEditSave}
                      disabled={savingEdit}
                      title="저장"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '2px', opacity: savingEdit ? 0.5 : 1 }}
                    >
                      💾
                    </button>
                  </div>
                ) : userPlan !== 'free' ? (
                  <button
                    onClick={startEdit}
                    title="편집"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '2px', filter: 'grayscale(1)' }}
                  >
                    ✏️
                  </button>
                ) : (
                  <button
                    onClick={() => alert('PRO 플랜에서만 편집 가능합니다.')}
                    title="편집 (PRO 전용)"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '2px', opacity: 0.35 }}
                  >
                    🔒
                  </button>
                )}
              </div>
            </div>

            {/* 식사명 + 칼로리 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ flex: 1, marginRight: '12px' }}>
                {isEditing ? (
                  <input
                    value={editFoodName}
                    onChange={e => setEditFoodName(e.target.value)}
                    style={{ fontSize: '22px', fontWeight: 400, border: '2px solid #e5e7eb', borderRadius: '4px', padding: '4px 8px', width: '100%', outline: 'none', backgroundColor: '#fafafa' }}
                  />
                ) : (
                  <h2 style={{ fontSize: '24px', fontWeight: 400 }}>
                    {meal.food_name}
                    {meal.is_edited && <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '6px' }}>수정됨</span>}
                  </h2>
                )}
                <p style={{ fontSize: '14px', color: '#6B21A8', marginTop: '2px' }}>{meal.category || '기타'}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                {isEditing ? (
                  <input
                    value={editCalories}
                    onChange={e => setEditCalories(e.target.value)}
                    style={{ fontSize: '24px', color: '#6B21A8', border: '2px solid #e5e7eb', borderRadius: '4px', padding: '2px 6px', width: '80px', textAlign: 'right', outline: 'none', backgroundColor: '#fafafa' }}
                  />
                ) : (
                  <p style={{ fontSize: '28px', color: 'black', lineHeight: 1 }}>{meal.calories}</p>
                )}
                <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px' }}>KCAL</p>
              </div>
            </div>

            {/* 영양정보 */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase' }}>Nutritional Info</p>
                {isEditing && <span style={{ fontSize: '10px', color: '#6B21A8', letterSpacing: '0.5px' }}>✏️ 편집 중</span>}
                {showOriginal && <span style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '0.5px' }}>AI 원본</span>}
              </div>
              {(() => {
                const displayNutrient = showOriginal && meal.original_nutrition
                  ? meal.original_nutrition.nutrients
                  : meal.nutrient;
                const nutrientFields = [
                  { key: 'carbohydrates', label: '탄수화물', unit: 'g' },
                  { key: 'protein', label: '단백질', unit: 'g' },
                  { key: 'fat', label: '지방', unit: 'g' },
                  { key: 'fiber', label: '식이섬유', unit: 'g' },
                  { key: 'sugar', label: '당류', unit: 'g' },
                  { key: 'sodium', label: '나트륨', unit: 'mg' },
                  ...(meal.nutrient?.caffeine != null ? [{ key: 'caffeine', label: '카페인', unit: 'mg' }] : []),
                ];
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb' }}>
                    {nutrientFields.map(n => (
                      <div key={n.key} style={{ padding: '14px 8px', backgroundColor: isEditing && !showOriginal ? '#fafafa' : 'white', textAlign: 'center' }}>
                        <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>{n.label}</p>
                        {isEditing && !showOriginal ? (
                          <input
                            value={editNutrient[n.key] ?? ''}
                            onChange={e => setEditNutrient(prev => ({ ...prev, [n.key]: e.target.value }))}
                            style={{ fontSize: '14px', border: '1.5px solid #d1d5db', borderRadius: '3px', width: '58px', textAlign: 'center', padding: '3px 2px', outline: 'none', backgroundColor: 'white' }}
                          />
                        ) : (
                          <p style={{ fontSize: '15px' }}>{(displayNutrient as any)?.[n.key] ?? 0}{n.unit}</p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div style={{ marginTop: '24px' }}>
              <p style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>Vitamins & Minerals</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {[
                  { key: 'vitaminA', label: '비타민A', unit: 'μg' },
                  { key: 'vitaminC', label: '비타민C', unit: 'mg' },
                  { key: 'vitaminD', label: '비타민D', unit: 'μg' },
                  { key: 'calcium', label: '칼슘', unit: 'mg' },
                  { key: 'iron', label: '철분', unit: 'mg' },
                  { key: 'potassium', label: '칼륨', unit: 'mg' },
                ].filter(n => (meal.nutrient as any)?.[n.key]).map(n => (
                  <div key={n.key} style={{ padding: '6px 12px', border: `1px solid ${isEditing ? '#d1d5db' : '#e5e7eb'}`, fontSize: '12px', backgroundColor: isEditing ? '#fafafa' : 'white' }}>
                    <span style={{ color: '#9ca3af', marginRight: '4px' }}>{n.label}</span>
                    {isEditing ? (
                      <input
                        value={editNutrient[n.key] ?? ''}
                        onChange={e => setEditNutrient(prev => ({ ...prev, [n.key]: e.target.value }))}
                        style={{ fontSize: '12px', border: '1.5px solid #d1d5db', borderRadius: '3px', width: '48px', padding: '2px', outline: 'none', backgroundColor: 'white' }}
                      />
                    ) : (
                      <span>{(meal.nutrient as any)?.[n.key]}{n.unit}</span>
                    )}
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
                  paddingBottom: '100%',
                  backgroundColor: m.id === id ? '#d1d5db' : 'white',
                  cursor: 'pointer',
                  outline: m.id === id ? '2px solid black' : 'none',
                  outlineOffset: '-2px',
                }}
              >
                {m.photo_url ? (
                  <MealPhoto photoUrl={m.photo_url} alt={m.food_name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, backgroundColor: '#f3f4f6' }} />
                )}
                {/* 4분할에서만 칼로리 표시 — 하단 중앙, 그라데이션 배경 */}
                {galleryMode === 'grid4' && (
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: '16px 8px 8px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)',
                    pointerEvents: 'none',
                    display: 'flex', justifyContent: 'center',
                  }}>
                    <span style={{
                      fontSize: '17px',
                      color: 'white',
                      textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                      fontWeight: 400,
                      letterSpacing: '0.5px',
                    }}>
                      {m.calories}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MealDetailPage() {
  return (
    <Suspense fallback={null}>
      <MealDetailContent />
    </Suspense>
  );
}
