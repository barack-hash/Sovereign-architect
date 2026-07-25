import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    // The graph canvas and charting libraries are the bulk of this; splitting
    // them out keeps the app shell small on first paint.
    rollupOptions: {
      output: {
        manualChunks: {
          flow: ['@xyflow/react'],
          charts: ['recharts'],
          motion: ['motion'],
        },
      },
    },
  },
});
