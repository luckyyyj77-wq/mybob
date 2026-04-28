"use client";

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { FaFireAlt, FaCalendarAlt, FaChartBar } from 'react-icons/fa';

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

export default function MonthlyReportPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeals = async () => {
      try {
        const response = await fetch('/api/meals');
        const result = await response.json();
        if (result.success) {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const monthlyMeals = result.data.filter((meal: Meal) => new Date(meal.created_at) >= thirtyDaysAgo);
          setMeals(monthlyMeals);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMeals();
  }, []);

  if (loading) return <div className="text-center py-20 text-purple-600">월간 데이터 분석 중...</div>;
  if (meals.length === 0) return <div className="text-center py-20 text-gray-500 text-xl">최근 30일간의 기록이 없습니다.</div>;

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
      <h2 className="text-3xl font-bold text-gray-800 text-center mb-8">월간 건강 리포트</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-orange-50 p-6 rounded-2xl flex items-center shadow-sm">
          <div className="bg-orange-500 p-4 rounded-xl text-white mr-4">
            <FaFireAlt className="text-2xl" />
          </div>
          <div>
            <p className="text-orange-600 text-sm font-semibold uppercase">월간 총 칼로리</p>
            <p className="text-2xl font-bold text-orange-900">{totalCalories.toLocaleString()} kcal</p>
          </div>
        </div>
        <div className="bg-indigo-50 p-6 rounded-2xl flex items-center shadow-sm">
          <div className="bg-indigo-500 p-4 rounded-xl text-white mr-4">
            <FaCalendarAlt className="text-2xl" />
          </div>
          <div>
            <p className="text-indigo-600 text-sm font-semibold uppercase">월간 평균 칼로리</p>
            <p className="text-2xl font-bold text-indigo-900">{Math.round(totalCalories / 30).toLocaleString()} kcal</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
          <FaChartBar className="mr-2 text-indigo-500" /> 월간 영양 밸런스
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

      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-xl font-bold text-gray-800 mb-4">월간 섭취 분석</h3>
        <p className="text-gray-600">지난 30일 동안 총 {meals.length}번의 식사를 기록하셨습니다. </p>
        <p className="text-gray-600 mt-2">균형 잡힌 식단을 위해 단백질 섭취 비율을 확인해 보세요!</p>
      </div>
    </div>
  );
}
