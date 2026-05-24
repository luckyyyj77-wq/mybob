"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FaThList, FaThLarge, FaTh, FaPlus, FaMinus, FaSearch, FaTimes } from 'react-icons/fa';
import { useAuth } from '@/lib/auth-context';
import { MealPhoto } from '@/components/MealPhoto';

const DAYS_PER_PAGE = 3;

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
type SortKey = 'date_desc' | 'date_asc' | 'cal_desc' | 'cal_asc';

const CATEGORIES = ['전체', '한식', '중식', '일식', '양식', '간식', '음료', '기타'];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'date_desc', label: '최신순' },
  { value: 'date_asc',  label: '오래된순' },
  { value: 'cal_desc',  label: '칼로리 높은순' },
  { value: 'cal_asc',   label: '칼로리 낮은순' },
];

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

function applyFilters(meals: Meal[], query: string, category: string, sort: SortKey): Meal[] {
  let result = [...meals];

  // 검색어
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    result = result.filter(m => m.food_name.toLowerCase().includes(q));
  }

  // 카테고리
  if (category !== '전체') {
    result = result.filter(m => (m.category || '기타') === category);
  }

  // 정렬
  result.sort((a, b) => {
    if (sort === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sort === 'date_asc')  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sort === 'cal_desc')  return b.calories - a.calories;
    if (sort === 'cal_asc')   return a.calories - b.calories;
    return 0;
  });

  return result;
}

