import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // Serve static assets (Base.svg, Polygon.png, USDC.svg) from SDK's public folder
  publicDir: path.resolve(__dirname, '../public'),
  resolve: {
    alias: {
      // Import SDK directly from source for hot-reload during dev
      'surf-widget-sdk': path.resolve(__dirname, '../src/index.ts'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
