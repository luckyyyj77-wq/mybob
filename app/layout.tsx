"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import './globals.css';
import { Session } from '@supabase/supabase-js';

import { FaHome, FaCamera, FaChartPie, FaHistory, FaCog } from 'react-icons/fa';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  // Define protected routes
  const protectedRoutes = ['/', '/capture', '/report', '/history', '/community', '/settings'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = pathname.startsWith('/auth');

  useEffect(() => {
    const checkSession = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);

      if (!session && isProtectedRoute && !isAuthRoute) {
        router.push('/auth/login');
      } else if (session && isAuthRoute) {
        router.push('/'); 
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);

      if (!session && isProtectedRoute && !isAuthRoute) {
        router.push('/auth/login');
      } else if (session && isAuthRoute) {
        router.push('/');
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [pathname, router, isProtectedRoute, isAuthRoute]);


  if (loading) {
    return (
      <html lang="en">
        <body>
          <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <p className="text-xl text-gray-700 font-black animate-pulse">LOADING...</p>
          </div>
        </body>
      </html>
    );
  }

  const showNav = !isAuthRoute;

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased pb-24">
        <main className="min-h-screen">
          {children}
        </main>

        {showNav && (
          <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-6 py-3 pb-8 z-50 flex justify-between items-center shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            {[
              { icon: FaHome, label: '홈', href: '/' },
              { icon: FaHistory, label: '기록', href: '/history' },
              { icon: FaCamera, label: '분석', href: '/capture', primary: true },
              { icon: FaChartPie, label: '리포트', href: '/report/daily' },
              { icon: FaCog, label: '설정', href: '/settings' },
            ].map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              
              if (item.primary) {
                return (
                  <Link key={item.label} href={item.href}>
                    <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-200 -mt-10 transform active:scale-90 transition-transform">
                      <item.icon className="text-2xl text-white" />
                    </div>
                  </Link>
                );
              }

              return (
                <Link key={item.label} href={item.href} className="flex flex-col items-center gap-1">
                  <item.icon className={`text-xl ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className={`text-[10px] font-bold ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </body>
    </html>
  );
}
