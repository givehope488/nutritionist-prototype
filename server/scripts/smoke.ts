import assert from 'node:assert/strict';
import type { Server } from 'node:http';
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
import { seedDishes } from '../src/data/seed';

/**
 * 契约巡检（`npm run smoke`）。
 *
 * 与 `npm run test` 的分工：
 *   - test  : 单元/集成用例，覆盖实现细节与边界
 *   - smoke : 只断言「契约层」——状态码、响应包络、关键字段是否还在
 *
 * 任何人改了返回结构（比如给成功响应套一层 data），这里第一个炸，不用等到联调。
 * 手工排查也方便：直接 `npm run smoke`，不需要起端口。
 */

// 独立进程里跑，用内存库 + 现场灌种子，不污染 server/data/runtime
process.env.DATABASE_URL ??= ':memory:';
seedDishes();

const checks: Array<{ name: string; run: () => Promise<void> }> = [];
const check = (name: string, run: () => Promise<void>): void => {
  checks.push({ name, run });
};

let baseUrl = '';

async function req(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  return { status: res.status, json: text === '' ? null : JSON.parse(text) };
}

/** 契约 §0.8：成功响应不得出现包装层 */
function assertNoEnvelope(payload: unknown, label: string): void {
  const object = payload as Record<string, unknown>;
  for (const forbidden of ['data', 'result', 'success']) {
    assert.equal(
      forbidden in object,
      false,
      `${label} 出现包装字段 "${forbidden}"，违反 API.md §0.8（成功直返业务对象）`,
    );
  }
}

const SESSION = 'smoke-session-1';
const LOG_ID = 'smoke-log-0001';

/** 失败响应的包络：`{ error: ApiError }`（API.md §1） */
function errorOf(payload: unknown): ApiError {
  return (payload as { error: ApiError }).error;
}

check('GET /healthz → 200', async () => {
  const res = await req('GET', '/healthz');
  assert.equal(res.status, 200);
});

check('GET /api/v1/menu?meal=lunch → 200 + dishes/avoid_options', async () => {
  const res = await req('GET', '/api/v1/menu?meal=lunch');
  assert.equal(res.status, 200);
  assertNoEnvelope(res.json, 'GET /menu');
  const body = res.json as MenuResponse;
  assert.ok(body.dishes.length > 0, 'dishes 为空');
  assert.ok(body.avoid_options.length > 0, 'avoid_options 为空');
  for (const key of ['id', 'name', 'category', 'portion_label', 'meals', 'kcal', 'protein_g', 'fat_g', 'carbs_g', 'sodium_mg', 'price_yuan', 'tags', 'drink', 'reliability', 'status']) {
    assert.ok(key in body.dishes[0]!, `dish 缺少字段 ${key}`);
  }
});

check('POST /api/v1/profiles → 200 + bmi / bmi_tag / day_kcal', async () => {
  const res = await req('POST', '/api/v1/profiles', {
    session_id: SESSION,
    sex: 'male',
    height_cm: 172,
    weight_kg: 65,
    age: 20,
    activity: 'mid',
    goal: 'health',
    avoid: ['nospicy'],
    default_meal: 'lunch',
  });
  assert.equal(res.status, 200);
  assertNoEnvelope(res.json, 'POST /profiles');
  const profile = res.json as Profile;
  assert.equal(typeof profile.bmi, 'number');
  assert.equal(typeof profile.bmi_tag, 'string');
  assert.equal(typeof profile.day_kcal, 'number');
  assert.deepEqual(profile.warnings, []);
});

check('POST /profiles 未成年+减脂 → 强制 health + warnings', async () => {
  const res = await req('POST', '/api/v1/profiles', {
    session_id: 'smoke-minor',
    sex: 'female',
    height_cm: 163,
    weight_kg: 52,
    age: 16,
    activity: 'low',
    goal: 'lose',
    avoid: [],
    default_meal: 'lunch',
  });
  assert.equal(res.status, 200);
  const profile = res.json as Profile;
  assert.equal(profile.goal, 'health', '未成年减脂未降级');
  assert.ok(profile.warnings.length > 0, '缺 warnings 提示');
});

check('POST /profiles 越界身高 → 400 + VALIDATION_ERROR + fields', async () => {
  const res = await req('POST', '/api/v1/profiles', {
    session_id: 'smoke-bad',
    sex: 'male',
    height_cm: 120,
    weight_kg: 65,
    age: 20,
    activity: 'mid',
    goal: 'health',
    avoid: [],
    default_meal: 'lunch',
  });
  assert.equal(res.status, 400);
  const body = errorOf(res.json);
  assert.equal(body.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(body.fields) && body.fields.length > 0, '缺字段定位');
});

