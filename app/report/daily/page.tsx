export default function DailyReportPage() {
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">일간 리포트 (오늘)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-blue-700 mb-3">총 칼로리</h3>
          <p className="text-3xl font-bold text-blue-900">2,100 kcal</p>
        </div>
        <div className="bg-green-50 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-green-700 mb-3">평균 식사 칼로리</h3>
          <p className="text-3xl font-bold text-green-900">700 kcal</p>
        </div>
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-yellow-700 mb-3">지출 금액</h3>
          <p className="text-3xl font-bold text-yellow-900">35,000 원</p>
        </div>
        <div className="bg-red-50 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-red-700 mb-3">영양소 밸런스</h3>
          <p className="text-lg text-red-900">탄수화물: 50%, 단백질: 20%, 지방: 30%</p>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
            <div className="bg-red-500 h-2.5 rounded-full" style={{ width: '50%' }}></div>
          </div>
        </div>
      </div>
      <div className="mt-8 bg-purple-50 p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold text-purple-700 mb-3">오늘의 음식 TOP 3</h3>
        <ul className="list-disc list-inside space-y-2">
          <li className="text-lg text-purple-900">비빔밥 (800kcal)</li>
          <li className="text-lg text-purple-900">닭가슴살 샐러드 (400kcal)</li>
          <li className="text-lg text-purple-900">아메리카노 (10kcal)</li>
        </ul>
      </div>
    </div>
  );
}
