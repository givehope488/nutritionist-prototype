import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiError, MenuResponse } from '@canteen/shared';
import { createApp } from '../src/app';
import { getAllDishes } from '../src/data/dishes';

let server: Server | undefined;
let baseUrl = '';

beforeAll(async () => {
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
      'price_yuan',
      'tags',
      'drink',
      'reliability',
      'status',
    ].sort();

    for (const dish of getAllDishes()) {
      expect(Object.keys(dish).sort()).toEqual(expectedFields);
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
