"use client";

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { analyzeCoach, getCoachMessage } from '@/lib/coach';
import type { Persona } from '@/lib/coach';
import { useAuth } from '@/lib/auth-context';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';

type Meal = {
  id: string;
  food_name: string;
  calories: number;
  created_at: string;
  nutrient: { carbohydrates: number; protein: number; fat: number };
};

type DayStat = { date: string; calories: number; carbs: number; protein: number; fat: number };

type AIFeedback = {
  feedback: string;
  goodPoint: string;
  improvement: string;
  weeklyInsight?: string;
  recommendation: { menu: string; reason: string };
};


function toKSTDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function computeTodayStats(meals: Meal[]) {
  const todayKST = toKSTDate(new Date().toISOString());
  const todayMeals = meals.filter(m => toKSTDate(m.created_at) === todayKST);
  const totalCalories = todayMeals.reduce((s, m) => s + (Number(m.calories) || 0), 0);
  const nutrients = todayMeals.reduce(
    (acc, m) => {
      acc.carbs   += Number(m.nutrient?.carbohydrates) || 0;
      acc.protein += Number(m.nutrient?.protein) || 0;
      acc.fat     += Number(m.nutrient?.fat) || 0;
      return acc;
    },
    { carbs: 0, protein: 0, fat: 0 }
  );
  return { totalCalories, mealNames: todayMeals.map(m => m.food_name), count: todayMeals.length, nutrients, todayMeals };
}

function buildWeekly(meals: Meal[]): DayStat[] {
  const weekly: DayStat[] = [];
  const todayKST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayKST.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    const dayMeals = meals.filter(m => toKSTDate(m.created_at) === dateStr);
    weekly.push({
      date: dateStr,
      calories: dayMeals.reduce((s, m) => s + (Number(m.calories) || 0), 0),
      carbs:    dayMeals.reduce((s, m) => s + (Number(m.nutrient?.carbohydrates) || 0), 0),
      protein:  dayMeals.reduce((s, m) => s + (Number(m.nutrient?.protein) || 0), 0),
      fat:      dayMeals.reduce((s, m) => s + (Number(m.nutrient?.fat) || 0), 0),
    });
  }
  return weekly;
}

