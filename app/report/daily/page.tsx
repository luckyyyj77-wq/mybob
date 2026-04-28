"use client";

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { FaFireAlt, FaUtensils, FaWallet, FaChartPie } from 'react-icons/fa';

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

const COLORS = ['#FFBB28', '#FF8042', '#0088FE'];

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

  if (loading) return <div className="text-center py-20 text-xl text-purple-600">데이터 분석 중...</div>;
  if (error) return <div className="text-center py-20 text-red-500 text-xl">오류: {error}</div>;
  if (meals.length === 0) return (
    <div className="text-center py-20">
      <p className="text-2xl text-gray-500 mb-4">오늘 기록된 식사가 없습니다.</p>
      <p className="text-gray-400">사진을 찍어 식단을 기록해 보세요!</p>
    </div>
  );

  const totalCalories = meals.reduce((sum, meal) => sum + (Number(meal.calories) || 0), 0);
  const totalPrice = meals.reduce((sum, meal) => sum + (Number(meal.price) || 0), 0);

  // 영양소 합계 계산
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
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-gray-800 text-center mb-8">오늘의 건강 요약</h2>
      
      {/* 상단 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex items-center shadow-sm">
          <div className="bg-indigo-500 p-4 rounded-xl text-white mr-4">
            <FaFireAlt className="text-2xl" />
          </div>
          <div>
            <p className="text-indigo-600 text-sm font-semibold uppercase">총 칼로리</p>
            <p className="text-2xl font-bold text-indigo-900">{totalCalories.toLocaleString()} kcal</p>
          </div>
        </div>
        
        <div className="bg-green-50 p-6 rounded-2xl border border-green-100 flex items-center shadow-sm">
          <div className="bg-green-500 p-4 rounded-xl text-white mr-4">
            <FaUtensils className="text-2xl" />
          </div>
          <div>
            <p className="text-green-600 text-sm font-semibold uppercase">기록 횟수</p>
            <p className="text-2xl font-bold text-green-900">{meals.length}회</p>
          </div>
        </div>

        <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-100 flex items-center shadow-sm">
          <div className="bg-yellow-500 p-4 rounded-xl text-white mr-4">
            <FaWallet className="text-2xl" />
          </div>
          <div>
            <p className="text-yellow-600 text-sm font-semibold uppercase">예상 지출</p>
            <p className="text-2xl font-bold text-yellow-900">{totalPrice.toLocaleString()} 원</p>
          </div>
        </div>
      </div>

      {/* 영양소 차트 섹션 */}
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
          <FaChartPie className="mr-2 text-purple-500" /> 영양소 밸런스
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
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
                <Legend verticalAlign="middle" align="right" layout="vertical" />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="space-y-4">
            {chartData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index] }}></div>
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <span className="font-semibold text-gray-800">{item.value.toFixed(1)}g</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 오늘의 메뉴 리스트 */}
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-xl font-bold text-gray-800 mb-4">오늘 먹은 메뉴</h3>
        <div className="divide-y divide-gray-100">
          {meals.map((meal) => (
            <div key={meal.id} className="py-4 flex justify-between items-center">
              <div>
                <p className="font-semibold text-gray-800">{meal.food_name}</p>
                <p className="text-sm text-gray-400">{new Date(meal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <p className="font-bold text-indigo-600">{meal.calories} kcal</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
