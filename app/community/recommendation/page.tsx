"use client";

import { useState, useEffect } from 'react';
import { FaSpinner } from 'react-icons/fa';

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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '80px', gap: '12px' }}>
        <div style={{ width: '28px', height: '28px', border: '2px solid #e5e7eb', borderTopColor: 'black', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9ca3af' }}>불러오는 중...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (meals.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: '80px' }}>
        <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '8px' }}>아직 공유된 식단이 없습니다.</p>
        <p style={{ fontSize: '13px', color: '#d1d5db' }}>당신이 첫 번째 주인공이 되어보세요!</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb' }}>
      {meals.map((meal) => (
        <div
          key={meal.id}
          style={{
            backgroundColor: 'white',
            display: 'flex',
            gap: '0',
          }}
        >
          {meal.photo_url && (
            <div style={{ width: '90px', flexShrink: 0, overflow: 'hidden' }}>
              <img
                src={meal.photo_url}
                alt={meal.food_name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
          <div style={{ flex: 1, padding: '16px', borderLeft: meal.photo_url ? '1px solid #e5e7eb' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{
                fontSize: '10px',
                color: '#9ca3af',
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}>
                {meal.category || '일반'}
              </span>
              <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                {new Date(meal.created_at).toLocaleDateString('ko-KR')}
              </span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 400, color: 'black', marginBottom: '8px' }}>
              {meal.food_name}
            </h3>
            <p style={{ fontSize: '14px', color: '#6B21A8' }}>
              {meal.calories} <span style={{ fontSize: '10px', color: '#9ca3af' }}>kcal</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
