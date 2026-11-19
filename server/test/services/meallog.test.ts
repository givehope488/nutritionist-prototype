import { describe, expect, it } from 'vitest';
import type { AdoptedComboSnapshot, MealLogItem, PricingMode } from '@canteen/shared';
import { judgeAdoption, judgeVerdict, WEIGH_SERVINGS_TOLERANCE } from '../../src/services/meallog';

/**
 * 采纳判定与判语规则（W2 #4，PD 2026-11-17 裁决策略 B）。
 *
 * 这里是纯函数测试，不碰数据库与 HTTP——规则本身要能在毫秒级验完，
 * 路由层只负责解析与落库。
 */

const fixed = (): PricingMode => 'fixed';
const weigh = (): PricingMode => 'weigh';

const snapshot = (items: Array<[string, number]>): AdoptedComboSnapshot => ({
  id: 'combo-1',
  items: items.map(([dish_id, servings]) => ({ dish_id, servings })),
});

const actual = (items: Array<[string, number]>): MealLogItem[] =>
  items.map(([dish_id, servings]) => ({ dish_id, name: dish_id, servings }));

describe('judgeAdoption：快照逐菜比对', () => {
  it('没有快照 → 自选，false', () => {
    expect(judgeAdoption({ snapshot: null, actualItems: actual([['s01', 1]]), pricingModeOf: fixed }).adopted).toBe(false);
  });

  it('fixed 菜：菜集合一致即算采纳，份量不同不影响', () => {
    const result = judgeAdoption({
      snapshot: snapshot([['s01', 1], ['p01', 1], ['v01', 1]]),
      actualItems: actual([['s01', 2], ['p01', 1], ['v01', 1]]),
      pricingModeOf: fixed,
    });
    expect(result.adopted).toBe(true);
  });

  it('预填后换了一道菜 → 不采纳', () => {
    const result = judgeAdoption({
      snapshot: snapshot([['s01', 1], ['p01', 1], ['v01', 1]]),
      actualItems: actual([['s01', 1], ['p02', 1], ['v01', 1]]),
      pricingModeOf: fixed,
    });
    expect(result.adopted).toBe(false);
    expect(result.reason).toContain('换了菜');
  });

  it('少吃一道或多加一道 → 不采纳', () => {
    const snapshotItems = snapshot([['s01', 1], ['p01', 1]]);
    expect(judgeAdoption({ snapshot: snapshotItems, actualItems: actual([['s01', 1]]), pricingModeOf: fixed }).adopted).toBe(false);
    expect(
      judgeAdoption({
        snapshot: snapshotItems,
        actualItems: actual([['s01', 1], ['p01', 1], ['v01', 1]]),
        pricingModeOf: fixed,
      }).adopted,
    ).toBe(false);
  });

  it('weigh 菜：份量在 ±15% 内算采纳', () => {
    // 推荐 4 份，实际 4.5 份 = +12.5%，在容差内
    const result = judgeAdoption({
      snapshot: snapshot([['w01', 4]]),
      actualItems: actual([['w01', 4.5]]),
      pricingModeOf: weigh,
    });
    expect(result.adopted).toBe(true);
    expect(WEIGH_SERVINGS_TOLERANCE).toBe(0.15);
  });

  it('weigh 菜：份量超出 ±15% 不算采纳', () => {
    // 推荐 4 份，实际 5 份 = +25%
    const result = judgeAdoption({
      snapshot: snapshot([['w01', 4]]),
      actualItems: actual([['w01', 5]]),
      pricingModeOf: weigh,
    });
    expect(result.adopted).toBe(false);
    expect(result.reason).toContain('称重菜');
  });

  it('fixed 与 weigh 混排：fixed 放宽、weigh 收紧', () => {
    const snap = snapshot([['s01', 1], ['w01', 2]]);
    // fixed 多份无所谓，weigh 正好 2 份
    expect(judgeAdoption({ snapshot: snap, actualItems: actual([['s01', 2], ['w01', 2]]), pricingModeOf: (id) => (id === 'w01' ? 'weigh' : 'fixed') }).adopted).toBe(true);
    // weigh 变成 3 份（+50%）→ 不采纳
    expect(judgeAdoption({ snapshot: snap, actualItems: actual([['s01', 1], ['w01', 3]]), pricingModeOf: (id) => (id === 'w01' ? 'weigh' : 'fixed') }).adopted).toBe(false);
  });

  it('pricing_mode 缺失按 fixed 处理（老种子语义）', () => {
    const result = judgeAdoption({
      snapshot: snapshot([['s01', 1]]),
      actualItems: actual([['s01', 3]]),
      pricingModeOf: () => 'fixed',
    });
    expect(result.adopted).toBe(true);
  });
});

describe('judgeVerdict：达标与判语', () => {
  const totals = (kcal: number) => ({ kcal, protein_g: 20, fat_g: 10, carbs_g: 40, sodium_mg: 500 });

  it('相差 ≤10% → ok', () => {
    const verdict = judgeVerdict(totals(900), { kcal: 937.6, protein_g: 30 });
    expect(verdict.level).toBe('ok');
    expect(verdict.title).toBe('吃得挺准');
  });

  it('相差 >10% → warn', () => {
    const verdict = judgeVerdict(totals(700), { kcal: 937.6, protein_g: 30 });
    expect(verdict.level).toBe('warn');
  });

  it('判语里不出现四位以上小数（浮点尾巴回归）', () => {
    const verdict = judgeVerdict(totals(830), { kcal: 937.6, protein_g: 30 });
    expect(verdict.body).not.toMatch(/\d\.\d{4,}/);
  });

  it('目标为 0 时不判达标（避免除以 0）', () => {
    const verdict = judgeVerdict(totals(100), { kcal: 0, protein_g: 0 });
    expect(verdict.level).toBe('warn');
  });
});
