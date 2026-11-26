import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../src/app';
import { seedDishes } from '../src/data/seed';

/**
 * 端到端流程用例（`npx tsx server/scripts/e2e-flow.ts`）。
 *
 * 与 smoke / test 的分工：
 *   - test  : 单元与集成用例，覆盖实现细节与边界
 *   - smoke : 只断言契约层——状态码、响应包络、关键字段还在不在
 *   - **本文件**：一条**真实链路**走通——建档 → 推荐 → 回填 → 反馈/复盘，
 *     断言的是**跨接口的数据是否接得上**（单接口都通过，串起来却对不上，
 *     是最常见也最��发现的 bug）。
 *
 * 走真实 HTTP（起 express、真的发请求），**不走 Mock**。
 * 数据落在内存库，不污染 server/data/runtime。
 *
 * 想对实测菜单 v3（384 道）跑：
 *     SEED_PATH=server/data/menu-seed.v3.json npx tsx server/scripts/e2e-flow.ts
 * 断言不写死菜名与道数，因此换种子也能跑。
 */

process.env.DATABASE_URL ??= ':memory:';
seedDishes();

const SESSION = 'e2e-session-' + Date.now();
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

/** 递归找出所有含指定键的对象路径——用来确认「全链路无价格」 */
function findKeys(value: unknown, key: string, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => findKeys(v, key, `${path}[${i}]`));
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const here = key in obj ? [path] : [];
    return here.concat(Object.entries(obj).flatMap(([k, v]) => findKeys(v, key, `${path}.${k}`)));
  }
  return [];
}

const steps: Array<{ name: string; ok: boolean; note: string }> = [];
function step(name: string, note: string): void {
  steps.push({ name, ok: true, note });
  console.log(`  ✓ ${name.padEnd(22)} ${note}`);
}

