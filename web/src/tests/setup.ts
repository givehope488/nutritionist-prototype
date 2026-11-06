import { beforeEach } from 'vitest';
import { resetMockDb } from '@/api/__mock__/db';

// Mock 后端在测试里零延迟，避免断言依赖 setTimeout
import.meta.env.VITE_MOCK_NETWORK = 'test';

// 每个用例从干净状态开始：Mock 后端把档案/记录存在 localStorage，草稿在 sessionStorage
beforeEach(() => {
  resetMockDb();
  localStorage.clear();
  sessionStorage.clear();
});
