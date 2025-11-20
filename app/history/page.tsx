type Meal = {
  id: string;
  food_name: string;
  calories: number;
  created_at: string;
  photo_url?: string; // Added photo_url
};

export default function HistoryPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMeals = async () => {
      try {
        const response = await fetch('/api/meals');
        if (!response.ok) {
          throw new Error('데이터를 불러오는데 실패했습니다.');
        }
        const data = await response.json();
        // Sort by created_at in descending order to show newest first
        const sortedMeals = data.data.sort((a: Meal, b: Meal) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setMeals(sortedMeals);
      } catch (err) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError('알 수 없는 오류가 발생했습니다.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMeals();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 to-cyan-100 p-4 sm:p-6 md:p-8">
      <header className="w-full max-w-4xl text-center py-6 mx-auto">
        <h1 className="text-5xl font-extrabold text-green-800 mb-2">사진 히스토리</h1>
        <p className="text-xl text-green-600">나의 식단 기록 타임라인</p>
      </header>
      
      <main className="w-full max-w-4xl mx-auto mt-8">
        {loading ? (
          <div className="flex justify-center items-center text-xl text-green-700">
            <FaSpinner className="animate-spin mr-3" />
            <span>기록을 불러오는 중...</span>
          </div>
        ) : error ? (
          <p className="text-center text-red-500 text-xl">{error}</p>
        ) : (
          <div className="relative border-l-4 border-green-300 ml-4 md:ml-0"> {/* Adjusted margin for mobile */}
            {meals.length > 0 ? (
              meals.map((meal, index) => (
                <div key={meal.id} className="mb-8 flex justify-start items-center w-full">
                  <div className="z-20 flex items-center order-1 bg-green-500 shadow-xl w-12 h-12 rounded-full absolute -left-6 md:-left-6">
                    <h1 className="mx-auto font-semibold text-lg text-white">{index + 1}</h1>
                  </div>
                  <div className="order-1 bg-white rounded-lg shadow-xl w-11/12 ml-6 md:ml-12 px-6 py-4"> {/* Adjusted margin */}
                    <div className="flex items-center text-sm text-gray-500 mb-2">
                      <FaCalendarAlt className="mr-2" />
                      <span>{new Date(meal.created_at).toLocaleString('ko-KR')}</span>
                    </div>
                    {meal.photo_url && (
                      <div className="mb-3">
                        <img src={meal.photo_url} alt={meal.food_name} className="w-full h-48 object-cover rounded-md shadow-sm" />
                      </div>
                    )}
                    <h3 className="mb-3 font-bold text-gray-800 text-xl">{meal.food_name}</h3>
                    <p className="text-md leading-snug tracking-wide text-gray-900 text-opacity-100">
                      <FaUtensils className="inline mr-2" />{meal.calories} kcal
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-600 text-xl">아직 저장된 식단 기록이 없습니다.</p>
            )}
          </div>
        )}
      </main>

      <div className="text-center mt-12">
        <Link href="/" className="text-green-600 hover:underline">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}