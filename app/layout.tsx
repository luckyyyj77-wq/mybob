"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import './globals.css';
import { Session } from '@supabase/supabase-js';
import { FaBars, FaCamera, FaHistory, FaTimes, FaHome, FaChartPie, FaUsers, FaCog, FaHandshake } from 'react-icons/fa';
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
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">Loading...</p>
            </div>
          </div>
        </body>
      </html>
    );
  }

  const showNav = !isAuthRoute;

  const menuItems = [
    { icon: FaHome, label: '홈버튼', href: '/' },
    { icon: FaChartPie, label: '리포트', href: '/report/daily' },
    { icon: FaUsers, label: '커뮤니티', href: '/community/recommendation' },
    { icon: FaCog, label: '설정', href: '/settings' },
    { icon: FaHandshake, label: '제휴문의', href: '#' },
  ];

  return (
    <html lang="ko" className="h-full">
      <body className="h-full bg-white text-black antialiased overflow-x-hidden flex flex-col">
        {/* Sidebar Overlay */}
        <AnimatePresence mode="wait">
          {isMenuOpen && (
            <div key="sidebar-container" className="fixed inset-0 z-[1000]">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
                className="absolute inset-0 bg-black"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
                className="absolute top-0 left-0 bottom-0 w-64 bg-white border-r-4 border-black flex flex-col"
              >
                <div className="p-8 border-b-4 border-black">
                  <h2 className="text-2xl font-black tracking-tighter">MYBOB</h2>
                </div>

                <nav className="flex-grow flex flex-col py-6">
                  {menuItems.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className="px-8 py-4 text-lg font-bold text-black hover:bg-black hover:text-white transition-colors border-b border-gray-100"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>

                <div className="p-8 border-t-4 border-black">
                  {!session ? (
                    <Link
                      href="/auth/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="text-base font-black text-purple-700 hover:text-purple-900 transition-colors"
                    >
                      로그인
                    </Link>
                  ) : (
                    <button
                      onClick={async () => {
                        await supabase.auth.signOut();
                        setIsMenuOpen(false);
                        router.push('/auth/login');
                      }}
                      className="text-base font-black text-red-500 hover:text-red-700 transition-colors text-left"
                    >
                      로그아웃
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <main className={`flex-grow relative ${showNav ? 'pb-24' : ''}`}>
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
                borderTop: '4px solid black',
                padding: '12px 40px 20px 40px',
              }}
            >
              {/* Hamburger Menu */}
              <button
                onClick={() => setIsMenuOpen(true)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  padding: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'block', width: '28px', height: '3px', backgroundColor: 'black' }} />
                <span style={{ display: 'block', width: '28px', height: '3px', backgroundColor: 'black' }} />
                <span style={{ display: 'block', width: '28px', height: '3px', backgroundColor: 'black' }} />
              </button>

              {/* Camera Scan */}
              <Link
                href="/capture"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '60px',
                  height: '60px',
                  backgroundColor: 'white',
                  border: '4px solid black',
                  borderRadius: '50%',
                  marginTop: '-30px',
                  boxShadow: '4px 4px 0px black',
                  textDecoration: 'none',
                  color: 'black',
                }}
              >
                <FaCamera size={24} />
              </Link>

              {/* Timeline */}
              <Link href="/history" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <FaHistory size={24} color="black" />
                <span style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '2px', color: '#6B21A8', textTransform: 'uppercase' }}>TIMELINE</span>
              </Link>
            </nav>
          </div>
        )}
      </body>
    </html>
  );
}
