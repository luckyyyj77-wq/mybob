"use client";

import { Link, useRouter } from '@/i18n/routing';
import { FaArrowLeft } from 'react-icons/fa';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTranslations } from 'next-intl';

type CoachPersona = 'robot' | 'cat' | 'dog';
type Plan = 'free' | 'pro' | 'lifetime';
const PLAN_COLOR: Record<Plan, string> = { free: '#9ca3af', pro: '#6B21A8', lifetime: '#d97706' };

export default function SettingsPage() {
  const { session } = useAuth();
  const router = useRouter();
  const t = useTranslations('Settings');
  const tp = useTranslations('Plan');
  const [coachPersona, setCoachPersona] = useState<CoachPersona>('dog');
  const [profile, setProfile] = useState<{ nickname: string; avatar_url: string | null; plan: Plan }>({ nickname: '', avatar_url: null, plan: 'free' });

  const COACH_OPTIONS: { id: CoachPersona; emoji: string; name: string; desc: string }[] = useMemo(() => [
    { id: 'robot', emoji: '🤖', name: t('coach.robot.name'), desc: t('coach.robot.desc') },
    { id: 'cat',   emoji: '🐱', name: t('coach.cat.name'),   desc: t('coach.cat.desc') },
    { id: 'dog',   emoji: '🐶', name: t('coach.dog.name'),   desc: t('coach.dog.desc') },
  ], [t]);

  const MENU_ITEMS = useMemo(() => [
    { href: '/settings/plan',    icon: '💳', label: t('menu.plan'),    desc: t('menu.planDesc') },
    { href: '/settings/goal',    icon: '🎯', label: t('menu.goal'),    desc: t('menu.goalDesc') },
    { href: '/settings/account', icon: '👤', label: t('menu.account'), desc: t('menu.accountDesc') },
    { href: '/settings/storage', icon: '💾', label: t('menu.storage'), desc: t('menu.storageDesc') },
    { href: '/settings/data',    icon: '📊', label: t('menu.data'),    desc: t('menu.dataDesc') },
  ], [t]);

  useEffect(() => {
    const saved = (localStorage.getItem('mybob_coach_persona') as CoachPersona) || 'dog';
    setCoachPersona(saved);
  }, []);

  useEffect(() => {
    if (!session) return;
    fetch('/api/profile', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.json())
      .then(d => { if (d.nickname) setProfile({ nickname: d.nickname, avatar_url: d.avatar_url ?? null, plan: d.plan ?? 'free' }); });
  }, [session]);

  return (
    <div style={{ height: 'calc(100svh - 65px)', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, padding: '24px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>APP</p>
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>{t('title')}</h1>
        </div>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaArrowLeft size={13} color="black" />
          </div>
        </Link>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

        {/* 프로필 */}
        <Link href="/settings/account" style={{ textDecoration: 'none', display: 'block', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#e9d5ff', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '22px' }}>👤</span>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '15px', fontWeight: 500, color: 'black', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile.nickname || '—'}
                </span>
                <span style={{ fontSize: '9px', letterSpacing: '1px', color: 'white', backgroundColor: PLAN_COLOR[profile.plan], padding: '2px 6px', flexShrink: 0 }}>
                  {tp(profile.plan).toUpperCase()}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#a855f7' }}>{t('profileEdit')} →</span>
            </div>
          </div>
        </Link>

        {/* 코치 스타일 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>{t('coachStyle')}</p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {COACH_OPTIONS.map(opt => {
            const isSelected = coachPersona === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => setCoachPersona(opt.id)}
                style={{
                  flex: 1, padding: '14px 8px',
                  border: `2px solid ${isSelected ? '#6B21A8' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  backgroundColor: isSelected ? '#f3e8ff' : 'white',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  userSelect: 'none', WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: '26px', lineHeight: 1 }}>{opt.emoji}</span>
                <span style={{ fontSize: '12px', color: isSelected ? '#6B21A8' : 'black', fontWeight: isSelected ? 600 : 400 }}>{opt.name}</span>
                <span style={{ fontSize: '10px', color: '#9ca3af', lineHeight: 1.4, textAlign: 'center' }}>{opt.desc}</span>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => {
            localStorage.setItem('mybob_coach_persona', coachPersona);
            const keys = Object.keys(localStorage);
            keys.forEach(k => { if (k.startsWith('mybob_coach_') && k !== 'mybob_coach_persona') localStorage.removeItem(k); });
            alert(t('coachChanged', { emoji: COACH_OPTIONS.find(o => o.id === coachPersona)?.emoji ?? '' }));
          }}
          style={{
            width: '100%', padding: '14px',
            backgroundColor: '#6B21A8', color: 'white',
            border: 'none', borderRadius: '8px',
            fontSize: '14px', fontWeight: 500,
            cursor: 'pointer', marginBottom: '28px',
            touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
          }}
        >
          {t('apply')}
        </button>

        {/* 메뉴 목록 */}
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>{t('menu.account')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: '28px' }}>
          {MENU_ITEMS.map(item => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px', backgroundColor: 'white',
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '20px', width: '24px', textAlign: 'center' }}>{item.icon}</span>
                  <div>
                    <p style={{ fontSize: '14px', color: 'black', marginBottom: '2px' }}>{item.label}</p>
                    <p style={{ fontSize: '11px', color: '#9ca3af' }}>{item.desc}</p>
                  </div>
                </div>
                <span style={{ fontSize: '18px', color: '#d1d5db' }}>›</span>
              </div>
            </Link>
          ))}
        </div>

        {/* 약관/정책 링크 */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', paddingBottom: '8px' }}>
          {[
            { href: '/terms',   label: t('legal.terms') },
            { href: '/privacy', label: t('legal.privacy') },
            { href: '/refund',  label: t('legal.refund') },
          ].map(link => (
            <Link key={link.href} href={link.href} style={{ fontSize: '11px', color: '#9ca3af', textDecoration: 'none' }}>
              {link.label}
            </Link>
          ))}
        </div>

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
