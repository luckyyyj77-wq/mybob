"use client";

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useRouter } from '@/i18n/routing';
import { useAuth } from '@/lib/auth-context';
import { getAchievedStreak, getTotalAchievedDays, GOAL_ACHIEVED_KEY } from '@/lib/goal-achievement';
import { useTranslations, useLocale } from 'next-intl';

interface Meal {
  id: string;
  food_name: string;
  calories: number;
  nutrient: {
    carbohydrates: number;
    protein: number;
    fat: number;
  };
  created_at: string;
}

export default function DailyReportPage() {
  const t = useTranslations('Report');
  const tc = useTranslations('Common');
  const locale = useLocale();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [targetCalories, setTargetCalories] = useState(2000);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const localMeals = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
    setMeals(localMeals);

    const savedTarget = localStorage.getItem('mybob_target_calories');
    if (savedTarget) setTargetCalories(parseInt(savedTarget));

    setLoading(false);
  }, []);

  const dateKey = selectedDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  const dayMeals = meals.filter(m => 
    new Date(m.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) === dateKey
  );

  const totalCalories = dayMeals.reduce((sum, m) => sum + m.calories, 0);
  const totalCarbs = dayMeals.reduce((sum, m) => sum + (m.nutrient?.carbohydrates || 0), 0);
  const totalProtein = dayMeals.reduce((sum, m) => sum + (m.nutrient?.protein || 0), 0);
  const totalFat = dayMeals.reduce((sum, m) => sum + (m.nutrient?.fat || 0), 0);

  const chartData = [
    { name: t('carbs'), value: totalCarbs * 4 },
    { name: t('protein'), value: totalProtein * 4 },
    { name: t('fat'), value: totalFat * 9 },
  ].filter(d => d.value > 0);

  const COLORS = ['#6B21A8', '#9333EA', '#C084FC'];

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const isGoalAchieved = totalCalories > 0 && totalCalories <= targetCalories;
  const streak = getAchievedStreak();
  const totalAchieved = getTotalAchievedDays();

  if (loading) return null;

  return (
    <div style={{ padding: '24px', backgroundColor: 'white', minHeight: 'calc(100svh - 130px)' }}>
      {/* Date Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <button onClick={() => changeDate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
          <FaChevronLeft size={20} color="#6B21A8" />
        </button>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
          {selectedDate.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric', weekday: 'short' })}
        </h2>
        <button onClick={() => changeDate(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
          <FaChevronRight size={20} color="#6B21A8" />
        </button>
      </div>

      {dayMeals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          <p>{t('noData')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Calorie Card */}
          <div style={{ padding: '24px', backgroundColor: '#faf5ff', borderRadius: '16px' }}>
            <p style={{ fontSize: '14px', color: '#6B21A8', marginBottom: '8px' }}>{t('totalCalories')}</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '32px', fontWeight: 700 }}>{totalCalories}</span>
              <span style={{ color: '#9ca3af' }}>/ {targetCalories} kcal</span>
            </div>
            <div style={{ height: '8px', backgroundColor: '#e9d5ff', borderRadius: '4px', marginTop: '16px', overflow: 'hidden' }}>
              <div style={{ 
                height: '100%', 
                width: `${Math.min((totalCalories / targetCalories) * 100, 100)}%`, 
                backgroundColor: totalCalories > targetCalories ? '#ef4444' : '#6B21A8',
                borderRadius: '4px' 
              }} />
            </div>
          </div>

          {/* Nutrient Chart */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{t('nutrientRatio')}</h3>
            <div style={{ height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px' }}>
              {chartData.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: COLORS[i], borderRadius: '2px' }} />
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Achievement */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '32px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{t('goalAchieved')}</h3>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1, padding: '16px', border: '1px solid #e5e7eb', borderRadius: '12px', textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>STREAK</p>
                <p style={{ fontSize: '18px', fontWeight: 600, color: '#6B21A8' }}>{t('streak', { count: streak })}</p>
              </div>
              <div style={{ flex: 1, padding: '16px', border: '1px solid #e5e7eb', borderRadius: '12px', textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>TOTAL</p>
                <p style={{ fontSize: '18px', fontWeight: 600 }}>{t('totalAchieved', { count: totalAchieved })}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
