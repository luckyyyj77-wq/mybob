"use client";

import Link from 'next/link';
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
  totalCalories: number;
  avgCalories: number;
  firstDate: string | null;
  lastDate: string | null;
  topCategory: string | null;
};

function computeStats(meals: Meal[]): Stats {
  if (meals.length === 0) {
    return { total: 0, totalCalories: 0, avgCalories: 0, firstDate: null, lastDate: null, topCategory: null };
  }
  const sorted = [...meals].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const totalCalories = meals.reduce((s, m) => s + (m.calories || 0), 0);
  const catCount: Record<string, number> = {};
  meals.forEach(m => { if (m.category) catCount[m.category] = (catCount[m.category] || 0) + 1; });
  const topCategory = Object.keys(catCount).sort((a, b) => catCount[b] - catCount[a])[0] || null;
  return {
    total: meals.length,
    totalCalories,
    avgCalories: Math.round(totalCalories / meals.length),
    firstDate: sorted[0].created_at,
    lastDate: sorted[sorted.length - 1].created_at,
    topCategory,
  };
}

function exportJSON(meals: Meal[]) {
  const payload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    app: 'MyBob',
    description: '개인 식단 영양 기록 — 온디바이스 AI 분석용',
    summary: computeStats(meals),
    meals,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mybob_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(meals: Meal[]) {
  const header = ['날짜', '음식명', '카테고리', '칼로리(kcal)', '탄수화물(g)', '단백질(g)', '지방(g)', '식이섬유(g)', '당류(g)', '나트륨(mg)'];
  const rows = meals.map(m => [
    new Date(m.created_at).toLocaleString('ko-KR'),
    m.food_name,
    m.category || '',
    m.calories,
    m.nutrient?.carbohydrates ?? '',
    m.nutrient?.protein ?? '',
    m.nutrient?.fat ?? '',
    m.nutrient?.fiber ?? '',
    m.nutrient?.sugar ?? '',
    m.nutrient?.sodium ?? '',
  ]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mybob_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function GoalSettings() {
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState('유지');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('mybob_goal');
    if (raw) {
      const g = JSON.parse(raw);
      setHeight(g.height || '');
      setWeight(g.weight || '');
      setGoal(g.goal || '유지');
    }
  }, []);

  const save = () => {
    localStorage.setItem('mybob_goal', JSON.stringify({ height, weight, goal }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
    fontSize: '14px', backgroundColor: 'white', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
      <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>신체 정보</p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>키 (cm)</p>
            <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="170" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>몸무게 (kg)</p>
            <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="65" style={inputStyle} />
          </div>
        </div>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px', marginTop: '12px' }}>목표</p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {['다이어트', '유지', '증량'].map(g => (
            <button
              key={g}
              onClick={() => setGoal(g)}
              style={{
                flex: 1, padding: '10px', border: '1px solid', fontSize: '13px', cursor: 'pointer',
                borderColor: goal === g ? 'black' : '#e5e7eb',
                backgroundColor: goal === g ? 'black' : 'white',
                color: goal === g ? 'white' : 'black',
              }}
            >
              {g}
            </button>
          ))}
        </div>
        <button
          onClick={save}
          style={{ width: '100%', padding: '12px', border: '1px solid black', backgroundColor: saved ? 'black' : 'white', color: saved ? 'white' : 'black', fontSize: '12px', cursor: 'pointer', letterSpacing: '1px', transition: 'all 0.2s' }}
        >
          {saved ? '저장됨' : '저장'}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [aiAlert, setAiAlert] = useState(true);
  const [notifFreq, setNotifFreq] = useState('1시간 후');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, totalCalories: 0, avgCalories: 0, firstDate: null, lastDate: null, topCategory: null });
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('mybob_meals');
    const parsed: Meal[] = raw ? JSON.parse(raw) : [];
    setMeals(parsed);
    setStats(computeStats(parsed));
  }, []);

  const handleDeleteAll = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    localStorage.removeItem('mybob_meals');
    setMeals([]);
    setStats(computeStats([]));
    setConfirmDelete(false);
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '24px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>APP</p>
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>설정</h1>
        </div>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaArrowLeft size={13} color="black" />
          </div>
        </Link>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

        {/* 기록 통계 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>기록 현황</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: '28px' }}>
          {[
            { label: '총 기록', value: `${stats.total}건` },
            { label: '총 칼로리', value: stats.totalCalories > 0 ? `${stats.totalCalories.toLocaleString()}kcal` : '-' },
            { label: '평균 칼로리', value: stats.avgCalories > 0 ? `${stats.avgCalories}kcal` : '-' },
          ].map(s => (
            <div key={s.label} style={{ padding: '14px 8px', backgroundColor: 'white', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '6px' }}>{s.label}</p>
              <p style={{ fontSize: '14px', color: 'black' }}>{s.value}</p>
            </div>
          ))}
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

        {/* 데이터 내보내기 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>데이터 내보내기</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
          <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>
            <p style={{ fontSize: '13px', color: 'black', marginBottom: '4px' }}>JSON</p>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '10px' }}>전체 영양 정보 포함 · 온디바이스 AI 분석용</p>
            <button
              onClick={() => { if (meals.length === 0) return alert('내보낼 데이터가 없습니다.'); exportJSON(meals); }}
              style={{ width: '100%', padding: '12px', border: '1px solid black', backgroundColor: 'white', fontSize: '12px', cursor: 'pointer', letterSpacing: '1px' }}
            >
              JSON으로 저장
            </button>
          </div>
          <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>
            <p style={{ fontSize: '13px', color: 'black', marginBottom: '4px' }}>CSV</p>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '10px' }}>엑셀 · 스프레드시트 호환</p>
            <button
              onClick={() => { if (meals.length === 0) return alert('내보낼 데이터가 없습니다.'); exportCSV(meals); }}
              style={{ width: '100%', padding: '12px', border: '1px solid #e5e7eb', backgroundColor: 'white', fontSize: '12px', cursor: 'pointer', letterSpacing: '1px' }}
            >
              CSV로 저장
            </button>
          </div>
        </div>

        {/* 알림 설정 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>알림 설정</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: 'white' }}>
            <span style={{ fontSize: '14px', color: 'black' }}>푸시 알림 주기</span>
            <select
              value={notifFreq}
              onChange={(e) => setNotifFreq(e.target.value)}
              style={{ padding: '5px 8px', border: '1px solid #e5e7eb', fontSize: '13px', backgroundColor: 'white', cursor: 'pointer', outline: 'none' }}
            >
              <option>1시간 후</option>
              <option>2시간 후</option>
              <option>수동</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: 'white' }}>
            <span style={{ fontSize: '14px', color: 'black' }}>AI 분석 알림</span>
            <button
              onClick={() => setAiAlert(!aiAlert)}
              style={{ width: '44px', height: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: aiAlert ? 'black' : 'white', cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s', padding: 0 }}
            >
              <span style={{ position: 'absolute', top: '3px', left: aiAlert ? '20px' : '3px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: aiAlert ? 'white' : '#d1d5db', transition: 'left 0.2s' }} />
            </button>
          </div>
        </div>

        {/* 보안 및 개인정보 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>보안 및 개인정보</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '28px' }}>
          {[
            { icon: '📁', title: '사진 저장 위치', desc: 'Supabase Storage — meal_photos/{사용자ID}/{연월}/{파일명}.jpg\n로그인 사용자만 저장되며, 각 사용자 폴더는 완전히 격리됩니다.' },
            { icon: '🔐', title: '인증 방식', desc: 'Supabase JWT 토큰 기반 인증. 로그인하지 않은 상태에서는 클라우드 저장이 이루어지지 않으며, 식단 기록은 이 기기의 로컬 스토리지에만 보관됩니다.' },
            { icon: '🗄️', title: '영양 데이터 저장', desc: '로컬 스토리지(mybob_meals)와 Supabase DB에 이중 저장됩니다. 서버 데이터는 로그인 계정에 귀속되며, 타인이 접근할 수 없습니다.' },
            { icon: '🤖', title: 'AI 분석 데이터', desc: '음식 사진은 Google Gemini API로 전송되어 분석됩니다. 분석 후 원본 이미지는 Gemini 서버에 저장되지 않습니다(Google 정책 기준).' },
            { icon: '🚫', title: '제3자 제공', desc: '수집된 식단 및 영양 데이터는 AI 분석·코칭 목적으로만 사용되며, 제3자에게 판매·제공되지 않습니다.' },
          ].map(item => (
            <div key={item.title} style={{ padding: '14px 16px', backgroundColor: 'white' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <p style={{ fontSize: '12px', color: 'black', fontWeight: 500, marginBottom: '4px' }}>{item.title}</p>
                  <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 목표 설정 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>목표 설정</p>
        <GoalSettings />

        {/* 개인 정보 + 위험 구역 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>개인 정보</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', marginBottom: '40px' }}>
          <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>이메일 주소</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '14px', color: 'black' }}>user@example.com</p>
              <button style={{ padding: '6px 12px', border: '1px solid #e5e7eb', backgroundColor: 'white', fontSize: '12px', cursor: 'pointer' }}>변경</button>
            </div>
          </div>
          <div style={{ padding: '14px 16px', backgroundColor: 'white' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>위험 구역</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDeleteAll}
                style={{ padding: '8px 14px', backgroundColor: confirmDelete ? '#ef4444' : 'white', color: confirmDelete ? 'white' : '#ef4444', border: '1px solid #fca5a5', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                {confirmDelete ? '한 번 더 누르면 삭제됩니다' : '로컬 기록 전체 삭제'}
              </button>
              {confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{ padding: '8px 14px', backgroundColor: 'white', color: '#9ca3af', border: '1px solid #e5e7eb', fontSize: '13px', cursor: 'pointer' }}
                >
                  취소
                </button>
              )}
            </div>
            <button style={{ marginTop: '8px', padding: '8px 14px', backgroundColor: 'white', color: '#ef4444', border: '1px solid #fca5a5', fontSize: '13px', cursor: 'pointer' }}>
              회원 탈퇴
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
