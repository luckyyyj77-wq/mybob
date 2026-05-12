"use client";

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

interface Meal {
  id: string;
  created_at: string;
  food_name: string;
  calories: number;
  category?: string;
  nutrient?: {
    carbohydrates?: number;
    protein?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
    caffeine?: number | null;
  };
}

// Harris-Benedict 평균 BMR × 가벼운 활동(1.375) 기준 TDEE
function calcTargetCalories(height: number, weight: number, goal: string): number {
  if (!height || !weight) return 2000;
  const bmr = 10 * weight + 6.25 * height - 5 * 30; // 나이 30 고정 (미입력)
  const tdee = Math.round(bmr * 1.375);
  if (goal === '다이어트') return Math.round(tdee * 0.8);
  if (goal === '증량')    return Math.round(tdee * 1.15);
  return tdee;
}

function fmt(date: Date) {
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
}

const COLORS = ['#000000', '#6B21A8', '#9ca3af'];

export default function DailyReportPage() {
  const router = useRouter();
  const [allMeals, setAllMeals] = useState<Meal[]>([]);
  const [targetDate, setTargetDate] = useState(new Date());
  const [targetCalories, setTargetCalories] = useState(2000);

  useEffect(() => {
    // 로컬 + 서버 병합 (홈 페이지와 동일 방식)
    const local: Meal[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
    setAllMeals(local);

    const goal = JSON.parse(localStorage.getItem('mybob_goal') || '{}');
    setTargetCalories(calcTargetCalories(Number(goal.height) || 0, Number(goal.weight) || 0, goal.goal || '유지'));

    // 서버 동기화 (백그라운드)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token;
      fetch('/api/meals', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then(r => r.json()).then(result => {
          if (result.success && Array.isArray(result.data)) {
            const serverIds = new Set(result.data.map((m: Meal) => m.id));
            const merged = [...result.data, ...local.filter(m => !serverIds.has(m.id))];
            setAllMeals(merged);
          }
        }).catch(() => {});
    });
  }, []);

  const dateStr = targetDate.toLocaleDateString();
  const meals = allMeals
    .filter(m => new Date(m.created_at).toLocaleDateString() === dateStr)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const totalCalories = meals.reduce((s, m) => s + (Number(m.calories) || 0), 0);
  const nutrients = meals.reduce(
    (acc, m) => {
      acc.carbs   += Number(m.nutrient?.carbohydrates) || 0;
      acc.protein += Number(m.nutrient?.protein) || 0;
      acc.fat     += Number(m.nutrient?.fat) || 0;
      acc.fiber   += Number(m.nutrient?.fiber) || 0;
      acc.sodium  += Number(m.nutrient?.sodium) || 0;
      acc.caffeine += Number(m.nutrient?.caffeine) || 0;
      return acc;
    },
    { carbs: 0, protein: 0, fat: 0, fiber: 0, sodium: 0, caffeine: 0 }
  );

  const progress = targetCalories > 0 ? Math.min(100, Math.round((totalCalories / targetCalories) * 100)) : 0;
  const remaining = targetCalories - totalCalories;

  const chartData = [
    { name: '탄수화물', value: Math.round(nutrients.carbs) },
    { name: '단백질',   value: Math.round(nutrients.protein) },
    { name: '지방',     value: Math.round(nutrients.fat) },
  ].filter(d => d.value > 0);

  const isToday = targetDate.toLocaleDateString() === new Date().toLocaleDateString();

  const moveDate = (delta: number) => {
    const d = new Date(targetDate);
    d.setDate(d.getDate() + delta);
    if (d <= new Date()) setTargetDate(d);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb' }}>

      {/* 날짜 네비게이션 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 8px', backgroundColor: 'white' }}>
        <button
          onPointerDown={() => moveDate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 20px', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          <FaChevronLeft size={12} color="black" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: 'black', fontWeight: 400 }}>{fmt(targetDate)}</p>
          {isToday && <p style={{ fontSize: '10px', color: '#6B21A8', letterSpacing: '1px' }}>TODAY</p>}
        </div>
        <button
          onPointerDown={() => !isToday && moveDate(1)}
          disabled={isToday}
          style={{ background: 'none', border: 'none', cursor: isToday ? 'default' : 'pointer', padding: '12px 20px', opacity: isToday ? 0.2 : 1, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          <FaChevronRight size={12} color="black" />
        </button>
      </div>

      {meals.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', backgroundColor: 'white' }}>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>이 날의 기록이 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 칼로리 목표 진행 */}
          <div style={{ padding: '20px 20px 16px', backgroundColor: 'white' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>칼로리 목표</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '28px', color: 'black', lineHeight: 1 }}>{totalCalories.toLocaleString()}</span>
                <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '4px' }}>kcal</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '11px', color: '#9ca3af' }}>목표 {targetCalories.toLocaleString()} kcal</p>
                <p style={{ fontSize: '12px', color: remaining >= 0 ? '#6B21A8' : '#ef4444' }}>
                  {remaining >= 0 ? `${remaining.toLocaleString()} 남음` : `${Math.abs(remaining).toLocaleString()} 초과`}
                </p>
              </div>
            </div>
            {/* 진행 바 */}
            <div style={{ height: '4px', backgroundColor: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                backgroundColor: progress >= 100 ? '#ef4444' : '#6B21A8',
                transition: 'width 0.4s ease',
              }} />
            </div>
            <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '6px', textAlign: 'right' }}>{progress}%</p>
          </div>

          {/* 요약 카드 4개 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px', backgroundColor: '#e5e7eb' }}>
            {[
              { label: '기록 횟수', value: meals.length, unit: '회' },
              { label: '탄수화물', value: Math.round(nutrients.carbs), unit: 'g' },
              { label: '단백질',   value: Math.round(nutrients.protein), unit: 'g' },
              { label: '지방',     value: Math.round(nutrients.fat), unit: 'g' },
            ].map(s => (
              <div key={s.label} style={{ padding: '16px', backgroundColor: 'white' }}>
                <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>{s.label}</p>
                <p style={{ fontSize: '20px', color: 'black', lineHeight: 1 }}>
                  {s.value} <span style={{ fontSize: '11px', color: '#9ca3af' }}>{s.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* 기타 영양소 (식이섬유·나트륨·카페인) */}
          {(nutrients.fiber > 0 || nutrients.sodium > 0 || nutrients.caffeine > 0) && (
            <div style={{ display: 'flex', gap: '1px', backgroundColor: '#e5e7eb' }}>
              {nutrients.fiber > 0 && (
                <div style={{ flex: 1, padding: '14px 12px', backgroundColor: 'white', textAlign: 'center' }}>
                  <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>식이섬유</p>
                  <p style={{ fontSize: '16px', color: 'black' }}>{Math.round(nutrients.fiber)}<span style={{ fontSize: '10px', color: '#9ca3af' }}>g</span></p>
                </div>
              )}
              {nutrients.sodium > 0 && (
                <div style={{ flex: 1, padding: '14px 12px', backgroundColor: 'white', textAlign: 'center' }}>
                  <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>나트륨</p>
                  <p style={{ fontSize: '16px', color: nutrients.sodium > 2000 ? '#ef4444' : 'black' }}>{Math.round(nutrients.sodium)}<span style={{ fontSize: '10px', color: '#9ca3af' }}>mg</span></p>
                </div>
              )}
              {nutrients.caffeine > 0 && (
                <div style={{ flex: 1, padding: '14px 12px', backgroundColor: 'white', textAlign: 'center' }}>
                  <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>카페인</p>
                  <p style={{ fontSize: '16px', color: nutrients.caffeine > 400 ? '#ef4444' : 'black' }}>{Math.round(nutrients.caffeine)}<span style={{ fontSize: '10px', color: '#9ca3af' }}>mg</span></p>
                </div>
              )}
            </div>
          )}

          {/* 영양소 도넛 차트 */}
          {chartData.length > 0 && (
            <div style={{ padding: '20px', backgroundColor: 'white' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>영양소 밸런스</p>
              <div style={{ height: '160px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={44} outerRadius={62} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 0, fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '4px' }}>
                {chartData.map((item, i) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: COLORS[i], display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>{item.name} {item.value}g</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 식사 목록 */}
          <div style={{ backgroundColor: 'white' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase' }}>식사 기록</p>
            </div>
            {meals.map((meal, i) => (
              <div
                key={meal.id}
                onClick={() => router.push(`/history/${meal.id}`)}
                style={{
                  padding: '14px 20px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: i < meals.length - 1 ? '1px solid #f3f4f6' : 'none',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <p style={{ fontSize: '14px', color: 'black' }}>{meal.food_name}</p>
                  <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>
                    {new Date(meal.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    {meal.category ? ` · ${meal.category}` : ''}
                  </p>
                </div>
                <p style={{ fontSize: '15px', color: '#6B21A8' }}>{meal.calories} kcal</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
