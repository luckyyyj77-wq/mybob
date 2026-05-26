"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { clearAllPhotos } from '@/lib/indexed-db';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import './globals.css';
import { FaCamera, FaHistory, FaHome, FaChartPie, FaUsers, FaCog, FaHandshake, FaSignInAlt, FaSignOutAlt, FaDownload } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const MENU_ITEMS = [
  { icon: FaHome,      label: '홈',      href: '/' },
  { icon: FaChartPie,  label: '리포트',  href: '/report/daily' },
  { icon: FaUsers,     label: '커뮤니티', href: '/community/recommendation' },
  { icon: FaCog,       label: '설정',    href: '/settings' },
  { icon: FaHandshake, label: '제휴문의', href: '/partnership' },
];

const HEAD_META = (
  <>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#ffffff" />
    <link rel="manifest" href="/manifest.json" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="MyBob" />
    <meta name="mobile-web-app-capable" content="yes" />
  </>
);

function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const installPromptRef = useRef<any>(null);

  const isAuthRoute = pathname?.startsWith('/auth') || false;
  const isCaptureRoute = pathname === '/capture';
  const isAdminRoute = pathname?.startsWith('/admin') || false;

  useEffect(() => {
    const splashShown = localStorage.getItem('mybob_splash_shown');
    let splashTimer: ReturnType<typeof setTimeout> | null = null;
    if (!splashShown) {
      setShowSplash(true);
      splashTimer = setTimeout(() => {
        setShowSplash(false);
        localStorage.setItem('mybob_splash_shown', '1');
      }, 2000);
    }

    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
    setIsIOS(ios);

    // Service Worker 등록 (PWA 설치 조건 — 안드로이드 크롬 필수)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      installPromptRef.current = e;
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) setIsInstalled(true);
    const onInstalled = () => setIsInstalled(true);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      if (splashTimer) clearTimeout(splashTimer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // 세션 로드 후 리다이렉트 (getSession 중복 제거 — AuthContext에서 1회만 호출)
  useEffect(() => {
    if (loading) return;
    const p = pathname ?? '';
    const isAuth = p.startsWith('/auth');
    const isProtected = p === '/' || ['/capture', '/report', '/history', '/community', '/settings'].some(r => p.startsWith(r));
    if (!session && isProtected && !isAuth) router.push('/auth/login');
    else if (session && isAuth) router.push('/');
  }, [session, loading, pathname, router]);

  const handleInstall = async () => {
    const prompt = installPromptRef.current;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    installPromptRef.current = null;
    setShowInstallBanner(false);
  };

  const handleInstallFromSidebar = () => {
    setIsMenuOpen(false);
    if (installPromptRef.current) {
      handleInstall();
    } else {
      setShowInstallBanner(true);
    }
  };

  // 관리자 페이지는 전역 레이아웃 없이 자체 레이아웃 사용
  if (isAdminRoute) {
    return <>{children}</>;
  }

  if (showSplash || loading) {
    return (
      <>
        <AnimatePresence>
          {showSplash ? (
            <motion.div
              key="splash"
              initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
              style={{ position: 'fixed', inset: 0, zIndex: 10000, backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            >
              <motion.h1
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, duration: 0.8 }}
                style={{ fontSize: '48px', fontWeight: 400, letterSpacing: '-2px', marginBottom: '12px' }}
              >
                MYBOB
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.5 }}
                style={{ fontSize: '12px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase' }}
              >
                식단 기록 & AI 분석
              </motion.p>
            </motion.div>
          ) : (
            <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '28px', height: '28px', border: '2px solid black', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          )}
        </AnimatePresence>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </>
    );
  }

  const showNav = !isAuthRoute && !isCaptureRoute;

  return (
    <>
      {/* PWA 설치 배너 */}
      <AnimatePresence>
        {showInstallBanner && !isInstalled && (
          <motion.div
            initial={{ y: -100 }} animate={{ y: 0 }} exit={{ y: -100 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9998,
              backgroundColor: 'white', borderBottom: '1px solid #e5e7eb',
              padding: '14px 20px', display: 'flex', alignItems: 'flex-start', gap: '12px',
            }}
          >
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', color: 'black', marginBottom: '4px' }}>MyBob 앱으로 설치</p>
              {isIOS ? (
                <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.5 }}>
                  Safari 하단의 <strong>공유</strong> 버튼(□↑)을 탭한 후<br />
                  <strong>홈 화면에 추가</strong>를 선택하세요.
                </p>
              ) : (
                <p style={{ fontSize: '11px', color: '#9ca3af' }}>홈 화면에 추가하면 앱처럼 사용할 수 있어요</p>
              )}
            </div>
            {!isIOS && (
              <button
                onClick={handleInstall}
                style={{ padding: '8px 14px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '12px', cursor: 'pointer', letterSpacing: '0.5px', flexShrink: 0 }}
              >
                설치
              </button>
            )}
            <button
              onClick={() => setShowInstallBanner(false)}
              style={{ background: 'none', border: 'none', fontSize: '18px', color: '#9ca3af', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Sidebar */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            key="sidebar"
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: 'easeInOut' }}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '18px', letterSpacing: '-0.5px' }}>MYBOB</span>
              <button
                onClick={() => setIsMenuOpen(false)}
                style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '8px', background: 'none', border: 'none', cursor: 'pointer' }}
                aria-label="메뉴 닫기"
              >
                <span style={{ display: 'block', width: '26px', height: '2px', backgroundColor: 'black', transform: 'translateY(7px) rotate(45deg)', transformOrigin: 'center' }} />
                <span style={{ display: 'block', width: '26px', height: '2px', backgroundColor: 'black', transform: 'rotate(-45deg)', transformOrigin: 'center' }} />
              </button>
            </div>

            <nav style={{ flex: 1, overflowY: 'auto', padding: '0 24px 85px 24px' }}>
              {MENU_ITEMS.map((item) => (
                <Link
                  key={item.label} href={item.href} onClick={() => setIsMenuOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px 16px', textDecoration: 'none', color: 'black', borderBottom: '1px solid #f3f4f6' }}
                >
                  <item.icon size={20} style={{ flexShrink: 0, color: '#6B21A8' }} />
                  <span style={{ fontSize: '18px', letterSpacing: '-0.3px' }}>{item.label}</span>
                </Link>
              ))}

              {!isInstalled && (
                <button
                  onClick={handleInstallFromSidebar}
                  style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px 16px', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                >
                  <FaDownload size={20} style={{ flexShrink: 0, color: '#6B21A8' }} />
                  <div>
                    <span style={{ fontSize: '18px', letterSpacing: '-0.3px', color: 'black', display: 'block' }}>앱 설치</span>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {isIOS ? 'Safari 공유 → 홈 화면에 추가' : '홈 화면에 추가'}
                    </span>
                  </div>
                </button>
              )}
              {isInstalled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px 16px', borderBottom: '1px solid #f3f4f6' }}>
                  <FaDownload size={20} style={{ flexShrink: 0, color: '#9ca3af' }} />
                  <span style={{ fontSize: '18px', letterSpacing: '-0.3px', color: '#9ca3af' }}>설치됨</span>
                </div>
              )}

              <div style={{ padding: '24px 16px', borderTop: '1px solid #e5e7eb', marginTop: '8px' }}>
                {!session ? (
                  <Link href="/auth/login" onClick={() => setIsMenuOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: '#6B21A8' }}
                  >
                    <FaSignInAlt size={18} />
                    <span style={{ fontSize: '16px' }}>로그인</span>
                  </Link>
                ) : (
                  <button
                    onClick={async () => { await supabase.auth.signOut(); await clearAllPhotos(); localStorage.removeItem('mybob_meals'); localStorage.removeItem('mybob_storage_mode'); localStorage.removeItem('mybob_onboarding_done'); setIsMenuOpen(false); router.push('/auth/login'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0 }}
                  >
                    <FaSignOutAlt size={18} />
                    <span style={{ fontSize: '16px' }}>로그아웃</span>
                  </button>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main style={{ position: 'relative', paddingBottom: showNav ? '65px' : '0' }}>
        {children}
      </main>

      {showNav && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999 }}>
          <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderTop: '1px solid #e5e7eb', padding: '12px 40px 20px 40px' }}>
            <button
              onClick={() => setIsMenuOpen(prev => !prev)}
              style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '8px', background: 'none', border: 'none', cursor: 'pointer', width: '42px', alignItems: 'center' }}
              aria-label="메뉴"
            >
              <span style={{ display: 'block', width: '24px', height: '1px', backgroundColor: 'black' }} />
              <span style={{ display: 'block', width: '24px', height: '1px', backgroundColor: 'black' }} />
              <span style={{ display: 'block', width: '24px', height: '1px', backgroundColor: 'black' }} />
            </button>

            <Link href="/capture" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', textDecoration: 'none', color: 'black', width: '42px' }}>
              <FaCamera size={20} />
              <span style={{ fontSize: '9px', letterSpacing: '1px', color: '#6B21A8', textTransform: 'uppercase' }}>CAPTURE</span>
            </Link>

            <Link href="/history" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', textDecoration: 'none', color: 'black', width: '42px' }}>
              <FaHistory size={20} />
              <span style={{ fontSize: '9px', letterSpacing: '1px', color: '#6B21A8', textTransform: 'uppercase' }}>TIMELINE</span>
            </Link>
          </nav>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin') || false;

  if (isAdminRoute) {
    return (
      <html lang="ko">
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        </head>
        <body style={{ margin: 0, backgroundColor: '#0f0f0f' }}>
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="ko">
      <head>{HEAD_META}</head>
      <body style={{ margin: 0, backgroundColor: 'white', overflowX: 'hidden' }}>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
