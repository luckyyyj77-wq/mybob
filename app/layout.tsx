"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import './globals.css';
import { Session } from '@supabase/supabase-js';

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
      // Authentication disabled temporarily
      setLoading(false);
      /*
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);

      if (!session && isProtectedRoute && !isAuthRoute) {
        router.push('/auth/login');
      } else if (session && isAuthRoute) {
        router.push('/'); 
      }
      */
    };

    checkSession();

    /*
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
    */
  }, [pathname, router, isProtectedRoute, isAuthRoute]);


  if (loading) {
    return (
      <html lang="en">
        <body>
          <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <p className="text-xl text-gray-700">로딩 중...</p>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