export default function Home() {
  const { token } = useAuth();
  const t = useTranslations('Home');
  const locale = useLocale();
  const [todayStats, setTodayStats] = useState({
    totalCalories: 0,
    mealNames: [] as string[],
    count: 0,
    nutrients: { carbs: 0, protein: 0, fat: 0 },
    todayMeals: [] as Meal[],
  });
  const [aiFeedback, setAiFeedback] = useState<AIFeedback | null>(null);
  const [coachComment, setCoachComment] = useState<string>('');
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [persona, setPersona] = useState<Persona>('dog');
  const syncedRef = useRef(false);
  const fetchingAIRef = useRef(false);
  const [foundingBanner, setFoundingBanner] = useState<{
    type: 'member' | 'available' | null;
    daysLeft?: number;
    remainingSlots?: number;
  }>({ type: null });

  const getKSTDateKey = () => {
    const kstHour = (new Date().getUTCHours() + 9) % 24;
    const block = Math.floor(kstHour / 3) * 3;
    const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    return `${date}-${String(block).padStart(2, '0')}`;
  };

  const VALID_PERSONAS: Persona[] = ['dog', 'cat', 'robot'];
  const sanitizePersona = (p: string | null): Persona =>
    VALID_PERSONAS.includes(p as Persona) ? (p as Persona) : 'dog';

  useEffect(() => {
    for (const key of Object.keys(localStorage)) {
      if (/^mybob_coach_(dog|cat|robot)_(\d{8}|\d{4}-\d{2}-\d{2})$/.test(key)) {
        localStorage.removeItem(key);
      }
    }

    const savedPersona = sanitizePersona(localStorage.getItem('mybob_coach_persona'));
    setPersona(savedPersona);

    const localRaw = localStorage.getItem('mybob_meals');
    const localMeals: Meal[] = localRaw ? JSON.parse(localRaw) : [];
    setTodayStats(computeTodayStats(localMeals));

    const goalRaw = localStorage.getItem('mybob_goal');
    if (token !== null) {
      syncFromServer(localMeals, savedPersona, goalRaw, token);
      syncedRef.current = true;
    } else {
      runCoachLocal(localMeals, savedPersona, goalRaw);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (token === null || syncedRef.current) return;
    syncedRef.current = true;
    const localRaw = localStorage.getItem('mybob_meals');
    const localMeals: Meal[] = localRaw ? JSON.parse(localRaw) : [];
    const goalRaw = localStorage.getItem('mybob_goal');
    const savedPersona = sanitizePersona(localStorage.getItem('mybob_coach_persona'));
    syncFromServer(localMeals, savedPersona, goalRaw, token);

    if (token) {
      fetch('/api/upload-status', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return;
          if (data.isFoundingMember && data.foundingInfo) {
            setFoundingBanner({ type: 'member', daysLeft: data.foundingInfo.daysLeft });
          } else if (!data.isFoundingMember && data.remainingSlots > 0) {
            setFoundingBanner({ type: 'available', remainingSlots: data.remainingSlots });
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const localRaw = localStorage.getItem('mybob_meals');
      const localMeals: Meal[] = localRaw ? JSON.parse(localRaw) : [];
      setTodayStats(computeTodayStats(localMeals));
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runCoachLocal = (meals: Meal[], currentPersona: Persona, goalRaw: string | null) => {
    const finalStats = computeTodayStats(meals);
    const weekly = buildWeekly(meals);
    const goalData = JSON.parse(goalRaw || '{"goal":"maintain"}');

    let weight = 65;
    let goalCalories = 0;
    try {
      if (goalRaw) {
        const gd = JSON.parse(goalRaw);
        if (gd.weight) weight = Number(gd.weight) || 65;
      }
    } catch { }

    const savedTarget = localStorage.getItem('mybob_target_calories');
    if (savedTarget && parseInt(savedTarget) > 0) {
      goalCalories = parseInt(savedTarget);
    } else {
      try {
        const gd = goalRaw ? JSON.parse(goalRaw) : {};
        const h = Number(gd.height) || 0;
        const w = Number(gd.weight) || 0;
        if (h > 0 && w > 0) {
          const bmr = 10 * w + 6.25 * h - 5 * 30;
          const tdee = Math.round(bmr * 1.375);
          const goal = gd.goal || 'maintain';
          goalCalories = (goal === 'diet') ? Math.round(tdee * 0.8)
                       : (goal === 'bulk') ? Math.round(tdee * 1.15)
                       : tdee;
        }
      } catch { }
      if (!goalCalories) goalCalories = 2000;
    }

    const goalProtein = weight * 1.5;
    const kstDateKey = getKSTDateKey();

    let todayAchieved = false;
    try {
      const achieved = JSON.parse(localStorage.getItem('mybob_goal_achieved') || '{}');
      todayAchieved = achieved[kstDateKey] === true;
    } catch { }

    const result = analyzeCoach({ todayMeals: finalStats.todayMeals as any, allMeals: meals as any, goalCalories, goalProtein, persona: currentPersona, todayAchieved, locale });
    if (!result.useGemini) {
      const seed = parseInt(kstDateKey.replace(/-/g, ''), 10);
      const message = getCoachMessage(result, seed, locale);
      if (message) setCoachComment(message);
    } else {
      fetchAI(finalStats, weekly, goalData, currentPersona);
    }
  };

  const syncFromServer = async (localMeals: Meal[], currentPersona: Persona, goalRaw: string | null, accessToken: string | null) => {
    try {
      let merged = localMeals;

      if (accessToken) {
        const res = await fetch('/api/meals', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const result = await res.json();
          if (result.success && Array.isArray(result.data)) {
            const serverIds = new Set(result.data.map((m: Meal) => m.id));
            const uniqueLocal = localMeals.filter(m => !serverIds.has(m.id));
            merged = [...result.data, ...uniqueLocal];
            localStorage.setItem('mybob_meals', JSON.stringify(merged));
            setTodayStats(computeTodayStats(merged));
          }
        }
      }

      runCoachLocal(merged, currentPersona, goalRaw);
    } catch { }
  };

  const fetchAI = async (
    stats: ReturnType<typeof computeTodayStats>,
    weekly: DayStat[],
    goalData: any,
    currentPersona: Persona,
  ) => {
    if (fetchingAIRef.current) return;

    const todayKey = `mybob_coach_${currentPersona}_${getKSTDateKey()}`;

    const cached = localStorage.getItem(todayKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.type === 'gemini') {
          setAiFeedback(parsed.data);
          return;
        }
      } catch { }
    }

    const diagRaw = localStorage.getItem('mybob_diagnosis_cache');
    if (diagRaw) {
      try {
        const { result, plan } = JSON.parse(diagRaw);
        if ((plan === 'pro' || plan === 'lifetime') && result?.ai_message) {
          const fromDiag: AIFeedback = {
            feedback: result.ai_message,
            goodPoint: result.strengths?.[0] ?? '',
            improvement: result.issues?.[0]?.description ?? '',
            recommendation: {
              menu: result.recommendations?.[0]?.title ?? '',
              reason: result.recommendations?.[0]?.description ?? '',
            },
          };
          setAiFeedback(fromDiag);
          return;
        }
      } catch { }
    }

    if (!token) return;

    fetchingAIRef.current = true;
    setLoadingFeedback(true);
    try {
      let achievedStreak = 0, totalAchievedDays = 0;
      try {
        const { getAchievedStreak, getTotalAchievedDays } = await import('@/lib/goal-achievement');
        achievedStreak = getAchievedStreak();
        totalAchievedDays = getTotalAchievedDays();
      } catch { }

      const res = await fetch('/api/recommendation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          today: { calories: stats.totalCalories, ...stats.nutrients },
          weekly,
          goal: goalData,
          achievedStreak,
          totalAchievedDays,
          persona: currentPersona,
          mealNames: stats.mealNames,
          currentHour: (new Date().getUTCHours() + 9) % 24,
          locale,
        }),
      });
      const r = await res.json();
      if (r.success) {
        setAiFeedback(r.data);
        localStorage.setItem(todayKey, JSON.stringify({ type: 'gemini', data: r.data }));
      }
    } catch { } finally {
      setLoadingFeedback(false);
      fetchingAIRef.current = false;
    }
  };

  const displayComment = coachComment || (aiFeedback?.feedback ?? '');

  return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden' }}>

      {/* 천인회 배너 */}
      {foundingBanner.type === 'member' && (
        <div style={{ flexShrink: 0, backgroundColor: '#6B21A8', color: 'white', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', letterSpacing: '0.3px' }}>{t('foundingMember')}</span>
          <span style={{ fontSize: '11px', opacity: 0.8 }}>D-{foundingBanner.daysLeft}</span>
        </div>
      )}
      {foundingBanner.type === 'available' && (
        <Link href="/settings/plan" style={{ flexShrink: 0, backgroundColor: '#f5f3ff', borderBottom: '1px solid #e9d5ff', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none' }}>
          <span style={{ fontSize: '12px', color: '#6B21A8', letterSpacing: '0.3px' }}>{t('foundingAvailable', { count: foundingBanner.remainingSlots ?? 0 })}</span>
          <span style={{ fontSize: '11px', color: '#a855f7' }}>{t('viewDetail')}</span>
        </Link>
      )}

      {/* Section 1: 인삿말 */}
      <motion.section
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
        style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '28px 28px 20px', borderBottom: '1px solid #e5e7eb' }}
      >
        <h1 style={{ fontSize: '26px', fontWeight: 400, color: 'black', letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: '8px' }}>
          {t('question')}
        </h1>
        {todayStats.count > 0 ? (
          <p style={{ fontSize: '12px', color: '#6B21A8', letterSpacing: '0.5px' }}>
            {t('todayMeals', { count: todayStats.count })}
          </p>
        ) : (
          <p style={{ fontSize: '12px', color: '#9ca3af' }}>
            {t('noMeals')}
          </p>
        )}
      </motion.section>

      {/* Section 2: AI COACH */}
      <motion.section
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 28px', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <span style={{ fontSize: '16px' }}>💡</span>
          <h2 style={{ fontSize: '16px', fontWeight: 400, color: 'black', letterSpacing: '0.5px' }}>AI COACH</h2>
        </div>

        <ul style={{ display: 'flex', flexDirection: 'column', gap: '18px', listStyle: 'none', padding: 0, margin: 0 }}>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6B21A8', flexShrink: 0, marginTop: '5px' }} />
            <div>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>{t('todayCalories')}</p>
              <p style={{ fontSize: '24px', color: 'black', lineHeight: 1 }}>
                {todayStats.totalCalories} <span style={{ fontSize: '11px', color: '#9ca3af' }}>KCAL</span>
              </p>
            </div>
          </li>

          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#9ca3af', flexShrink: 0, marginTop: '5px' }} />
            <div>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>{t('nutrientBalance')}</p>
              <div style={{ display: 'flex', gap: '14px' }}>
                <span style={{ fontSize: '13px', color: 'black' }}>{t('carbs')} {todayStats.nutrients.carbs.toFixed(0)}g</span>
                <span style={{ fontSize: '13px', color: 'black' }}>{t('protein')} {todayStats.nutrients.protein.toFixed(0)}g</span>
                <span style={{ fontSize: '13px', color: 'black' }}>{t('fat')} {todayStats.nutrients.fat.toFixed(0)}g</span>
              </div>
            </div>
          </li>

          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#d1d5db', flexShrink: 0, marginTop: '5px' }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>{t('coachComment')}</p>
              {loadingFeedback ? (
                <div style={{ width: '14px', height: '14px', border: '1.5px solid black', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : displayComment ? (
                <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6 }}>
                  {persona === 'robot' ? '🤖' : persona === 'cat' ? '🐱' : '🐶'} "{displayComment}"
                </p>
              ) : (
                <p style={{ fontSize: '12px', color: '#9ca3af' }}>{t('noHistory')}</p>
              )}
            </div>
          </li>
        </ul>
      </motion.section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
