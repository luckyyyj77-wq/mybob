// 식약처 식품영양성분DB(I2790) 조회 — AI 추정치 대신 공공 DB 수치를 우선 사용
//
// 인증키 발급: https://www.foodsafetykorea.go.kr/api/ 회원가입 → 마이페이지 → 인증키 발급
// 환경변수: FOODSAFETY_API_KEY (Vercel + .env.local)
// 키가 없거나 조회에 실패하면 null을 반환해 기존 Gemini-only 흐름이 그대로 유지됨.
//
// I2790 응답 필드 가정: NUTR_CONT1~9는 SERVING_WT(1회제공량 g) 기준 수치.
// SERVING_WT가 없으면 100g 기준으로 간주.

export type FoodDbEntry = {
  name: string;        // DB 식품명
  basisGrams: number;  // 아래 수치의 기준 중량(g)
  calories: number;    // kcal (basisGrams 기준)
  nutrients: {
    carbohydrates: number | null;
    protein: number | null;
    fat: number | null;
    sugar: number | null;
    sodium: number | null;        // mg
    saturated_fat: number | null;
    trans_fat: number | null;
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

export async function lookupKoreanFoodDB(foodName: string): Promise<FoodDbEntry | null> {
  const apiKey = process.env.FOODSAFETY_API_KEY?.trim();
  if (!apiKey || !foodName?.trim()) return null;

  const key = normalizeFoodName(foodName);
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.entry;

  let entry: FoodDbEntry | null = null;
  try {
    const url = `https://openapi.foodsafetykorea.go.kr/api/${apiKey}/I2790/json/1/5/DESC_KOR=${encodeURIComponent(foodName.trim())}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const rows = data?.I2790?.row;
      if (Array.isArray(rows) && rows.length > 0) {
        // 식품명 완전 일치 우선, 없으면 첫 번째 결과
        const row = rows.find((r: any) => normalizeFoodName(String(r?.DESC_KOR ?? '')) === key) ?? rows[0];
        const servingWt = toNum(row.SERVING_WT);
        const calories = toNum(row.NUTR_CONT1);
        if (calories != null && calories > 0) {
          entry = {
            name: String(row.DESC_KOR ?? foodName),
            basisGrams: servingWt && servingWt > 0 ? servingWt : 100,
            calories,
            nutrients: {
              carbohydrates: toNum(row.NUTR_CONT2),
              protein: toNum(row.NUTR_CONT3),
              fat: toNum(row.NUTR_CONT4),
              sugar: toNum(row.NUTR_CONT5),
              sodium: toNum(row.NUTR_CONT6),
              saturated_fat: toNum(row.NUTR_CONT8),
              trans_fat: toNum(row.NUTR_CONT9),
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
