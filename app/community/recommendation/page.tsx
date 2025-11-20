export default function CommunityRecommendationPage() {
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">맛집 추천</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-blue-700 mb-2">오늘의 추천 맛집: 건강한 샐러드 맛집</h3>
          <p className="text-gray-700">신선한 재료와 다양한 드레싱으로 건강한 한 끼를 즐겨보세요!</p>
          <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">자세히 보기</button>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-green-700 mb-2">인기 맛집: 매콤한 닭볶음탕</h3>
          <p className="text-gray-700">스트레스 해소에 딱! 친구들과 함께 즐기기 좋은 곳.</p>
          <button className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">자세히 보기</button>
        </div>
      </div>
      <div className="mt-8 bg-gray-50 p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold text-gray-800 mb-3">내 주변 맛집 찾기 (미구현)</h3>
        <p className="text-gray-700">위치 기반으로 주변 맛집을 추천해주는 기능이 들어갈 예정입니다.</p>
      </div>
    </div>
  );
}
