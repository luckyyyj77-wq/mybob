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

  // Safely check for auth routes
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
      <html lang="en">
        <body>
          <div className="min-h-screen flex items-center justify-center bg-white text-slate-900 antialiased">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading MyBob...</p>
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
    <html lang="en">
      <body className="bg-white text-slate-900 antialiased overflow-x-hidden">
        {/* Sidebar Overlay */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
              />
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed top-0 left-0 bottom-0 w-72 bg-white z-[70] shadow-2xl p-8 flex flex-col"
              >
                <div className="flex justify-between items-center mb-12">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter">MYBOB</h2>
                  <button onClick={() => setIsMenuOpen(false)} className="text-slate-300 hover:text-slate-900 transition-colors">
                    <FaTimes size={24} />
                  </button>
                </div>

                <nav className="flex-grow flex flex-col gap-8">
                  {menuItems.map((item) => (
                    <Link 
                      key={item.label} 
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-5 text-xl font-bold text-slate-400 hover:text-indigo-600 transition-all group"
                    >
                      <item.icon className="text-xl opacity-50 group-hover:opacity-100" />
                      <span className="group-hover:translate-x-1 transition-transform">{item.label}</span>
                    </Link>
                  ))}
                  
                  {/* Auth Link in Menu */}
                  {!session ? (
                    <Link 
                      href="/auth/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-5 text-xl font-bold text-indigo-600 hover:text-indigo-700 transition-all pt-4 border-t border-slate-50"
                    >
                      <span>로그인</span>
                    </Link>
                  ) : (
                    <button 
                      onClick={async () => {
                        await supabase.auth.signOut();
                        setIsMenuOpen(false);
                        router.push('/auth/login');
                      }}
                      className="flex items-center gap-5 text-xl font-bold text-rose-500 hover:text-rose-600 transition-all pt-4 border-t border-slate-50 text-left"
                    >
                      <span>로그아웃</span>
                    </button>
                  )}
                </nav>

                <div className="mt-auto">
                  <p className="text-[10px] font-black text-slate-200 uppercase tracking-widest">Version 1.0.0</p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <main className={`min-h-screen ${showNav ? 'pb-24' : ''}`}>
          {children}
        </main>

        {showNav && (
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-slate-900 px-6 py-4 pb-8 z-50 flex justify-between items-center">
            {/* Hamburger Menu */}
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="p-2 text-3xl text-slate-900"
            >
              <FaBars />
            </button>

            {/* Camera Scan */}
            <Link href="/capture" className="bg-indigo-600 p-4 rounded-2xl shadow-lg border-2 border-slate-900 transform -translate-y-2">
              <FaCamera className="text-2xl text-white" />
            </Link>

            {/* Timeline */}
            <Link href="/history" className="flex flex-col items-center">
              <div className="text-3xl text-slate-900">
                <FaHistory />
              </div>
              <span className="text-[10px] font-black uppercase tracking-tighter text-indigo-600 mt-1">TIMELINE</span>
            </Link>
          </nav>
        )}
      </body>
    </html>
  );
}
