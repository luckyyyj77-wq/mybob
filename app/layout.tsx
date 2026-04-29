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
      <html lang="en" className="h-full">
        <body className="h-full bg-white text-slate-900 antialiased">
          <div className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-black uppercase tracking-widest text-slate-400">Loading...</p>
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
    <html lang="en" className="h-full">
      <body className="h-full bg-white text-slate-900 antialiased overflow-x-hidden flex flex-col">
        {/* Sidebar Overlay */}
        <AnimatePresence mode="wait">
          {isMenuOpen && (
            <div key="sidebar-container" className="fixed inset-0 z-[1000]">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
              />
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute top-0 left-0 bottom-0 w-80 bg-white shadow-2xl p-10 flex flex-col"
              >
                <div className="flex justify-between items-center mb-16">
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic">MYBOB</h2>
                  <button onClick={() => setIsMenuOpen(false)} className="text-slate-300 hover:text-slate-900 transition-colors">
                    <FaTimes size={32} />
                  </button>
                </div>

                <nav className="flex-grow flex flex-col gap-10">
                  {menuItems.map((item) => (
                    <Link 
                      key={item.label} 
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-6 text-2xl font-black text-slate-400 hover:text-indigo-600 transition-all group"
                    >
                      <item.icon className="text-2xl opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-transform" />
                      <span className="group-hover:translate-x-2 transition-transform">{item.label}</span>
                    </Link>
                  ))}
                  
                  <div className="mt-4 pt-10 border-t-2 border-slate-50">
                    {!session ? (
                      <Link 
                        href="/auth/login"
                        onClick={() => setIsMenuOpen(false)}
                        className="text-2xl font-black text-indigo-600 hover:text-indigo-800 transition-colors"
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
                        className="text-2xl font-black text-rose-500 hover:text-rose-700 transition-colors text-left"
                      >
                        로그아웃
                      </button>
                    )}
                  </div>
                </nav>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <main className={`flex-grow relative ${showNav ? 'pb-48' : ''}`}>
          {children}
        </main>

        {showNav && (
          <div 
            style={{ 
              position: 'fixed', 
              bottom: '40px', 
              left: '50%', 
              transform: 'translateX(-50%)', 
              width: '100%', 
              maxWidth: '450px',
              zIndex: 9999,
              pointerEvents: 'none',
              display: 'flex',
              justifyContent: 'center',
              padding: '0 24px'
            }}
          >
            <nav className="w-full bg-white border-[5px] border-slate-900 rounded-[2.5rem] px-8 py-4 flex justify-between items-center shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] pointer-events-auto">
              {/* Hamburger Menu */}
              <button 
                onClick={() => setIsMenuOpen(true)}
                className="p-2 text-4xl text-slate-900 hover:scale-110 active:scale-90 transition-all"
              >
                <FaBars />
              </button>

              {/* Camera Scan */}
              <Link href="/capture" className="bg-indigo-600 p-5 rounded-3xl shadow-[0_15px_30px_-5px_rgba(79,70,229,0.5)] border-[5px] border-slate-900 transform -translate-y-8 hover:-translate-y-10 transition-all active:scale-95">
                <FaCamera className="text-3xl text-white" />
              </Link>

              {/* Timeline */}
              <Link href="/history" className="flex flex-col items-center group">
                <div className="text-4xl text-slate-900 group-hover:scale-110 active:scale-90 transition-all">
                  <FaHistory />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mt-1">TIMELINE</span>
              </Link>
            </nav>
          </div>
        )}
      </body>
    </html>
  );
}
