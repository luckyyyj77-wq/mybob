"use client";

import { Link } from '@/i18n/routing';
import { FaArrowLeft } from 'react-icons/fa';
import { useState, useEffect } from 'react';

type Meal = {
  id: string;
  food_name: string;
  calories: number;
  created_at: string;
  photo_url?: string;
  category?: string;
  nutrient?: {
    carbohydrates?: number;
    protein?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  };
};

type Stats = {
  total: number;
  avgCaloriesPerDay: number;
  topFood: { mealType: string; category: string; foodName: string } | null;
  firstDate: string | null;
  lastDate: string | null;
  topCategory: string | null;
};

const MEAL_TYPE: Record<string, string> = { 한식: '주식', 중식: '주식', 일식: '주식', 양식: '주식', 기타: '주식', 간식: '간식', 음료: '음료' };

function computeStats(meals: Meal[]): Stats {
  if (meals.length === 0) return { total: 0, avgCaloriesPerDay: 0, topFood: null, firstDate: null, lastDate: null, topCategory: null };
  const sorted = [...meals].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const dayCalMap: Record<string, number> = {};
  meals.forEach(m => { const day = m.created_at.slice(0, 10); dayCalMap[day] = (dayCalMap[day] || 0) + (m.calories || 0); });
  const dayVals = Object.values(dayCalMap);
  const avgCaloriesPerDay = Math.round(dayVals.reduce((s, v) => s + v, 0) / dayVals.length);
  const catCount: Record<string, number> = {};
  meals.forEach(m => { if (m.category) catCount[m.category] = (catCount[m.category] || 0) + 1; });
  const topCategory = Object.keys(catCount).sort((a, b) => catCount[b] - catCount[a])[0] || null;
  const foodCount: Record<string, number> = {};
  meals.forEach(m => { const key = `${m.category || '기타'}::${m.food_name}`; foodCount[key] = (foodCount[key] || 0) + 1; });
  const topFoodKey = Object.keys(foodCount).sort((a, b) => foodCount[b] - foodCount[a])[0] || null;
  let topFood: Stats['topFood'] = null;
  if (topFoodKey) { const [cat, name] = topFoodKey.split('::'); topFood = { mealType: MEAL_TYPE[cat] ?? '주식', category: cat, foodName: name }; }
  return { total: meals.length, avgCaloriesPerDay, topFood, firstDate: sorted[0].created_at, lastDate: sorted[sorted.length - 1].created_at, topCategory };
}

function buildJSONBlob(meals: Meal[]) {
  return new Blob([JSON.stringify({ version: '1.0', exportedAt: new Date().toISOString(), app: 'MyBob', meals }, null, 2)], { type: 'application/json' });
}

function buildCSVBlob(meals: Meal[]) {
  const header = ['날짜','음식명','카테고리','칼로리(kcal)','탄수화물(g)','단백질(g)','지방(g)','식이섬유(g)','당류(g)','나트륨(mg)'];
  const rows = meals.map(m => [new Date(m.created_at).toLocaleString('ko-KR'), m.food_name, m.category || '', m.calories, m.nutrient?.carbohydrates ?? '', m.nutrient?.protein ?? '', m.nutrient?.fat ?? '', m.nutrient?.fiber ?? '', m.nutrient?.sugar ?? '', m.nutrient?.sodium ?? '']);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  return new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
}

async function shareOrDownload(meals: Meal[], type: 'json' | 'csv') {
  if (meals.length === 0) { alert('내보낼 데이터가 없습니다.'); return; }
  const date = new Date().toISOString().split('T')[0];
  const filename = `mybob_${date}.${type}`;
  const blob = type === 'json' ? buildJSONBlob(meals) : buildCSVBlob(meals);
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'MyBob 식단 데이터' }); return; } catch (e: any) { if (e.name === 'AbortError') return; }
  }
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({ suggestedName: filename, types: [{ description: type.toUpperCase(), accept: { [blob.type]: [`.${type}`] } }] });
      const writable = await handle.createWritable();
      await writable.write(blob); await writable.close(); return;
    } catch (e: any) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });

export default function DataPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, avgCaloriesPerDay: 0, topFood: null, firstDate: null, lastDate: null, topCategory: null });

  useEffect(() => {
    const raw = localStorage.getItem('mybob_meals');
    const parsed: Meal[] = raw ? JSON.parse(raw) : [];
    setMeals(parsed);
    setStats(computeStats(parsed));
  }, []);

  return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden' }}>

      <div style={{ flexShrink: 0, padding: '24px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>SETTINGS</p>
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>기록 데이터</h1>
        </div>
        <Link href="/settings" style={{ textDecoration: 'none' }}>
          <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaArrowLeft size={13} color="black" />
          </div>
        </Link>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>기록 현황</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: '12px' }}>
          <div style={{ padding: '14px 8px', backgroundColor: 'white', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '6px' }}>총 기록</p>
            <p style={{ fontSize: '14px', color: 'black' }}>{stats.total}건</p>
          </div>
          <div style={{ padding: '14px 8px', backgroundColor: 'white', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '6px' }}>1일 평균</p>
            <p style={{ fontSize: '14px', color: 'black' }}>{stats.avgCaloriesPerDay > 0 ? `${stats.avgCaloriesPerDay.toLocaleString()}kcal` : '-'}</p>
          </div>
          <div style={{ padding: '14px 8px', backgroundColor: 'white', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '6px' }}>자주 먹는 음식</p>
            {stats.topFood ? (
              <div>
                <p style={{ fontSize: '9px', color: '#9ca3af', marginBottom: '2px' }}>{stats.topFood.mealType} · {stats.topFood.category}</p>
                <p style={{ fontSize: '12px', color: '#6B21A8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stats.topFood.foodName}</p>
              </div>
            ) : <p style={{ fontSize: '14px', color: 'black' }}>-</p>}
          </div>
        </div>

        {stats.firstDate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: 'white' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>첫 기록일</span>
              <span style={{ fontSize: '12px', color: 'black' }}>{fmt(stats.firstDate)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: 'white' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>최근 기록일</span>
              <span style={{ fontSize: '12px', color: 'black' }}>{fmt(stats.lastDate!)}</span>
            </div>
            {stats.topCategory && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: 'white' }}>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>가장 많은 카테고리</span>
                <span style={{ fontSize: '12px', color: '#6B21A8' }}>{stats.topCategory}</span>
              </div>
            )}
          </div>
        )}

        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>데이터 내보내기</p>
        <div style={{ display: 'flex', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '12px' }}>
          <button onClick={() => shareOrDownload(meals, 'json')} style={{ flex: 1, padding: '14px 8px', border: 'none', backgroundColor: 'white', fontSize: '13px', cursor: 'pointer', letterSpacing: '0.5px' }}>JSON</button>
          <button onClick={() => shareOrDownload(meals, 'csv')} style={{ flex: 1, padding: '14px 8px', border: 'none', backgroundColor: 'white', fontSize: '13px', cursor: 'pointer', letterSpacing: '0.5px' }}>CSV</button>
        </div>
        <p style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.5 }}>
          JSON: 앱 백업 및 복원에 적합합니다. CSV: 스프레드시트에서 열 수 있습니다.
        </p>
      </div>
    </div>
  );
}
