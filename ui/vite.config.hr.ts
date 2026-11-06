import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  define: {
    'import.meta.env.VITE_SYSTEM_SOURCE': JSON.stringify('hr'),
    'import.meta.env.VITE_SYSTEM_NAME': JSON.stringify('HR Platform'),
    'import.meta.env.VITE_SYSTEM_COLOR': JSON.stringify('#5b2c6f'),
  },
  server: {
    port: 5174,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
