"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import './globals.css';
import { Session } from '@supabase/supabase-js';
import { FaCamera, FaHistory, FaHome, FaChartPie, FaUsers, FaCog, FaHandshake, FaSignInAlt, FaSignOutAlt } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isAuthRoute = pathname?.startsWith('/auth') || false;
  const isCaptureRoute = pathname === '/capture';
  const isProtectedRoute = pathname === '/' || ['/capture', '/report', '/history', '/community', '/settings'].some(route => pathname?.startsWith(route));

  useEffect(() => {
    const checkSession = async () => {
      setLoading(true);
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setLoading(false);

      if (!currentSession && isProtectedRoute && !isAuthRoute) {
        router.push('/auth/login');
      } else if (currentSession && isAuthRoute) {
        router.push('/');
      }
    };
    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession && isProtectedRoute && !isAuthRoute) {
        router.push('/auth/login');
      } else if (newSession && isAuthRoute) {
        router.push('/');
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [pathname, isProtectedRoute, isAuthRoute, router]);

  if (loading) {
    return (
      <html lang="ko" className="h-full">
        <body className="h-full bg-white text-black antialiased">
          <div className="min-h-screen flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        </body>
      </html>
    );
  }

  const showNav = !isAuthRoute && !isCaptureRoute;

  const menuItems = [
    { icon: FaHome, label: '홈', href: '/' },
    { icon: FaChartPie, label: '리포트', href: '/report/daily' },
    { icon: FaUsers, label: '커뮤니티', href: '/community/recommendation' },
    { icon: FaCog, label: '설정', href: '/settings' },
    { icon: FaHandshake, label: '제휴문의', href: '#' },
  ];

  return (
    <html lang="ko" className="h-full">
      <body className="h-full bg-white text-black antialiased overflow-x-hidden flex flex-col">

        {/* Fullscreen Sidebar */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              key="sidebar"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.28, ease: 'easeInOut' }}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                backgroundColor: 'white',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* 상단: 타이틀 + 닫기(햄버거 재클릭) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                borderBottom: '1px solid #e5e7eb',
              }}>
                <span style={{ fontSize: '18px', letterSpacing: '-0.5px' }}>MYBOB</span>

                {/* 닫기 버튼 — 햄버거 동일 위치/모양 */}
                <button
                  onClick={() => setIsMenuOpen(false)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    padding: '8px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  aria-label="메뉴 닫기"
                >
                  {/* X 모양 (두 선 교차) */}
                  <span style={{
                    display: 'block', width: '26px', height: '2px',
                    backgroundColor: 'black',
                    transform: 'translateY(7px) rotate(45deg)',
                    transformOrigin: 'center',
                  }} />
                  <span style={{
                    display: 'block', width: '26px', height: '2px',
                    backgroundColor: 'black',
                    transform: 'rotate(-45deg)',
                    transformOrigin: 'center',
                  }} />
                </button>
              </div>

              {/* 메뉴 아이템 — 아이콘 중심 */}
              <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0', padding: '0 24px' }}>
                {menuItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '20px',
                      padding: '20px 16px',
                      textDecoration: 'none',
                      color: 'black',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <item.icon size={22} style={{ flexShrink: 0, color: '#6B21A8' }} />
                    <span style={{ fontSize: '20px', letterSpacing: '-0.3px' }}>{item.label}</span>
                  </Link>
                ))}
              </nav>

              {/* 하단: 로그인/로그아웃 */}
              <div style={{
                padding: '24px 40px',
                borderTop: '1px solid #e5e7eb',
              }}>
                {!session ? (
                  <Link
                    href="/auth/login"
                    onClick={() => setIsMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      textDecoration: 'none',
                      color: '#6B21A8',
                    }}
                  >
                    <FaSignInAlt size={18} />
                    <span style={{ fontSize: '16px' }}>로그인</span>
                  </Link>
                ) : (
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setIsMenuOpen(false);
                      router.push('/auth/login');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#ef4444',
                      padding: 0,
                    }}
                  >
                    <FaSignOutAlt size={18} />
                    <span style={{ fontSize: '16px' }}>로그아웃</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <main style={{ flexGrow: 1, position: 'relative', paddingBottom: showNav ? '65px' : '0' }}>
          {children}
        </main>

        {showNav && (
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
            }}
          >
            <nav
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'white',
                borderTop: '1px solid #e5e7eb',
                padding: '12px 40px 20px 40px',
              }}
            >
              {/* 햄버거 — 열기/닫기 토글 */}
              <button
                onClick={() => setIsMenuOpen(prev => !prev)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  padding: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
                aria-label={isMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
              >
                <span style={{ display: 'block', width: '26px', height: '2px', backgroundColor: 'black' }} />
                <span style={{ display: 'block', width: '26px', height: '2px', backgroundColor: 'black' }} />
                <span style={{ display: 'block', width: '26px', height: '2px', backgroundColor: 'black' }} />
              </button>

              {/* 카메라 */}
              <Link
                href="/capture"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '56px',
                  height: '56px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '50%',
                  marginTop: '-28px',
                  textDecoration: 'none',
                  color: 'black',
                }}
              >
                <FaCamera size={22} />
              </Link>

              {/* 타임라인 */}
              <Link
                href="/history"
                style={{
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                  color: 'black',
                }}
              >
                <FaHistory size={22} />
                <span style={{ fontSize: '9px', letterSpacing: '1px', color: '#6B21A8', textTransform: 'uppercase' }}>TIMELINE</span>
              </Link>
            </nav>
          </div>
        )}
      </body>
    </html>
  );
}