export default function HistoryPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('full');
  const [galleryScale, setGalleryScale] = useState(4);

  // 검색 / 필터 / 정렬
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('전체');
  const [sort, setSort] = useState<SortKey>('date_desc');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 날짜 그룹 pagination
  const [visibleDays, setVisibleDays] = useState(DAYS_PER_PAGE);

  // 맨 위로 버튼
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const local: Meal[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
    const sorted = (arr: Meal[]) => arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setMeals(sorted(local));
    setLoading(false);

    if (token === null) return;
    fetch('/api/meals', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json()).then(result => {
        if (result.success && Array.isArray(result.data)) {
          const serverIds = new Set(result.data.map((m: Meal) => m.id));
          const merged = [...result.data, ...local.filter(m => !serverIds.has(m.id))];
          setMeals(sorted(merged));
        }
      }).catch(() => {});
  }, [token]);

  // 검색창 열릴 때 포커스
  useEffect(() => {
    if (showSearch) setTimeout(() => searchInputRef.current?.focus(), 80);
  }, [showSearch]);

  // 필터/정렬 변경 시 visibleDays 리셋
  useEffect(() => {
    setVisibleDays(DAYS_PER_PAGE);
  }, [query, category, sort, viewMode]);

  // 맨 위로 버튼 표시
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleZoom = (delta: number) => {
    setGalleryScale(prev => Math.max(3, Math.min(6, prev + delta)));
  };

  const filtered = useMemo(
    () => applyFilters(meals, query, category, sort),
    [meals, query, category, sort]
  );
  const allGroups = useMemo(() => groupByDate(filtered), [filtered]);
  const groups = useMemo(() => allGroups.slice(0, visibleDays), [allGroups, visibleDays]);
  const visibleFiltered = useMemo(() => groups.flatMap(g => g.meals), [groups]);

  // 검색/필터 활성화 여부
  const isFiltered = query.trim() !== '' || category !== '전체' || sort !== 'date_desc';

  const clearAll = () => {
    setQuery('');
    setCategory('전체');
    setSort('date_desc');
  };

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>TIMELINE</p>
          <h1 style={{ fontSize: '26px', fontWeight: 400, color: 'black', letterSpacing: '-1px', lineHeight: 1 }}>기록</h1>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* 검색 버튼 */}
          <button
            onClick={() => setShowSearch(v => !v)}
            style={{ background: showSearch ? 'black' : 'none', border: '1px solid #e5e7eb', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
          >
            <FaSearch size={12} color={showSearch ? 'white' : 'black'} />
            {/* 필터 활성 표시 dot */}
            {isFiltered && !showSearch && (
              <span style={{ position: 'absolute', top: '5px', right: '5px', width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#6B21A8' }} />
            )}
          </button>
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

      {/* 검색 / 필터 패널 */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}
          >
            <div style={{ padding: '12px 24px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* 검색 인풋 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #e5e7eb', padding: '8px 12px' }}>
                <FaSearch size={11} color="#9ca3af" style={{ flexShrink: 0 }} />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="음식 이름 검색"
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', color: 'black', backgroundColor: 'transparent' }}
                />
                {query && (
                  <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
                    <FaTimes size={10} color="#9ca3af" />
                  </button>
                )}
              </div>

              {/* 카테고리 필터 */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    style={{
                      padding: '5px 10px', fontSize: '11px', cursor: 'pointer', border: '1px solid',
                      borderColor: category === cat ? 'black' : '#e5e7eb',
                      backgroundColor: category === cat ? 'black' : 'white',
                      color: category === cat ? 'white' : '#6b7280',
                      letterSpacing: '0.3px',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* 정렬 + 초기화 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSort(opt.value)}
                      style={{
                        padding: '5px 10px', fontSize: '11px', cursor: 'pointer', border: '1px solid',
                        borderColor: sort === opt.value ? '#6B21A8' : '#e5e7eb',
                        backgroundColor: sort === opt.value ? '#6B21A8' : 'white',
                        color: sort === opt.value ? 'white' : '#6b7280',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {isFiltered && (
                  <button onClick={clearAll} style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    초기화
                  </button>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 결과 수 표시 (검색/필터 활성 시) */}
      {isFiltered && (
        <div style={{ padding: '8px 24px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#fafafa' }}>
          <p style={{ fontSize: '11px', color: '#9ca3af' }}>
            {filtered.length}개 결과
            {query && <span> · "<span style={{ color: 'black' }}>{query}</span>"</span>}
            {category !== '전체' && <span> · <span style={{ color: '#6B21A8' }}>{category}</span></span>}
          </p>
        </div>
      )}

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
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: '80px' }}>
            {isFiltered ? (
              <>
                <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '12px' }}>검색 결과가 없습니다.</p>
                <button onClick={clearAll} style={{ fontSize: '12px', color: '#6B21A8', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.5px' }}>필터 초기화</button>
              </>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>기록된 식단이 없습니다.</p>
                <Link href="/capture" style={{ fontSize: '13px', color: '#6B21A8', textDecoration: 'none', letterSpacing: '1px' }}>지금 기록 시작하기 →</Link>
              </>
            )}
          </div>
        ) : (
          <AnimatePresence mode="wait">

            {/* ── 타임라인 ── */}
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
                        <motion.div
                          key={meal.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          style={{ display: 'flex', gap: '20px', marginBottom: '16px', position: 'relative' }}
                        >
                          <div style={{ width: '9px', height: '9px', borderRadius: '50%', border: '2px solid #6B21A8', backgroundColor: 'white', flexShrink: 0, marginTop: '16px', zIndex: 1 }} />
                          <div
                            onClick={() => router.push(`/history/${meal.id}`)}
                            style={{ flex: 1, border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer', overflow: 'hidden' }}
                          >
                            {meal.photo_url && (
                              <div style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden', position: 'relative' }}>
                                <MealPhoto photoUrl={meal.photo_url} alt={meal.food_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 10px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), transparent)' }}>
                                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.9)', letterSpacing: '0.5px' }}>
                                    {new Date(meal.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                    {meal.category ? ` · ${meal.category}` : ''}
                                  </p>
                                </div>
                              </div>
                            )}
                            <div style={{ padding: '10px 14px' }}>
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

            {/* ── 4분할 ── */}
            {viewMode === 'grid' && (
              <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px', backgroundColor: '#e5e7eb' }}
              >
                {visibleFiltered.map(meal => (
                  <div key={meal.id} onClick={() => router.push(`/history/${meal.id}`)}
                    style={{ position: 'relative', width: '100%', aspectRatio: '1/1', backgroundColor: '#f3f4f6', cursor: 'pointer', overflow: 'hidden' }}
                  >
                    {meal.photo_url && <MealPhoto photoUrl={meal.photo_url} alt={meal.food_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
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
                {visibleFiltered.map(meal => (
                  <div key={meal.id} onClick={() => router.push(`/history/${meal.id}`)}
                    style={{ position: 'relative', width: '100%', aspectRatio: '1/1', backgroundColor: '#f3f4f6', cursor: 'pointer', overflow: 'hidden' }}
                  >
                    {meal.photo_url && <MealPhoto photoUrl={meal.photo_url} alt={meal.food_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                ))}
              </motion.div>
            )}

          </AnimatePresence>
        )}
      </main>

      {/* 더 보기 버튼 */}
      {!loading && visibleDays < allGroups.length && (
        <div style={{ padding: '16px 24px 32px', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => setVisibleDays(d => d + DAYS_PER_PAGE)}
            style={{
              padding: '10px 28px', fontSize: '12px', letterSpacing: '1.5px',
              color: '#6B21A8', backgroundColor: 'white',
              border: '1px solid #e9d5ff', cursor: 'pointer',
            }}
          >
            +3일 더 보기
          </button>
        </div>
      )}

      {/* 맨 위로 버튼 */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed', bottom: '88px', right: '20px',
            width: '40px', height: '40px', borderRadius: '50%',
            backgroundColor: 'rgba(0,0,0,0.6)', border: 'none',
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 50, backdropFilter: 'blur(6px)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 12V4M4 8l4-4 4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
