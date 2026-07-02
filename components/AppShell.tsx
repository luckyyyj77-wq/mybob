"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from '@/i18n/routing'; // Use localized routing
import { Link } from '@/i18n/routing';
import { useAuth } from '@/lib/auth-context';
import { FaCamera, FaHistory, FaHome, FaChartPie, FaUsers, FaCog, FaHandshake, FaSignInAlt, FaSignOutAlt, FaDownload } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';

const MENU_ITEMS = [
  { icon: FaHome,      label: '홈',      href: '/', key: 'home' },
  { icon: FaChartPie,  label: '리포트',  href: '/report/daily', key: 'report' },
  { icon: FaUsers,     label: '커뮤니티', href: '/community/recommendation', key: 'community' },
  { icon: FaCog,       label: '설정',    href: '/settings', key: 'settings' },
  { icon: FaHandshake, label: '제휴문의', href: '/partnership', key: 'partnership' },
];

type AppBanner = { message: string; type: 'info' | 'warning' | 'event'; active: boolean } | null;

const BANNER_BG: Record<string, string> = { info: '#1e40af', warning: '#b45309', event: '#6B21A8' };

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [appBanner, setAppBanner] = useState<AppBanner>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const installPromptRef = useRef<any>(null);
  const tNav = useTranslations('Nav');

  const isAuthRoute = pathname?.startsWith('/auth') || false;
  const isCaptureRoute = pathname === '/capture';

  useEffect(() => {
    fetch('/api/admin/banner')
      .then(r => r.json())
      .then(data => {
        if (data.banner?.active) {
          setAppBanner(data.banner);
          if (sessionStorage.getItem('mybob_banner_dismissed') === data.banner.message) {
            setBannerDismissed(true);
          }
        }
      })
      .catch(() => {});
  }, []);

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

  useEffect(() => {
    if (loading) return;
    const p = pathname ?? '';
    const isAuth = p.startsWith('/auth');
    const isProtected = p === '/' || ['/capture', '/report', '/history', '/community', '/settings'].some(r => p.startsWith(r));
    if (!session && isProtected && !isAuth) router.push('/auth/login');
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
                {tNav('tagline')}
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
              <p style={{ fontSize: '13px', color: 'black', marginBottom: '4px' }}>{tNav('installBannerTitle')}</p>
              {isIOS ? (
                <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.5 }}>
                  {tNav.rich('installBannerIOS', {
                    strong: (chunks) => <strong>{chunks}</strong>,
                    br: () => <br />,
                  })}
                </p>
              ) : (
                <p style={{ fontSize: '11px', color: '#9ca3af' }}>{tNav('installBannerAndroid')}</p>
              )}
            </div>
            {!isIOS && (
              <button
                onClick={handleInstall}
                style={{ padding: '8px 14px', backgroundColor: 'black', color: 'white', border: 'none', fontSize: '12px', cursor: 'pointer', letterSpacing: '0.5px', flexShrink: 0 }}
              >
                {tNav('installBtn')}
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

      {appBanner?.active && !bannerDismissed && !isAuthRoute && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9997,
          backgroundColor: BANNER_BG[appBanner.type] || '#1e40af',
          color: 'white', padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', lineHeight: 1.4,
        }}>
          <span style={{ flex: 1 }}>{appBanner.message}</span>
          <button
            onClick={() => { setBannerDismissed(true); sessionStorage.setItem('mybob_banner_dismissed', appBanner.message); }}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: '16px', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}
          >×</button>
        </div>
      )}

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
                aria-label={tNav('closeMenu')}
              >
                <span style={{ display: 'block', width: '26px', height: '2px', backgroundColor: 'black', transform: 'translateY(7px) rotate(45deg)', transformOrigin: 'center' }} />
                <span style={{ display: 'block', width: '26px', height: '2px', backgroundColor: 'black', transform: 'rotate(-45deg)', transformOrigin: 'center' }} />
              </button>
            </div>

            <nav style={{ flex: 1, overflowY: 'auto', padding: '0 24px 85px 24px' }}>
              {MENU_ITEMS.map((item) => (
                <Link
                  key={item.key} href={item.href} onClick={() => setIsMenuOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px 16px', textDecoration: 'none', color: 'black', borderBottom: '1px solid #f3f4f6' }}
                >
                  <item.icon size={20} style={{ flexShrink: 0, color: '#6B21A8' }} />
                  <span style={{ fontSize: '18px', letterSpacing: '-0.3px' }}>{tNav(item.key)}</span>
                </Link>
              ))}

              {!isInstalled && (
                <button
                  onClick={handleInstallFromSidebar}
                  style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px 16px', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                >
                  <FaDownload size={20} style={{ flexShrink: 0, color: '#6B21A8' }} />
                  <div>
                    <span style={{ fontSize: '18px', letterSpacing: '-0.3px', color: 'black', display: 'block' }}>{tNav('install')}</span>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {isIOS ? tNav('installIOSShort') : tNav('installAndroidShort')}
                    </span>
                  </div>
                </button>
              )}
              {isInstalled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px 16px', borderBottom: '1px solid #f3f4f6' }}>
                  <FaDownload size={20} style={{ flexShrink: 0, color: '#9ca3af' }} />
                  <span style={{ fontSize: '18px', letterSpacing: '-0.3px', color: '#9ca3af' }}>{tNav('installed')}</span>
                </div>
              )}

              <div style={{ padding: '24px 16px', borderTop: '1px solid #e5e7eb', marginTop: '8px' }}>
                {!session ? (
                  <Link href="/auth/login" onClick={() => setIsMenuOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: '#6B21A8' }}
                  >
                    <FaSignInAlt size={18} />
                    <span style={{ fontSize: '16px' }}>{tNav('login')}</span>
                  </Link>
                ) : (
                  <Link href="/settings/account" onClick={() => setIsMenuOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: '#374151' }}
                  >
                    <FaSignOutAlt size={18} />
                    <span style={{ fontSize: '16px' }}>{tNav('myAccount')}</span>
                  </Link>
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
              aria-label={tNav('openMenu')}
            >
              <span style={{ display: 'block', width: '24px', height: '1px', backgroundColor: 'black' }} />
              <span style={{ display: 'block', width: '24px', height: '1px', backgroundColor: 'black' }} />
              <span style={{ display: 'block', width: '24px', height: '1px', backgroundColor: 'black' }} />
            </button>

            <Link href="/capture" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', textDecoration: 'none', color: 'black', width: '42px' }}>
              <FaCamera size={20} />
              <span style={{ fontSize: '9px', letterSpacing: '1px', color: '#6B21A8', textTransform: 'uppercase' }}>{tNav('capture')}</span>
            </Link>

            <Link href="/history" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', textDecoration: 'none', color: 'black', width: '42px' }}>
              <FaHistory size={20} />
              <span style={{ fontSize: '9px', letterSpacing: '1px', color: '#6B21A8', textTransform: 'uppercase' }}>{tNav('timeline')}</span>
            </Link>
          </nav>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
