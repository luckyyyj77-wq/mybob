/**
 * 자주 먹는 음식 추출 — AI 분석 힌트용
 *
 * localStorage 식단 기록에서 반복 품목 상위 N개를 뽑아 analyze-food 요청에
 * 함께 보낸다. 1단계(이름 확정) 프롬프트에 힌트로 주입되어 반복 품목의
 * 이름이 일관되게 나오고, 식약처 DB 매칭률도 올라간다.
 */

const CACHE_KEY = 'mybob_meals';

export function getFrequentFoodNames(limit = 20): string[] {
  try {
    const meals: { food_name?: string }[] = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    const counts = new Map<string, number>();
    for (const m of meals) {
      if (!m.food_name) continue;
      // 복수 품목 식단은 ' + '로 합쳐 저장되므로 개별 품목으로 분리
      for (const raw of String(m.food_name).split(' + ')) {
        const name = raw.trim();
        if (!name || name.length > 40) continue;
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count >= 2) // 2회 이상 먹은 품목만 힌트로
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name]) => name);
  } catch {
    return [];
  }
}
