"use client"; // Make this a client component to use useRouter and supabase client

import Link from 'next/link';
import { FaCamera, FaChartLine, FaHistory, FaUsers, FaCog, FaSignOutAlt } from 'react-icons/fa';
import { supabase } from '@/lib/supabase/client'; // Import Supabase client
import { useRouter } from 'next/navigation'; // Import useRouter

export default function Home() {
  const router = useRouter();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      router.push('/auth/login'); // Redirect to login page after logout
    } else {
      console.error('Logout error:', error);
      alert('로그아웃에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <header className="w-full max-w-4xl text-center py-6">
        <h1 className="text-5xl font-extrabold text-indigo-800 mb-2">뭐먹었어</h1>
        <p className="text-xl text-indigo-600">스마트한 식단 기록, AI가 알아서</p>
      </header>

      <main className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* 오늘의 섭취 기록 (Today's Intake Record) */}
        <section className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">오늘의 섭취 기록</h2>
          <div className="space-y-3">
            <p className="text-gray-700 text-lg">총 칼로리: <span className="font-semibold text-indigo-600">1800 kcal</span></p>
            <p className="text-700 text-lg">주요 식사: <span className="font-semibold text-indigo-600">점심 (비빔밥), 저녁 (닭가슴살 샐러드)</span></p>
            <p className="text-gray-700 text-lg">AI 분석 피드백 대기중: <span className="font-semibold text-orange-500">2건</span></p>
          </div>
          <button className="mt-6 w-full py-3 bg-indigo-500 text-white rounded-lg shadow-md hover:bg-indigo-600 text-lg font-semibold transition duration-300">
            상세 기록 보기
          </button>
        </section>

        {/* AI 자동 분석 알림 (AI Auto Analysis Notifications) */}
        <section className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">AI 분석 알림</h2>
          <ul className="space-y-3 text-gray-700 text-lg">
            <li><span className="font-semibold text-green-600">[완료]</span> 아침 식사 분석 완료!</li>
            <li><span className="font-semibold text-yellow-600">[대기]</span> 점심 식사 사진 분석 대기 중.</li>
            <li><span className="font-semibold text-red-600">[피드백 요청]</span> 저녁 식사 칼로리 확인 요청.</li>
          </ul>
          <button className="mt-6 w-full py-3 bg-teal-500 text-white rounded-lg shadow-md hover:bg-teal-600 text-lg font-semibold transition duration-300">
            모든 알림 보기
          </button>
        </section>
      </main>

      {/* Main Navigation */}
      <nav className="w-full max-w-4xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mt-10">
        <Link href="/capture" className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition duration-300 text-indigo-700 hover:text-indigo-900">
          <FaCamera className="text-4xl mb-2" />
          <span className="text-lg font-semibold">사진 촬영</span>
        </Link>
        <Link href="/report/daily" className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition duration-300 text-green-700 hover:text-green-900">
          <FaChartLine className="text-4xl mb-2" />
          <span className="text-lg font-semibold">리포트</span>
        </Link>
        <Link href="/history" className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition duration-300 text-purple-700 hover:text-purple-900">
          <FaHistory className="text-4xl mb-2" />
          <span className="text-lg font-semibold">사진 히스토리</span>
        </Link>
        <Link href="/community/recommendation" className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition duration-300 text-orange-700 hover:text-orange-900">
          <FaUsers className="text-4xl mb-2" />
          <span className="text-lg font-semibold">커뮤니티</span>
        </Link>
        <Link href="/settings" className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition duration-300 text-gray-700 hover:text-gray-900">
          <FaCog className="text-4xl mb-2" />
          <span className="text-lg font-semibold">설정</span>
        </Link>
      </nav>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="mt-10 flex items-center px-6 py-3 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 text-lg font-semibold transition duration-300"
      >
        <FaSignOutAlt className="mr-2" /> 로그아웃
      </button>
    </div>
  );
}
