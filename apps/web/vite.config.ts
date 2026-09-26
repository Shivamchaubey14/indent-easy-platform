import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// In development the API runs on :4000; the browser talks to Vite, which forwards API paths so the
// app always uses same-origin URLs (as it will behind NGINX in DEV/QA/PROD).
const api = process.env['API_ORIGIN'] ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/routes',
      generatedRouteTree: './src/generated/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/graphql': api,
      '/api': api,
      '/health': api,
    },
  },
  build: {
    sourcemap: true,
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Form tests type character by character; on a busy machine they need more than 5 s.
    testTimeout: 15_000,
  },
});
