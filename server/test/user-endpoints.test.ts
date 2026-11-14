import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  ApiError,
  InsightsSummaryResponse,
  MealLogListResponse,
  MealLogResponse,
  MenuResponse,
  Profile,
  RecommendationResponse,
} from '@canteen/shared';
import { createApp } from '../src/app';
import { resetDatabase } from '../src/data/db';
import { seedDishes } from '../src/data/seed';

/**
 * 相对今天往前推 n 天，返回 YYYY-MM-DD。
 *
 * 为什么不用固化日期（曾经写成 '2026-11-06'）：
 * insights 的窗口是「今天 − days」（routes/insights.ts 用 `toISOString().slice(0,10)` 算），
 * 固化日期会随时间推移滑出窗口——2026-11-13 时 sinceDate 恰好是 11-06、测试还绿，
 * 11-14 起 sinceDate 变成 11-07、日志被过滤、`logged_meals` 断言实得 0，
 * 于是**从那天起主干与所有 PR 的 CI `test` 全红**，且与任何业务改动无关。
 *
 * 这里用与 insights 相同的算法生成日期，两边永远对齐。
 */
const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

let server: Server | undefined;
let baseUrl = '';

beforeAll(async () => {
  // 每次测试进程一份内存库（vitest.config.ts 设了 DATABASE_URL=:memory:）
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

beforeEach(() => {
  resetDatabase();
});

const validProfile = {
  session_id: 'sess-a',
  sex: 'male',
  height_cm: 172,
  weight_kg: 65,
  age: 20,
  activity: 'mid',
  goal: 'health',
  avoid: ['nospicy'],
  default_meal: 'lunch',
};

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

describe('POST /api/v1/profiles', () => {
  it('建档返回服务端派生值，且不含包装层', async () => {
    const res = await post('/api/v1/profiles', validProfile);
    expect(res.status).toBe(200);

    const body = res.json as Profile & Record<string, unknown>;
    expect(body.data).toBeUndefined();
    expect(body.bmi).toBeCloseTo(21.97, 2);
    expect(body.bmi_tag).toBe('正常');
    expect(typeof body.day_kcal).toBe('number');
    expect(body.warnings).toEqual([]);
  });

  it('同一 session_id 重复提交是 upsert', async () => {
    await post('/api/v1/profiles', validProfile);
    const res = await post('/api/v1/profiles', { ...validProfile, weight_kg: 67 });
    expect((res.json as Profile).weight_kg).toBe(67);

    const me = await get('/api/v1/profiles/me?session_id=sess-a');
    expect((me.json as Profile).weight_kg).toBe(67);
  });

  it('未成年 + 减脂 → 降级为 health 并提示', async () => {
    const res = await post('/api/v1/profiles', {
      ...validProfile,
      age: 16,
      goal: 'lose',
      sex: 'female',
      height_cm: 163,
      weight_kg: 52,
    });
    const body = res.json as Profile;
    expect(body.goal).toBe('health');
    expect(body.warnings[0]).toContain('未满18岁');
  });

  it('身高越界 → 400，并给出字段定位', async () => {
    const res = await post('/api/v1/profiles', { ...validProfile, height_cm: 120 });
    expect(res.status).toBe(400);
    const body = res.json as { error: ApiError };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.fields?.[0]?.path).toBe('height_cm');
  });

  it('未知忌口 key → 400（避免前端静默失效）', async () => {
    const res = await post('/api/v1/profiles', { ...validProfile, avoid: ['not-a-key'] });
    expect(res.status).toBe(400);
  });

  it('档案不存在 → 404', async () => {
    const res = await get('/api/v1/profiles/me?session_id=nobody');
    expect(res.status).toBe(404);
    expect((res.json as { error: ApiError }).error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/v1/recommendations', () => {
  it('最多 3 套，字段齐全', async () => {
    const res = await post('/api/v1/recommendations', { session_id: 'sess-a', meal: 'lunch' });
    expect(res.status).toBe(200);

    const body = res.json as RecommendationResponse;
    expect(body.combos.length).toBeLessThanOrEqual(3);
    for (const combo of body.combos) {
      expect(combo.totals.kcal).toBeGreaterThan(0);
      expect(['template', 'llm']).toContain(combo.engine);
      expect(combo.dishes.length).toBeGreaterThan(0);
    }
  });

  it('遵守档案里的忌口：不吃辣时组合里没有 spicy 菜', async () => {
    await post('/api/v1/profiles', { ...validProfile, avoid: ['nospicy'] });
    const res = await post('/api/v1/recommendations', { session_id: 'sess-a', meal: 'lunch' });
    const body = res.json as RecommendationResponse;

    const menu = await get('/api/v1/menu?meal=lunch');
    const spicyIds = new Set(
      (menu.json as MenuResponse).dishes.filter((dish) => dish.tags.includes('spicy')).map((dish) => dish.id),
    );
    for (const combo of body.combos) {
      for (const dish of combo.dishes) {
        expect(spicyIds.has(dish.id)).toBe(false);
      }
    }
  });

  it('overrides.avoid 能覆盖档案设置（试算场景）', async () => {
    await post('/api/v1/profiles', validProfile);
    const res = await post('/api/v1/recommendations', {
      session_id: 'sess-a',
      meal: 'lunch',
      overrides: { avoid: ['nomeat'] },
    });
    expect(res.status).toBe(200);
  });

  it('午晚按 v1.2.2：每套必须含主食、主菜、素菜', async () => {
    const res = await post('/api/v1/recommendations', { session_id: 'sess-a', meal: 'lunch' });
    const body = res.json as RecommendationResponse;
    expect(body.combos.length).toBeGreaterThan(0);
    for (const combo of body.combos) {
      const categories = combo.dishes.map((dish) => dish.category);
      expect(categories).toContain('staple');
      expect(categories).toContain('protein');
      expect(categories).toContain('veg');
    }
  });

  it('早餐按 v1.2.2：主食×主菜即可，素菜 0 道也不该出空', async () => {
    const res = await post('/api/v1/recommendations', { session_id: 'sess-a', meal: 'breakfast' });
    expect(res.status).toBe(200);

    const body = res.json as RecommendationResponse;
    expect(body.combos.length).toBeGreaterThan(0);
    for (const combo of body.combos) {
      const categories = combo.dishes.map((dish) => dish.category);
      expect(categories).toContain('staple');
      expect(categories).toContain('protein');
      expect(categories).not.toContain('veg');
    }
  });
});

describe('POST /api/v1/meal-logs', () => {
  const payload = {
    id: 'log-1',
    session_id: 'sess-a',
    date: daysAgo(1),
    meal: 'lunch',
    items: [{ dish_id: 's01', servings: 1 }],
  };

  it('累加营养值并给出判定', async () => {
    const res = await post('/api/v1/meal-logs', payload);
    expect(res.status).toBe(200);
    const body = res.json as MealLogResponse;
    expect(body.duplicate).toBe(false);
    expect(body.totals.kcal).toBeGreaterThan(0);
    expect(['ok', 'warn']).toContain(body.verdict.level);
  });

  it('判语文案不带浮点尾巴（前端 {{ verdict.body }} 直出给用户看）', async () => {
    await post('/api/v1/profiles', validProfile); // 引擎本餐目标 937.6，必然产生小数差
    const res = await post('/api/v1/meal-logs', { ...payload, id: 'log-float' });
    const body = res.json as MealLogResponse;

    // 回归护栏：出现 107.60000000000002 这类四位以上小数，说明 gap 忘了 round1
    expect(body.verdict.body).not.toMatch(/\d\.\d{4,}/);
    expect(body.verdict.title.length).toBeGreaterThan(0);
  });

  it('本餐目标由引擎按档案计算，不再是写死的 730（PROGRESS §2.1 BE-B #3）', async () => {
    await post('/api/v1/profiles', validProfile); // 男 172cm 65kg 20 岁 health
    const first = await post('/api/v1/meal-logs', { ...payload, id: 'log-target-a' });
    const targetA = (first.json as MealLogResponse).target;

    expect(targetA.kcal).not.toBe(730);
    expect(targetA.kcal).toBeGreaterThan(0);
    expect(targetA.protein_g).toBeGreaterThan(0);

    // 换一份档案（女 / 更轻 / 减脂）→ 目标必须跟着变，证明是档案驱动而非常量
    await post('/api/v1/profiles', {
      ...validProfile,
      session_id: 'sess-b',
      sex: 'female',
      height_cm: 160,
      weight_kg: 50,
      goal: 'lose',
    });
    const second = await post('/api/v1/meal-logs', {
      ...payload,
      id: 'log-target-b',
      session_id: 'sess-b',
    });
    const targetB = (second.json as MealLogResponse).target;

    expect(targetB.kcal).toBeGreaterThan(0);
    expect(targetB.kcal).not.toBe(targetA.kcal);
  });

  it('重复 id 幂等：第二次 duplicate=true 且 totals 不变', async () => {
    const first = await post('/api/v1/meal-logs', payload);
    const second = await post('/api/v1/meal-logs', payload);
    expect((second.json as MealLogResponse).duplicate).toBe(true);
    expect((second.json as MealLogResponse).totals).toEqual((first.json as MealLogResponse).totals);
  });

  it('份数不在 0.5 步进上 → 400', async () => {
    const res = await post('/api/v1/meal-logs', {
      ...payload,
      id: 'log-bad-step',
      items: [{ dish_id: 's01', servings: 0.7 }],
    });
    expect(res.status).toBe(400);
  });

  it('份数超过上限 5 → 400', async () => {
    const res = await post('/api/v1/meal-logs', {
      ...payload,
      id: 'log-too-many',
      items: [{ dish_id: 's01', servings: 6 }],
    });
    expect(res.status).toBe(400);
  });

  it('菜品不存在 → 400 且定位到 items[i].dish_id', async () => {
    const res = await post('/api/v1/meal-logs', {
      ...payload,
      id: 'log-unknown',
      items: [{ dish_id: 'not-a-dish', servings: 1 }],
    });
    expect(res.status).toBe(400);
    expect((res.json as { error: ApiError }).error.fields?.[0]?.path).toBe('items[0].dish_id');
  });
});

describe('GET /api/v1/meal-logs 与 insights', () => {
  it('列表按 session 隔离并按日期倒序分页', async () => {
    await post('/api/v1/meal-logs', {
      id: 'log-a',
      session_id: 'sess-a',
      date: daysAgo(2),
      meal: 'lunch',
      items: [{ dish_id: 's01', servings: 1 }],
    });
    await post('/api/v1/meal-logs', {
      id: 'log-b',
      session_id: 'sess-a',
      date: daysAgo(1),
      meal: 'dinner',
      items: [{ dish_id: 's01', servings: 1 }],
    });

    const res = await get('/api/v1/meal-logs?session_id=sess-a&page=1&page_size=20');
    const body = res.json as MealLogListResponse;
    expect(body.total).toBe(2);
    expect(body.logs[0]?.date).toBe(daysAgo(1));

    const other = await get('/api/v1/meal-logs?session_id=sess-b');
    expect((other.json as MealLogListResponse).total).toBe(0);
  });

  it('统计采纳率 = 采纳餐数 / 记录餐数', async () => {
    await post('/api/v1/meal-logs', {
      id: 'log-adopted',
      session_id: 'sess-a',
      date: daysAgo(1),
      meal: 'lunch',
      items: [{ dish_id: 's01', servings: 1 }],
      adopted_combo_id: 'c9f31a02',
    });
    await post('/api/v1/meal-logs', {
      id: 'log-self',
      session_id: 'sess-a',
      date: daysAgo(1),
      meal: 'dinner',
      items: [{ dish_id: 's01', servings: 1 }],
    });

    const res = await get('/api/v1/insights/summary?session_id=sess-a&days=7');
    const body = res.json as InsightsSummaryResponse;
    expect(body.logged_meals).toBe(2);
    expect(body.adopted).toBe(1);
    expect(body.adoption_rate).toBe(0.5);
  });
});
