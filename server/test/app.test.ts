import type { Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiError, MenuResponse } from '@canteen/shared';
import { createApp } from '../src/app';
import { getAllDishes } from '../src/data/dishes';
import { seedDishes } from '../src/data/seed';

let server: Server | undefined;
let baseUrl = '';

beforeAll(async () => {
  // 数据源已从 JSON 改为 SQLite：测试进程用内存库，先灌种子
  seedDishes();
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server?.once('listening', () => resolve()));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('无法获取测试端口');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      const running = server;
      if (!running) {
        resolve();
        return;
      }
      running.close((err) => (err ? reject(err) : resolve()));
    }),
);

describe('基础设施', () => {
  it('GET /healthz 返回运行状态', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });
});

describe('GET /api/v1/menu', () => {
  it('按餐段返回菜品与忌口选项，且成功响应不裹 data 包装层', async () => {
    const res = await fetch(`${baseUrl}/api/v1/menu?meal=lunch`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as MenuResponse;
    expect(body).not.toHaveProperty('data');
    expect(Array.isArray(body.dishes)).toBe(true);
    expect(body.dishes.length).toBeGreaterThan(0);
    expect(Array.isArray(body.avoid_options)).toBe(true);
    expect(body.avoid_options.length).toBeGreaterThan(0);

    for (const dish of body.dishes) {
      expect(dish.meals).toContain('lunch');
      expect(dish.status).toBe('active');
      expect(typeof dish.kcal).toBe('number');
      expect(['A', 'B', 'C']).toContain(dish.reliability);
    }
  });

  it('响应字段严格等于契约字段，不夹带种子元数据', () => {
    const expectedFields = [
      'id',
      'name',
      'category',
      'portion_label',
      'meals',
      'kcal',
      'protein_g',
      'fat_g',
      'carbs_g',
      'sodium_mg',
      'tags',
      'drink',
      'reliability',
      'status',
    ].sort();

    for (const dish of getAllDishes()) {
      expect(Object.keys(dish).sort()).toEqual(expectedFields);
    }
  });

  it('种子内部治理字段不外泄（portion_grams / ingredients / source）', async () => {
    // 种子已按 v2 提供克重与配料依据，用于数据治理；这些字段不属于 API.md §2.1 的 Dish，
    // 因此在数据边界被投影掉。此断言防止将来"顺手把 portion_grams 加进 DTO"。
    const seed = JSON.parse(
      await readFile(new URL('../data/menu-seed.json', import.meta.url), 'utf8'),
    ) as { dishes: Array<Record<string, unknown>> };

    const withGrams = seed.dishes.filter((d) => typeof d.portion_grams === 'number');
    expect(withGrams.length).toBeGreaterThan(0);
    expect(seed.dishes.every((d) => Array.isArray(d.ingredients))).toBe(true);

    const res = await fetch(`${baseUrl}/api/v1/menu?meal=lunch`);
    const body = (await res.json()) as { dishes: Array<Record<string, unknown>> };
    for (const dish of body.dishes) {
      expect(dish).not.toHaveProperty('portion_grams');
      expect(dish).not.toHaveProperty('ingredients');
      expect(dish).not.toHaveProperty('source');
    }

    // README 合规条目 4：B 级以下不在前端展示精确克重 —— 展示用语不得含克重数字
    for (const dish of body.dishes) {
      expect(String(dish.portion_label)).not.toMatch(/\d+(\.\d+)?\s*(g|kg|ml|克|毫升)/i);
    }
  });

  it('非法 meal 返回 400 与统一 error 包络（API.md §1）', async () => {
    const res = await fetch(`${baseUrl}/api/v1/menu?meal=brunch`);
    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: ApiError };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBeTruthy();
    expect(body.error.fields?.[0]?.path).toBe('meal');
  });
});

describe('未知路径', () => {
  it('返回 404 与 NOT_FOUND 错误码', async () => {
    const res = await fetch(`${baseUrl}/api/v1/does-not-exist`);
    expect(res.status).toBe(404);

    const body = (await res.json()) as { error: ApiError };
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
