export default function WeeklyReportPage() {
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">주간 리포트 (이번 주)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-blue-700 mb-3">총 주간 칼로리</h3>
          <p className="text-3xl font-bold text-blue-900">14,700 kcal</p>
        </div>
        <div className="bg-green-50 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-green-700 mb-3">주간 외식 비율</h3>
          <p className="text-3xl font-bold text-green-900">40%</p>
        </div>
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-yellow-700 mb-3">주간 지출 금액</h3>
          <p className="text-3xl font-bold text-yellow-900">210,000 원</p>
        </div>
        <div className="bg-red-50 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-red-700 mb-3">자주 먹는 음식 TOP 3</h3>
          <ul className="list-disc list-inside space-y-1">
            <li className="text-lg text-red-900">김치찌개</li>
            <li className="text-lg text-red-900">샌드위치</li>
            <li className="text-lg text-red-900">아메리카노</li>
          </ul>
        </div>
      </div>
      <div className="mt-8 bg-purple-50 p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold text-purple-700 mb-3">주간 영양소 밸런스 그래프 (예시)</h3>
        <p className="text-gray-700">여기에 주간 탄단지 비율을 보여주는 막대 그래프나 원형 그래프가 들어갑니다.</p>
      </div>
    </div>
  );
}
