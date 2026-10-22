import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Proxy /api cùng origin cho local và Docker; có thể đổi đích qua API_PROXY_TARGET.
      proxy: { '/api': env.API_PROXY_TARGET ?? 'http://localhost:3000' },
    },
  };
});
