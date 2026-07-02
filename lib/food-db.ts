// 식약처 식품영양성분DB 조회 — AI 추정치 대신 공공 DB 수치를 우선 사용
//
// API: 공공데이터포털 "식품의약품안전처_식품영양성분DB정보"
//      https://www.data.go.kr/data/15127578/openapi.do
// 엔드포인트: apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02
// 환경변수: FOODSAFETY_API_KEY (data.go.kr 일반 인증키, Vercel + .env.local)
// 키가 없거나 조회에 실패하면 null을 반환해 기존 Gemini-only 흐름이 그대로 유지됨.
//
// 영양수치 기준량: Z10500(영양성분함량기준량, 예 "100g") 필드 기준.
// 필드가 없거나 파싱 불가하면 100g으로 간주.

export type FoodDbEntry = {
  name: string;        // DB 식품명
  basisGrams: number;  // 아래 수치의 기준 중량(g)
  calories: number;    // kcal (basisGrams 기준)
  nutrients: {
    carbohydrates: number | null;
    protein: number | null;
    fat: number | null;
    sugar: number | null;
    fiber: number | null;
    sodium: number | null;  // mg
  };
};

// 일일 호출 쿼터 절약용 인메모리 캐시 (serverless 인스턴스 수명 동안 유지)
const CACHE_TTL = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { entry: FoodDbEntry | null; expiresAt: number }>();

function toNum(v: unknown): number | null {
  const n = parseFloat(String(v ?? '').trim());
  return Number.isFinite(n) ? n : null;
}

export function normalizeFoodName(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

// 응답 items에서 검색어와 가장 잘 맞는 행 선택: 완전 일치 > 포함 관계 > 첫 번째
function pickBestRow(rows: any[], queryNorm: string): any {
  const named = rows.map(r => ({ row: r, norm: normalizeFoodName(String(r?.FOOD_NM_KR ?? '')) }));
  return (
    named.find(n => n.norm === queryNorm)?.row ??
    named.find(n => n.norm.includes(queryNorm) || queryNorm.includes(n.norm))?.row ??
    rows[0]
  );
}

export async function lookupKoreanFoodDB(foodName: string): Promise<FoodDbEntry | null> {
  const apiKey = process.env.FOODSAFETY_API_KEY?.trim();
  if (!apiKey || !foodName?.trim()) return null;

  const key = normalizeFoodName(foodName);
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.entry;

  let entry: FoodDbEntry | null = null;
  try {
    const url = `https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02`
      + `?serviceKey=${encodeURIComponent(apiKey)}&type=json&pageNo=1&numOfRows=5`
      + `&FOOD_NM_KR=${encodeURIComponent(foodName.trim())}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const rawItems = data?.body?.items;
      // items가 [{...}] 또는 [{ item: {...} }] 두 형태 모두 방어
      const rows: any[] = (Array.isArray(rawItems) ? rawItems : [])
        .map((it: any) => (it && typeof it === 'object' && 'item' in it ? it.item : it))
        .filter(Boolean);

      if (rows.length > 0) {
        const row = pickBestRow(rows, key);
        const calories = toNum(row.AMT_NUM1);
        if (calories != null && calories > 0) {
          // Z10500: 영양성분함량기준량 (예 "100g") — 숫자만 추출
          const basisMatch = String(row.Z10500 ?? '').match(/(\d+(?:\.\d+)?)/);
          const basisGrams = basisMatch ? parseFloat(basisMatch[1]) : 100;
          entry = {
            name: String(row.FOOD_NM_KR ?? foodName),
            basisGrams: basisGrams > 0 ? basisGrams : 100,
            calories,
            nutrients: {
              protein: toNum(row.AMT_NUM3),
              fat: toNum(row.AMT_NUM4),
              carbohydrates: toNum(row.AMT_NUM6),
              sugar: toNum(row.AMT_NUM7),
              fiber: toNum(row.AMT_NUM8),
              sodium: toNum(row.AMT_NUM13),
            },
          };
        }
      }
    }
  } catch { /* 조회 실패 → Gemini 수치 사용 */ }

  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { entry, expiresAt: Date.now() + CACHE_TTL });
  return entry;
}

// 여러 음식명 병렬 조회 (최대 5개) — 정규화된 이름을 키로 하는 Map 반환
export async function lookupKoreanFoodsDB(names: string[]): Promise<Map<string, FoodDbEntry>> {
  const targets = names.slice(0, 5);
  const results = await Promise.all(targets.map(n => lookupKoreanFoodDB(n)));
  const map = new Map<string, FoodDbEntry>();
  targets.forEach((n, i) => {
    const entry = results[i];
    if (entry) map.set(normalizeFoodName(n), entry);
  });
  return map;
}
