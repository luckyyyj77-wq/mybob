"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

type MealRow = {
  id: string;
  user_id: string;
  food_name: string;
  category: string;
  calories: number;
  created_at: string;
  photo_url: string | null;
};

const CATEGORIES = ['all', '한식', '중식', '일식', '양식', '간식', '음료', '기타'];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminMealsPage() {
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('all');
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const fetchMeals = useCallback(async (cat: string, q: string, off: number) => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String(off),
      ...(cat !== 'all' && { category: cat }),
      ...(q && { search: q }),
    });

    const res = await fetch(`/api/admin/meals?${params}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const result = await res.json();
    if (result.success) {
      setMeals(result.data);
      setTotal(result.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMeals(category, search, offset);
  }, [category, search, offset, fetchMeals]);

  const handleSearch = () => {
    setSearch(searchInput);
    setOffset(0);
  };

  const handleCategory = (cat: string) => {
    setCategory(cat);
    setOffset(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>MEALS</p>
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: '#0f0f0f', lineHeight: 1 }}>식단 데이터</h1>
        </div>
        <p style={{ fontSize: '12px', color: '#9ca3af' }}>총 {total.toLocaleString()}건</p>
      </div>

      {/* 카테고리 필터 — 가로 스크롤 */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', width: 'max-content', minWidth: '100%' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategory(cat)}
              style={{
                padding: '9px 14px', border: 'none', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap',
                backgroundColor: category === cat ? '#0f0f0f' : 'white',
                color: category === cat ? 'white' : '#9ca3af',
              }}
            >
              {cat === 'all' ? '전체' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* 검색 */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="음식명 검색..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{
            flex: 1, padding: '10px 14px', border: '1px solid #e5e7eb',
            fontSize: '13px', outline: 'none', backgroundColor: 'white',
          }}
        />
        <button
          onClick={handleSearch}
          style={{ padding: '10px 16px', backgroundColor: '#0f0f0f', color: 'white', border: 'none', fontSize: '12px', cursor: 'pointer', letterSpacing: '1px', flexShrink: 0 }}
        >
          검색
        </button>
      </div>

      {/* 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb' }}>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'white' }}>
            <div style={{ width: '20px', height: '20px', border: '2px solid #6B21A8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        ) : meals.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'white' }}>
            <p style={{ fontSize: '13px', color: '#9ca3af' }}>데이터가 없습니다.</p>
          </div>
        ) : (
          meals.map(m => (
            <div key={m.id} style={{ display: 'flex', gap: '12px', padding: '10px 14px', backgroundColor: 'white', alignItems: 'center' }}>
              {/* 썸네일 */}
              <div style={{ width: '40px', height: '40px', backgroundColor: '#f3f4f6', overflow: 'hidden', flexShrink: 0 }}>
                {m.photo_url && !m.photo_url.startsWith('local:') ? (
                  <img src={m.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🍽️</div>
                )}
              </div>
              {/* 내용 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>{m.food_name}</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: '#6B21A8' }}>{m.calories}kcal</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{m.category || '기타'}</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{fmtDate(m.created_at)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 페이지네이션 */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
        <button
          onClick={() => setOffset(Math.max(0, offset - LIMIT))}
          disabled={offset === 0}
          style={{ padding: '9px 18px', border: '1px solid #e5e7eb', backgroundColor: 'white', fontSize: '12px', cursor: offset === 0 ? 'not-allowed' : 'pointer', color: offset === 0 ? '#d1d5db' : 'black' }}
        >
          이전
        </button>
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>
          {offset + 1}–{Math.min(offset + LIMIT, total)} / {total}
        </span>
        <button
          onClick={() => setOffset(offset + LIMIT)}
          disabled={offset + LIMIT >= total}
          style={{ padding: '9px 18px', border: '1px solid #e5e7eb', backgroundColor: 'white', fontSize: '12px', cursor: offset + LIMIT >= total ? 'not-allowed' : 'pointer', color: offset + LIMIT >= total ? '#d1d5db' : 'black' }}
        >
          다음
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
