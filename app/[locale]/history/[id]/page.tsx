"use client";

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, Link } from '@/i18n/routing';
import { useParams, useSearchParams } from 'next/navigation';
import { FaArrowLeft, FaChevronLeft, FaChevronRight, FaTh, FaThLarge } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { MealPhoto } from '@/components/MealPhoto';
import { updateGoalAchievement } from '@/lib/goal-achievement';
import { isUnrecognizedMeal } from '@/lib/unrecognized';
import { useTranslations, useLocale } from 'next-intl';

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
  is_public?: boolean;
  visibility?: 'private' | 'neighbors' | 'public';
  _unrecognized?: boolean;
};

type GalleryMode = 'detail' | 'grid4' | 'grid16';

function MealDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const t = useTranslations('MealDetail');
  const tc = useTranslations('Common');
  const locale = useLocale();

  const id = params?.id as string;
  const [meal, setMeal] = useState<Meal | null>(null);
  const [allMeals, setAllMeals] = useState<Meal[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const initialMode = (searchParams?.get('mode') as GalleryMode) || 'detail';
  const [galleryMode, setGalleryMode] = useState<GalleryMode>(initialMode);

  const [isEditing, setIsEditing] = useState(false);
  const [editFoodName, setEditFoodName] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editNutrient, setEditNutrient] = useState<Record<string, string>>({});
  const [showOriginal, setShowOriginal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingRating, setSavingRating] = useState(false);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [editPortion, setEditPortion] = useState<number>(1);
  const [editRating, setEditRating] = useState<number | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [showAddNutrient, setShowAddNutrient] = useState(false);

  const [showRecover, setShowRecover] = useState(false);
  const [recoverName, setRecoverName] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [recoverError, setRecoverError] = useState('');

  const RATING_OPTIONS = useMemo(() => [
    { value: 2, emoji: '😊', label: t('ratingLabels.excellent') },
    { value: 1, emoji: '😐', label: t('ratingLabels.good') },
    { value: 0, emoji: '😞', label: t('ratingLabels.poor') },
  ], [t]);

  const tHistory = useTranslations('History');
  const CATEGORY_MAP: Record<string, string> = useMemo(() => ({
    '한식': tHistory('categories.korean'),
    '중식': tHistory('categories.chinese'),
    '일식': tHistory('categories.japanese'),
    '양식': tHistory('categories.western'),
    '간식': tHistory('categories.snack'),
    '음료': tHistory('categories.drink'),
    '기타': tHistory('categories.etc'),
  }), [tHistory]);

  const tNutrients = useTranslations('Capture.nutrients');
  const NUTRIENT_LABELS: Record<string, string> = useMemo(() => ({
    carbohydrates: tNutrients('carbohydrates'),
    protein: tNutrients('protein'),
    fat: tNutrients('fat'),
    fiber: tNutrients('fiber'),
    sugar: tNutrients('sugar'),
    sodium: tNutrients('sodium'),
    caffeine: tNutrients('caffeine'),
    vitaminA: 'Vit A',
    vitaminC: 'Vit C',
    vitaminD: 'Vit D',
    calcium: 'Calcium',
    iron: 'Iron',
    potassium: 'Potassium',
  }), [tNutrients]);

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
    if (token === undefined) return;
    const loadData = async () => {
      let all: Meal[] = [];
      const localStr = localStorage.getItem('mybob_meals');
      if (localStr) all = JSON.parse(localStr);

      let serverMeals: Meal[] = [];

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
              serverMeals = r.data;
              const serverIds = new Set(serverMeals.map((m: Meal) => m.id));
              all = [...serverMeals, ...all.filter((m: Meal) => !serverIds.has(m.id))];
            }
          }
          if (profileRes?.ok) {
            const profileData = await profileRes.json();
            setUserPlan(profileData.effective_plan || profileData.plan || 'free');
          }
        } catch { }
      } else {
        setUserPlan('free');
      }

      const sorted = all.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setAllMeals(sorted);

      const idx = sorted.findIndex(m => m.id === id);
      if (idx !== -1) {
        const serverVersion = serverMeals.find(m => m.id === id);
        const found = serverVersion ?? sorted[idx];
        setMeal(found);
        setCurrentIndex(idx);
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
  }, [id, token]);

  const navigateTo = (idx: number) => {
    if (idx >= 0 && idx < allMeals.length) {
      router.push(`/history/${allMeals[idx].id}`);
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
          if (r.error === 'PRO_REQUIRED') { alert(t('proRequired')); return; }
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
      const existing: Meal[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
      localStorage.setItem('mybob_meals', JSON.stringify(
        existing.map(m => m.id === meal.id ? updatedMeal : m)
      ));
      updateGoalAchievement();
      { const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); Object.keys(localStorage).filter(k => k.startsWith('mybob_coach_') && k.includes(today)).forEach(k => localStorage.removeItem(k)); }
      setIsEditing(false);
    } catch (err: any) {
      alert(t('saveFail', { error: err.message }));
    } finally {
      setSavingEdit(false);
    }
  };

  // 미인식 식단 복구: 이름 입력 → 식약처 DB/Gemini 영양정보 → 식단 업데이트
  const handleRecover = async () => {
    if (!meal || !token || !recoverName.trim() || recovering) return;
    setRecovering(true);
    setRecoverError('');
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(meal.id);
      const res = await fetch('/api/meals/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mealId: isUuid ? meal.id : undefined,
          foodName: recoverName.trim(),
          portion: meal.portion ?? 1,
        }),
      });
      const r = await res.json();
      if (!res.ok) {
        setRecoverError(r.error === 'ANALYSIS_LIMIT_EXCEEDED' ? t('recoverLimit') : t('recoverFail'));
        return;
      }
      const { _unrecognized, ...rest } = meal;
      const updatedMeal: Meal = {
        ...rest,
        food_name: r.food.name,
        calories: r.food.calories,
        category: r.food.category,
        nutrient: r.food.nutrients as Nutrient,
        original_nutrition: { calories: r.base.calories, nutrients: r.base.nutrients as Nutrient },
      };
      setMeal(updatedMeal);
      setEditFoodName(updatedMeal.food_name);
      setEditCalories(String(updatedMeal.calories));
      setEditNutrient(
        Object.fromEntries(
          Object.entries(updatedMeal.nutrient || {}).map(([k, v]) => [k, v != null ? String(v) : ''])
        )
      );
      const existing: Meal[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
      localStorage.setItem('mybob_meals', JSON.stringify(
        existing.map(m => m.id === meal.id ? updatedMeal : m)
      ));
      updateGoalAchievement();
      { const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); Object.keys(localStorage).filter(k => k.startsWith('mybob_coach_') && k.includes(today)).forEach(k => localStorage.removeItem(k)); }
      setShowRecover(false);
      setRecoverName('');
    } catch {
      setRecoverError(t('recoverFail'));
    } finally {
      setRecovering(false);
    }
  };

  const handleVisibilityChange = async (v: 'private' | 'neighbors' | 'public') => {
    if (!meal || !token) return;
    const prev = meal.visibility ?? 'private';
    setMeal({ ...meal, visibility: v, is_public: v !== 'private' });
    try {
      await fetch('/api/meals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mealId: meal.id, updates: { visibility: v } }),
      });
      const existing: Meal[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
      localStorage.setItem('mybob_meals', JSON.stringify(
        existing.map(m => m.id === meal.id ? { ...m, visibility: v, is_public: v !== 'private' } : m)
      ));
    } catch {
      setMeal({ ...meal, visibility: prev, is_public: prev !== 'private' });
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
      <p>{t('notFound')}</p>
      <Link href="/history">{t('goBack')}</Link>
    </div>
  );

  const cols = galleryMode === 'grid4' ? 2 : galleryMode === 'grid16' ? 4 : 1;

  return (
    <div style={{ height: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flexShrink: 0, padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => router.push('/history')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <FaArrowLeft size={18} color="black" />
        </button>
        <span style={{ fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase' }}>{t('title')}</span>
        <div style={{ width: '18px' }} />
      </div>

      {galleryMode === 'detail' ? (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ position: 'fixed', top: '70px', right: '16px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 50 }}>
            <button onClick={() => setGalleryMode('grid4')} style={{ width: '44px', height: '44px', backgroundColor: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(6px)' }} title={t('view4')}><FaThLarge size={16} color="white" /></button>
            <button onClick={() => setGalleryMode('grid16')} style={{ width: '44px', height: '44px', backgroundColor: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(6px)' }} title={t('view16')}><FaTh size={16} color="white" /></button>
          </div>

          <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', backgroundColor: '#f3f4f6', flexShrink: 0 }}>
            {meal.photo_url ? <MealPhoto photoUrl={meal.photo_url} alt={meal.food_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>{t('noImage')}</div>}
            <button onClick={() => navigateTo(currentIndex - 1)} disabled={currentIndex <= 0} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: currentIndex <= 0 ? 0.3 : 1 }}><FaChevronLeft color="black" /></button>
            <button onClick={() => navigateTo(currentIndex + 1)} disabled={currentIndex >= allMeals.length - 1} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: currentIndex >= allMeals.length - 1 ? 0.3 : 1 }}><FaChevronRight color="black" /></button>

            <div style={{ position: 'absolute', bottom: '10px', right: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.7)', letterSpacing: '1px', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{t('aiRating')}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {RATING_OPTIONS.map(r => {
                  const currentRating = isEditing ? editRating : meal.rating;
                  const isActive = currentRating === r.value;
                  const activeColor = r.value === 2 ? 'rgba(34,197,94,0.85)' : r.value === 1 ? 'rgba(234,179,8,0.85)' : 'rgba(239,68,68,0.85)';
                  return (
                    <button key={r.value} onClick={() => { if (!isEditing) return; setEditRating(editRating === r.value ? null : r.value); }} style={{ width: '34px', height: '34px', backgroundColor: isActive ? activeColor : 'rgba(0,0,0,0.35)', border: 'none', borderRadius: '50%', cursor: isEditing ? 'pointer' : 'default', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, backdropFilter: 'blur(4px)', transition: 'background-color 0.15s', opacity: isEditing ? 1 : (isActive ? 1 : 0.5) }}>{r.emoji}</button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{new Date(meal.created_at).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', { dateStyle: 'long', timeStyle: 'short' })}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {([1, 0.5, 0.25] as const).map(p => (
                      <button key={p} onClick={() => { const baseCalories = meal.original_nutrition?.calories ?? meal.calories; const baseNutrients = meal.original_nutrition?.nutrients ?? meal.nutrient ?? {}; setEditPortion(p); setEditCalories(String(Math.round(baseCalories * p))); setEditNutrient(Object.fromEntries(Object.entries(baseNutrients).map(([k, v]) => [k, v != null ? String(Math.round((v as number) * p * 10) / 10) : '']))); }} style={{ padding: '2px 7px', fontSize: '12px', backgroundColor: editPortion === p ? 'black' : 'white', color: editPortion === p ? 'white' : '#6b7280', border: '1px solid #e5e7eb', cursor: 'pointer' }}>{p === 1 ? '1' : p === 0.5 ? '½' : '¼'}</button>
                    ))}
                  </div>
                ) : (
                  meal.portion != null && meal.portion !== 1 && <span style={{ fontSize: '11px', color: '#6B21A8' }}>{meal.portion === 0.5 ? '½' : '¼'}</span>
                )}
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button onClick={() => { setIsEditing(false); setShowAddNutrient(false); }} title={t('cancelBtn')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '2px', lineHeight: 1 }}>✖️</button>
                    <button onClick={handleEditSave} disabled={savingEdit} title={t('saveBtn')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', padding: '2px', opacity: savingEdit ? 0.5 : 1, lineHeight: 1 }}>✅</button>
                  </div>
                ) : userPlan !== 'free' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(meal.id) ? (
                  <button onClick={startEdit} title={t('editBtn')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '2px', filter: 'grayscale(1)', lineHeight: 1 }}>✏️</button>
                ) : userPlan !== 'free' ? (
                  <button onClick={() => alert(t('cloudRequired'))} title={t('editBtn')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '2px', opacity: 0.35, lineHeight: 1 }}>☁️</button>
                ) : (
                  <button onClick={() => alert(t('proRequired'))} title={t('editBtn')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '2px', opacity: 0.35, lineHeight: 1 }}>🔒</button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ flex: 1, marginRight: '12px' }}>
                {isEditing ? <input value={editFoodName} onChange={e => setEditFoodName(e.target.value)} onFocus={selectAll} style={{ fontSize: '22px', fontWeight: 400, border: '2px solid #e5e7eb', borderRadius: '4px', padding: '4px 8px', width: '100%', outline: 'none', backgroundColor: '#fafafa' }} /> : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 400 }}>{meal.food_name}{meal.is_edited && <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '6px' }}>{t('edited')}</span>}</h2>
                    {isUnrecognizedMeal(meal) && <span style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px', whiteSpace: 'nowrap' }}>{t('unrecognized')}</span>}
                  </div>
                )}
                <p style={{ fontSize: '14px', color: '#6B21A8', marginTop: '2px' }}>{CATEGORY_MAP[meal.category || '기타'] ?? meal.category}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                {isEditing ? <input value={editCalories} onChange={e => handleNumericInput('calories', e.target.value, setEditCalories)} onFocus={selectAll} inputMode="decimal" style={{ fontSize: '24px', color: '#6B21A8', border: `2px solid ${invalidFields.has('calories') ? '#ef4444' : '#e5e7eb'}`, borderRadius: '4px', padding: '2px 6px', width: '80px', textAlign: 'right', outline: 'none', backgroundColor: '#fafafa', transition: 'border-color 0.2s' }} /> : <p style={{ fontSize: '28px', color: 'black', lineHeight: 1 }}>{meal.calories}</p>}
                <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px' }}>KCAL</p>
              </div>
            </div>

            {isUnrecognizedMeal(meal) && token && !isEditing && (
              <button onClick={() => { setRecoverName(''); setRecoverError(''); setShowRecover(true); }} style={{ width: '100%', padding: '14px', marginBottom: '20px', backgroundColor: '#fffbeb', border: '1px dashed #f59e0b', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                🔍 {t('recoverCta')}
              </button>
            )}

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase' }}>{t('nutritionalInfo')}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isEditing && meal.is_edited && meal.original_nutrition && (
                    <button onClick={() => setShowOriginal(p => !p)} title={showOriginal ? t('showEdited') : t('showOriginal')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '0', opacity: showOriginal ? 1 : 0.45, lineHeight: 1 }}>🔄</button>
                  )}
                  {isEditing && !showOriginal && <span style={{ fontSize: '10px', color: '#6B21A8' }}>✏️ {t('editing')}</span>}
                  {showOriginal && <span style={{ fontSize: '10px', color: '#9ca3af' }}>{t('aiOriginal')}</span>}
                </div>
              </div>
              {(() => {
                const displayNutrient = showOriginal && meal.original_nutrition ? meal.original_nutrition.nutrients : meal.nutrient;
                const mainFields = [ { key: 'carbohydrates', unit: 'g' }, { key: 'protein', unit: 'g' }, { key: 'fat', unit: 'g' } ];
                const subAllFields = [ { key: 'fiber', unit: 'g' }, { key: 'sugar', unit: 'g' }, { key: 'sodium', unit: 'mg' }, { key: 'caffeine', unit: 'mg' }, { key: 'vitaminA', unit: 'μg' }, { key: 'vitaminC', unit: 'mg' }, { key: 'vitaminD', unit: 'μg' }, { key: 'calcium', unit: 'mg' }, { key: 'iron', unit: 'mg' }, { key: 'potassium', unit: 'mg' } ];
                const subFields = subAllFields.filter(n => { const val = (displayNutrient as any)?.[n.key]; return (val != null && val !== 0) || (isEditing && editNutrient[n.key] !== undefined); });
                const subRemainder = subFields.length % 3;
                const subPadCount = subRemainder === 0 ? 0 : 3 - subRemainder;
                const bgMain = isEditing && !showOriginal ? '#fafafa' : 'white';
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', backgroundColor: '#e5e7eb' }}>
                      {mainFields.map(n => (
                        <div key={n.key} style={{ padding: '18px 8px', backgroundColor: bgMain, textAlign: 'center' }}>
                          <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '6px' }}>{NUTRIENT_LABELS[n.key]}</p>
                          {isEditing && !showOriginal ? <input value={editNutrient[n.key] ?? ''} onChange={e => handleNumericInput(n.key, e.target.value, v => setEditNutrient(prev => ({ ...prev, [n.key]: v })))} onFocus={selectAll} inputMode="decimal" style={{ fontSize: '16px', border: `1.5px solid ${invalidFields.has(n.key) ? '#ef4444' : '#d1d5db'}`, borderRadius: '3px', width: '64px', textAlign: 'center', padding: '4px 2px', outline: 'none', backgroundColor: 'white', transition: 'border-color 0.2s' }} /> : <p style={{ fontSize: '18px', color: '#111' }}>{(displayNutrient as any)?.[n.key]}{n.unit}</p>}
                        </div>
                      ))}
                    </div>
                    {subFields.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', backgroundColor: '#e5e7eb' }}>
                        {subFields.map(n => (
                          <div key={n.key} style={{ padding: '9px 8px', backgroundColor: bgMain, textAlign: 'center' }}>
                            <p style={{ fontSize: '9px', color: '#9ca3af', marginBottom: '3px' }}>{NUTRIENT_LABELS[n.key]}</p>
                            {isEditing && !showOriginal ? <input value={editNutrient[n.key] ?? ''} onChange={e => handleNumericInput(n.key, e.target.value, v => setEditNutrient(prev => ({ ...prev, [n.key]: v })))} onFocus={selectAll} inputMode="decimal" style={{ fontSize: '11px', border: `1.5px solid ${invalidFields.has(n.key) ? '#ef4444' : '#d1d5db'}`, borderRadius: '3px', width: '46px', textAlign: 'center', padding: '2px', outline: 'none', backgroundColor: 'white', transition: 'border-color 0.2s' }} /> : <p style={{ fontSize: '12px', color: '#374151' }}>{(displayNutrient as any)?.[n.key]}{n.unit}</p>}
                          </div>
                        ))}
                        {Array.from({ length: subPadCount }).map((_, i) => <div key={`pad_${i}`} style={{ padding: '9px 8px', backgroundColor: bgMain }} />)}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {userPlan !== null && userPlan !== 'free' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(meal.id) && (() => {
              const vis = meal.visibility ?? 'private';
              const OPTIONS = [
                { value: 'private' as const, label: t('visibility.private'), emoji: '🔒', desc: t('visibility.privateDesc') },
                { value: 'neighbors' as const, label: t('visibility.neighbors'), emoji: '👥', desc: t('visibility.neighborsDesc') },
                { value: 'public' as const, label: t('visibility.public'), emoji: '🌏', desc: t('visibility.publicDesc') },
              ];
              return (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
                  <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>{t('visibility.title')}</p>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {OPTIONS.map(opt => {
                      const active = vis === opt.value;
                      return (
                        <button key={opt.value} onClick={() => handleVisibilityChange(opt.value)} style={{ flex: 1, padding: '10px 6px', border: `1px solid ${active ? '#a855f7' : '#e5e7eb'}`, backgroundColor: active ? '#f5f3ff' : 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '16px' }}>{opt.emoji}</span>
                          <span style={{ fontSize: '11px', fontWeight: active ? 600 : 400, color: active ? '#6B21A8' : '#374151' }}>{opt.label}</span>
                          <span style={{ fontSize: '9px', color: '#9ca3af', lineHeight: 1.3, textAlign: 'center' }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {isEditing && (
              <div style={{ marginTop: '16px' }}>
                {!showAddNutrient ? <button onClick={() => setShowAddNutrient(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '12px', color: '#6B21A8', backgroundColor: 'white', border: '1px dashed #c4b5fd', cursor: 'pointer', letterSpacing: '0.5px' }}>{t('addNutrient')}</button> : (
                  <div style={{ border: '1px solid #e5e7eb', padding: '16px', backgroundColor: '#fafafa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}><p style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{t('selectNutrient')}</p><button onClick={() => setShowAddNutrient(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#9ca3af', padding: 0 }}>✕</button></div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {Object.entries(NUTRIENT_LABELS).filter(([key]) => { const origVal = (meal.nutrient as any)?.[key]; const isZeroOrMissing = origVal == null || origVal === 0; const alreadyAdded = editNutrient[key] !== undefined && editNutrient[key] !== ''; return isZeroOrMissing && !alreadyAdded; }).map(([key, label]) => {
                        const unit = ['sodium', 'caffeine', 'vitaminC', 'calcium', 'iron', 'potassium'].includes(key) ? 'mg' : ['vitaminA', 'vitaminD'].includes(key) ? 'μg' : 'g';
                        return <button key={key} onClick={() => { setEditNutrient(prev => ({ ...prev, [key]: '' })); setShowAddNutrient(false); }} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: 'white', border: '1px solid #e5e7eb', cursor: 'pointer', color: '#374151', transition: 'all 0.15s' }}>{label} <span style={{ color: '#9ca3af', fontSize: '10px' }}>({unit})</span></button>;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <div style={{ position: 'fixed', top: '70px', right: '16px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 50 }}>
            <button onClick={() => setGalleryMode('detail')} style={{ width: '44px', height: '44px', backgroundColor: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(6px)', color: 'white', fontSize: '10px', letterSpacing: '0.5px' }}>✕</button>
            <button onClick={() => setGalleryMode(galleryMode === 'grid4' ? 'grid16' : 'grid4')} style={{ width: '44px', height: '44px', backgroundColor: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(6px)' }}>{galleryMode === 'grid4' ? <FaTh size={16} color="white" /> : <FaThLarge size={16} color="white" />}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '2px', backgroundColor: '#e5e7eb' }}>
            {allMeals.slice().reverse().map((m) => (
              <div key={m.id} onClick={() => router.push(`/history/${m.id}`)} style={{ position: 'relative', paddingBottom: '100%', backgroundColor: m.id === id ? '#d1d5db' : 'white', cursor: 'pointer', outline: m.id === id ? '2px solid black' : 'none', outlineOffset: '-2px' }}>
                {m.photo_url ? <MealPhoto photoUrl={m.photo_url} alt={m.food_name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ position: 'absolute', inset: 0, backgroundColor: '#f3f4f6' }} />}
                {galleryMode === 'grid4' && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 8px 8px', background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)', pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}><span style={{ fontSize: '17px', color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.5)', fontWeight: 400, letterSpacing: '0.5px' }}>{m.calories}</span></div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showRecover && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !recovering && setShowRecover(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100 }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.25 }} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderRadius: '16px 16px 0 0', padding: '24px 24px 36px', zIndex: 101 }}>
              <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>{t('recoverTitle')}</p>
              <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>{t('recoverDesc')}</p>
              <input
                value={recoverName}
                onChange={e => setRecoverName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRecover(); }}
                placeholder={t('recoverPlaceholder')}
                autoFocus
                maxLength={100}
                style={{ width: '100%', padding: '12px 14px', fontSize: '16px', border: '2px solid #e5e7eb', borderRadius: '8px', outline: 'none', marginBottom: '10px', boxSizing: 'border-box' }}
              />
              {recoverError && <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '10px' }}>{recoverError}</p>}
              <button
                onClick={handleRecover}
                disabled={recovering || !recoverName.trim()}
                style={{ width: '100%', padding: '14px', fontSize: '14px', fontWeight: 600, backgroundColor: recovering || !recoverName.trim() ? '#e9d5ff' : '#6B21A8', color: 'white', border: 'none', borderRadius: '8px', cursor: recovering || !recoverName.trim() ? 'default' : 'pointer' }}
              >
                {recovering ? t('recovering') : t('recoverSubmit')}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
