import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pokeriq.app',
  appName: 'PokerIQ',
  webDir: 'dist',
  server: {
    // 开发时使用本地服务器（取消注释下行）
    // url: 'http://localhost:3000',
    // 生产环境：Capacitor 将加载 webDir 中的静态文件
    // API 请求通过下方 server.url 转发到 Vercel
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: '#0a0f12',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0f12',
    },
  },
};

export default config;
