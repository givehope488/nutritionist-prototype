import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // 每个测试进程一份内存库：用例之间不共享状态，也不会写脏 server/data/runtime
    env: {
      DATABASE_URL: ':memory:',
    },
  },
});
