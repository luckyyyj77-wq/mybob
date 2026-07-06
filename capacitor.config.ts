import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mybob.app',
  appName: '뭐먹었어',
  webDir: 'out',
  server: {
    url: 'https://www.mybob.kr',
    cleartext: false,
  },
  android: {
    // 웹 코드(lib/native-app.ts)에서 앱 웹뷰를 식별해 외부 결제 동선을 숨기기 위한 마커
    appendUserAgent: 'MybobApp',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
