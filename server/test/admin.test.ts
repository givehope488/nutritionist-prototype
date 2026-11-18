import { beforeEach, describe, expect, it } from 'vitest';
import {
  bulkImport,
  findDish,
  listDishes,
  listRevisions,
  setDishStatus,
  updateDish,
} from '../src/admin/dishes';
import { getDb, resetDatabase } from '../src/data/db';
import { seedDishes } from '../src/data/seed';

// 2026-11-17 PD：v3 上线后默认种子已切到 menu-seed.v3.json。本文件的断言写死在 55 道原型
// 夹具上（s01 等菜品 id 与份量形态），故显式固定 SEED_PATH，不被默认种子变更牵连；
// v3 的行为已由 server/scripts/e2e-flow.ts 与引擎合成夹具覆盖。@BE-B 请复核此固定方式。
process.env.SEED_PATH = 'server/data/menu-seed.json';
import { HttpError } from '../src/http/errors';

/**
 * 管理端服务测试（W2 · 管理端）。
 *
 * 重点不是「能不能改」，而是**留痕与拒绝**：
 * 没写 reason 必须拒、越界数值必须拒、没有实际变化不能凭空产生一条修订记录。
 */

beforeEach(() => {
  seedDishes();
  resetDatabase();
  getDb().exec('DELETE FROM dish_revisions');
});

describe('updateDish：修订营养数据', () => {
  it('改一个字段 → 库中生效且写入一条修订（带 from/to）', () => {
    const before = findDish('s01');
    const { dish, changed } = updateDish(
      's01',
      { kcal: 245 },
      { reason: '10 月抽检称重，实际份量 210g', operator: 'PD' },
    );

    expect(changed.kcal).toEqual({ from: before.kcal, to: 245 });
    expect(dish.kcal).toBe(245);
    expect(findDish('s01').kcal).toBe(245);

    const { revisions } = listRevisions('s01');
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.operator).toBe('PD');
    expect(revisions[0]?.reason).toContain('抽检');
    expect(revisions[0]?.changed_fields).toMatchObject({ kcal: { from: before.kcal, to: 245 } });
  });

  it('缺 reason → 400（拒绝写入，也不产生修订）', () => {
    expect(() => updateDish('s01', { kcal: 300 }, { operator: 'PD' })).toThrow(HttpError);
    expect(findDish('s01').kcal).not.toBe(300);
    expect(listRevisions('s01').revisions).toHaveLength(0);
  });

  it('未知菜品 → 404', () => {
    expect(() =>
      updateDish('not-a-dish', { kcal: 300 }, { reason: '测试', operator: 'PD' }),
    ).toThrow(/菜品不存在/);
  });

  it('负数或非数字 → 400', () => {
    expect(() => updateDish('s01', { kcal: -1 }, { reason: '测试', operator: 'PD' })).toThrow(HttpError);
    expect(() =>
      updateDish('s01', { kcal: Number('abc') }, { reason: '测试', operator: 'PD' }),
    ).toThrow(HttpError);
  });

  it('没有实际变化 → 不写修订（幂等）', () => {
    const current = findDish('s02');
    const { changed } = updateDish('s02', { kcal: current.kcal }, { reason: '重复提交', operator: 'PD' });
    expect(changed).toEqual({});
    expect(listRevisions('s02').revisions).toHaveLength(0);
  });
});

describe('setDishStatus：上下架', () => {
  it('下架后 list 按 status 过滤生效，并留痕', () => {
    setDishStatus('s01', 'hidden', 'PD');
    expect(findDish('s01').status).toBe('hidden');
    expect(listDishes({ status: 'hidden' }).some((dish) => dish.id === 's01')).toBe(true);
    expect(listDishes({ status: 'active' }).some((dish) => dish.id === 's01')).toBe(false);
    expect(listRevisions('s01').revisions[0]?.reason).toContain('状态变更');
  });
});

describe('bulkImport：逐行独立', () => {
  it('一行成功一行失败时，成功行生效、失败行给出定位', () => {
    const result = bulkImport(
      [
        { id: 's01', kcal: 250, reason: '批量校准' },
        { id: 'not-a-dish', kcal: 250, reason: '批量校准' },
      ],
      'PD',
    );

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.rows[1]?.ok).toBe(false);
    expect(result.rows[1]?.message).toContain('菜品不存在');
    expect(findDish('s01').kcal).toBe(250);
  });
});
