"use client";

import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, Cell, PieChart, Pie } from 'recharts';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useAuth } from '@/lib/auth-context';
import { useTranslations } from 'next-intl';

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

function calcTargetCalories(height: number, weight: number, goal: string): number {
  if (!height || !weight) return 2000;
  const bmr = 10 * weight + 6.25 * height - 5 * 30;
  const tdee = Math.round(bmr * 1.375);
  if (goal === 'diet') return Math.round(tdee * 0.8);
  if (goal === 'bulk') return Math.round(tdee * 1.15);
  return tdee;
}

const PIE_COLORS = ['#000000', '#6B21A8', '#9ca3af'];

function toKSTDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}
function toKSTDay(iso: string): number {
  return parseInt(toKSTDate(iso).slice(8), 10);
}

export default function MonthlyReportPage() {
  const { token } = useAuth();
  const t = useTranslations('Report');
  const [allMeals, setAllMeals] = useState<Meal[]>([]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [targetCalories, setTargetCalories] = useState(2000);

  const { year, month } = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [monthOffset]);

  const isCurrentMonth = monthOffset === 0;

  useEffect(() => {
    const local: Meal[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
    setAllMeals(local);
    const goal = JSON.parse(localStorage.getItem('mybob_goal') || '{}');
    setTargetCalories(calcTargetCalories(Number(goal.height) || 0, Number(goal.weight) || 0, goal.goal || 'maintain'));

    if (token === null) return;
    fetch('/api/meals', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json()).then(result => {
        if (result.success && Array.isArray(result.data)) {
          const serverIds = new Set(result.data.map((m: Meal) => m.id));
          const merged = [...result.data, ...local.filter(m => !serverIds.has(m.id))];
          setAllMeals(merged);
          localStorage.setItem('mybob_meals', JSON.stringify(merged));
        }
      }).catch(() => {});
  }, [token]);

  const monthMeals = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return allMeals.filter(m => toKSTDate(m.created_at).startsWith(prefix));
  }, [allMeals, year, month]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dailyData = useMemo(() => {
    const map: Record<number, number> = {};
    monthMeals.forEach(m => { const day = toKSTDay(m.created_at); map[day] = (map[day] || 0) + m.calories; });
    return Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1, label: `${i + 1}`,
      calories: map[i + 1] || 0,
      isToday: isCurrentMonth && new Date().getDate() === i + 1,
    }));
  }, [monthMeals, daysInMonth, isCurrentMonth]);

  const stats = useMemo(() => {
    if (monthMeals.length === 0) return null;
    const totalCal = monthMeals.reduce((s, m) => s + m.calories, 0);
    const recordedDays = new Set(monthMeals.map(m => toKSTDate(m.created_at))).size;
    const avgCal = recordedDays > 0 ? Math.round(totalCal / recordedDays) : 0;
    const carbs   = monthMeals.reduce((s, m) => s + (m.nutrient?.carbohydrates || 0), 0);
    const protein = monthMeals.reduce((s, m) => s + (m.nutrient?.protein || 0), 0);
    const fat     = monthMeals.reduce((s, m) => s + (m.nutrient?.fat || 0), 0);
    const sodium  = monthMeals.reduce((s, m) => s + (m.nutrient?.sodium || 0), 0);
    const fiber   = monthMeals.reduce((s, m) => s + (m.nutrient?.fiber || 0), 0);
    const goalDays = dailyData.filter(d => d.calories > 0 && d.calories / targetCalories >= 0.8 && d.calories / targetCalories <= 1.2).length;
    const catMap: Record<string, number> = {};
    monthMeals.forEach(m => { if (m.category) catMap[m.category] = (catMap[m.category] || 0) + 1; });
    const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { totalCal, avgCal, recordedDays, carbs, protein, fat, sodium, fiber, goalDays, topCats };
  }, [monthMeals, dailyData, targetCalories]);

  const pieData = stats && (stats.carbs + stats.protein + stats.fat) > 0
    ? [{ name: t('carbs'), value: stats.carbs }, { name: t('protein'), value: stats.protein }, { name: t('fat'), value: stats.fat }]
    : [];

  return (
    <div style={{ padding: '20px 24px 40px' }}>

      {/* 월 네비게이션 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button
          onPointerDown={() => setMonthOffset(o => o - 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 20px', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          <FaChevronLeft size={14} color="black" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '16px', fontWeight: 400, color: 'black' }}>{t('monthTitle', { year, month: month + 1 })}</p>
          {isCurrentMonth && <span style={{ fontSize: '9px', letterSpacing: '2px', color: '#6B21A8', textTransform: 'uppercase' }}>THIS MONTH</span>}
        </div>
        <button
          onPointerDown={() => monthOffset < 0 && setMonthOffset(o => o + 1)}
          disabled={monthOffset >= 0}
          style={{ background: 'none', border: 'none', cursor: monthOffset < 0 ? 'pointer' : 'default', padding: '12px 20px', opacity: monthOffset < 0 ? 1 : 0.2, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          <FaChevronRight size={14} color="black" />
        </button>
      </div>

      {!stats ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: '13px' }}>{t('noMonthlyData')}</div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            {[
              { label: t('totalCal'),    value: stats.totalCal.toLocaleString(), unit: 'kcal', hi: false },
              { label: t('dailyAvg'),    value: stats.avgCal.toLocaleString(),   unit: 'kcal', hi: stats.avgCal > targetCalories },
              { label: t('recordDays'),  value: `${stats.recordedDays}`,         unit: `/ ${daysInMonth}`, hi: false },
              { label: t('goalDays'),    value: `${stats.goalDays}`,             unit: '',   hi: false },
              { label: t('sodiumTotal'), value: Math.round(stats.sodium / 1000 * 10) / 10, unit: 'g', hi: stats.sodium / (stats.recordedDays || 1) > 2000 },
              { label: t('fiberTotal'),  value: Math.round(stats.fiber),         unit: 'g',   hi: false },
            ].map(c => (
              <div key={c.label} style={{ border: '1px solid #e5e7eb', padding: '14px 16px' }}>
                <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>{c.label}</p>
                <p style={{ fontSize: '20px', color: c.hi ? '#ef4444' : 'black', lineHeight: 1 }}>
                  {c.value}<span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '3px' }}>{c.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* 목표 대비 진행 */}
          <div style={{ border: '1px solid #e5e7eb', padding: '16px', marginBottom: '16px' }}>
            <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>{t('avgGoalCal')}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: 'black' }}>{stats.avgCal.toLocaleString()} kcal</span>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>{t('goalLine', { value: targetCalories.toLocaleString() })}</span>
            </div>
            <div style={{ height: '6px', backgroundColor: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, Math.round(stats.avgCal / targetCalories * 100))}%`,
                backgroundColor: stats.avgCal > targetCalories ? '#ef4444' : '#6B21A8', borderRadius: '3px' }} />
            </div>
            <p style={{ fontSize: '11px', color: stats.avgCal > targetCalories ? '#ef4444' : '#6B21A8', marginTop: '6px', textAlign: 'right' }}>
              {stats.avgCal > targetCalories
                ? t('calOver', { value: (stats.avgCal - targetCalories).toLocaleString() })
                : t('calUnder', { value: (targetCalories - stats.avgCal).toLocaleString() })}
            </p>
          </div>

          {/* 일별 바차트 */}
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' }}>{t('dailyCal')}</p>
            <div style={{ height: '130px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} barSize={5} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9ca3af' }} interval={Math.floor(daysInMonth / 6)} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 0, fontSize: '11px' }}
                    formatter={(v) => [`${Number(v).toLocaleString()} kcal`, t('calTooltip')]}
                    labelFormatter={(l) => `${month + 1}/${l}`} />
                  <ReferenceLine y={targetCalories} stroke="#6B21A8" strokeDasharray="4 4" strokeWidth={1} />
                  <Bar dataKey="calories" radius={[2, 2, 0, 0]}>
                    {dailyData.map((e, i) => (
                      <Cell key={i} fill={e.isToday ? '#6B21A8' : e.calories > targetCalories ? '#ef4444' : e.calories === 0 ? '#f3f4f6' : '#000000'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 영양 밸런스 + 카테고리 TOP3 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div style={{ border: '1px solid #e5e7eb', padding: '14px' }}>
              <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>{t('nutrientBalance')}</p>
              {pieData.length > 0 ? (
                <>
                  <div style={{ height: '100px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={44} paddingAngle={3} dataKey="value" strokeWidth={0}>
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 0, fontSize: '10px' }} formatter={(v) => [`${Math.round(Number(v))}g`]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {[{ label: t('carbShort'), v: stats.carbs, c: '#000000' }, { label: t('proteinShort'), v: stats.protein, c: '#6B21A8' }, { label: t('fatShort'), v: stats.fat, c: '#9ca3af' }].map(n => (
                      <div key={n.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: n.c }} />
                          <span style={{ fontSize: '10px', color: '#6b7280' }}>{n.label}</span>
                        </div>
                        <span style={{ fontSize: '10px', color: 'black' }}>{Math.round(n.v)}g</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', paddingTop: '30px' }}>{t('noData')}</p>}
            </div>

            <div style={{ border: '1px solid #e5e7eb', padding: '14px' }}>
              <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>{t('topCat3')}</p>
              {stats.topCats.length === 0
                ? <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', paddingTop: '30px' }}>{t('noData')}</p>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
                    {stats.topCats.map(([cat, count], i) => {
                      const pct = Math.round(count / monthMeals.length * 100);
                      return (
                        <div key={cat}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', color: 'black' }}>{i + 1}. {cat}</span>
                            <span style={{ fontSize: '10px', color: '#9ca3af' }}>{pct}%</span>
                          </div>
                          <div style={{ height: '3px', backgroundColor: '#f3f4f6', borderRadius: '2px' }}>
                            <div style={{ height: '100%', width: `${pct}%`, backgroundColor: i === 0 ? 'black' : i === 1 ? '#6B21A8' : '#9ca3af', borderRadius: '2px' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>}
            </div>
          </div>

          {/* 주차별 평균 */}
          <div style={{ border: '1px solid #e5e7eb', padding: '16px' }}>
            <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' }}>{t('weeklyAvgCals')}</p>
            {Array.from({ length: Math.ceil(daysInMonth / 7) }, (_, w) => {
              const s = w * 7 + 1, e = Math.min(s + 6, daysInMonth);
              const wm = monthMeals.filter(m => { const d = toKSTDay(m.created_at); return d >= s && d <= e; });
              const wd = new Set(wm.map(m => toKSTDate(m.created_at))).size;
              const wa = wd > 0 ? Math.round(wm.reduce((sum, m) => sum + m.calories, 0) / wd) : 0;
              return (
                <div key={w} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af', width: '24px', flexShrink: 0 }}>{t('weekLabel', { n: w + 1 })}</span>
                  <div style={{ flex: 1, height: '6px', backgroundColor: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: wa > 0 ? `${Math.min(100, Math.round(wa / targetCalories * 100))}%` : '0%',
                      backgroundColor: wa > targetCalories ? '#ef4444' : '#000000', borderRadius: '3px' }} />
                  </div>
                  <span style={{ fontSize: '11px', color: 'black', width: '54px', textAlign: 'right', flexShrink: 0 }}>
                    {wa > 0 ? wa.toLocaleString() : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
