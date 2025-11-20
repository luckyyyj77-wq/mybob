export default function MonthlyReportPage() {
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">월간 리포트 (이번 달)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-blue-700 mb-3">총 월간 칼로리</h3>
          <p className="text-3xl font-bold text-blue-900">63,000 kcal</p>
        </div>
        <div className="bg-green-50 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-green-700 mb-3">월간 외식 비율</h3>
          <p className="text-3xl font-bold text-green-900">55%</p>
        </div>
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-yellow-700 mb-3">월간 지출 금액</h3>
          <p className="text-3xl font-bold text-yellow-900">945,000 원</p>
        </div>
        <div className="bg-red-50 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-red-700 mb-3">월간 식단 패턴</h3>
          <p className="text-lg text-red-900">주로 저녁 외식이 많았으며, 한식 비중 높음.</p>
        </div>
      </div>
      <div className="mt-8 bg-purple-50 p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold text-purple-700 mb-3">월간 영양소 섭취 추이 (예시)</h3>
        <p className="text-gray-700">여기에 월별 영양소 섭취 변화를 보여주는 선 그래프가 들어갑니다.</p>
      </div>
    </div>
  );
}
