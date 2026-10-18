import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy /api sang backend => frontend gọi cùng origin, không vướng CORS khi dev.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
