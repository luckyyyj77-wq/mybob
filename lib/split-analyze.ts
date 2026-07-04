// split-analyze.ts — 이미지를 4분할해서 각 영역을 분석 후 결과 합산
// 전체 이미지 인식 실패 시 폴백으로 사용

import { getFrequentFoodNames } from './frequent-foods';

export type FoodItem = {
  name: string;
  calories: number;
  category?: string;
  amount?: string;
  confidence?: string;
  nutrients: Record<string, number | null>;
};

type QuadrantResult = { success: boolean; items?: FoodItem[] };

// 이미지를 4등분해서 각각의 base64 반환
function splitImageToQuadrants(dataUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const hw = Math.floor(img.width / 2);
      const hh = Math.floor(img.height / 2);
      const quads: string[] = [];

      const coords = [
        { sx: 0,  sy: 0  },
        { sx: hw, sy: 0  },
        { sx: 0,  sy: hh },
        { sx: hw, sy: hh },
      ];

      for (const { sx, sy } of coords) {
        const canvas = document.createElement('canvas');
        canvas.width = hw;
        canvas.height = hh;
        canvas.getContext('2d')!.drawImage(img, sx, sy, hw, hh, 0, 0, hw, hh);
        quads.push(canvas.toDataURL('image/jpeg', 0.85));
      }
      resolve(quads);
    };
    img.src = dataUrl;
  });
}

// 단일 이미지로 API 호출
async function analyzeOne(
  imageBase64: string,
  token: string,
  locale: string,
): Promise<QuadrantResult> {
  try {
    const res = await fetch('/api/analyze-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ image: imageBase64, mode: 'food', locale, frequentFoods: getFrequentFoodNames() }),
    });
    if (!res.ok) return { success: false };
    const data = await res.json();
    if (!data.success || !data.food) return { success: false };
    // food는 단일 합산 객체 — items 배열로 래핑
    return { success: true, items: [data.food] };
  } catch {
    return { success: false };
  }
}

// 전체 이미지 분석 실패 시: 4분할 병렬 분석 → 결과 합산
export async function analyzeWithSplit(
  originalDataUrl: string,
  token: string,
  locale: string,
): Promise<{ success: boolean; food?: FoodItem }> {
  const quads = await splitImageToQuadrants(originalDataUrl);

  const results = await Promise.all(
    quads.map(q => analyzeOne(q, token, locale))
  );

  const successResults = results
    .filter(r => r.success && r.items && r.items.length > 0)
    .flatMap(r => r.items!);

  if (successResults.length === 0) return { success: false };

  // NOT_FOOD 제외 (calories === 0 이고 name이 비어있거나 unknown인 경우)
  const validItems = successResults.filter(
    it => it.calories > 0 && it.name && !['unknown', ''].includes(it.name.toLowerCase())
  );
  if (validItems.length === 0) return { success: false };

  // 중복 제거: 같은 이름이 여러 분할에서 나온 경우 최대 칼로리 하나만 유지
  const seen = new Map<string, FoodItem>();
  for (const item of validItems) {
    const key = item.name.toLowerCase().trim();
    if (!seen.has(key) || (seen.get(key)!.calories < item.calories)) {
      seen.set(key, item);
    }
  }
  const deduped = Array.from(seen.values());

  // 합산
  const mergedNutrients: Record<string, number> = {};
  for (const item of deduped) {
    for (const [k, v] of Object.entries(item.nutrients ?? {})) {
      if (v == null) continue;
      mergedNutrients[k] = (mergedNutrients[k] ?? 0) + (v as number);
    }
  }

  const combined: FoodItem = {
    name: deduped.map(i => i.name).join(' + '),
    calories: deduped.reduce((s, i) => s + i.calories, 0),
    category: deduped[0]?.category ?? '기타',
    amount: deduped.map(i => i.amount).filter(Boolean).join(', '),
    confidence: 'medium',
    nutrients: mergedNutrients,
  };

  return { success: true, food: combined };
}
