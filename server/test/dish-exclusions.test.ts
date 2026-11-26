import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  DishExclusion,
  DishExclusionListResponse,
  MenuResponse,
  RecommendationResponse,
} from '@canteen/shared';
import { createApp } from '../src/app';
import { resetDatabase } from '../src/data/db';
import { seedDishes } from '../src/data/seed';

/**
 * 个人排除（API.md v1.2.12 §2.6）。
 *
 * 三条底线：
 * 1. 排除只影响该 session 的后续推荐，不碰菜品状态、不碰其他用户；
 * 2. 幂等：同一道菜重复排除不重复写，返回 200；
 * 3. 删除档案时连带清理排除记录（与 meal_logs 一致）。
 */
let server: Server | undefined;
let baseUrl = '';

beforeAll(async () => {
  seedDishes();
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server?.once('listening', () => resolve()));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('无法获取测试端口');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      if (!server) {
        resolve();
        return;
      }
      server.close((err) => (err ? reject(err) : resolve()));
    }),
);

beforeEach(() => resetDatabase());

const profile = (session_id: string) => ({
  session_id,
  sex: 'male',
  height_cm: 172,
  weight_kg: 65,
  age: 20,
  activity: 'mid',
  goal: 'health',
  avoid: [],
  default_meal: 'lunch',
});

async function post(path: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as unknown };
}

async function get(path: string): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${baseUrl}${path}`);
  return { status: res.status, json: (await res.json()) as unknown };
}

async function del(path: string): Promise<number> {
  const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE' });
  return res.status;
}

async function seedProfile(sessionId: string): Promise<void> {
  const res = await post('/api/v1/profiles', profile(sessionId));
  expect(res.status).toBe(200);
}

async function recommend(sessionId: string): Promise<RecommendationResponse> {
  const res = await post('/api/v1/recommendations', { session_id: sessionId, meal: 'lunch' });
  expect(res.status).toBe(200);
  return res.json as RecommendationResponse;
}

async function lunchDishes(): Promise<MenuResponse['dishes']> {
  const res = await get('/api/v1/menu?meal=lunch');
  expect(res.status).toBe(200);
  return (res.json as MenuResponse).dishes;
}

describe('POST /api/v1/dish-exclusions', () => {
  it('新排除返回 201；重复排除返回 200 且列表不重复', async () => {
    const dish = (await lunchDishes())[0];
    const first = await post('/api/v1/dish-exclusions', {
      session_id: 'sess-a',
      dish_id: dish.id,
    });
    expect(first.status).toBe(201);
    expect(first.json).toEqual({ dish_id: dish.id, name: dish.name });

    const again = await post('/api/v1/dish-exclusions', {
      session_id: 'sess-a',
      dish_id: dish.id,
    });
    expect(again.status).toBe(200);

    const list = await get('/api/v1/dish-exclusions?session_id=sess-a');
    expect(list.status).toBe(200);
    expect((list.json as DishExclusionListResponse).dishes).toEqual([
      { dish_id: dish.id, name: dish.name } satisfies DishExclusion,
    ]);
  });

  it('未知菜品按 400 拒绝，并带 dish_id 定位', async () => {
    const res = await post('/api/v1/dish-exclusions', {
      session_id: 'sess-a',
      dish_id: 'no-such-dish',
    });
    expect(res.status).toBe(400);
    const body = res.json as { error: { code: string; fields: { path: string }[] } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.fields[0]?.path).toBe('dish_id');
  });
});

describe('排除对推荐的影响', () => {
  it('排除后该菜不再出现在组合里；其他 session 不受影响；恢复后回到原结果', async () => {
    await seedProfile('sess-a');
    await seedProfile('sess-b');

    const before = await recommend('sess-a');
    const target = before.combos[0]?.dishes[0];
    expect(target).toBeDefined();
    if (!target) return;

    await post('/api/v1/dish-exclusions', { session_id: 'sess-a', dish_id: target.id });

    const after = await recommend('sess-a');
    const leaked = after.combos.flatMap((combo) =>
      combo.dishes.filter((dish) => dish.id === target.id),
    );
    expect(leaked).toEqual([]);

    // 只影响自己：sess-b 的推荐仍可包含这道菜
    const other = await recommend('sess-b');
    expect(other.combos.some((combo) => combo.dishes.some((dish) => dish.id === target.id))).toBe(
      true,
    );

    // 恢复后第一套（贴合度最优兜底，确定性选择）与排除前一致；
    // 第 2/3 套按设计随机抽取，不做逐 id 断言。
    expect(await del(`/api/v1/dish-exclusions/${target.id}?session_id=sess-a`)).toBe(204);
    const restored = await recommend('sess-a');
    expect(restored.combos[0]?.id).toBe(before.combos[0]?.id);
  });

  it('重复删除同一道菜返回 404', async () => {
    const dish = (await lunchDishes())[0];
    await post('/api/v1/dish-exclusions', { session_id: 'sess-a', dish_id: dish.id });
    expect(await del(`/api/v1/dish-exclusions/${dish.id}?session_id=sess-a`)).toBe(204);
    expect(await del(`/api/v1/dish-exclusions/${dish.id}?session_id=sess-a`)).toBe(404);
  });
});

describe('合规删除连带清理', () => {
  it('删除档案后，该 session 的排除记录一并清空', async () => {
    await seedProfile('sess-a');
    const dish = (await lunchDishes())[0];
    await post('/api/v1/dish-exclusions', { session_id: 'sess-a', dish_id: dish.id });

    expect(await del('/api/v1/profiles/me?session_id=sess-a')).toBe(204);
    const list = await get('/api/v1/dish-exclusions?session_id=sess-a');
    expect((list.json as DishExclusionListResponse).dishes).toEqual([]);
  });
});