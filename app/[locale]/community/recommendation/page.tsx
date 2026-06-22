"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { MealPhoto } from '@/components/MealPhoto';
import { useTranslations } from 'next-intl';

type Visibility = 'private' | 'neighbors' | 'public';

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
  visibility: Visibility;
  is_neighbor: boolean;
  like_count: number;
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

const CURATION_COLORS = ['#f0fdf4', '#fffbeb', '#fef2f2', '#eff6ff', '#faf5ff'];
const ADS_COLORS = ['#6B21A8', '#065f46'];

function buildFeed(realPosts: RealPost[], isPro: boolean, curationCards: Omit<CurationCard, 'id'>[], ads: Omit<AdCard, 'id'>[]): FeedItem[] {
  const feed: FeedItem[] = [];
  let curationIdx = 0;
  let adIdx = 0;
  let realIdx = 0;
  let itemCount = 0;

  const lead = Math.min(2, curationCards.length);
  for (let i = 0; i < lead; i++) {
    feed.push({ ...curationCards[curationIdx++], id: `cur_${curationIdx}` });
    itemCount++;
  }

  while (realIdx < realPosts.length || curationIdx < curationCards.length) {
    for (let i = 0; i < 3 && realIdx < realPosts.length; i++) {
      feed.push(realPosts[realIdx++]);
      itemCount++;
    }
    if (curationIdx < curationCards.length) {
      feed.push({ ...curationCards[curationIdx++], id: `cur_${curationIdx}` });
      itemCount++;
    }
    if (!isPro && ads.length > 0 && itemCount % 6 === 0) {
      feed.push({ ...ads[adIdx % ads.length], id: `ad_${adIdx++}` });
    }
  }
  while (realIdx < realPosts.length) {
    feed.push(realPosts[realIdx++]);
    itemCount++;
    if (!isPro && ads.length > 0 && itemCount % 6 === 0) {
      feed.push({ ...ads[adIdx % ads.length], id: `ad_${adIdx++}` });
    }
  }

  return feed;
}

function VisibilityBadge({ visibility, isNeighbor, tPublic, tNeighbor }: { visibility: Visibility; isNeighbor: boolean; tPublic: string; tNeighbor: string }) {
  if (visibility === 'public') {
    return (
      <span style={{ fontSize: '9px', color: '#6B21A8', border: '1px solid #e9d5ff', padding: '2px 5px', letterSpacing: '0.5px' }}>
        🌏 {tPublic}
      </span>
    );
  }
  if (isNeighbor) {
    return (
      <span style={{ fontSize: '9px', color: '#6b7280', border: '1px solid #e5e7eb', padding: '2px 5px', letterSpacing: '0.5px' }}>
        👥 {tNeighbor}
      </span>
    );
  }
  return null;
}

