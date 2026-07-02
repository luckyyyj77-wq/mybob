"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { clearAllPhotos } from '@/lib/indexed-db';
import {
  FaChartBar, FaUsers, FaUtensils, FaFileAlt,
  FaHandshake, FaCog, FaBars, FaTimes, FaSignOutAlt, FaCreditCard, FaMedal,
} from 'react-icons/fa';

const NAV_ITEMS = [
  { href: '/admin',                  icon: FaChartBar,   label: '대시보드',    implemented: true },
  { href: '/admin/users',            icon: FaUsers,      label: '회원 관리',   implemented: true },
  { href: '/admin/meals',            icon: FaUtensils,   label: '식단 데이터', implemented: true },
  { href: '/admin/subscriptions',    icon: FaCreditCard, label: '구독 관리',   implemented: true },
  { href: '/admin/founding',         icon: FaMedal,      label: '천인회',      implemented: true },
  { href: '/admin/reports',          icon: FaFileAlt,    label: '통계 리포트', implemented: true },
  { href: '/admin/feedback',         icon: FaHandshake,  label: '제휴/문의',   implemented: false },
  { href: '/admin/settings',         icon: FaCog,        label: '앱 설정',     implemented: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/auth/login'); return; }
      try {
        const res = await fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.status === 403) { router.replace('/'); return; }
        setChecking(false);
      } catch {
        router.replace('/');
      }
    });
  }, [router]);

  if (checking) return (
    <html lang="ko">
      <body style={{ margin: 0, backgroundColor: '#0f0f0f' }}>
        <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '28px', height: '28px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </body>
    </html>
  );

  const NavContent = () => (
    <>
      {/* 로고 */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '4px' }}>MYBOB</p>
        <p style={{ fontSize: '16px', color: 'white', letterSpacing: '1px' }}>ADMIN</p>
      </div>

      {/* 메뉴 */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.implemented ? item.href : '#'}
              onClick={() => setMobileNavOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 20px',
                textDecoration: 'none',
                backgroundColor: active ? 'rgba(107,33,168,0.3)' : 'transparent',
                borderLeft: active ? '2px solid #6B21A8' : '2px solid transparent',
                cursor: item.implemented ? 'pointer' : 'default',
                transition: 'background-color 0.15s',
              }}
            >
              <item.icon size={14} color={active ? '#a855f7' : item.implemented ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'} />
              <span style={{ fontSize: '13px', color: active ? 'white' : item.implemented ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)' }}>
                {item.label}
              </span>
              {!item.implemented && (
                <span style={{ marginLeft: 'auto', fontSize: '9px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.5px' }}>예정</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 로그아웃 */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={async () => { await supabase.auth.signOut(); await clearAllPhotos(); localStorage.removeItem('mybob_meals'); localStorage.removeItem('mybob_storage_mode'); localStorage.removeItem('mybob_onboarding_done'); router.push('/auth/login'); }}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <FaSignOutAlt size={13} color="rgba(255,255,255,0.3)" />
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>로그아웃</span>
        </button>
      </div>
    </>
  );

  return (
    <html lang="ko">
      <body style={{ margin: 0, backgroundColor: '#f8f9fa' }}>
        <div style={{ minHeight: '100svh', display: 'flex' }}>
          {/* ── 데스크탑 사이드바 (768px 이상) ── */}
          <aside style={{
            width: '200px', flexShrink: 0,
            backgroundColor: '#0f0f0f',
            display: 'flex', flexDirection: 'column',
            position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
          }}
            className="admin-sidebar"
          >
            <NavContent />
          </aside>

          {/* ── 모바일 오버레이 사이드바 ── */}
          {mobileNavOpen && (
            <div
              onClick={() => setMobileNavOpen(false)}
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 200 }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{ width: '220px', height: '100%', backgroundColor: '#0f0f0f', display: 'flex', flexDirection: 'column' }}
              >
                <NavContent />
              </div>
            </div>
          )}

          {/* ── 메인 콘텐츠 ── */}
          <div style={{ flex: 1 }} className="admin-main">

            {/* 모바일 탑바 */}
            <div style={{ backgroundColor: '#0f0f0f', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              className="admin-topbar"
            >
              <button
                onClick={() => setMobileNavOpen(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <FaBars size={16} color="white" />
              </button>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', letterSpacing: '1px' }}>MYBOB ADMIN</span>
              <div style={{ width: '24px' }} />
            </div>

            {/* 페이지 콘텐츠 */}
            <div style={{ padding: '24px 20px' }}>
              {children}
            </div>
          </div>

          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }

            /* 데스크탑: 사이드바 고정, 메인 왼쪽 여백 */
            @media (min-width: 768px) {
              .admin-sidebar { display: flex !important; }
              .admin-main { margin-left: 200px; }
              .admin-topbar { display: none !important; }
            }

            /* 모바일: 사이드바 숨김, 탑바 표시 */
            @media (max-width: 767px) {
              .admin-sidebar { display: none !important; }
              .admin-main { margin-left: 0 !important; }
              .admin-topbar { display: flex !important; }
            }
          `}</style>
        </div>
      </body>
    </html>
  );
}
