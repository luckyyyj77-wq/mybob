// 임시 디버그 엔드포인트 — Vercel 서버에서 식약처 API 연결 상태 확인용. 진단 후 삭제.
import { NextResponse } from 'next/server';
import { lookupKoreanFoodDB } from '@/lib/food-db';

export const maxDuration = 30;

const DEBUG_SECRET = 'mybob-fooddb-debug-20260704';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') !== DEBUG_SECRET) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const name = searchParams.get('name') || '김치찌개';
  const apiKey = process.env.FOODSAFETY_API_KEY?.trim();

  const report: Record<string, any> = {
    keyPresent: !!apiKey,
    keyLength: apiKey?.length ?? 0,
    region: process.env.VERCEL_REGION ?? null,
  };

  // 1) raw fetch — 상태/시간/응답 앞부분
  if (apiKey) {
    const url = `https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02`
      + `?serviceKey=${encodeURIComponent(apiKey)}&type=json&pageNo=1&numOfRows=3`
      + `&FOOD_NM_KR=${encodeURIComponent(name)}`;
    const t0 = Date.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const text = await res.text();
      report.raw = {
        status: res.status,
        ms: Date.now() - t0,
        bodyHead: text.slice(0, 300),
      };
    } catch (e: any) {
      report.raw = { error: e?.name + ': ' + e?.message, ms: Date.now() - t0 };
    }
  }

  // 2) 실제 lookup 함수 결과 (6초 타임아웃 포함)
  const t1 = Date.now();
  const entry = await lookupKoreanFoodDB(name);
  report.lookup = { ms: Date.now() - t1, entry };

  return NextResponse.json(report);
}
