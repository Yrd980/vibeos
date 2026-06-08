import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deepseek/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            const apiKey = process.env.VITE_DEEPSEEK_API_KEY ?? process.env.DEEPSEEK_API_KEY;
            if (apiKey) proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
          });
        },
      },
    },
  },
});
