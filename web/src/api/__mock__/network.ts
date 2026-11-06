// Mock 网络环境模拟：让「弱网 / 超时 / 重复提交」这些 W5 边界在本地可复现。
// 取值来自 VITE_MOCK_NETWORK（off | slow | flaky | test），不影响真实后端。
// test 为 0 延迟，供单测/e2e 确定性断言；loading 态由 src/tests/unit/asyncStates.test.ts 单独覆盖。
const MODE = import.meta.env.VITE_MOCK_NETWORK ?? 'off';

const LATENCY: Record<string, number> = { off: 120, slow: 1200, flaky: 300, test: 0 };

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function simulateNetwork(): Promise<void> {
  await delay(LATENCY[MODE] ?? LATENCY.off);
  if (MODE === 'flaky' && Math.random() < 0.25) {
    // 模拟网关 500：非契约形态响应，验证 client 的收敛逻辑
    throw new Error('mock gateway error');
  }
}

export const mockNetworkMode = MODE;
