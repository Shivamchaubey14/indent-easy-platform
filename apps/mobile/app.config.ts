import type { ExpoConfig } from 'expo/config';

// Runs in Expo Go today. Development builds (SRS §18.1) take over once a native module outside
// Expo Go is needed (MMKV, SQLCipher, Sentry); the identifiers below are already final.
const config: ExpoConfig = {
  name: 'Indent Easy',
  slug: 'indent-easy',
  scheme: 'indenteasy',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  android: { package: 'in.shwetdhara.indenteasy' },
  ios: { bundleIdentifier: 'in.shwetdhara.indenteasy' },
  plugins: ['expo-router', 'expo-font', 'expo-sqlite', 'expo-localization'],
};

export default config;
