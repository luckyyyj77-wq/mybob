"use client";

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  token: string | null;
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true, token: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);
  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      wasSignedIn.current = !!s;
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);

      // 로그인 상태였는데 외부에서 세션이 끊긴 경우
      if (event === 'SIGNED_OUT' && wasSignedIn.current) {
        wasSignedIn.current = false;
        const isAuthPage = window.location.pathname.startsWith('/auth');
        if (!isAuthPage) {
          // 토스트 메시지 표시 후 로그인 페이지 이동
          const toast = document.createElement('div');
          toast.textContent = '다른 기기에서 로그아웃되었습니다.';
          toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#0f0f0f;color:white;padding:12px 20px;font-size:13px;z-index:9999;white-space:nowrap;';
          document.body.appendChild(toast);
          setTimeout(() => {
            document.body.removeChild(toast);
            window.location.href = '/auth/login';
          }, 2000);
        }
      }

      if (s) wasSignedIn.current = true;
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, token: session?.access_token ?? null }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
