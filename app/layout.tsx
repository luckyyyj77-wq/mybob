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
            <p className="text-xl text-gray-700 font-black">LOADING...</p>
          </div>
        </body>
      </html>
    );
  }

  const showNav = !isAuthRoute;

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased overflow-x-hidden">
        <main className={`min-h-screen ${showNav ? 'pb-20' : ''}`}>
          {children}
        </main>

        {showNav && (
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 py-2 pb-6 z-50 flex justify-around items-center shadow-lg">
            {[
              { icon: FaHome, label: 'Home', href: '/' },
              { icon: FaHistory, label: 'History', href: '/history' },
              { icon: FaCamera, label: 'Scan', href: '/capture', primary: true },
              { icon: FaChartPie, label: 'Report', href: '/report/daily' },
              { icon: FaCog, label: 'Settings', href: '/settings' },
            ].map((item) => {
              const isActive = pathname === item.href;
              
              if (item.primary) {
                return (
                  <Link key={item.label} href={item.href}>
                    <div className="bg-indigo-600 p-3.5 rounded-2xl shadow-lg -mt-8 border-4 border-slate-50">
                      <item.icon className="text-xl text-white" />
                    </div>
                  </Link>
                );
              }

              return (
                <Link key={item.label} href={item.href} className="flex flex-col items-center gap-0.5">
                  <item.icon className={`text-lg ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className={`text-[9px] font-black uppercase ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </body>
    </html>
  );
}
