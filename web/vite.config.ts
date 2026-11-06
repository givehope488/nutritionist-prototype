/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const shared = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': shared('./src'),
      '@canteen/shared': shared('../shared/src/index.ts'),
      '@menu-seed': shared('../server/data/menu-seed.json'),
    },
  },
  // shared/ 位于 web/ 之外（仓库根），dev server 需显式放行
  server: {
    port: 5173,
    fs: { allow: ['..'] },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
