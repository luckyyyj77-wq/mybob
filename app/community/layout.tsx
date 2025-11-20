import Link from 'next/link';

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 flex flex-col items-center p-4">
      <header className="w-full max-w-4xl text-center py-6 mx-auto">
        <h1 className="text-5xl font-extrabold text-purple-800 mb-2">커뮤니티</h1>
        <p className="text-xl text-purple-600">함께 즐기는 식단 공유</p>
      </header>

      <nav className="w-full max-w-lg flex justify-center space-x-4 mb-8">
        <Link href="/community/recommendation" className="px-6 py-2 rounded-full text-lg font-semibold text-white bg-purple-500 hover:bg-purple-600 transition duration-300">
          맛집 추천
        </Link>
        <Link href="/community/challenge" className="px-6 py-2 rounded-full text-lg font-semibold text-white bg-purple-500 hover:bg-purple-600 transition duration-300">
          인증 챌린지
        </Link>
      </nav>

      <main className="w-full max-w-4xl bg-white rounded-xl shadow-lg p-6 md:p-8">
        {children}
      </main>

      <Link href="/" className="mt-8 text-purple-600 hover:underline">
        홈으로 돌아가기
      </Link>
    </div>
  );
}
