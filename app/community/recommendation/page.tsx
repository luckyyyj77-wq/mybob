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
        <div style={{ width: '32px', height: '32px', border: '3px solid black', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: '#9ca3af' }}>불러오는 중...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (meals.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: '80px', border: '3px dashed #e5e7eb', padding: '60px 32px' }}>
        <p style={{ fontSize: '15px', fontWeight: 700, color: '#9ca3af', marginBottom: '8px' }}>아직 공유된 식단이 없습니다.</p>
        <p style={{ fontSize: '13px', color: '#d1d5db' }}>당신이 첫 번째 주인공이 되어보세요!</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {meals.map((meal, index) => (
        <div
          key={meal.id}
          style={{
            border: '3px solid black',
            overflow: 'hidden',
            boxShadow: '4px 4px 0px black',
            display: 'flex',
            gap: '0',
          }}
        >
          {meal.photo_url && (
            <div style={{ width: '100px', flexShrink: 0, overflow: 'hidden' }}>
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
          <div style={{ flex: 1, padding: '16px', borderLeft: meal.photo_url ? '3px solid black' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{
                fontSize: '10px',
                fontWeight: 900,
                color: 'white',
                backgroundColor: 'black',
                padding: '3px 8px',
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}>
                {meal.category || '일반'}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af' }}>
                {new Date(meal.created_at).toLocaleDateString('ko-KR')}
              </span>
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 900, color: 'black', letterSpacing: '-0.3px', marginBottom: '8px' }}>
              {meal.food_name}
            </h3>
            <p style={{ fontSize: '14px', fontWeight: 900, color: '#6B21A8' }}>
              {meal.calories} <span style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af' }}>kcal</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
