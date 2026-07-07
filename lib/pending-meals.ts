// pending-meals.ts — 분석 실패한 식단을 IndexedDB에 임시 저장하고 백그라운드 재처리하는 큐
// openDB는 indexed-db.ts에서 가져와 동일한 DB 인스턴스 공유

import { openDB } from './indexed-db';

const STORE_PENDING = 'pending_meals';

export type PendingMeal = {
  id: string;            // timestamp string (pending 고유 키)
  imageBase64: string;   // 리사이즈된 이미지 (data URL)
  capturedAt: string;    // ISO datetime — 원본 촬영 시각
  retryCount: number;
  lastAttemptAt?: number; // 마지막 재시도 시각(epoch ms) — 시간 기반 백오프용
  locale: string;
  storageMode: 'local' | 'cloud';
  rating: number | null;
  portion: number;
  visibility: 'private' | 'neighbors' | 'public';
};

export async function enqueuePendingMeal(meal: PendingMeal): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite');
    tx.objectStore(STORE_PENDING).put(meal, meal.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllPendingMeals(): Promise<PendingMeal[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readonly');
    const req = tx.objectStore(STORE_PENDING).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePendingMeal(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite');
    tx.objectStore(STORE_PENDING).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updatePendingMealRetry(id: string, retryCount: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite');
    const store = tx.objectStore(STORE_PENDING);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const meal = getReq.result as PendingMeal | undefined;
      if (!meal) { resolve(); return; }
      meal.retryCount = retryCount;
      meal.lastAttemptAt = Date.now();
      store.put(meal, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readonly');
    const req = tx.objectStore(STORE_PENDING).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