async function run(): Promise<void> {
  console.log('端到端流程：建档 → 推荐 → 回填 → 反馈/复盘\n');

  // ------------------------------------------------------------ 1) 建档
  const profile = await req('POST', '/api/v1/profiles', {
    session_id: SESSION,
    sex: 'male',
    height_cm: 172,
    weight_kg: 65,
    age: 22,
    activity: 'mid',
    goal: 'lose',
    avoid: [],
    default_meal: 'lunch',
  });
  assert.equal(profile.status, 200, `建档应 200，实得 ${profile.status}`);
  const p = profile.json as Record<string, unknown>;
  for (const k of ['session_id', 'bmi', 'bmi_tag', 'day_kcal', 'warnings']) {
    assert.ok(k in p, `建档响应缺 ${k}`);
  }
  assert.ok(Number(p.day_kcal) > 0, 'day_kcal 应为正数');
  assert.ok(Array.isArray(p.warnings), 'warnings 应为数组');
  step('建档', `day_kcal=${p.day_kcal} bmi=${p.bmi}（${p.bmi_tag}）`);

  // 档案可回读
  const me = await req('GET', `/api/v1/profiles/me?session_id=${SESSION}`);
  assert.equal(me.status, 200, '档案回读应 200');
  assert.equal((me.json as Record<string, unknown>).session_id, SESSION);
  step('档案回读', 'GET /profiles/me 一致');

  // ------------------------------------------------------------ 2) 推荐
  const rec = await req('POST', '/api/v1/recommendations', {
    session_id: SESSION,
    meal: 'lunch',
  });
  assert.equal(rec.status, 200, `推荐应 200，实得 ${rec.status}`);
  const r = rec.json as {
    target?: Record<string, unknown>;
    combos?: Array<{ id?: string; dishes?: Array<{ id?: string; name?: string; servings?: number }>; totals?: { kcal?: number } }>;
    notice?: string | null;
  };
  assert.ok(r.target, '推荐响应缺 target');
  assert.ok(Array.isArray(r.combos), '推荐响应缺 combos 数组');
  assert.ok(r.combos.length >= 1, '推荐应至少给出一套');
  for (const combo of r.combos) {
    assert.ok(Array.isArray(combo.dishes) && combo.dishes.length > 0, '每套组合都要有菜');
    assert.ok(typeof combo.totals?.kcal === 'number', '每套组合都要有 totals.kcal');
  }
  const picked = r.combos[0];
  step(
    '推荐',
    `${r.combos.length} 套，午餐目标 ${r.target.kcal} kcal，首套 ${picked.totals?.kcal} kcal`,
  );

  // 推荐里的菜必须是菜单里真实存在的 id（跨接口一致性）
  const menu = await req('GET', '/api/v1/menu?meal=lunch');
  assert.equal(menu.status, 200, '菜单应 200');
  const menuIds = new Set(
    ((menu.json as { dishes?: Array<{ id?: string }> }).dishes ?? []).map((d) => d.id),
  );
  for (const combo of r.combos) {
    for (const d of combo.dishes ?? []) {
      assert.ok(menuIds.has(d.id as string), `推荐里的菜 ${d.id}（${d.name}）不在菜单里`);
    }
  }
  step('推荐↔菜单', `${menuIds.size} 道菜，推荐引用的 id 全部存在`);

  // ------------------------------------------------------------ 2b) 早餐（v1.2.10）
  // 「早餐偏一大碗」回归：全天供应的盖浇饭/拌面不得作为单菜出现在早餐；
  // 第一套必须来自早餐优先池（仅早餐供应的菜，或炒饭/炒面/炒米粉这类常见早餐成品）。
  const bfRec = await req('POST', '/api/v1/recommendations', {
    session_id: SESSION,
    meal: 'breakfast',
  });
  assert.equal(bfRec.status, 200, `早餐推荐应 200，实得 ${bfRec.status}`);
  const br = bfRec.json as {
    combos?: Array<{ dishes?: Array<{ id?: string; name?: string }> }>;
    notice?: string | null;
  };
  assert.ok(Array.isArray(br.combos) && br.combos.length >= 1, '早餐推荐应至少给出一套');

  const bfMenu = await req('GET', '/api/v1/menu?meal=breakfast');
  assert.equal(bfMenu.status, 200, '早餐菜单应 200');
  const bfDishes = (bfMenu.json as { dishes?: Array<{ id: string; name: string; meals: string[] }> })
    .dishes ?? [];
  const bfById = new Map(bfDishes.map((dish) => [dish.id, dish]));
  const isBreakfastLine = (dish: { meals: string[] }) =>
    dish.meals.length === 1 && dish.meals[0] === 'breakfast';
  const isCommonBreakfast = (dish: { name: string }) => /炒饭|炒面|炒米粉/.test(dish.name);
  const inPriority = (dish: { name: string; meals: string[] }) =>
    isBreakfastLine(dish) || isCommonBreakfast(dish);

  let priorityHits = 0;
  for (const combo of br.combos) {
    const dishes = combo.dishes ?? [];
    for (const item of dishes) {
      const dish = bfById.get(item.id as string);
      assert.ok(dish, `早餐推荐里的菜 ${item.id}（${item.name}）不在早餐菜单里`);
      if (inPriority(dish)) priorityHits += 1;
      // 单菜套餐是这次回归的重灾区：全天盖浇饭/拌面不能再被当成早餐
      if (dishes.length === 1) {
        assert.ok(
          inPriority(dish),
          `早餐单菜「${dish.name}」既不是早餐线也不是常见早餐成品（v1.2.10 回归）`,
        );
      }
    }
  }
  assert.ok(priorityHits > 0, '早餐推荐里应至少有一道早餐线 / 常见早餐成品');
  for (const item of br.combos[0].dishes ?? []) {
    const dish = bfById.get(item.id as string);
    assert.ok(
      dish && inPriority(dish),
      `第一套早餐「${item.name}」不在早餐优先池里（v1.2.10 回归）`,
    );
  }
  step(
    '早餐优先池',
    `${br.combos.length} 套，首套 ${br.combos[0].dishes?.[0]?.name}，无全天盖浇饭/拌面单菜`,
  );

  // ------------------------------------------------------------ 3) 回填
  // 份量取推荐里的 servings：回填要「照推荐吃」，快照与 items 才会一致（API v1.2.5 采纳判定）
  const items = (picked.dishes ?? []).map((d) => ({ dish_id: d.id, servings: d.servings }));
  const logId = 'e2e-log-' + Date.now();
  const log = await req('POST', '/api/v1/meal-logs', {
    id: logId,
    session_id: SESSION,
    date: new Date().toISOString().slice(0, 10),
    meal: 'lunch',
    items,
    adopted_combo_id: picked.id ?? null,
    adopted_combo: { id: picked.id, items },
  });
  assert.equal(log.status, 200, `回填应 200，实得 ${log.status}`);
  const l = log.json as {
    duplicate?: boolean;
    totals?: { kcal?: number };
    verdict?: { level?: string; title?: string; body?: string };
    adopted?: boolean;
  };
  assert.ok(typeof l.totals?.kcal === 'number' && l.totals.kcal > 0, '回填缺 totals.kcal');
  assert.ok(l.verdict?.level, '回填缺 verdict.level');
  assert.ok(l.verdict?.title, '回填缺 verdict.title');
  assert.ok(l.verdict?.body, '回填缺 verdict.body');
  assert.ok(['ok', 'warn'].includes(l.verdict.level as string), `verdict.level 非法：${l.verdict.level}`);
  step('回填', `totals=${l.totals.kcal} kcal，判定「${l.verdict.title}」`);

  // 回填的热量应与推荐那套一致（同一批菜、同一份量）
  if (picked.totals?.kcal !== undefined) {
    assert.equal(
      Math.round(l.totals.kcal as number),
      Math.round(picked.totals.kcal),
      `回填热量 ${l.totals.kcal} 应等于被采纳组合的 ${picked.totals.kcal}`,
    );
    step('回填↔推荐', '热量与被采纳的组合完全一致');
  }

  // 幂等：同一个 id 再发一次
  const dup = await req('POST', '/api/v1/meal-logs', {
    id: logId,
    session_id: SESSION,
    date: new Date().toISOString().slice(0, 10),
    meal: 'lunch',
    items,
    adopted_combo_id: picked.id ?? null,
    adopted_combo: { id: picked.id, items },
  });
  assert.equal(dup.status, 200, '重复回填应 200');
  assert.equal((dup.json as { duplicate?: boolean }).duplicate, true, '重复回填应标记 duplicate');
  step('回填幂等', '重复 id 返回 duplicate: true');

  // ------------------------------------------------------------ 4) 反馈 / 复盘
  const list = await req(
    'GET',
    `/api/v1/meal-logs?session_id=${SESSION}&from=2000-01-01&to=2099-12-31`,
  );
  assert.equal(list.status, 200, '记录列表应 200');
  const lst = list.json as { total?: number; logs?: Array<{ id?: string; verdict?: { title?: string } }> };
  assert.ok((lst.total ?? 0) >= 1, '记录列表应至少有一条');
  assert.ok(
    (lst.logs ?? []).some((x) => x.id === logId),
    '记录列表里应能查到刚回填的那条',
  );
  assert.ok(
    (lst.logs ?? []).every((x) => x.verdict?.title),
    '每条记录都应带 verdict 文案（反馈页要展示）',
  );
  step('反馈/复盘', `列表 ${lst.total} 条，均带判定文案`);

  const insights = await req('GET', `/api/v1/insights/summary?session_id=${SESSION}&days=7`);
  assert.equal(insights.status, 200, '统计应 200');
  const ins = insights.json as { logged_meals?: number; adoption_rate?: number };
  assert.ok((ins.logged_meals ?? 0) >= 1, '统计里的 logged_meals 应 ≥1');
  step('统计', `logged_meals=${ins.logged_meals} adoption_rate=${ins.adoption_rate}`);

  // ------------------------------------------------------------ 5) 全链路无价格
  const payloads: Array<[string, unknown]> = [
    ['建档', profile.json],
    ['推荐', rec.json],
    ['早餐推荐', bfRec.json],
    ['回填', log.json],
    ['菜单', menu.json],
    ['早餐菜单', bfMenu.json],
    ['记录列表', list.json],
    ['统计', insights.json],
  ];
  for (const [label, payload] of payloads) {
    const hits = findKeys(payload, 'price_yuan');
    assert.equal(hits.length, 0, `${label} 响应里出现了价格字段：${hits.join(', ')}`);
  }
  step('无价格', `${payloads.length} 份响应的任意层级都没有 price_yuan`);
}

const server: Server = createApp().listen(0);
await new Promise<void>((resolve) => server.once('listening', () => resolve()));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('拿不到端口');
baseUrl = `http://127.0.0.1:${address.port}`;

let failed = 0;
try {
  await run();
  console.log('\n端到端流程全部通过。');
} catch (err) {
  failed = 1;
  console.error('\n端到端流程失败：');
  console.error(err instanceof Error ? err.message : err);
} finally {
  server.close();
}

process.exit(failed);
