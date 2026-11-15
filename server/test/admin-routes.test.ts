import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ApiError, Dish, DishRevisionListResponse } from '@canteen/shared';
import { createApp } from '../src/app';
import { getDb, resetDatabase } from '../src/data/db';
import { seedDishes } from '../src/data/seed';

/**
 * 管理端 HTTP 路由测试（API.md §3）。
 *
 * 重点验两件事：
 * 1. **没令牌一个都进不来**（含「未配置 ADMIN_TOKEN 时必须 401」这条安全默认）
 * 2. 带令牌后 CRUD 行为与 CLI 一致（改营养必须带 reason、留痕、下架生效）
 */

const TOKEN = 'test-admin-token';
let server: Server | undefined;
let baseUrl = '';

beforeAll(async () => {
  process.env.ADMIN_TOKEN = TOKEN;
  seedDishes();
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server?.once('listening', () => resolve()));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('无法获取测试端口');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server?.close((error) => (error ? reject(error) : resolve()));
  });
  delete process.env.ADMIN_TOKEN;
});

beforeEach(() => {
  seedDishes();
  resetDatabase();
  getDb().exec('DELETE FROM dish_revisions');
});

async function call(
  method: string,
  path: string,
  options: { token?: string | null; body?: unknown } = {},
): Promise<{ status: number; json: unknown }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = options.token === undefined ? TOKEN : options.token;
  if (token !== null) headers['x-admin-token'] = token;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const text = await res.text();
  return { status: res.status, json: text === '' ? null : JSON.parse(text) };
}

describe('鉴权', () => {
  it('不带 X-Admin-Token → 401', async () => {
    const res = await call('GET', '/api/v1/admin/dishes', { token: null });
    expect(res.status).toBe(401);
    expect((res.json as { error: ApiError }).error.code).toBe('UNAUTHORIZED');
  });

  it('令牌错误 → 401', async () => {
    const res = await call('GET', '/api/v1/admin/dishes', { token: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('服务端未配置 ADMIN_TOKEN 时一律 401（安全默认）', async () => {
    delete process.env.ADMIN_TOKEN;
    const res = await call('GET', '/api/v1/admin/dishes', { token: '' });
    expect(res.status).toBe(401);
    process.env.ADMIN_TOKEN = TOKEN;
  });
});

describe('CRUD', () => {
  it('带令牌可以列出全部菜品（含下架）', async () => {
    const res = await call('GET', '/api/v1/admin/dishes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
    expect((res.json as Dish[]).length).toBeGreaterThan(0);
  });

  it('PUT 改营养必须带 reason，否则 400 且不落库', async () => {
    const before = (await call('GET', '/api/v1/admin/dishes')).json as Dish[];
    const dish = before.find((item) => item.id === 's01')!;

    const bad = await call('PUT', '/api/v1/admin/dishes/s01', { body: { kcal: 999 } });
    expect(bad.status).toBe(400);

    const ok = await call('PUT', '/api/v1/admin/dishes/s01', {
      body: { kcal: dish.kcal + 10, reason: '管理端测试' },
    });
    expect(ok.status).toBe(200);
    expect((ok.json as { dish: Dish }).dish.kcal).toBe(dish.kcal + 10);
  });

  it('上下架生效，且修订历史可查', async () => {
    const res = await call('POST', '/api/v1/admin/dishes/s01/status', { body: { status: 'hidden' } });
    expect(res.status).toBe(200);
    expect((res.json as { dish: Dish }).dish.status).toBe('hidden');

    const revisions = await call('GET', '/api/v1/admin/dishes/s01/revisions');
    expect(revisions.status).toBe(200);
    const list = (revisions.json as DishRevisionListResponse).revisions;
    expect(list[0]?.reason).toContain('状态变更');
  });

  it('新增菜品：id 重复 → 409，正常 → 201', async () => {
    const payload = {
      id: 'x-new-01',
      name: '测试菜',
      category: 'veg',
      portion_label: '1 份',
      meals: ['lunch'],
      kcal: 100,
      protein_g: 3,
      fat_g: 2,
      carbs_g: 15,
      sodium_mg: 200,
      reliability: 'B',
    };
    const created = await call('POST', '/api/v1/admin/dishes', { body: payload });
    expect(created.status).toBe(201);
    expect((created.json as Dish).id).toBe('x-new-01');

    const dup = await call('POST', '/api/v1/admin/dishes', { body: payload });
    expect(dup.status).toBe(409);
    expect((dup.json as { error: ApiError }).error.code).toBe('CONFLICT');
  });

  it('批量导入逐行返回成败', async () => {
    const res = await call('POST', '/api/v1/admin/dishes/bulk-import', {
      body: [
        { id: 's02', kcal: 300, reason: '批量' },
        { id: 'nope', kcal: 300, reason: '批量' },
      ],
    });
    expect(res.status).toBe(200);
    const result = res.json as { succeeded: number; failed: number };
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
  });
});
