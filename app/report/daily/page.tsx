"use client";

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Meal {
  id: string;
  created_at: string;
  food_name: string;
  calories: number;
  price: number;
  category: string;
  nutrient: {
    carbohydrates: number;
    protein: number;
    fat: number;
  };
}

const COLORS = ['#000000', '#6B21A8', '#9ca3af'];

export default function DailyReportPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMeals = async () => {
      try {
        const response = await fetch('/api/meals');
        if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
        const result = await response.json();
        if (result.success) {
          const today = new Date().toLocaleDateString();
          const todayMeals = result.data.filter((meal: Meal) =>
            new Date(meal.created_at).toLocaleDateString() === today
          );
          setMeals(todayMeals);
        } else {
          throw new Error(result.error || '알 수 없는 오류가 발생했습니다.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchMeals();
  }, []);

  if (loading) return (
    <div style={{ textAlign: 'center', paddingTop: '60px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '3px', textTransform: 'uppercase' }}>분석 중...</p>
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', paddingTop: '60px' }}>
      <p style={{ color: '#ef4444', fontWeight: 700 }}>오류: {error}</p>
    </div>
  );

  if (meals.length === 0) return (
    <div style={{ textAlign: 'center', paddingTop: '80px' }}>
      <p style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 600, marginBottom: '8px' }}>오늘 기록된 식사가 없습니다.</p>
      <p style={{ fontSize: '13px', color: '#d1d5db' }}>사진을 찍어 식단을 기록해 보세요!</p>
    </div>
  );

  const totalCalories = meals.reduce((sum, meal) => sum + (Number(meal.calories) || 0), 0);
  const totalPrice = meals.reduce((sum, meal) => sum + (Number(meal.price) || 0), 0);
  const totalNutrients = meals.reduce((acc, meal) => {
    acc.carbs += Number(meal.nutrient?.carbohydrates) || 0;
    acc.protein += Number(meal.nutrient?.protein) || 0;
    acc.fat += Number(meal.nutrient?.fat) || 0;
    return acc;
  }, { carbs: 0, protein: 0, fat: 0 });

  const chartData = [
    { name: '탄수화물', value: totalNutrients.carbs },
    { name: '단백질', value: totalNutrients.protein },
    { name: '지방', value: totalNutrients.fat },
  ].filter(d => d.value > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {[
          { label: '총 칼로리', value: `${totalCalories.toLocaleString()}`, unit: 'kcal' },
          { label: '기록 횟수', value: `${meals.length}`, unit: '회' },
          { label: '탄수화물', value: `${totalNutrients.carbs.toFixed(0)}`, unit: 'g' },
          { label: '단백질', value: `${totalNutrients.protein.toFixed(0)}`, unit: 'g' },
        ].map((stat, i) => (
          <div key={stat.label} style={{
            padding: '20px',
            border: '3px solid black',
            boxShadow: i === 0 ? '4px 4px 0px #6B21A8' : '4px 4px 0px black',
          }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
              {stat.label}
            </p>
            <p style={{ fontSize: '24px', fontWeight: 900, color: 'black', lineHeight: 1 }}>
              {stat.value} <span style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af' }}>{stat.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Pie Chart */}
      {chartData.length > 0 && (
        <div style={{ border: '3px solid black', padding: '20px', boxShadow: '4px 4px 0px black' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' }}>
            영양소 밸런스
          </p>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ border: '2px solid black', borderRadius: 0, fontSize: '12px', fontWeight: 700 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px' }}>
            {chartData.map((item, index) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS[index], display: 'inline-block' }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>{item.name} {item.value.toFixed(0)}g</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meal List */}
      <div style={{ border: '3px solid black' }}>
        <div style={{ padding: '16px 20px', borderBottom: '3px solid black', backgroundColor: 'black' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'white', letterSpacing: '3px', textTransform: 'uppercase' }}>
            오늘 먹은 메뉴
          </p>
        </div>
        {meals.map((meal, index) => (
          <div
            key={meal.id}
            style={{
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: index < meals.length - 1 ? '2px solid #f3f4f6' : 'none',
            }}
          >
            <div>
              <p style={{ fontSize: '15px', fontWeight: 900, color: 'black' }}>{meal.food_name}</p>
              <p style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, marginTop: '2px' }}>
                {new Date(meal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <p style={{ fontSize: '16px', fontWeight: 900, color: '#6B21A8' }}>{meal.calories} kcal</p>
          </div>
        ))}
      </div>
    </div>
  );
}