function RealPostCard({ item, likedMap, onLike, timeAgoStr, tPublic, tNeighbor }: {
  item: RealPost;
  likedMap: Record<string, { count: number; liked: boolean }>;
  onLike: (id: string) => void;
  timeAgoStr: string;
  tPublic: string;
  tNeighbor: string;
}) {
  const initials = item.nickname.slice(0, 2);
  const likeInfo = likedMap[item.id] ?? { count: item.like_count, liked: false };

  return (
    <div style={{ backgroundColor: 'white', padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
      {/* 유저 헤더 */}
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
          <p style={{ fontSize: '11px', color: '#9ca3af' }}>{timeAgoStr}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <VisibilityBadge visibility={item.visibility} isNeighbor={item.is_neighbor} tPublic={tPublic} tNeighbor={tNeighbor} />
          {item.category && (
            <span style={{ fontSize: '9px', letterSpacing: '1.2px', textTransform: 'uppercase', color: '#9ca3af', border: '1px solid #e5e7eb', padding: '3px 7px' }}>
              {item.category}
            </span>
          )}
        </div>
      </div>

      {/* 사진 */}
      {item.photo_url && !item.photo_url.startsWith('local:') && (
        <div style={{ position: 'relative', marginBottom: '12px', height: '220px', overflow: 'hidden' }}>
          <MealPhoto photoUrl={item.photo_url} alt={item.food_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      {/* 음식 정보 + 좋아요 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '17px', fontWeight: 400, color: 'black' }}>{item.food_name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* 좋아요 (전체공개만) */}
          {item.visibility === 'public' && (
            <button
              onClick={() => onLike(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <span style={{ fontSize: '16px' }}>{likeInfo.liked ? '❤️' : '🤍'}</span>
              {likeInfo.count > 0 && (
                <span style={{ fontSize: '11px', color: likeInfo.liked ? '#e11d48' : '#9ca3af' }}>{likeInfo.count}</span>
              )}
            </button>
          )}
          <p style={{ fontSize: '20px', color: '#6B21A8', lineHeight: 1 }}>
            {item.calories}
            <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '3px' }}>kcal</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function CurationPostCard({ item }: { item: CurationCard }) {
  return (
    <div style={{ backgroundColor: item.color, padding: '18px 20px', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6B21A8', border: '1px solid #e9d5ff', padding: '2px 7px', backgroundColor: 'white' }}>
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
    <div style={{ backgroundColor: item.ad_color, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.07)' }} />
      <div style={{ position: 'absolute', right: '20px', bottom: '-30px', width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '9px', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.3)', padding: '2px 6px' }}>AD</span>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', letterSpacing: '1px' }}>{item.ad_brand}</span>
      </div>
      <p style={{ fontSize: '18px', fontWeight: 400, color: 'white', marginBottom: '8px', lineHeight: 1.3 }}>{item.ad_title}</p>
      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginBottom: '16px' }}>{item.ad_desc}</p>
      <button style={{ backgroundColor: 'white', color: item.ad_color, border: 'none', padding: '9px 20px', fontSize: '12px', fontWeight: 500, letterSpacing: '0.5px', cursor: 'pointer' }}>
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
  const t = useTranslations('Community');
  const timeAgoRaw = t.raw('timeAgo') as { justNow: string; minutes: string; hours: string; days: string };
  const tPublic = t('public');
  const tNeighbor = t('neighbor');

  const curationRaw = t.raw('curation') as { emoji: string; tag: string; title: string; desc: string }[];
  const CURATION_CARDS: Omit<CurationCard, 'id'>[] = curationRaw.map((c, i) => ({
    type: 'curation' as const, ...c, calories: [320, 370, 510, 180, 620][i] ?? 300, color: CURATION_COLORS[i] ?? '#f9fafb',
  }));
  const adsRaw = t.raw('ads') as { brand: string; title: string; desc: string; cta: string }[];
  const ADS: Omit<AdCard, 'id'>[] = adsRaw.map((a, i) => ({
    type: 'ad' as const, ad_brand: a.brand, ad_title: a.title, ad_desc: a.desc, ad_cta: a.cta, ad_color: ADS_COLORS[i] ?? '#6B21A8',
  }));

  const timeAgo = useCallback((iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return timeAgoRaw.justNow;
    if (diff < 3600) return timeAgoRaw.minutes.replace('{n}', String(Math.floor(diff / 60)));
    if (diff < 86400) return timeAgoRaw.hours.replace('{n}', String(Math.floor(diff / 3600)));
    return timeAgoRaw.days.replace('{n}', String(Math.floor(diff / 86400)));
  }, [timeAgoRaw]);

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [likedMap, setLikedMap] = useState<Record<string, { count: number; liked: boolean }>>({});

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
          category: m.category ?? '',
          photo_url: m.photo_url ?? null,
          created_at: m.created_at,
          nickname: m.nickname,
          avatar_url: m.avatar_url ?? null,
          visibility: m.visibility ?? (m.is_public ? 'neighbors' : 'private'),
          is_neighbor: m.is_neighbor ?? false,
          like_count: m.like_count ?? 0,
        }));

        setFeed(buildFeed(realPosts, pro, CURATION_CARDS, ADS));

        // 좋아요 초기값 로드 (전체공개 식단만)
        const publicIds = realPosts.filter(p => p.visibility === 'public').map(p => p.id);
        if (publicIds.length > 0) {
          const likesRes = await fetch('/api/likes/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ mealIds: publicIds }),
          });
          if (likesRes.ok) {
            const likesData = await likesRes.json();
            setLikedMap(likesData.data ?? {});
          }
        }
      } catch {
        setFeed(buildFeed([], isPro ?? false, CURATION_CARDS, ADS));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  const handleLike = async (mealId: string) => {
    if (!token) return;
    const prev = likedMap[mealId] ?? { count: 0, liked: false };
    // 낙관적 업데이트
    setLikedMap(m => ({
      ...m,
      [mealId]: { count: prev.liked ? prev.count - 1 : prev.count + 1, liked: !prev.liked },
    }));
    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mealId }),
      });
      if (res.ok) {
        const data = await res.json();
        setLikedMap(m => ({ ...m, [mealId]: { count: data.count, liked: data.liked } }));
      }
    } catch {
      setLikedMap(m => ({ ...m, [mealId]: prev }));
    }
  };

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
          <p style={{ fontSize: '14px', color: '#9ca3af' }}>{t('noFeed')}</p>
          <p style={{ fontSize: '12px', color: '#d1d5db', marginTop: '6px' }}>{t('noFeedDesc')}</p>
        </div>
      )}
      {feed.map(item => {
        if (item.type === 'real') return <RealPostCard key={item.id} item={item} likedMap={likedMap} onLike={handleLike} timeAgoStr={timeAgo(item.created_at)} tPublic={tPublic} tNeighbor={tNeighbor} />;
        if (item.type === 'curation') return <CurationPostCard key={item.id} item={item} />;
        if (item.type === 'ad' && !isPro) return <AdPostCard key={item.id} item={item} />;
        return null;
      })}
    </div>
  );
}
