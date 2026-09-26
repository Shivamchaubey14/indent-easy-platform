/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must use require */

// Reanimated runs animations on a native UI thread; under Jest both it and its worklets runtime
// are replaced by their official mocks.
jest.mock(
  'react-native-worklets',
  () => require('react-native-worklets/lib/module/mock') as unknown,
);
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock') as unknown);

jest.mock(
  '@react-native-community/netinfo',
  () => require('@react-native-community/netinfo/jest/netinfo-mock.js') as unknown,
);
jest.mock(
  'react-native-safe-area-context',
  () => (require('react-native-safe-area-context/jest/mock') as { default: unknown }).default,
);

// The key-value store is native SQLite; tests keep preferences in memory.
jest.mock('expo-sqlite/kv-store', () => {
  const values = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItemSync: (key: string) => values.get(key) ?? null,
      setItemSync: (key: string, value: string) => values.set(key, value),
      removeItemSync: (key: string) => values.delete(key),
    },
  };
});
