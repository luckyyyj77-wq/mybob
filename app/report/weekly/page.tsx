"use client";

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, PieChart, Pie, Cell } from 'recharts';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useAuth } from '@/lib/auth-context';

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
    caffeine?: number | null;
  };
}

function calcTargetCalories(height: number, weight: number, goal: string): number {
  if (!height || !weight) return 2000;
  const bmr = 10 * weight + 6.25 * height - 5 * 30;
  const tdee = Math.round(bmr * 1.375);
  if (goal === '다이어트') return Math.round(tdee * 0.8);
  if (goal === '증량')    return Math.round(tdee * 1.15);
  return tdee;
}

// 해당 주의 월요일 반환
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const COLORS = ['#000000', '#6B21A8', '#9ca3af'];
const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export default function WeeklyReportPage() {
  const { token } = useAuth();
  const [allMeals, setAllMeals] = useState<Meal[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [targetCalories, setTargetCalories] = useState(2000);

  useEffect(() => {
    const local: Meal[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
    setAllMeals(local);

    const goal = JSON.parse(localStorage.getItem('mybob_goal') || '{}');
    setTargetCalories(calcTargetCalories(Number(goal.height) || 0, Number(goal.weight) || 0, goal.goal || '유지'));

    if (token === null) return;
    fetch('/api/meals', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json()).then(result => {
        if (result.success && Array.isArray(result.data)) {
          const serverIds = new Set(result.data.map((m: Meal) => m.id));
          const merged = [...result.data, ...local.filter(m => !serverIds.has(m.id))];
          setAllMeals(merged);
        }
      }).catch(() => {});
  }, [token]);

  // 주간 범위 계산
  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const isThisWeek = weekOffset === 0;

  const fmtRange = (start: Date, end: Date) => {
    const s = start.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    const e = end.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    return `${s} — ${e}`;
  };

  const toKSTKey = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayKSTKey = toKSTKey(new Date());

  // 7일치 데이터 생성
  const weekData = DAY_LABELS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const dateStr = toKSTKey(d);
    const dayMeals = allMeals.filter(m => toKSTKey(new Date(m.created_at)) === dateStr);
    const calories = dayMeals.reduce((s, m) => s + (Number(m.calories) || 0), 0);
    const isToday = dateStr === todayKSTKey;
    const isFuture = dateStr > todayKSTKey;
    return { label, calories, isToday, isFuture, date: d };
  });

  // 주간 집계
  const recordedDays = weekData.filter(d => d.calories > 0);
  const weekMeals = allMeals.filter(m => {
    const t = new Date(m.created_at).getTime();
    return t >= monday.getTime() && t <= sunday.getTime();
  });

  const totalCalories = weekMeals.reduce((s, m) => s + (Number(m.calories) || 0), 0);
  const avgCalories = recordedDays.length > 0 ? Math.round(totalCalories / recordedDays.length) : 0;
  const weekTarget = targetCalories * 7;

  const nutrients = weekMeals.reduce(
    (acc, m) => {
      acc.carbs   += Number(m.nutrient?.carbohydrates) || 0;
      acc.protein += Number(m.nutrient?.protein) || 0;
      acc.fat     += Number(m.nutrient?.fat) || 0;
      return acc;
    },
    { carbs: 0, protein: 0, fat: 0 }
  );

  const chartData = [
    { name: '탄수화물', value: Math.round(nutrients.carbs) },
    { name: '단백질',   value: Math.round(nutrients.protein) },
    { name: '지방',     value: Math.round(nutrients.fat) },
  ].filter(d => d.value > 0);

  // 카테고리 TOP 3
  const catCount: Record<string, number> = {};
  weekMeals.forEach(m => { if (m.category) catCount[m.category] = (catCount[m.category] || 0) + 1; });
  const topCats = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb' }}>

      {/* 주간 네비게이션 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 8px', backgroundColor: 'white' }}>
        <button
          onPointerDown={() => setWeekOffset(w => w - 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 20px', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          <FaChevronLeft size={12} color="black" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: 'black' }}>{fmtRange(monday, sunday)}</p>
          {isThisWeek && <p style={{ fontSize: '10px', color: '#6B21A8', letterSpacing: '1px' }}>THIS WEEK</p>}
        </div>
        <button
          onPointerDown={() => !isThisWeek && setWeekOffset(w => w + 1)}
          disabled={isThisWeek}
          style={{ background: 'none', border: 'none', cursor: isThisWeek ? 'default' : 'pointer', padding: '12px 20px', opacity: isThisWeek ? 0.2 : 1, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          <FaChevronRight size={12} color="black" />
        </button>
      </div>

      {weekMeals.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', backgroundColor: 'white' }}>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>이 주의 기록이 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px', backgroundColor: '#e5e7eb' }}>
            {[
              { label: '주간 총 칼로리', value: totalCalories.toLocaleString(), unit: 'kcal',
                sub: `목표 ${weekTarget.toLocaleString()}`, over: totalCalories > weekTarget },
              { label: '일 평균 칼로리', value: avgCalories.toLocaleString(), unit: 'kcal',
                sub: `목표 ${targetCalories.toLocaleString()}`, over: avgCalories > targetCalories },
              { label: '기록일', value: recordedDays.length, unit: '일', sub: '/ 7일', over: false },
              { label: '총 기록 횟수', value: weekMeals.length, unit: '회', sub: '', over: false },
            ].map(s => (
              <div key={s.label} style={{ padding: '16px', backgroundColor: 'white' }}>
                <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>{s.label}</p>
                <p style={{ fontSize: '20px', color: s.over ? '#ef4444' : 'black', lineHeight: 1 }}>
                  {s.value} <span style={{ fontSize: '11px', color: '#9ca3af' }}>{s.unit}</span>
                </p>
                {s.sub && <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>{s.sub}</p>}
              </div>
            ))}
          </div>

          {/* 막대 그래프 */}
          <div style={{ padding: '20px', backgroundColor: 'white' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>일별 칼로리</p>
            <div style={{ height: '160px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekData} barSize={24} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip
                    contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 0, fontSize: '11px' }}
                    formatter={(v) => [`${Number(v).toLocaleString()} kcal`, '칼로리']}
                    labelFormatter={(label) => `${label}요일`}
                  />
                  <ReferenceLine y={targetCalories} stroke="#6B21A8" strokeDasharray="4 4" strokeWidth={1} />
                  <Bar dataKey="calories" radius={[2, 2, 0, 0]}>
                    {weekData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.isFuture ? '#f3f4f6' : entry.isToday ? '#6B21A8' : entry.calories > targetCalories ? '#ef4444' : '#000000'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '2px', backgroundColor: '#6B21A8', display: 'inline-block', borderTop: '1px dashed #6B21A8' }} />
                <span style={{ fontSize: '10px', color: '#9ca3af' }}>목표 {targetCalories.toLocaleString()} kcal</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#ef4444', display: 'inline-block' }} />
                <span style={{ fontSize: '10px', color: '#9ca3af' }}>목표 초과</span>
              </div>
            </div>
          </div>

          {/* 영양 밸런스 도넛 */}
          {chartData.length > 0 && (
            <div style={{ padding: '20px', backgroundColor: 'white' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>주간 영양 밸런스</p>
              <div style={{ height: '150px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={58} paddingAngle={3} dataKey="value" strokeWidth={0}>
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

          {/* 카테고리 TOP 3 */}
          {topCats.length > 0 && (
            <div style={{ backgroundColor: 'white' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase' }}>많이 먹은 카테고리</p>
              </div>
              {topCats.map(([cat, count], i) => {
                const total = weekMeals.length;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={cat} style={{ padding: '14px 20px', borderBottom: i < topCats.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', color: 'black' }}>{cat}</span>
                      <span style={{ fontSize: '12px', color: '#6B21A8' }}>{count}회 · {pct}%</span>
                    </div>
                    <div style={{ height: '3px', backgroundColor: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: i === 0 ? '#000000' : i === 1 ? '#6B21A8' : '#9ca3af' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
