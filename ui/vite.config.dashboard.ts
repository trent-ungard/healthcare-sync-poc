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
    'import.meta.env.VITE_SYSTEM_SOURCE': JSON.stringify('dashboard'),
    'import.meta.env.VITE_SYSTEM_NAME': JSON.stringify('Operations Dashboard'),
    'import.meta.env.VITE_SYSTEM_COLOR': JSON.stringify('#1a1a2e'),
    'import.meta.env.VITE_DASHBOARD_MODE': JSON.stringify('true'),
  },
  server: {
    port: 5175,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
