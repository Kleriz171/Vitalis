import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.vitalis.mobile',
  appName: 'Vitalis',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // For local dev against the API on your laptop, point to your LAN IP:
    // url: 'http://192.168.1.220:5174',
    // cleartext: true,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: '#060912' },
  },
};

export default config;
