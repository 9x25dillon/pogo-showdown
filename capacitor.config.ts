import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pogoshowdown.app',
  appName: 'Eternity High',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0b0714',
  },
};

export default config;
