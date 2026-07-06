// 캐패시터 네이티브 앱(안드로이드 웹뷰) 감지
// Google Play 결제 정책상 앱 내에서 외부 결제(Lemon Squeezy) 동선을 노출하면 안 되므로,
// 결제 UI를 숨길 때 이 함수로 분기한다. 웹/PWA에서는 항상 false.
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  // capacitor.config.ts의 android.appendUserAgent와 동일한 마커
  return navigator.userAgent.includes('MybobApp');
}
