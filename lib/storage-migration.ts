// 스토리지 모드 전환 엔진 — 로컬↔클라우드 데이터 이동

import { savePhoto, getPhoto, fetchAndSavePhoto } from './indexed-db';
import { setStorageMode } from './storage-mode';

export type MigrationProgress = {
  phase: 'idle' | 'checking' | 'uploading' | 'downloading' | 'done' | 'error';
  current: number;
  total: number;
  message: string;
};

type LocalMeal = {
  id: string;
  food_name: string;
  calories: number;
  category?: string;
  nutrient?: any;
  photo_url?: string;
  created_at: string;
};

// Wi-Fi 연결 감지 (Network Information API)
export function isOnWifi(): boolean {
  if (typeof navigator === 'undefined') return true;
  const conn = (navigator as any).connection;
  if (!conn) return true; // API 미지원 → 알 수 없음이므로 경고만
  return conn.type === 'wifi' || conn.effectiveType === '4g';
}

export function getNetworkType(): string {
  const conn = (navigator as any).connection;
  if (!conn) return 'unknown';
  return conn.type || conn.effectiveType || 'unknown';
}

// 배치 딜레이 — 서버 부담 분산
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── LOCAL → CLOUD ──────────────────────────────────────────────
// localStorage 메타 + IndexedDB 사진을 서버로 업로드
export async function migrateLocalToCloud(
  token: string,
  onProgress: (p: MigrationProgress) => void
): Promise<void> {
  const meals: LocalMeal[] = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
  const localMeals = meals.filter(m => m.photo_url?.startsWith('local:') || !m.photo_url?.startsWith('http'));

  if (localMeals.length === 0) {
    // 이미 클라우드 데이터만 있음 — 모드만 전환
    setStorageMode('cloud');
    onProgress({ phase: 'done', current: 0, total: 0, message: '전환 완료' });
    return;
  }

  onProgress({ phase: 'uploading', current: 0, total: localMeals.length, message: '서버에 업로드 중...' });

  let succeeded = 0;
  const BATCH = 3; // 한 번에 3개씩

  for (let i = 0; i < localMeals.length; i += BATCH) {
    const batch = localMeals.slice(i, i + BATCH);

    await Promise.all(batch.map(async (meal) => {
      try {
        // 사진 base64 가져오기 (local: 마커면 IndexedDB, 아니면 그대로)
        let imageBase64: string | null = null;
        if (meal.photo_url?.startsWith('local:')) {
          imageBase64 = await getPhoto(meal.photo_url.slice(6));
        } else if (meal.photo_url?.startsWith('data:')) {
          imageBase64 = meal.photo_url;
        }

        const mealData = {
          name: meal.food_name,
          calories: meal.calories,
          category: meal.category,
          nutrients: meal.nutrient,
        };

        const res = await fetch('/api/meals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mealData, imageBase64 }),
        });

        if (res.ok) {
          const result = await res.json();
          // localStorage의 photo_url을 서버 URL로 업데이트
          if (result.success && result.data?.[0]?.photo_url) {
            meal.photo_url = result.data[0].photo_url;
            meal.id = result.data[0].id || meal.id;
          }
          succeeded++;
        }
      } catch { /* 개별 실패는 무시하고 계속 */ }
    }));

    onProgress({
      phase: 'uploading',
      current: Math.min(i + BATCH, localMeals.length),
      total: localMeals.length,
      message: `${Math.min(i + BATCH, localMeals.length)} / ${localMeals.length} 업로드 중...`,
    });

    // 배치 간 0.5초 대기 (서버 부담 분산)
    if (i + BATCH < localMeals.length) await delay(500);
  }

  // localStorage 업데이트 (photo_url이 서버 URL로 교체됨)
  localStorage.setItem('mybob_meals', JSON.stringify(meals));

  setStorageMode('cloud');
  onProgress({
    phase: 'done',
    current: succeeded,
    total: localMeals.length,
    message: `${succeeded}개 업로드 완료`,
  });
}

// ── CLOUD → LOCAL ──────────────────────────────────────────────
// 서버 데이터를 IndexedDB + localStorage로 다운로드
export async function migrateCloudToLocal(
  token: string,
  onProgress: (p: MigrationProgress) => void
): Promise<void> {
  onProgress({ phase: 'downloading', current: 0, total: 0, message: '서버에서 데이터 가져오는 중...' });

  // 서버 메타 데이터 조회
  const res = await fetch('/api/meals', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('서버 데이터 조회 실패');

  const result = await res.json();
  if (!result.success || !Array.isArray(result.data)) throw new Error('데이터 형식 오류');

  const serverMeals: LocalMeal[] = result.data;
  const photosToDownload = serverMeals.filter(m => m.photo_url?.startsWith('http'));

  onProgress({
    phase: 'downloading',
    current: 0,
    total: photosToDownload.length,
    message: `사진 ${photosToDownload.length}개 다운로드 중...`,
  });

  const BATCH = 3;
  for (let i = 0; i < photosToDownload.length; i += BATCH) {
    const batch = photosToDownload.slice(i, i + BATCH);

    await Promise.all(batch.map(async (meal) => {
      try {
        const base64 = await fetchAndSavePhoto(meal.id, meal.photo_url!);
        if (base64) {
          meal.photo_url = `local:${meal.id}`; // 마커로 교체
        }
      } catch { /* 사진 다운로드 실패해도 메타는 저장 */ }
    }));

    onProgress({
      phase: 'downloading',
      current: Math.min(i + BATCH, photosToDownload.length),
      total: photosToDownload.length,
      message: `${Math.min(i + BATCH, photosToDownload.length)} / ${photosToDownload.length} 다운로드 중...`,
    });

    if (i + BATCH < photosToDownload.length) await delay(500);
  }

  // localStorage 저장
  localStorage.setItem('mybob_meals', JSON.stringify(serverMeals));

  // 15일 삭제 예약 기록
  const deleteAt = new Date();
  deleteAt.setDate(deleteAt.getDate() + 15);
  localStorage.setItem('mybob_cloud_delete_scheduled', deleteAt.toISOString());

  setStorageMode('local');
  onProgress({
    phase: 'done',
    current: photosToDownload.length,
    total: photosToDownload.length,
    message: '다운로드 완료. 서버 데이터는 15일 후 삭제됩니다.',
  });
}

// 15일 삭제 예약 정보 조회
export function getCloudDeleteSchedule(): { scheduledAt: Date; daysLeft: number } | null {
  const raw = localStorage.getItem('mybob_cloud_delete_scheduled');
  if (!raw) return null;
  const scheduledAt = new Date(raw);
  const now = new Date();
  const daysLeft = Math.ceil((scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 0) return null; // 기간 만료
  return { scheduledAt, daysLeft };
}

// 삭제 예약 취소 (클라우드 복귀 시)
export function cancelCloudDeleteSchedule() {
  localStorage.removeItem('mybob_cloud_delete_scheduled');
}

// 서버 데이터 즉시 삭제 요청
export async function requestServerDataDeletion(token: string): Promise<void> {
  const res = await fetch('/api/meals/delete-all', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('서버 삭제 요청 실패');
  localStorage.removeItem('mybob_cloud_delete_scheduled');
}
