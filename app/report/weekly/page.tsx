"use client";

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { FaFireAlt, FaCalendarWeek, FaChartLine } from 'react-icons/fa';

interface Meal {
  id: string;
  created_at: string;
  food_name: string;
  calories: number;
  nutrient: {
    carbohydrates: number;
    protein: number;
    fat: number;
  };
}

const COLORS = ['#FFBB28', '#FF8042', '#0088FE'];

export default function WeeklyReportPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeals = async () => {
      try {
        const response = await fetch('/api/meals');
        const result = await response.json();
        if (result.success) {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const weeklyMeals = result.data.filter((meal: Meal) => new Date(meal.created_at) >= sevenDaysAgo);
          setMeals(weeklyMeals);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMeals();
  }, []);

  if (loading) return <div className="text-center py-20 text-purple-600">주간 데이터 분석 중...</div>;
  if (meals.length === 0) return <div className="text-center py-20 text-gray-500 text-xl">최근 7일간의 기록이 없습니다.</div>;

  // 날짜별 데이터 가공 (선 그래프용)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  });

  const dailyData = last7Days.map(date => {
    const dayMeals = meals.filter(m => new Date(m.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) === date);
    return {
      date,
      calories: dayMeals.reduce((sum, m) => sum + (Number(m.calories) || 0), 0)
    };
  });

  const totalCalories = meals.reduce((sum, meal) => sum + (Number(meal.calories) || 0), 0);
  const totalNutrients = meals.reduce((acc, meal) => {
    acc.carbs += Number(meal.nutrient?.carbohydrates) || 0;
    acc.protein += Number(meal.nutrient?.protein) || 0;
    acc.fat += Number(meal.nutrient?.fat) || 0;
    return acc;
  }, { carbs: 0, protein: 0, fat: 0 });

  const pieData = [
    { name: '탄수화물', value: totalNutrients.carbs },
    { name: '단백질', value: totalNutrients.protein },
    { name: '지방', value: totalNutrients.fat },
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-gray-800 text-center mb-8">주간 건강 리포트</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-purple-50 p-6 rounded-2xl flex items-center shadow-sm">
          <div className="bg-purple-500 p-4 rounded-xl text-white mr-4">
            <FaFireAlt className="text-2xl" />
          </div>
          <div>
            <p className="text-purple-600 text-sm font-semibold uppercase">주간 총 칼로리</p>
            <p className="text-2xl font-bold text-purple-900">{totalCalories.toLocaleString()} kcal</p>
          </div>
        </div>
        <div className="bg-blue-50 p-6 rounded-2xl flex items-center shadow-sm">
          <div className="bg-blue-500 p-4 rounded-xl text-white mr-4">
            <FaCalendarWeek className="text-2xl" />
          </div>
          <div>
            <p className="text-blue-600 text-sm font-semibold uppercase">주간 평균 칼로리</p>
            <p className="text-2xl font-bold text-blue-900">{Math.round(totalCalories / 7).toLocaleString()} kcal</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
          <FaChartLine className="mr-2 text-blue-500" /> 주간 칼로리 변화
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="calories" stroke="#8884d8" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
          <FaFireAlt className="mr-2 text-orange-500" /> 주간 영양 밸런스
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
