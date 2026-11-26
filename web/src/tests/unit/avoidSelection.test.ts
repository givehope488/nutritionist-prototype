import { describe, expect, it } from 'vitest';
import {
  isAvoidDisabled,
  MEAT_FREE_KEY,
  MEAT_SPECIFIC_KEYS,
  toggleAvoidKey,
} from '../../utils/avoid';

/**
 * 忌口互斥规则（产品口径 2026-11-26）：
 * 「不吃荤」= 不吃猪/牛/海鲜 的超集，勾了它，三个具体项置灰且被清空。
 */

describe('不吃荤 与 具体荤菜项 的互斥', () => {
  it('勾了不吃荤 → 不吃猪/牛/海鲜 置灰', () => {
    const selected = [MEAT_FREE_KEY];
    for (const key of MEAT_SPECIFIC_KEYS) {
      expect(isAvoidDisabled(selected, key)).toBe(true);
    }
  });

  it('勾了不吃荤 → 蛋/奶/辣/花生/麸质 仍然可选', () => {
    const selected = [MEAT_FREE_KEY];
    for (const key of ['noegg', 'nomilk', 'nospicy', 'nopeanut', 'nogluten']) {
      expect(isAvoidDisabled(selected, key)).toBe(false);
    }
  });

  it('没勾不吃荤时，具体项都可选', () => {
    expect(isAvoidDisabled(['nospicy'], 'nopork')).toBe(false);
  });

  it('先勾不吃猪肉，再勾不吃荤 → 具体项被清掉，只剩不吃荤', () => {
    const after = toggleAvoidKey(['nopork', 'nospicy'], MEAT_FREE_KEY);
    expect(after).toEqual(['nospicy', MEAT_FREE_KEY]);
    expect(after).not.toContain('nopork');
  });

  it('勾了不吃荤时点具体项 → 选择不变（防绕过）', () => {
    const selected = [MEAT_FREE_KEY];
    for (const key of MEAT_SPECIFIC_KEYS) {
      expect(toggleAvoidKey(selected, key)).toEqual(selected);
    }
  });

  it('取消不吃荤 → 具体项恢复可选', () => {
    const after = toggleAvoidKey([MEAT_FREE_KEY], MEAT_FREE_KEY);
    expect(after).toEqual([]);
    expect(isAvoidDisabled(after, 'nopork')).toBe(false);
  });

  it('普通多选行为不变', () => {
    expect(toggleAvoidKey([], 'noegg')).toEqual(['noegg']);
    expect(toggleAvoidKey(['noegg'], 'noegg')).toEqual([]);
    expect(toggleAvoidKey(['noegg'], 'nomilk')).toEqual(['noegg', 'nomilk']);
  });
});
