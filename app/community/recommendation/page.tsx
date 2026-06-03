"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { MealPhoto } from '@/components/MealPhoto';

interface RealPost {
  id: string;
  type: 'real';
  food_name: string;
  calories: number;
  category: string;
  photo_url: string | null;
  created_at: string;
  nickname: string;
  avatar_url: string | null;
}

interface CurationCard {
  id: string;
  type: 'curation';
  emoji: string;
  tag: string;
  title: string;
  desc: string;
  calories: number;
  color: string;
}

interface AdCard {
  id: string;
  type: 'ad';
  ad_brand: string;
  ad_title: string;
  ad_desc: string;
  ad_cta: string;
  ad_color: string;
}

type FeedItem = RealPost | CurationCard | AdCard;

const CURATION_CARDS: Omit<CurationCard, 'id'>[] = [
  {
    type: 'curation',
    emoji: '🥗',
    tag: '오늘의 추천',
    title: '닭가슴살 샐러드',
    desc: '고단백 저칼로리, 다이어트 식단의 정석. 방울토마토·아보카도와 함께하면 더욱 완벽.',
    calories: 320,
    color: '#f0fdf4',
  },
  {
    type: 'curation',
    emoji: '🍳',
    tag: '아침 추천',
    title: '달걀 2개 + 통밀토스트',
    desc: '하루를 시작하는 든든한 아침. 양질의 단백질로 포만감을 오래 유지하세요.',
    calories: 370,
    color: '#fffbeb',
  },
  {
    type: 'curation',
    emoji: '🍱',
    tag: '한식 베스트',
    title: '현미밥 + 된장찌개 + 나물',
    desc: '균형 잡힌 한국식 한 끼. 식이섬유 풍부, 혈당 스파이크 없는 건강 식사.',
    calories: 510,
    color: '#fef2f2',
  },
  {
    type: 'curation',
    emoji: '🥛',
    tag: '간식 추천',
    title: '그릭요거트 + 블루베리',
    desc: '프로바이오틱스와 항산화 성분이 가득. 오후 3시 슬럼프를 이겨내는 최적의 간식.',
    calories: 180,
    color: '#eff6ff',
  },
  {
    type: 'curation',
    emoji: '🐟',
    tag: 'PRO PICK',
    title: '연어 포케볼',
    desc: '오메가-3 풍부한 연어, 아보카도, 현미밥의 조합. 근육 회복과 포만감을 동시에.',
    calories: 620,
    color: '#faf5ff',
  },
];

