import { describe, expect, it } from 'vitest';
import { calcBMR, calcTargets, resolveGoal } from '../../src/engines/nutrition';
import type { ProfileInput } from '@canteen/shared';

/**
 * 营养计算引擎测试（BE-A 验收：PROGRESS §2.2 #1）。
 * 口径对照 docs/API.md 附录 A，样例 day_kcal 与手算一致。
 */

function profile(partial: Partial<ProfileInput>): ProfileInput {
  return {
    session_id: 'test-session',
    sex: 'male',
    height_cm: 172,
    weight_kg: 65,
    age: 20,
    activity: 'mid',
    goal: 'health',
    avoid: [],
    default_meal: 'lunch',
    ...partial,
  };
}

describe('calcBMR（Mifflin-St Jeor，附录 A）', () => {
  it('男 = 10W + 6.25H - 5A + 5', () => {
    expect(calcBMR('male', 65, 172, 20)).toBe(1630); // 650+1075-100+5
  });
  it('女 = 10W + 6.25H - 5A - 161', () => {
    expect(calcBMR('female', 55, 160, 22)).toBe(1279); // 550+1000-110-161
  });
});

describe('calcTargets：4 组样例 day_kcal 与手算一致', () => {
  it('男 health（mid）：TDEE = 1630×1.4 = 2282', () => {
    const { profile: p } = calcTargets(profile({ sex: 'male', goal: 'health' }));
    expect(p.day_kcal).toBe(2282);
    expect(p.bmi).toBe(21.97);
    expect(p.bmi_tag).toBe('正常');
  });

  it('女 health（mid，160/55/22）：TDEE = 1279×1.4 = 1791', () => {
    const { profile: p } = calcTargets(
      profile({ sex: 'female', height_cm: 160, weight_kg: 55, age: 22, goal: 'health' }),
    );
    expect(calcBMR('female', 55, 160, 22)).toBe(1279);
    expect(p.day_kcal).toBe(1791);
  });

  it('男 lose（mid）：TDEE×0.8 = 1826（未触及地板）', () => {
    const { profile: p } = calcTargets(profile({ sex: 'male', goal: 'lose' }));
    expect(p.day_kcal).toBe(1826);
  });

  it('男 gain（mid）：TDEE×1.12 = 2556', () => {
    const { profile: p } = calcTargets(profile({ sex: 'male', goal: 'gain' }));
    expect(p.day_kcal).toBe(2556); // 2282*1.12=2555.8→2556
  });
});

describe('餐次目标（午餐 0.4）', () => {
  it('男 health 午餐：kcal=912.8、protein_g=31.2', () => {
    const { mealTargets } = calcTargets(profile({ goal: 'health' }));
    const lunch = mealTargets.lunch;
    expect(lunch.meal_ratio).toBe(0.4);
    expect(lunch.kcal).toBe(912.8);
    expect(lunch.protein_g).toBe(31.2);
    expect(lunch.sodium_mg).toBe(1600);
  });
});

describe('餐次目标之和 = 日目标（v1.2.3 占比和=1.0）', () => {
  it('三餐 kcal 之和 ≈ day_kcal', () => {
    const { profile: p, mealTargets } = calcTargets(profile({ goal: 'health' }));
    const sum =
      mealTargets.breakfast.kcal + mealTargets.lunch.kcal + mealTargets.dinner.kcal;
    expect(sum).toBeCloseTo(p.day_kcal, 0);
  });
  it('三餐 meal_ratio 之和 = 1.0', () => {
    const { mealTargets } = calcTargets(profile({ goal: 'health' }));
    const r =
      mealTargets.breakfast.meal_ratio +
      mealTargets.lunch.meal_ratio +
      mealTargets.dinner.meal_ratio;
    expect(r).toBeCloseTo(1.0, 6);
  });
});

describe('边界：lose 不低于 BMR×1.05', () => {
  it('低代谢女性 lose：day_kcal 取地板值 1078 而非 986', () => {
    // BMR=1027(女 40/150/30)，TDEE×0.8≈986，BMR×1.05≈1078 → 取 1078
    const { profile: p } = calcTargets(
      profile({ sex: 'female', height_cm: 150, weight_kg: 40, age: 30, activity: 'low', goal: 'lose' }),
    );
    expect(calcBMR('female', 40, 150, 30)).toBe(1027);
    expect(p.day_kcal).toBe(1078);
    expect(p.day_kcal).toBeGreaterThanOrEqual(Math.round(1027 * 1.05));
  });
});

describe('边界：未成年 + lose 强制降级 health', () => {
  it('age<18 且 goal=lose → health，并给出警告', () => {
    const { profile: p } = calcTargets(
      profile({ height_cm: 170, weight_kg: 60, age: 16, goal: 'lose' }),
    );
    expect(p.goal).toBe('health');
    expect(p.warnings).toContain('未满18岁不提供热量缺口方案，已调整为日常保健');
    // health 的 day_kcal = BMR×1.4 = 1588×1.4 = 2223
    expect(calcBMR('male', 60, 170, 16)).toBe(1588);
    expect(p.day_kcal).toBe(2223);
  });
});

describe('resolveGoal 纯函数', () => {
  it('成年 lose 不降级', () => {
    expect(resolveGoal('lose', 20)).toEqual({ goal: 'lose', minorDowngraded: false });
  });
  it('未成年 lose 降级', () => {
    expect(resolveGoal('lose', 16)).toEqual({ goal: 'health', minorDowngraded: true });
  });
});
