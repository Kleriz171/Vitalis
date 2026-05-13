import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.vitalis.mobile',
  appName: 'Vitalis',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Point the native shell at the local Vite dev server for hot-reload.
    // For the iOS Simulator, localhost works because it shares the host's network.
    // For a physical device, swap to your laptop's LAN IP (e.g. http://192.168.0.111:5174).
    url: 'http://192.168.0.111:5174',
    cleartext: true,
    allowNavigation: ['*'],
  },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: '#f7f5f0' },
  },
};

export default config;
