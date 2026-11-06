// client.ts 解包单测（PROGRESS §2.2 FE-A #1）：
// 业务代码只见 ApiResult<T> 两种形态，解包只在这一处验证（API.md §0.8 §1）。
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProfileInput } from '@canteen/shared';

async function loadClient(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import('@/api/client');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('client.ts 解包（API.md §0.8 §1）', () => {
  it('200 直返业务对象：不剥包装层', async () => {
    const { request } = await loadClient();
    const result = await request<{ dishes: unknown[]; avoid_options: unknown[] }>(
      'GET',
      '/menu?meal=lunch',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.isArray(result.data.dishes)).toBe(true);
    expect(result.data.dishes.length).toBeGreaterThan(0);
    expect(result.data).not.toHaveProperty('data');
    expect(result.data).not.toHaveProperty('ok');
  });

  it('400 转 ApiResult.error：保留 code 与 fields 定位', async () => {
    const { request } = await loadClient();
    const invalidProfile = {
      session_id: 'client-test',
      sex: 'male',
      height_cm: 130,
      weight_kg: 65,
      age: 20,
      activity: 'mid',
      goal: 'health',
      avoid: [],
      default_meal: 'lunch',
    } satisfies ProfileInput;
    const result = await request('POST', '/profiles', { body: invalidProfile });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(result.error.fields?.[0]?.path).toBe('height_cm');
    expect(result.error.fields?.[0]?.issue).toContain('140');
    expect(result).not.toHaveProperty('data');
  });

  it('非 JSON 的 2xx：按契约违约收敛为 INTERNAL，不当成功', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      })),
    );
    const { request } = await loadClient({ VITE_API_BASE: 'http://api.test' });
    const result = await request('GET', '/menu?meal=lunch');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INTERNAL');
    expect(result.error.message).toBe('响应格式不符合接口协定');
  });

  it('网络异常：fetch 拒绝时返回 INTERNAL + 可操作文案', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const { request } = await loadClient({ VITE_API_BASE: 'http://api.test' });
    const result = await request('GET', '/menu?meal=lunch');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INTERNAL');
    expect(result.error.message).toBe('网络连接失败，请检查网络后重试');
  });

  it('非 JSON 的 5xx：收敛为服务不可用，不是成功', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 502,
        json: async () => {
          throw new SyntaxError('Bad gateway');
        },
      })),
    );
    const { request } = await loadClient({ VITE_API_BASE: 'http://api.test' });
    const result = await request('GET', '/menu?meal=lunch');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INTERNAL');
    expect(result.error.message).toBe('服务暂时不可用，请稍后再试');
  });
});