const ADS: Omit<AdCard, 'id'>[] = [
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

function buildFeed(realPosts: RealPost[], isPro: boolean): FeedItem[] {
  const feed: FeedItem[] = [];
  let curationIdx = 0;
  let adIdx = 0;
  let realIdx = 0;
  let position = 0;

  // 첫 1~2개는 큐레이션 카드로 시작 (실제 데이터 없을 때 빈 느낌 방지)
  const leadCuration = Math.min(2, CURATION_CARDS.length);
  for (let i = 0; i < leadCuration; i++) {
    feed.push({ ...CURATION_CARDS[curationIdx], id: `cur_${curationIdx}` });
    curationIdx++;
    position++;
  }

  // 이후: 실제 포스트 3개 → 큐레이션 1개 → 광고(PRO 아니면) 순환
  while (realIdx < realPosts.length || curationIdx < CURATION_CARDS.length) {
    // 실제 포스트 최대 3개
    for (let i = 0; i < 3 && realIdx < realPosts.length; i++) {
      feed.push(realPosts[realIdx++]);
      position++;
    }

    // 큐레이션 카드 1개
    if (curationIdx < CURATION_CARDS.length) {
      feed.push({ ...CURATION_CARDS[curationIdx], id: `cur_${curationIdx}` });
      curationIdx++;
      position++;
    }

    // 광고 (PRO 아니면 5개마다)
    if (!isPro && position > 0 && position % 5 === 0) {
      const ad = ADS[adIdx % ADS.length];
      feed.push({ ...ad, id: `ad_${adIdx}` });
      adIdx++;
    }
  }

  // 남은 실제 포스트 처리
  while (realIdx < realPosts.length) {
    feed.push(realPosts[realIdx++]);
    position++;
    if (!isPro && position % 5 === 0) {
      const ad = ADS[adIdx % ADS.length];
      feed.push({ ...ad, id: `ad_${adIdx}` });
      adIdx++;
    }
  }

  return feed;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function RealPostCard({ item }: { item: RealPost }) {
  const initials = item.nickname.slice(0, 2);
  return (
    <div style={{ backgroundColor: 'white', padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        {item.avatar_url ? (
          <img src={item.avatar_url} alt="" style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 500, color: '#6b7280', flexShrink: 0,
          }}>
            {initials}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '13px', color: 'black', fontWeight: 500 }}>{item.nickname}</p>
          <p style={{ fontSize: '11px', color: '#9ca3af' }}>{timeAgo(item.created_at)}</p>
        </div>
        <span style={{
          fontSize: '9px', letterSpacing: '1.2px', textTransform: 'uppercase',
          color: '#9ca3af', border: '1px solid #e5e7eb', padding: '3px 7px',
        }}>
          {item.category}
        </span>
      </div>

      {item.photo_url && (
        <div style={{ position: 'relative', marginBottom: '12px', borderRadius: '4px', overflow: 'hidden', height: '220px' }}>
          <MealPhoto photoUrl={item.photo_url} alt={item.food_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

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

function CurationPostCard({ item }: { item: CurationCard }) {
  return (
    <div style={{ backgroundColor: item.color, padding: '18px 20px', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{
          fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase',
          color: '#6B21A8', border: '1px solid #e9d5ff', padding: '2px 7px', backgroundColor: 'white',
        }}>
          {item.tag}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <span style={{ fontSize: '40px', lineHeight: 1, flexShrink: 0 }}>{item.emoji}</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '16px', fontWeight: 500, color: 'black', marginBottom: '6px' }}>{item.title}</p>
          <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.6, marginBottom: '10px' }}>{item.desc}</p>
          <p style={{ fontSize: '18px', color: '#6B21A8', lineHeight: 1 }}>
            {item.calories}
            <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '3px' }}>kcal</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function AdPostCard({ item }: { item: AdCard }) {
  return (
    <div style={{
      backgroundColor: item.ad_color,
      padding: '20px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
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

function SkeletonCard() {
  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', backgroundColor: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#f3f4f6' }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: '80px', height: '12px', backgroundColor: '#f3f4f6', marginBottom: '6px' }} />
          <div style={{ width: '50px', height: '10px', backgroundColor: '#f3f4f6' }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: '140px', height: '16px', backgroundColor: '#f3f4f6' }} />
        <div style={{ width: '50px', height: '20px', backgroundColor: '#f3f4f6' }} />
      </div>
    </div>
  );
}

export default function CommunityRecommendationPage() {
  const { token } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        const [profileRes, feedRes] = await Promise.all([
          fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/community', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const profileData = profileRes.ok ? await profileRes.json() : null;
        const pro = profileData?.plan === 'pro' || profileData?.plan === 'lifetime';
        setIsPro(pro);

        const feedData = feedRes.ok ? await feedRes.json() : null;
        const realPosts: RealPost[] = (feedData?.data ?? []).map((m: any) => ({
          id: m.id,
          type: 'real' as const,
          food_name: m.food_name,
          calories: m.calories,
          category: m.category,
          photo_url: m.photo_url ?? null,
          created_at: m.created_at,
          nickname: m.nickname,
          avatar_url: m.avatar_url ?? null,
        }));

        setFeed(buildFeed(realPosts, pro));
      } catch {
        // 실패 시 큐레이션만 표시
        setFeed(buildFeed([], false));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  if (loading || isPro === null) {
    return (
      <div style={{ paddingBottom: '24px' }}>
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '24px' }}>
      {feed.length === 0 && (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '32px', marginBottom: '12px' }}>🍽️</p>
          <p style={{ fontSize: '14px', color: '#9ca3af' }}>아직 공유된 식단이 없어요</p>
          <p style={{ fontSize: '12px', color: '#d1d5db', marginTop: '6px' }}>식단을 기록하고 이웃과 공유해보세요!</p>
        </div>
      )}
      {feed.map(item => {
        if (item.type === 'real') return <RealPostCard key={item.id} item={item} />;
        if (item.type === 'curation') return <CurationPostCard key={item.id} item={item} />;
        if (item.type === 'ad' && !isPro) return <AdPostCard key={item.id} item={item} />;
        return null;
      })}
    </div>
  );
}
