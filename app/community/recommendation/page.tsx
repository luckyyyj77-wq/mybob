"use client";

import { useState, useEffect } from 'react';
import { FaFireAlt, FaClock, FaUserCircle, FaSpinner } from 'react-icons/fa';

interface Meal {
  id: string;
  food_name: string;
  calories: number;
  photo_url: string;
  created_at: string;
  category: string;
}

export default function CommunityRecommendationPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCommunityFeed = async () => {
      try {
        const response = await fetch('/api/community');
        const result = await response.json();
        if (result.success) {
          setMeals(result.data);
        }
      } catch (error) {
        console.error('Feed error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCommunityFeed();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-orange-600">
        <FaSpinner className="animate-spin text-5xl mb-4" />
        <p className="text-xl font-bold">전 세계의 식단 정보를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {meals.length > 0 ? (
        meals.map((meal) => (
          <div key={meal.id} className="bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group">
            <div className="relative h-64 w-full bg-gray-200 overflow-hidden">
              <img 
                src={meal.photo_url} 
                alt={meal.food_name} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=이미지+없음';
                }}
              />
              <div className="absolute top-4 left-4">
                <span className="bg-orange-500 text-white text-xs font-black px-3 py-1.5 rounded-full shadow-lg">
                  {meal.category || '일반'}
                </span>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex items-center mb-4">
                <FaUserCircle className="text-2xl text-gray-300 mr-2" />
                <span className="text-sm font-bold text-gray-500">Anonymous User</span>
              </div>
              
              <h3 className="text-2xl font-black text-gray-800 mb-2 truncate">{meal.food_name}</h3>
              
              <div className="flex items-center justify-between mt-4 border-t pt-4">
                <div className="flex items-center text-orange-600 font-black">
                  <FaFireAlt className="mr-1.5" />
                  <span>{meal.calories} kcal</span>
                </div>
                <div className="flex items-center text-gray-400 text-xs font-medium">
                  <FaClock className="mr-1.5" />
                  <span>{new Date(meal.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="col-span-full text-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-orange-200">
          <p className="text-2xl font-bold text-orange-400">아직 공유된 식단이 없습니다.</p>
          <p className="text-orange-300 mt-2">당신이 첫 번째 주인공이 되어보세요!</p>
        </div>
      )}
    </div>
  );
}
