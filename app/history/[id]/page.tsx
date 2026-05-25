"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaChevronLeft, FaChevronRight, FaTh, FaThLarge } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
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
  const { token } = useAuth();
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
  const [editPortion, setEditPortion] = useState<number>(1);
  const [editRating, setEditRating] = useState<number | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [showAddNutrient, setShowAddNutrient] = useState(false);

  const STANDARD_NUTRIENTS = [
    { key: 'carbohydrates', label: '탄수화물', unit: 'g' },
    { key: 'protein', label: '단백질', unit: 'g' },
    { key: 'fat', label: '지방', unit: 'g' },
    { key: 'fiber', label: '식이섬유', unit: 'g' },
    { key: 'sugar', label: '당류', unit: 'g' },
    { key: 'sodium', label: '나트륨', unit: 'mg' },
    { key: 'caffeine', label: '카페인', unit: 'mg' },
    { key: 'vitaminA', label: '비타민A', unit: 'μg' },
    { key: 'vitaminC', label: '비타민C', unit: 'mg' },
    { key: 'vitaminD', label: '비타민D', unit: 'μg' },
    { key: 'calcium', label: '칼슘', unit: 'mg' },
    { key: 'iron', label: '철분', unit: 'mg' },
    { key: 'potassium', label: '칼륨', unit: 'mg' },
  ];

  const handleNumericInput = (key: string, raw: string, setter: (v: string) => void) => {
    const cleaned = raw.replace(/[^\d.]/g, '');
    setter(cleaned);
    if (cleaned !== raw && raw !== '') {
      setInvalidFields(prev => new Set(prev).add(key));
      setTimeout(() => setInvalidFields(prev => { const s = new Set(prev); s.delete(key); return s; }), 800);
    }
  };

  const selectAll = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

  useEffect(() => {
    const loadData = async () => {
      let all: Meal[] = [];
      const localStr = localStorage.getItem('mybob_meals');
      if (localStr) all = JSON.parse(localStr);

      if (token) {
        try {
          const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
          const [mealsRes, profileRes] = await Promise.all([
            fetch('/api/meals', { headers }),
            fetch('/api/profile', { headers }),
          ]);
          if (mealsRes.ok) {
            const r = await mealsRes.json();
            if (r.success && Array.isArray(r.data)) {
              const serverIds = new Set(r.data.map((m: Meal) => m.id));
              all = [...r.data, ...all.filter((m: Meal) => !serverIds.has(m.id))];
            }
          }
          if (profileRes?.ok) {
            const profileData = await profileRes.json();
            setUserPlan(profileData.plan || 'free');
          }
        } catch { /* use local only */ }
      }

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
      if (token) {
        await fetch('/api/meals', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mealId: meal.id, updates: { rating: newRating } }),
        });
      }
      const existing: Meal[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
      localStorage.setItem('mybob_meals', JSON.stringify(
        existing.map(m => m.id === meal.id ? { ...m, rating: newRating } : m)
      ));
    } catch { } finally {
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
      if (token) {
        const res = await fetch('/api/meals', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            mealId: meal.id,
            updates: { food_name: editFoodName, calories: newCalories, nutrient: newNutrient, rating: editRating, portion: editPortion },
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
        rating: editRating,
        portion: editPortion,
        original_nutrition: meal.original_nutrition ?? { calories: meal.calories, nutrients: meal.nutrient! },
      };
      setMeal(updatedMeal);
      // 로컬 캐시 동기화
      const existing: Meal[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
      localStorage.setItem('mybob_meals', JSON.stringify(
        existing.map(m => m.id === meal.id ? updatedMeal : m)
      ));
      localStorage.removeItem(`mybob_coach_${new Date().toISOString().slice(0, 10)}`);
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
    setEditPortion(meal.portion ?? 1);
    setEditRating(meal.rating ?? null);
    setIsEditing(true);
    setShowOriginal(false);
    setShowAddNutrient(false);
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

          {/* 사진 — 평가 이모지를 우측 하단 오버레이로 */}
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

            {/* AI 평가 — 사진 우측 하단 오버레이 (편집 중일 때만 변경 가능) */}
            <div style={{
              position: 'absolute', bottom: '10px', right: '10px',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px',
            }}>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.7)', letterSpacing: '1px', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>AI 평가</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  { value: 2, emoji: '😊', activeColor: 'rgba(34,197,94,0.85)' },
                  { value: 1, emoji: '😐', activeColor: 'rgba(234,179,8,0.85)' },
                  { value: 0, emoji: '😞', activeColor: 'rgba(239,68,68,0.85)' },
                ].map(r => {
                  const currentRating = isEditing ? editRating : meal.rating;
                  const isActive = currentRating === r.value;
                  return (
                    <button
                      key={r.value}
                      onClick={() => {
                        if (!isEditing) return;
                        setEditRating(editRating === r.value ? null : r.value);
                      }}
                      style={{
                        width: '34px', height: '34px',
                        backgroundColor: isActive ? r.activeColor : 'rgba(0,0,0,0.35)',
                        border: 'none',
                        borderRadius: '50%',
                        cursor: isEditing ? 'pointer' : 'default',
                        fontSize: '18px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0,
                        backdropFilter: 'blur(4px)',
                        transition: 'background-color 0.15s',
                        opacity: isEditing ? 1 : (isActive ? 1 : 0.5),
                      }}
                    >
                      {r.emoji}
                    </button>
                  );
                })}
              </div>
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
                {/* 식사량 — 편집 중이면 선택 버튼, 아니면 텍스트 표시 */}
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {([1, 0.5, 0.25] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => {
                          // 원본 칼로리/영양 기준으로 재계산
                          const baseCalories = meal.original_nutrition?.calories ?? meal.calories;
                          const baseNutrients = meal.original_nutrition?.nutrients ?? meal.nutrient ?? {};
                          setEditPortion(p);
                          setEditCalories(String(Math.round(baseCalories * p)));
                          setEditNutrient(
                            Object.fromEntries(
                              Object.entries(baseNutrients).map(([k, v]) =>
                                [k, v != null ? String(Math.round((v as number) * p * 10) / 10) : '']
                              )
                            )
                          );
                        }}
                        style={{
                          padding: '2px 7px', fontSize: '12px',
                          backgroundColor: editPortion === p ? 'black' : 'white',
                          color: editPortion === p ? 'white' : '#6b7280',
                          border: '1px solid #e5e7eb', cursor: 'pointer',
                        }}
                      >
                        {p === 1 ? '1' : p === 0.5 ? '½' : '¼'}
                      </button>
                    ))}
                  </div>
                ) : (
                  meal.portion != null && meal.portion !== 1 && (
                    <span style={{ fontSize: '11px', color: '#6B21A8' }}>
                      {meal.portion === 0.5 ? '½' : '¼'}
                    </span>
                  )
                )}
                {/* 편집 버튼 */}
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                      onClick={() => { setIsEditing(false); setShowAddNutrient(false); }}
                      title="취소"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '2px', lineHeight: 1 }}
                    >
                      ✖️
                    </button>
                    <button
                      onClick={handleEditSave}
                      disabled={savingEdit}
                      title="저장"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', padding: '2px', opacity: savingEdit ? 0.5 : 1, lineHeight: 1 }}
                    >
                      ✅
                    </button>
                  </div>
                ) : userPlan !== 'free' ? (
                  <button
                    onClick={startEdit}
                    title="편집"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '2px', filter: 'grayscale(1)', lineHeight: 1 }}
                  >
                    ✏️
                  </button>
                ) : (
                  <button
                    onClick={() => alert('PRO 플랜에서만 편집 가능합니다.')}
                    title="편집 (PRO 전용)"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '2px', opacity: 0.35, lineHeight: 1 }}
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
                    onFocus={selectAll}
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
                    onChange={e => handleNumericInput('calories', e.target.value, setEditCalories)}
                    onFocus={selectAll}
                    inputMode="decimal"
                    style={{ fontSize: '24px', color: '#6B21A8', border: `2px solid ${invalidFields.has('calories') ? '#ef4444' : '#e5e7eb'}`, borderRadius: '4px', padding: '2px 6px', width: '80px', textAlign: 'right', outline: 'none', backgroundColor: '#fafafa', transition: 'border-color 0.2s' }}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* 되돌리기 — 편집 중이고 수정된 기록 있을 때만 */}
                  {isEditing && meal.is_edited && meal.original_nutrition && (
                    <button
                      onClick={() => setShowOriginal(p => !p)}
                      title={showOriginal ? '수정값으로 보기' : 'AI 원본으로 보기'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '0', opacity: showOriginal ? 1 : 0.45, lineHeight: 1 }}
                    >
                      🔄
                    </button>
                  )}
                  {isEditing && !showOriginal && <span style={{ fontSize: '10px', color: '#6B21A8' }}>✏️ 편집 중</span>}
                  {showOriginal && <span style={{ fontSize: '10px', color: '#9ca3af' }}>AI 원본</span>}
                </div>
              </div>
              {(() => {
                const displayNutrient = showOriginal && meal.original_nutrition
                  ? meal.original_nutrition.nutrients
                  : meal.nutrient;

                const mainFields = [
                  { key: 'carbohydrates', label: '탄수화물', unit: 'g' },
                  { key: 'protein', label: '단백질', unit: 'g' },
                  { key: 'fat', label: '지방', unit: 'g' },
                ];

                const subAllFields = [
                  { key: 'fiber', label: '식이섬유', unit: 'g' },
                  { key: 'sugar', label: '당류', unit: 'g' },
                  { key: 'sodium', label: '나트륨', unit: 'mg' },
                  { key: 'caffeine', label: '카페인', unit: 'mg' },
                  { key: 'vitaminA', label: '비타민A', unit: 'μg' },
                  { key: 'vitaminC', label: '비타민C', unit: 'mg' },
                  { key: 'vitaminD', label: '비타민D', unit: 'μg' },
                  { key: 'calcium', label: '칼슘', unit: 'mg' },
                  { key: 'iron', label: '철분', unit: 'mg' },
                  { key: 'potassium', label: '칼륨', unit: 'mg' },
                ];

                const subFields = subAllFields.filter(n => {
                  const hasOriginalValue = (meal.nutrient as any)?.[n.key] != null;
                  const hasEditValue = isEditing && editNutrient[n.key] !== undefined;
                  return hasOriginalValue || hasEditValue;
                });

                const subRemainder = subFields.length % 3;
                const subPadCount = subRemainder === 0 ? 0 : 3 - subRemainder;

                const bgMain = isEditing && !showOriginal ? '#fafafa' : 'white';

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb' }}>
                    {/* 탄단지 — 큰 셀 */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', backgroundColor: '#e5e7eb' }}>
                      {mainFields.map(n => (
                        <div key={n.key} style={{ padding: '18px 8px', backgroundColor: bgMain, textAlign: 'center' }}>
                          <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '6px' }}>{n.label}</p>
                          {isEditing && !showOriginal ? (
                            <input
                              value={editNutrient[n.key] ?? ''}
                              onChange={e => handleNumericInput(n.key, e.target.value, v => setEditNutrient(prev => ({ ...prev, [n.key]: v })))}
                              onFocus={selectAll}
                              inputMode="decimal"
                              style={{ fontSize: '16px', border: `1.5px solid ${invalidFields.has(n.key) ? '#ef4444' : '#d1d5db'}`, borderRadius: '3px', width: '64px', textAlign: 'center', padding: '4px 2px', outline: 'none', backgroundColor: 'white', transition: 'border-color 0.2s' }}
                            />
                          ) : (
                            <p style={{ fontSize: '18px', color: '#111' }}>{(displayNutrient as any)?.[n.key]}{n.unit}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* 나머지 영양성분 — 작은 셀 (값 있는 것만) */}
                    {subFields.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', backgroundColor: '#e5e7eb' }}>
                        {subFields.map(n => (
                          <div key={n.key} style={{ padding: '9px 8px', backgroundColor: bgMain, textAlign: 'center' }}>
                            <p style={{ fontSize: '9px', color: '#9ca3af', marginBottom: '3px' }}>{n.label}</p>
                            {isEditing && !showOriginal ? (
                              <input
                                value={editNutrient[n.key] ?? ''}
                                onChange={e => handleNumericInput(n.key, e.target.value, v => setEditNutrient(prev => ({ ...prev, [n.key]: v })))}
                                onFocus={selectAll}
                                inputMode="decimal"
                                style={{ fontSize: '11px', border: `1.5px solid ${invalidFields.has(n.key) ? '#ef4444' : '#d1d5db'}`, borderRadius: '3px', width: '46px', textAlign: 'center', padding: '2px', outline: 'none', backgroundColor: 'white', transition: 'border-color 0.2s' }}
                              />
                            ) : (
                              <p style={{ fontSize: '12px', color: '#374151' }}>{(displayNutrient as any)?.[n.key]}{n.unit}</p>
                            )}
                          </div>
                        ))}
                        {Array.from({ length: subPadCount }).map((_, i) => (
                          <div key={`pad_${i}`} style={{ padding: '9px 8px', backgroundColor: bgMain }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* 영양성분 추가 — 편집 중일 때만 표시 */}
            {isEditing && (
              <div style={{ marginTop: '16px' }}>
                {!showAddNutrient ? (
                  <button
                    onClick={() => setShowAddNutrient(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 14px', fontSize: '12px', color: '#6B21A8',
                      backgroundColor: 'white', border: '1px dashed #c4b5fd',
                      cursor: 'pointer', letterSpacing: '0.5px',
                    }}
                  >
                    + 영양성분 추가
                  </button>
                ) : (
                  <div style={{ border: '1px solid #e5e7eb', padding: '16px', backgroundColor: '#fafafa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <p style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase' }}>영양성분 선택</p>
                      <button
                        onClick={() => setShowAddNutrient(false)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#9ca3af', padding: 0 }}
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {STANDARD_NUTRIENTS.filter(n => {
                        const hasOriginalValue = (meal.nutrient as any)?.[n.key] != null;
                        const alreadyAdded = editNutrient[n.key] !== undefined;
                        return !hasOriginalValue && !alreadyAdded;
                      }).map(n => (
                        <button
                          key={n.key}
                          onClick={() => {
                            setEditNutrient(prev => ({ ...prev, [n.key]: '' }));
                            setShowAddNutrient(false);
                          }}
                          style={{
                            padding: '6px 12px', fontSize: '12px',
                            backgroundColor: 'white', border: '1px solid #e5e7eb',
                            cursor: 'pointer', color: '#374151',
                            transition: 'all 0.15s',
                          }}
                        >
                          {n.label} <span style={{ color: '#9ca3af', fontSize: '10px' }}>({n.unit})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
