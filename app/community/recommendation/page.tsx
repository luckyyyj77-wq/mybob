"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

interface FeedItem {
  id: string;
  type: 'post' | 'ad';
  food_name?: string;
  calories?: number;
  photo_url?: string;
  created_at?: string;
  category?: string;
  user_handle?: string;
  // ad fields
  ad_brand?: string;
  ad_title?: string;
  ad_desc?: string;
  ad_cta?: string;
  ad_color?: string;
}

const DUMMY_POSTS: FeedItem[] = [
  { id: 'd1', type: 'post', food_name: '닭가슴살 샐러드', calories: 320, category: '다이어트', user_handle: '@health_mia', created_at: '2026-05-10T08:20:00Z', photo_url: '' },
  { id: 'd2', type: 'post', food_name: '현미밥 + 된장찌개', calories: 510, category: '한식', user_handle: '@rice_lover', created_at: '2026-05-10T09:15:00Z', photo_url: '' },
  { id: 'd3', type: 'post', food_name: '그릭요거트 & 그래놀라', calories: 280, category: '아침', user_handle: '@morning_fit', created_at: '2026-05-10T07:30:00Z', photo_url: '' },
  { id: 'd4', type: 'post', food_name: '연어 포케볼', calories: 620, category: '건강식', user_handle: '@poke_seoul', created_at: '2026-05-09T12:10:00Z', photo_url: '' },
  { id: 'd5', type: 'post', food_name: '두부 스테이크', calories: 390, category: '다이어트', user_handle: '@vegan_jin', created_at: '2026-05-09T19:00:00Z', photo_url: '' },
  { id: 'd6', type: 'post', food_name: '오트밀 바나나볼', calories: 350, category: '아침', user_handle: '@oat_daily', created_at: '2026-05-09T08:00:00Z', photo_url: '' },
  { id: 'd7', type: 'post', food_name: '닭볶음탕 + 잡곡밥', calories: 740, category: '한식', user_handle: '@k_food_log', created_at: '2026-05-08T18:30:00Z', photo_url: '' },
  { id: 'd8', type: 'post', food_name: '아보카도 토스트', calories: 430, category: '브런치', user_handle: '@brunch_haru', created_at: '2026-05-08T10:45:00Z', photo_url: '' },
  { id: 'd9', type: 'post', food_name: '단백질 쉐이크 + 바나나', calories: 410, category: '증량', user_handle: '@gym_woo', created_at: '2026-05-08T07:00:00Z', photo_url: '' },
  { id: 'd10', type: 'post', food_name: '미역국 + 흰쌀밥', calories: 480, category: '한식', user_handle: '@homemeal_soo', created_at: '2026-05-07T12:00:00Z', photo_url: '' },
];

const ADS: Omit<FeedItem, 'id'>[] = [
  {
    type: 'ad',
    ad_brand: 'PROTEINWORKS',
    ad_title: '단백질 보충제 1위 브랜드',
    ad_desc: '운동 후 골든타임, 흡수율 95% 유청 단백질로 채우세요.',
    ad_cta: '지금 할인받기',
    ad_color: '#6B21A8',
  },
  {
    type: 'ad',
    ad_brand: 'FRESHBOX',
    ad_title: '신선 식단 정기배송',
    ad_desc: '영양사가 설계한 주 5회 건강 도시락, 첫 주문 30% 할인.',
    ad_cta: '무료 체험',
    ad_color: '#065f46',
  },
];

function buildFeed(posts: FeedItem[]): FeedItem[] {
  const feed: FeedItem[] = [];
  posts.forEach((post, i) => {
    feed.push(post);
    // 5개마다 광고 삽입
    if ((i + 1) % 5 === 0) {
      const ad = ADS[Math.floor((i + 1) / 5 - 1) % ADS.length];
      feed.push({ ...ad, id: `ad_${i}` });
    }
  });
  return feed;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function PostCard({ item }: { item: FeedItem }) {
  const initials = (item.user_handle ?? '@?').replace('@', '').slice(0, 2).toUpperCase();
  return (
    <div style={{ backgroundColor: 'white', padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
      {/* 유저 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '50%',
          backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 500, color: '#6b7280', flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '13px', color: 'black', fontWeight: 500 }}>{item.user_handle}</p>
          <p style={{ fontSize: '11px', color: '#9ca3af' }}>{timeAgo(item.created_at!)}</p>
        </div>
        <span style={{
          fontSize: '9px', letterSpacing: '1.2px', textTransform: 'uppercase',
          color: '#9ca3af', border: '1px solid #e5e7eb', padding: '3px 7px',
        }}>
          {item.category}
        </span>
      </div>

      {/* 음식 정보 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '17px', fontWeight: 400, color: 'black' }}>{item.food_name}</p>
        <p style={{ fontSize: '20px', color: '#6B21A8', lineHeight: 1 }}>
          {item.calories}
          <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '3px' }}>kcal</span>
        </p>
      </div>
    </div>
  );
}

function AdCard({ item }: { item: FeedItem }) {
  return (
    <div style={{
      backgroundColor: item.ad_color,
      padding: '20px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 배경 장식 */}
      <div style={{
        position: 'absolute', right: '-20px', top: '-20px',
        width: '120px', height: '120px', borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.07)',
      }} />
      <div style={{
        position: 'absolute', right: '20px', bottom: '-30px',
        width: '80px', height: '80px', borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.05)',
      }} />

      {/* AD 배지 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{
          fontSize: '9px', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.6)',
          border: '1px solid rgba(255,255,255,0.3)', padding: '2px 6px',
        }}>AD</span>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', letterSpacing: '1px' }}>
          {item.ad_brand}
        </span>
      </div>

      <p style={{ fontSize: '18px', fontWeight: 400, color: 'white', marginBottom: '8px', lineHeight: 1.3 }}>
        {item.ad_title}
      </p>
      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginBottom: '16px' }}>
        {item.ad_desc}
      </p>

      <button style={{
        backgroundColor: 'white',
        color: item.ad_color,
        border: 'none',
        padding: '9px 20px',
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '0.5px',
        cursor: 'pointer',
      }}>
        {item.ad_cta} →
      </button>
    </div>
  );
}

export default function CommunityRecommendationPage() {
  const { token } = useAuth();
  const [feed] = useState<FeedItem[]>(() => buildFeed(DUMMY_POSTS));
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    // 로컬 모드도 PRO면 광고 없음 — profile API로 플랜만 확인
    if (!token) return;
    fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setIsPro(d.plan === 'pro' || d.plan === 'lifetime'); })
      .catch(() => {});
  }, [token]);

  return (
    <div style={{ paddingBottom: '24px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {feed.map(item =>
        item.type === 'ad' && !isPro
          ? <AdCard key={item.id} item={item} />
          : item.type === 'post'
          ? <PostCard key={item.id} item={item} />
          : null
      )}
    </div>
  );
}
