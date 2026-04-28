"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaUsers, FaTrophy, FaArrowLeft } from 'react-icons/fa';

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex flex-col items-center p-4">
      <header className="w-full max-w-4xl text-center py-8">
        <h1 className="text-5xl font-extrabold text-orange-800 mb-2 flex items-center justify-center">
          <FaUsers className="mr-4" /> 커뮤니티
        </h1>
        <p className="text-xl text-orange-600 font-medium">함께 먹고, 함께 힘내요!</p>
      </header>

      <nav className="w-full max-w-lg flex justify-center space-x-2 mb-8 bg-white/50 p-1.5 rounded-2xl backdrop-blur-sm border border-orange-200">
        <Link 
          href="/community/recommendation" 
          className={`flex-1 text-center py-3 rounded-xl text-sm font-bold transition duration-300 ${
            pathname === '/community/recommendation' 
              ? 'bg-orange-500 text-white shadow-md' 
              : 'text-orange-600 hover:bg-orange-100'
          }`}
        >
          <FaUsers className="inline mr-2" /> 추천 피드
        </Link>
        <Link 
          href="/community/challenge" 
          className={`flex-1 text-center py-3 rounded-xl text-sm font-bold transition duration-300 ${
            pathname === '/community/challenge' 
              ? 'bg-orange-500 text-white shadow-md' 
              : 'text-orange-600 hover:bg-orange-100'
          }`}
        >
          <FaTrophy className="inline mr-2" /> 챌린지
        </Link>
      </nav>

      <main className="w-full max-w-5xl">
        {children}
      </main>

      <Link href="/" className="my-10 text-orange-600 hover:underline flex items-center font-bold bg-white px-6 py-2 rounded-full shadow-sm">
        <FaArrowLeft className="mr-2" /> 홈으로 돌아가기
      </Link>
    </div>
  );
}
