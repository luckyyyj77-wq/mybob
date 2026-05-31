"use client";

import { useState, useEffect } from 'react';
import { getPhoto } from './indexed-db';

// photo_url이 "local:{mealId}" 형식이면 IndexedDB에서 base64를 꺼냄
// 일반 URL이면 그대로 반환
export function usePhoto(photoUrl: string | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!photoUrl) { setSrc(null); return; }

    if (photoUrl.startsWith('local:')) {
      let cancelled = false;
      const mealId = photoUrl.slice(6);
      getPhoto(mealId)
        .then(base64 => { if (!cancelled) setSrc(base64); })
        .catch(() => { if (!cancelled) setSrc(null); });
      return () => { cancelled = true; };
    } else {
      setSrc(photoUrl);
    }
  }, [photoUrl]);

  return src;
}