check('GET /profiles/me 不存在 → 404 + NOT_FOUND', async () => {
  const res = await req('GET', '/api/v1/profiles/me?session_id=nobody');
  assert.equal(res.status, 404);
  assert.equal(errorOf(res.json).code, 'NOT_FOUND');
});

check('POST /api/v1/recommendations → 200 + ≤3 套 + totals/reason/engine', async () => {
  const res = await req('POST', '/api/v1/recommendations', { session_id: SESSION, meal: 'lunch' });
  assert.equal(res.status, 200);
  assertNoEnvelope(res.json, 'POST /recommendations');
  const body = res.json as RecommendationResponse;
  assert.ok(typeof body.target.kcal === 'number', 'target 缺失');
  assert.ok(body.combos.length <= 3, 'combos 超过 3 套');
  for (const combo of body.combos) {
    assert.equal(typeof combo.id, 'string');
    assert.ok(combo.dishes.length > 0, 'combo 没有菜');
    assert.equal(typeof combo.totals.kcal, 'number');
    assert.equal(typeof combo.reason, 'string');
    assert.ok(['template', 'llm'].includes(combo.engine), 'engine 取值非法');
  }
});

check('POST /api/v1/meal-logs → 200 + totals/verdict', async () => {
  const menu = await req('GET', '/api/v1/menu?meal=lunch');
  const dishes = (menu.json as MenuResponse).dishes;
  const staple = dishes.find((dish) => dish.category === 'staple')!;
  const protein = dishes.find((dish) => dish.category === 'protein')!;

  const res = await req('POST', '/api/v1/meal-logs', {
    id: LOG_ID,
    session_id: SESSION,
    date: '2026-11-06',
    meal: 'lunch',
    items: [
      { dish_id: staple.id, servings: 1 },
      { dish_id: protein.id, servings: 1.5 },
    ],
    adopted_combo_id: 'c9f31a02',
  });
  assert.equal(res.status, 200);
  assertNoEnvelope(res.json, 'POST /meal-logs');
  const log = res.json as MealLogResponse;
  assert.equal(log.duplicate, false);
  assert.ok(log.totals.kcal > 0, 'totals 未计算');
  assert.ok(['ok', 'warn'].includes(log.verdict.level));
  assert.equal(typeof log.verdict.title, 'string');
});

check('POST /meal-logs 重复 id → duplicate=true（幂等）', async () => {
  const res = await req('POST', '/api/v1/meal-logs', {
    id: LOG_ID,
    session_id: SESSION,
    date: '2026-11-06',
    meal: 'lunch',
    items: [{ dish_id: 's01', servings: 1 }],
  });
  assert.equal(res.status, 200);
  assert.equal((res.json as MealLogResponse).duplicate, true);
});

check('GET /api/v1/meal-logs → 200 + total/page/logs', async () => {
  const res = await req('GET', `/api/v1/meal-logs?session_id=${SESSION}&page=1&page_size=20`);
  assert.equal(res.status, 200);
  const body = res.json as MealLogListResponse;
  assert.equal(typeof body.total, 'number');
  assert.equal(body.page, 1);
  assert.ok(body.logs.length >= 1, 'logs 为空');
});

check('GET /api/v1/insights/summary → 200 + 采纳率', async () => {
  const res = await req('GET', `/api/v1/insights/summary?session_id=${SESSION}&days=7`);
  assert.equal(res.status, 200);
  const body = res.json as InsightsSummaryResponse;
  assert.equal(typeof body.logged_meals, 'number');
  assert.equal(typeof body.adoption_rate, 'number');
});

check('未知端点 → 404 + error 包络', async () => {
  const res = await req('GET', '/api/v1/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(errorOf(res.json).code, 'NOT_FOUND');
});

async function main(): Promise<void> {
  const server: Server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('无法获取 smoke 测试端口');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;

  console.log('契约 smoke：逐端点断言 API.md §2\n');
  let failed = 0;
  for (const item of checks) {
    try {
      await item.run();
      console.log(`  ✓ ${item.name}`);
    } catch (error) {
      failed++;
      console.log(`  ✗ ${item.name}`);
      console.log(`      ${(error as Error).message}`);
    }
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  console.log(`\n结果：${checks.length - failed}/${checks.length} 通过`);
  if (failed > 0) {
    console.log('\n提示：改返回结构前先改 docs/API.md 并发起评审（附录 C）。');
    process.exitCode = 1;
  }
}

await main();
