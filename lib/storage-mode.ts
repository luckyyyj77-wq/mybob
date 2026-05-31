// 저장 방식 관련 유틸리티 — 앱 전체에서 이 파일만 참조

export type StorageMode = 'local' | 'cloud';

const KEY = 'mybob_storage_mode';

export function getStorageMode(): StorageMode {
  if (typeof window === 'undefined') return 'local';
  const val = localStorage.getItem(KEY);
  return val === 'cloud' ? 'cloud' : 'local';
}

export function setStorageMode(mode: StorageMode) {
  localStorage.setItem(KEY, mode);
}

export function isOnboardingDone(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('mybob_onboarding_done') === '1';
}

export function markOnboardingDone() {
  localStorage.setItem('mybob_onboarding_done', '1');
}
