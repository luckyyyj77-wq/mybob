// IndexedDB 래퍼 — 사진(base64) 로컬 저장용
// idb 패키지 없이 native API 사용

const DB_NAME = 'mybob_db';
const DB_VERSION = 1;
const STORE_PHOTOS = 'photos'; // key: mealId, value: base64 string

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        db.createObjectStore(STORE_PHOTOS); // keyPath 없이 key 직접 지정
      }
    };
    req.onsuccess = () => { dbInstance = req.result; resolve(req.result); };
    req.onerror = () => reject(req.error);
  });
}

export async function savePhoto(mealId: string, base64: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, 'readwrite');
    const req = tx.objectStore(STORE_PHOTOS).put(base64, mealId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getPhoto(mealId: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, 'readonly');
    const req = tx.objectStore(STORE_PHOTOS).get(mealId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePhoto(mealId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, 'readwrite');
    const req = tx.objectStore(STORE_PHOTOS).delete(mealId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllPhotoIds(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, 'readonly');
    const req = tx.objectStore(STORE_PHOTOS).getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllPhotos(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, 'readwrite');
    const req = tx.objectStore(STORE_PHOTOS).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// 클라우드→로컬 전환 시: 서버 URL 사진을 IndexedDB로 마이그레이션
export async function fetchAndSavePhoto(mealId: string, url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        await savePhoto(mealId, base64);
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
