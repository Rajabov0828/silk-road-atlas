import { defineConfig } from 'vitest/config';

// During local development, proxy /api to the local backend or deployed API.
const devApi = process.env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8000';

export default defineConfig({
  server: {
    proxy: {
      '/api': { target: devApi, changeOrigin: true, secure: false },
    },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
  },
});
