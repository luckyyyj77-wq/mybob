export default function CommunityChallengePage() {
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">인증 챌린지</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-purple-700 mb-2">#물2리터마시기 챌린지</h3>
          <p className="text-gray-700">매일 물 2리터 마시고 인증샷 남기기! 건강한 습관을 만들어요.</p>
          <button className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600">참여하기</button>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-pink-700 mb-2">#클린식단챌린지</h3>
          <p className="text-gray-700">일주일간 가공식품 줄이고 건강한 식단 유지! 성공하면 특별 배지!</p>
          <button className="mt-4 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600">참여하기</button>
        </div>
      </div>
      <div className="mt-8 bg-gray-50 p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold text-gray-800 mb-3">나만의 챌린지 만들기 (미구현)</h3>
        <p className="text-gray-700">새로운 챌린지를 직접 만들고 친구들을 초대해 보세요.</p>
      </div>
    </div>
  );
}
