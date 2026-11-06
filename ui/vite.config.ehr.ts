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
    'import.meta.env.VITE_SYSTEM_SOURCE': JSON.stringify('ehr'),
    'import.meta.env.VITE_SYSTEM_NAME': JSON.stringify('Electronic Health Records (EHR)'),
    'import.meta.env.VITE_SYSTEM_COLOR': JSON.stringify('#1e3a5f'),
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
