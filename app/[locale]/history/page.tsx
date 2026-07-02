"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { motion, AnimatePresence } from 'framer-motion';
import { FaThList, FaThLarge, FaTh, FaPlus, FaMinus, FaSearch, FaTimes, FaSpinner } from 'react-icons/fa';
import { useAuth } from '@/lib/auth-context';
import { MealPhoto } from '@/components/MealPhoto';
import { getStorageMode } from '@/lib/storage-mode';
import { useTranslations, useLocale } from 'next-intl';

const DAYS_PER_PAGE = 3;

type Meal = {
  id: string;
  food_name: string;
  calories: number;
  created_at: string;
  photo_url?: string;
  category?: string;
  nutrient?: any;
  is_manual?: boolean;
  _unrecognized?: boolean;
};

type ViewMode = 'full' | 'grid' | 'gallery';
type SortKey = 'date_desc' | 'date_asc' | 'cal_desc' | 'cal_asc';
type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'latenight';

export default function HistoryPage() {
  const router = useRouter();
  const { token } = useAuth();
  const t = useTranslations('History');
  const tc = useTranslations('Common');
  const locale = useLocale();

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('full');
  const [galleryScale, setGalleryScale] = useState(4);

  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<SortKey>('date_desc');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [visibleDays, setVisibleDays] = useState(DAYS_PER_PAGE);
  const [showTop, setShowTop] = useState(false);

  const [showQuickLog, setShowQuickLog] = useState(false);
  const [qlStep, setQlStep] = useState<'time' | 'input'>('time');
  const [qlMealTime, setQlMealTime] = useState<MealTime>('lunch');
  const [qlFoodName, setQlFoodName] = useState('');
  const [qlDate, setQlDate] = useState(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }));
  const [qlHour, setQlHour] = useState(12);
  const [qlMinute, setQlMinute] = useState(30);
  const [qlLoading, setQlLoading] = useState(false);
  const [qlError, setQlError] = useState<string | null>(null);
  const qlInputRef = useRef<HTMLInputElement>(null);

  const SORT_OPTIONS: { value: SortKey; label: string }[] = useMemo(() => [
    { value: 'date_desc', label: t('sort.date_desc') },
    { value: 'date_asc',  label: t('sort.date_asc') },
    { value: 'cal_desc',  label: t('sort.cal_desc') },
    { value: 'cal_asc',   label: t('sort.cal_asc') },
  ], [t]);

  const MEAL_TIMES: { value: MealTime; label: string; emoji: string; defaultHour: number; defaultMinute: number }[] = useMemo(() => [
    { value: 'breakfast', label: t('mealTime.breakfast'), emoji: '🌅', defaultHour: 8,  defaultMinute: 0  },
    { value: 'lunch',     label: t('mealTime.lunch'),     emoji: '☀️', defaultHour: 12, defaultMinute: 30 },
    { value: 'dinner',    label: t('mealTime.dinner'),    emoji: '🌆', defaultHour: 18, defaultMinute: 30 },
    { value: 'snack',     label: t('mealTime.snack'),     emoji: '🍪', defaultHour: 15, defaultMinute: 0  },
    { value: 'latenight', label: t('mealTime.latenight'), emoji: '🌙', defaultHour: 22, defaultMinute: 0  },
  ], [t]);

  const CATEGORIES: { value: string; label: string }[] = useMemo(() => [
    { value: 'all',      label: t('categories.all') },
    { value: '한식',      label: t('categories.korean') },
    { value: '중식',      label: t('categories.chinese') },
    { value: '일식',      label: t('categories.japanese') },
    { value: '양식',      label: t('categories.western') },
    { value: '간식',      label: t('categories.snack') },
    { value: '음료',      label: t('categories.drink') },
    { value: '기타',      label: t('categories.etc') },
  ], [t]);

  const CATEGORY_EMOJI: Record<string, string> = {
    '한식': '🍱', '중식': '🥢', '일식': '🍣', '양식': '🍝',
    '간식': '🍪', '음료': '🧃', '기타': '🍽️',
  };

  const CATEGORY_BG: Record<string, { bg: string; accent: string }> = {
    '한식':   { bg: '#fff8f0', accent: '#f97316' },
    '중식':   { bg: '#fff0f0', accent: '#ef4444' },
    '일식':   { bg: '#f0f4ff', accent: '#6366f1' },
    '양식':   { bg: '#f0fff4', accent: '#16a34a' },
    '간식':   { bg: '#fdf4ff', accent: '#a855f7' },
    '음료':   { bg: '#f0f9ff', accent: '#0ea5e9' },
    '기타':   { bg: '#f9fafb', accent: '#6b7280' },
  };

  const toKSTDateKey = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  };

  const formatDateLabel = (dateStr: string): string => {
    const kstKey = toKSTDateKey(dateStr);
    const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    const yesterday = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    if (kstKey === todayKey) return t('today');
    if (kstKey === yesterdayKey) return t('yesterday');
    return new Date(dateStr).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  };

  const groupByDate = useCallback((meals: Meal[]) => {
    const map = new Map<string, Meal[]>();
    meals.forEach(m => {
      const key = toKSTDateKey(m.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return Array.from(map.entries()).map(([key, meals]) => ({
      dateKey: key,
      label: formatDateLabel(meals[0].created_at),
      meals,
    }));
  }, [locale, t]);

  const applyFilters = useCallback((meals: Meal[], query: string, category: string, sort: SortKey) => {
    let result = [...meals];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(m => m.food_name.toLowerCase().includes(q));
    }
    if (category !== 'all') {
      result = result.filter(m => (m.category || '기타') === category);
    }
    result.sort((a, b) => {
      if (sort === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === 'date_asc')  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === 'cal_desc')  return b.calories - a.calories;
      if (sort === 'cal_asc')   return a.calories - b.calories;
      return 0;
    });
    return result;
  }, []);

  useEffect(() => {
    const local: Meal[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
    const sorted = (arr: Meal[]) => arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setMeals(sorted(local));
    setLoading(false);

    if (token === null) return;
    fetch('/api/meals', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(result => {
        if (result.success && Array.isArray(result.data)) {
          const serverIds = new Set(result.data.map((m: Meal) => m.id));
          const merged = [...result.data, ...local.filter(m => !serverIds.has(m.id))];
          setMeals(sorted(merged));
          localStorage.setItem('mybob_meals', JSON.stringify(merged));
        }
      }).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (showSearch) setTimeout(() => searchInputRef.current?.focus(), 80);
  }, [showSearch]);

  useEffect(() => { setVisibleDays(DAYS_PER_PAGE); }, [query, category, sort, viewMode]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const selectMealTime = (mt: MealTime) => {
    setQlMealTime(mt);
    const found = MEAL_TIMES.find(t => t.value === mt);
    if (found) { setQlHour(found.defaultHour); setQlMinute(found.defaultMinute); }
    setQlStep('input');
    setTimeout(() => qlInputRef.current?.focus(), 100);
  };

  const openQuickLog = () => {
    setQlStep('time');
    setQlFoodName('');
    setQlDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }));
    setQlError(null);
    setShowQuickLog(true);
  };

  const closeQuickLog = () => {
    setShowQuickLog(false);
    setQlStep('time');
    setQlFoodName('');
    setQlError(null);
    setQlLoading(false);
  };

  const handleQuickLogSave = useCallback(async () => {
    if (!qlFoodName.trim()) return;
    setQlLoading(true);
    setQlError(null);

    const createdAt = new Date(`${qlDate}T${String(qlHour).padStart(2, '0')}:${String(qlMinute).padStart(2, '0')}:00+09:00`).toISOString();
    const mode = getStorageMode();

    try {
      if (mode === 'cloud' && token) {
        const res = await fetch('/api/quick-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ foodName: qlFoodName.trim(), mealTime: qlMealTime, createdAt }),
        });
        const result = await res.json();
        if (res.status === 429) { setQlError(t('quickLog.limitError')); setQlLoading(false); return; }
        if (!res.ok) { setQlError(t('quickLog.saveError')); setQlLoading(false); return; }

        const newMeal: Meal = {
          id: result.data?.id ?? Date.now().toString(),
          food_name: qlFoodName.trim(),
          calories: result.nutrition?.calories ?? 0,
          category: result.nutrition?.category ?? '기타',
          nutrient: result.nutrition?.nutrients,
          photo_url: undefined,
          created_at: createdAt,
          is_manual: true,
        };
        setMeals(prev => {
          const updated = [newMeal, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          localStorage.setItem('mybob_meals', JSON.stringify(updated));
          return updated;
        });

      } else {
        let nutrition = { calories: 0, category: '기타', nutrients: {} };
        if (token) {
          const res = await fetch('/api/quick-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ foodName: qlFoodName.trim(), mealTime: qlMealTime, createdAt }),
          });
          if (res.ok) {
            const result = await res.json();
            nutrition = result.nutrition ?? nutrition;
          }
        }

        const mealId = Date.now().toString();
        const newMeal: Meal = {
          id: mealId,
          food_name: qlFoodName.trim(),
          calories: nutrition.calories,
          category: nutrition.category,
          nutrient: nutrition.nutrients,
          photo_url: undefined,
          created_at: createdAt,
          is_manual: true,
        };
        setMeals(prev => {
          const updated = [newMeal, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          localStorage.setItem('mybob_meals', JSON.stringify(updated));
          return updated;
        });
      }

      closeQuickLog();
    } catch {
      setQlError(t('quickLog.saveError'));
      setQlLoading(false);
    }
  }, [qlFoodName, qlMealTime, qlDate, qlHour, qlMinute, token, t]);

  const filtered = useMemo(() => applyFilters(meals, query, category, sort), [meals, query, category, sort, applyFilters]);
  const allGroups = useMemo(() => groupByDate(filtered), [filtered, groupByDate]);
  const groups = useMemo(() => allGroups.slice(0, visibleDays), [allGroups, visibleDays]);
  const visibleFiltered = useMemo(() => groups.flatMap(g => g.meals), [groups]);
  const isFiltered = query.trim() !== '' || category !== 'all' || sort !== 'date_desc';

  const clearAll = () => { setQuery(''); setCategory('all'); setSort('date_desc'); };

  const ManualMealCard = ({ meal }: { meal: Meal }) => {
    const cat = meal.category || '기타';
    const theme = CATEGORY_BG[cat] ?? CATEGORY_BG['기타'];
    const emoji = CATEGORY_EMOJI[cat] ?? '🍽️';
    const tips = t.raw('tips') as string[];
    const tip = tips[Math.abs(parseInt(meal.id.slice(-4)) || 0) % tips.length];
    
    return (
      <div
        onClick={() => router.push(`/history/${meal.id}`)}
        style={{
          flex: 1, border: '1px solid #e5e7eb', backgroundColor: theme.bg,
          cursor: 'pointer', overflow: 'hidden', minHeight: '180px',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px 16px 12px', gap: '8px',
        }}>
          <div style={{ fontSize: '56px', lineHeight: 1 }}>{emoji}</div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '17px', fontWeight: 400, color: 'black', letterSpacing: '-0.3px', marginBottom: '2px' }}>
              {meal.food_name}
            </p>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '0.5px' }}>
              {new Date(meal.created_at).toLocaleTimeString(locale === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              {' · '}{cat}
              {' · '}
              <span style={{ color: '#d1fae5', backgroundColor: '#065f46', padding: '1px 5px', fontSize: '9px', borderRadius: '2px' }}>{t('manualTag')}</span>
            </p>
          </div>
        </div>

        <div style={{
          padding: '10px 16px',
          backgroundColor: 'rgba(255,255,255,0.6)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderTop: `1px solid ${theme.accent}22`,
        }}>
          <div>
            <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '2px' }}>{t('calories')}</p>
            <p style={{ fontSize: '24px', color: theme.accent, lineHeight: 1 }}>{meal.calories}</p>
            <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px' }}>KCAL</p>
          </div>
        </div>

        <div style={{
          padding: '10px 16px',
          backgroundColor: theme.accent + '11',
          borderTop: `1px solid ${theme.accent}22`,
        }}>
          <p style={{ fontSize: '10px', color: theme.accent, lineHeight: 1.5 }}>
            💡 {tip}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>

      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>TIMELINE</p>
          <h1 style={{ fontSize: '26px', fontWeight: 400, color: 'black', letterSpacing: '-1px', lineHeight: 1 }}>{t('title')}</h1>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={openQuickLog}
            style={{ background: 'none', border: '1px solid #e5e7eb', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px' }}
          >
            🍚
          </button>
          <button
            onClick={() => setShowSearch(v => !v)}
            style={{ background: showSearch ? 'black' : 'none', border: '1px solid #e5e7eb', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
          >
            <FaSearch size={12} color={showSearch ? 'white' : 'black'} />
            {isFiltered && !showSearch && (
              <span style={{ position: 'absolute', top: '5px', right: '5px', width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#6B21A8' }} />
            )}
          </button>
          <button onClick={() => setViewMode('full')} style={{ background: viewMode === 'full' ? 'black' : 'none', border: '1px solid #e5e7eb', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><FaThList size={12} color={viewMode === 'full' ? 'white' : 'black'} /></button>
          <button onClick={() => setViewMode('grid')} style={{ background: viewMode === 'grid' ? 'black' : 'none', border: '1px solid #e5e7eb', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><FaThLarge size={12} color={viewMode === 'grid' ? 'white' : 'black'} /></button>
          <button onClick={() => setViewMode('gallery')} style={{ background: viewMode === 'gallery' ? 'black' : 'none', border: '1px solid #e5e7eb', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><FaTh size={12} color={viewMode === 'gallery' ? 'white' : 'black'} /></button>
        </div>
      </div>

      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}
          >
            <div style={{ padding: '12px 24px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #e5e7eb', padding: '8px 12px' }}>
                <FaSearch size={11} color="#9ca3af" style={{ flexShrink: 0 }} />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', color: 'black', backgroundColor: 'transparent' }}
                />
                {query && (
                  <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
                    <FaTimes size={10} color="#9ca3af" />
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => (
                  <button key={cat.value} onClick={() => setCategory(cat.value)} style={{
                    padding: '5px 10px', fontSize: '11px', cursor: 'pointer', border: '1px solid',
                    borderColor: category === cat.value ? 'black' : '#e5e7eb',
                    backgroundColor: category === cat.value ? 'black' : 'white',
                    color: category === cat.value ? 'white' : '#6b7280', letterSpacing: '0.3px',
                  }}>{cat.label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {SORT_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setSort(opt.value)} style={{
                      padding: '5px 10px', fontSize: '11px', cursor: 'pointer', border: '1px solid',
                      borderColor: sort === opt.value ? '#6B21A8' : '#e5e7eb',
                      backgroundColor: sort === opt.value ? '#6B21A8' : 'white',
                      color: sort === opt.value ? 'white' : '#6b7280',
                    }}>{opt.label}</button>
                  ))}
                </div>
                {isFiltered && (
                  <button onClick={clearAll} style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>{tc('retry')}</button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main style={{ flex: 1, padding: viewMode === 'full' ? '20px 24px' : '0' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '80px' }}>
            <div style={{ width: '28px', height: '28px', border: '2px solid black', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', paddingTop: '60px' }}>
            <p style={{ color: '#ef4444', marginBottom: '16px' }}>{error}</p>
            <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', backgroundColor: 'black', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px', letterSpacing: '2px' }}>{tc('retry')}</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: '80px' }}>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>{isFiltered ? t('noResults') : t('noHistory')}</p>
            {!isFiltered && <Link href="/capture" style={{ fontSize: '13px', color: '#6B21A8', textDecoration: 'none', letterSpacing: '1px' }}>{t('startFirst')}</Link>}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === 'full' && (
              <motion.div key="full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {groups.map((group, gi) => (
                  <div key={group.dateKey}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', marginTop: gi > 0 ? '28px' : '0' }}>
                      <span style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '1px', whiteSpace: 'nowrap' }}>{group.label}</span>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '4px', top: '12px', bottom: '12px', width: '1px', backgroundColor: '#e9d5ff' }} />
                      {group.meals.map((meal, index) => (
                        <motion.div key={meal.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }} style={{ display: 'flex', gap: '20px', marginBottom: '16px', position: 'relative' }}>
                          <div style={{ width: '9px', height: '9px', borderRadius: '50%', border: '2px solid #6B21A8', backgroundColor: 'white', flexShrink: 0, marginTop: '16px', zIndex: 1 }} />
                          {meal.is_manual ? <ManualMealCard meal={meal} /> : (
                            <div onClick={() => router.push(`/history/${meal.id}`)} style={{ flex: 1, border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer', overflow: 'hidden' }}>
                              {meal.photo_url && (
                                <div style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden', position: 'relative' }}>
                                  <MealPhoto photoUrl={meal.photo_url} alt={meal.food_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 10px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), transparent)' }}>
                                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.9)', letterSpacing: '0.5px' }}>{new Date(meal.created_at).toLocaleTimeString(locale === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}{meal.category ? ` · ${meal.category}` : ''}</p>
                                  </div>
                                </div>
                              )}
                              <div style={{ padding: '10px 14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                  <div style={{ flex: 1, marginRight: '8px' }}>
                                    <h3 style={{ fontSize: '17px', fontWeight: 400, color: 'black', letterSpacing: '-0.3px' }}>{meal.food_name}</h3>
                                    {meal._unrecognized && (
                                      <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '10px', padding: '2px 7px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px', letterSpacing: '0.3px' }}>
                                        {t('unrecognized')}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <p style={{ fontSize: '18px', fontWeight: 400, color: '#6B21A8', lineHeight: 1 }}>{meal.calories}</p>
                                    <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px' }}>KCAL</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
            {(viewMode === 'grid' || viewMode === 'gallery') && (
              <motion.div key={viewMode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'grid', gridTemplateColumns: `repeat(${viewMode === 'grid' ? 2 : galleryScale}, 1fr)`, gap: '2px', backgroundColor: '#e5e7eb' }}
              >
                {visibleFiltered.map(meal => (
                  <div key={meal.id} onClick={() => router.push(`/history/${meal.id}`)}
                    style={{ position: 'relative', width: '100%', aspectRatio: '1/1', backgroundColor: meal.is_manual ? (CATEGORY_BG[meal.category || '기타']?.bg ?? '#f9fafb') : '#f3f4f6', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {meal.photo_url ? <MealPhoto photoUrl={meal.photo_url} alt={meal.food_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: viewMode === 'grid' ? '48px' : '24px' }}>{CATEGORY_EMOJI[meal.category || '기타'] ?? '🍽️'}</span>}
                    {viewMode === 'grid' && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 8px 8px', background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)', pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}><span style={{ fontSize: '17px', color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.5)', fontWeight: 400, letterSpacing: '0.5px' }}>{meal.calories}</span></div>}
                    {meal._unrecognized && (
                      <div style={{ position: 'absolute', top: '4px', left: '4px', fontSize: '9px', padding: '2px 5px', backgroundColor: 'rgba(254,243,199,0.9)', color: '#92400e', borderRadius: '3px' }}>
                        {t('unrecognized')}
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {!loading && visibleDays < allGroups.length && (
        <div style={{ padding: '16px 24px 32px', display: 'flex', justifyContent: 'center' }}>
          <button onClick={() => setVisibleDays(d => d + DAYS_PER_PAGE)} style={{ padding: '10px 28px', fontSize: '12px', letterSpacing: '1.5px', color: '#6B21A8', backgroundColor: 'white', border: '1px solid #e9d5ff', cursor: 'pointer' }}>{t('loadMore', { count: DAYS_PER_PAGE })}</button>
        </div>
      )}

      {showQuickLog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10002, overscrollBehavior: 'contain' }}>
          <div onClick={closeQuickLog} onTouchMove={e => e.preventDefault()} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', height: qlStep === 'time' ? 'auto' : '520px', maxHeight: '90vh' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}><div style={{ width: '36px', height: '4px', borderRadius: '2px', backgroundColor: '#e5e7eb' }} /></div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 24px 16px' }}>
              <div><p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '2px' }}>{t('quickLog.title')}</p><h2 style={{ fontSize: '20px', fontWeight: 400, color: 'black', letterSpacing: '-0.5px' }}>{qlStep === 'time' ? t('quickLog.stepTime') : t('quickLog.stepInput')}</h2></div>
              <button onClick={closeQuickLog} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}><FaTimes size={16} color="#9ca3af" /></button>
            </div>
            {qlStep === 'time' && (
              <div style={{ padding: '0 24px 32px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
                {MEAL_TIMES.map(mt => (
                  <button key={mt.value} onClick={() => selectMealTime(mt.value)} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 20px', backgroundColor: qlMealTime === mt.value ? '#faf5ff' : '#fafafa', border: `1px solid ${qlMealTime === mt.value ? '#a855f7' : '#e5e7eb'}`, cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: '26px', lineHeight: 1 }}>{mt.emoji}</span>
                    <div><p style={{ fontSize: '15px', color: 'black', marginBottom: '2px' }}>{mt.label}</p><p style={{ fontSize: '11px', color: '#9ca3af' }}>{t('quickLog.defaultTime', { time: `${String(mt.defaultHour).padStart(2, '0')}:${String(mt.defaultMinute).padStart(2, '0')}` })}</p></div>
                  </button>
                ))}
              </div>
            )}
            {qlStep === 'input' && (
              <>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={() => setQlStep('time')} style={{ background: 'none', border: '1px solid #e5e7eb', padding: '6px 10px', fontSize: '11px', cursor: 'pointer', color: '#6b7280' }}>{t('quickLog.changeTime')}</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}><span>{MEAL_TIMES.find(t => t.value === qlMealTime)?.emoji}</span><span style={{ fontSize: '13px', color: '#6B21A8' }}>{MEAL_TIMES.find(t => t.value === qlMealTime)?.label}</span></div>
                  </div>
                  <div><p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>{t('quickLog.dateTime')}</p><div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><input type="date" value={qlDate} max={new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })} onChange={e => setQlDate(e.target.value)} style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', fontSize: '13px', color: 'black', outline: 'none', backgroundColor: 'white' }} /><div style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #e5e7eb', padding: '10px 12px' }}><input type="number" min={0} max={23} value={String(qlHour).padStart(2, '0')} onChange={e => setQlHour(Math.max(0, Math.min(23, Number(e.target.value))))} style={{ width: '32px', border: 'none', outline: 'none', fontSize: '13px', textAlign: 'center', color: 'black' }} /><span style={{ color: '#9ca3af' }}>:</span><input type="number" min={0} max={59} step={5} value={String(qlMinute).padStart(2, '0')} onChange={e => setQlMinute(Math.max(0, Math.min(59, Number(e.target.value))))} style={{ width: '32px', border: 'none', outline: 'none', fontSize: '13px', textAlign: 'center', color: 'black' }} /></div></div></div>
                  <div><p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>{t('quickLog.foodName')}</p><input ref={qlInputRef} value={qlFoodName} onChange={e => setQlFoodName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && qlFoodName.trim()) handleQuickLogSave(); }} placeholder={t('quickLog.placeholder')} style={{ width: '100%', padding: '14px 16px', border: '1px solid #e5e7eb', fontSize: '15px', color: 'black', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }} /><p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px', lineHeight: 1.5 }}>{t('quickLog.guide')}</p></div>
                  {qlError && <p style={{ fontSize: '12px', color: '#ef4444', padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>{qlError}</p>}
                </div>
                <div style={{ padding: '12px 24px 32px', borderTop: '1px solid #f3f4f6', backgroundColor: 'white' }}><button onClick={handleQuickLogSave} disabled={qlLoading || !qlFoodName.trim()} style={{ width: '100%', padding: '15px', backgroundColor: qlFoodName.trim() ? 'black' : '#f3f4f6', color: qlFoodName.trim() ? 'white' : '#9ca3af', border: 'none', fontSize: '14px', letterSpacing: '1px', cursor: qlFoodName.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>{qlLoading ? <><FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> {t('quickLog.adding')}</> : t('quickLog.addBtn')}</button></div>
              </>
            )}
          </div>
        </div>
      )}
      <style>{` @keyframes spin { to { transform: rotate(360deg); } } `}</style>
    </div>
  );
}
