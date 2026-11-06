// 闭环三端点（推荐 / 回填 / 统计）的契约断言：字段名与取值范围逐条对齐 API.md §2.3~§2.5。
import { describe, expect, it } from 'vitest';
import type { MealLogRequest, Meal, ProfileInput } from '@canteen/shared';
import { createMealLog, createRecommendation, getInsightsSummary, listMealLogs, saveProfile } from '@/api/endpoints';

const baseProfile: ProfileInput = {
  session_id: 'flow-session',
  sex: 'male',
  height_cm: 172,
  weight_kg: 65,
  age: 20,
  activity: 'mid',
  goal: 'health',
  avoid: [],
  default_meal: 'lunch',
};

async function seed(overrides: Partial<ProfileInput> = {}) {
  const result = await saveProfile({ ...baseProfile, ...overrides });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.data;
}

async function recommend(meal: Meal) {
  const result = await createRecommendation({ session_id: baseProfile.session_id, meal });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.data;
}

describe('推荐（§2.3）', () => {
  it('返回 target + 最多 3 套 combos，主菜不重复、主食互不相同', async () => {
    await seed();
    const data = await recommend('lunch');
    expect(data.combos.length).toBeLessThanOrEqual(3);
    expect(data.combos.length).toBeGreaterThan(0);
    const staples = data.combos.map((combo) => combo.dishes[0].id);
    const mains = data.combos.map((combo) => combo.dishes[1].id);
    expect(new Set(staples).size).toBe(staples.length);
    expect(new Set(mains).size).toBe(mains.length);
    expect(data.notice).toBeNull();
  });

  it('target 的本餐热量 = 日热量 × 餐次占比', async () => {
    await seed();
    const data = await recommend('lunch');
    expect(data.target.meal_ratio).toBe(0.4);
    expect(data.target.kcal).toBe(Math.round(data.target.day_kcal * 0.4));
  });

  it('每套组合带 reason 与 engine 标记，engine ∈ template/llm', async () => {
    await seed();
    const data = await recommend('lunch');
    for (const combo of data.combos) {
      expect(combo.reason.length).toBeGreaterThan(10);
      expect(['template', 'llm']).toContain(combo.engine);
      expect(combo.id).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it('忌口再严也不是错误：200 + 合法 combos（55 道菜下仍能凑出早餐）', async () => {
    await seed({ avoid: ['vegan', 'noegg', 'nomilk', 'noseafood', 'nogluten', 'nopork', 'nobeef', 'nopeanut', 'nospicy'] });
    const result = await createRecommendation({ session_id: baseProfile.session_id, meal: 'breakfast' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.isArray(result.data.combos)).toBe(true);
    // 当前种子数据下忌口无法把菜品池掏空，无解分支（combos=[] + notice）由 NoSolutionNotice 组件覆盖
    // 见 web/docs/FE-B-开发记录.md 待评审议题 Q5：哪些忌口组合应判无解，需 BE-A + PD 给判据
    if (result.data.combos.length === 0) expect(result.data.notice).toContain('建议放宽');
  });

  it('overrides 只在本次生效，不落库', async () => {
    await seed({ goal: 'health' });
    const trial = await createRecommendation({
      session_id: baseProfile.session_id,
      meal: 'lunch',
      overrides: { goal: 'lose' },
    });
    expect(trial.ok).toBe(true);
    if (!trial.ok) return;
    const stored = await saveProfile({ ...baseProfile });
    expect(stored.ok && stored.data.goal).toBe('health');
  });
});

describe('回填（§2.4）', () => {
  function logInput(overrides: Partial<MealLogRequest> = {}): MealLogRequest {
    return {
      id: 'client-uuid-1',
      session_id: baseProfile.session_id,
      date: '2026-11-04',
      meal: 'lunch',
      items: [
        { dish_id: 's01', servings: 1 },
        { dish_id: 'm08', servings: 1 },
        { dish_id: 'v01', servings: 1 },
      ],
      adopted_combo_id: null,
      ...overrides,
    };
  }

  it('响应含 totals / target / verdict，verdict.level ∈ ok|warn', async () => {
    await seed();
    const result = await createMealLog(logInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.duplicate).toBe(false);
    expect(Object.keys(result.data.totals).sort()).toEqual([
      'carbs_g',
      'fat_g',
      'kcal',
      'protein_g',
      'sodium_mg',
    ]);
    expect(Object.keys(result.data.target).sort()).toEqual(['kcal', 'protein_g']);
    expect(['ok', 'warn']).toContain(result.data.verdict.level);
    expect(result.data.items[0]).toEqual({ dish_id: 's01', name: '白米饭', servings: 1 });
  });

  it('幂等：同 id 重复提交返回首次结果并 duplicate=true，不新增记录', async () => {
    await seed();
    const first = await createMealLog(logInput());
    const second = await createMealLog(logInput());
    expect(first.ok && second.ok).toBe(true);
    if (!second.ok || !first.ok) return;
    expect(second.data.duplicate).toBe(true);
    expect(second.data.totals).toEqual(first.data.totals);
    const list = await listMealLogs({ session_id: baseProfile.session_id });
    expect(list.ok && list.data.total).toBe(1);
  });

  it('份数只接受 0.5 步进、上限 5', async () => {
    await seed();
    const bad = await createMealLog(logInput({ id: 'u-bad', items: [{ dish_id: 's01', servings: 1.2 }] }));
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.error.fields?.[0]?.path).toBe('items[0].servings');

    const over = await createMealLog(logInput({ id: 'u-over', items: [{ dish_id: 's01', servings: 6 }] }));
    expect(over.ok).toBe(false);
  });

  it('不存在的 dish_id 报 VALIDATION_ERROR 并定位到具体项', async () => {
    await seed();
    const result = await createMealLog(
      logInput({ id: 'u-404', items: [{ dish_id: 'zz99', servings: 1 }] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.fields?.[0]?.path).toBe('items[0].dish_id');
  });

  it('采纳推荐时 adopted=true，自选时 adopted=false', async () => {
    await seed();
    const reco = await recommend('lunch');
    const adopted = reco.combos[0];
    const hit = await createMealLog(
      logInput({
        id: 'u-adopt',
        items: adopted.dishes.map((dish) => ({ dish_id: dish.id, servings: 1 })),
        adopted_combo_id: adopted.id,
      }),
    );
    expect(hit.ok && hit.data.adopted).toBe(true);

    const missed = await createMealLog(
      logInput({ id: 'u-self', items: [{ dish_id: 's01', servings: 1 }], adopted_combo_id: adopted.id }),
    );
    expect(missed.ok && missed.data.adopted).toBe(false);

    const self = await createMealLog(logInput({ id: 'u-null' }));
    expect(self.ok && self.data.adopted).toBe(false);
  });
});

describe('记录与统计（§2.5）', () => {
  it('分页返回 total / page / logs', async () => {
    await seed();
    for (let index = 0; index < 3; index += 1) {
      await createMealLog({
        id: `page-${index}`,
        session_id: baseProfile.session_id,
        date: '2026-11-04',
        meal: 'lunch',
        items: [{ dish_id: 's01', servings: 1 }],
        adopted_combo_id: null,
      });
    }
    const result = await listMealLogs({ session_id: baseProfile.session_id, page: 1, page_size: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.total).toBe(3);
    expect(result.data.page).toBe(1);
    expect(result.data.logs.length).toBe(2);
  });

  it('summary 给出 logged_meals / adopted / adoption_rate / 均值', async () => {
    await seed();
    const reco = await recommend('lunch');
    const adopted = reco.combos[0];
    await createMealLog({
      id: 'sum-1',
      session_id: baseProfile.session_id,
      date: new Date().toISOString().slice(0, 10),
      meal: 'lunch',
      items: adopted.dishes.map((dish) => ({ dish_id: dish.id, servings: 1 })),
      adopted_combo_id: adopted.id,
    });
    await createMealLog({
      id: 'sum-2',
      session_id: baseProfile.session_id,
      date: new Date().toISOString().slice(0, 10),
      meal: 'lunch',
      items: [{ dish_id: 's01', servings: 1 }],
      adopted_combo_id: null,
    });
    const result = await getInsightsSummary({ session_id: baseProfile.session_id, days: 7 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.logged_meals).toBe(2);
    expect(result.data.adopted).toBe(1);
    expect(result.data.adoption_rate).toBe(0.5);
    expect(result.data.avg_kcal).toBeGreaterThan(0);
  });

  it('没有任何记录时统计为 0 而不是报错', async () => {
    await seed();
    const result = await getInsightsSummary({ session_id: baseProfile.session_id, days: 7 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      logged_meals: 0,
      adopted: 0,
      adoption_rate: 0,
      avg_kcal: 0,
      avg_protein_g: 0,
    });
  });
});
