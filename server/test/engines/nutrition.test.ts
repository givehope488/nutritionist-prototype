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

  it('男 gain（增肌，mid）：TDEE×1.12 = 2556', () => {
    const { profile: p } = calcTargets(profile({ sex: 'male', goal: 'gain' }));
    expect(p.day_kcal).toBe(2556); // 2282*1.12=2555.8→2556
  });

  it('男 weight_gain（增重，mid）：TDEE×1.15 = 2624', () => {
    const { profile: p } = calcTargets(profile({ sex: 'male', goal: 'weight_gain' }));
    expect(p.day_kcal).toBe(2624); // 2282*1.15=2624.3→2624
    expect(p.bmi_tag).toBe('正常');
  });
});

describe('餐次目标（午餐 0.4）', () => {
  it('男 health 午餐：kcal=912.8、protein_g=31.2', () => {
    const { mealTargets } = calcTargets(profile({ goal: 'health' }));
    const lunch = mealTargets.lunch;
    expect(lunch.meal_ratio).toBe(0.4);
    expect(lunch.kcal).toBe(912.8);
    expect(lunch.protein_g).toBe(31.2);
    // 脂肪 27%：2282×0.27/9=68.5 → 午餐 27.4；碳水余量 338.4 → 135.4
    expect(lunch.fat_g).toBe(27.4);
    expect(lunch.carbs_g).toBe(135.4);
    expect(lunch.sodium_mg).toBe(1600);
  });

  it('减肥（lose）脂肪占比下调到 25%：午餐脂肪 20.3g，低于保持的 27.4g', () => {
    const { mealTargets } = calcTargets(profile({ goal: 'lose' }));
    const lunch = mealTargets.lunch;
    // 日目标 1826 kcal：脂肪 1826×0.25/9=50.7 → 午餐 20.3；蛋白 65×1.6×0.4=41.6
    expect(lunch.kcal).toBe(730.4);
    expect(lunch.protein_g).toBe(41.6);
    expect(lunch.fat_g).toBe(20.3);
    expect(lunch.carbs_g).toBe(95.4);
  });

  it('增重（weight_gain）蛋白按保持的 1.2：午餐蛋白 31.2g，低于增肌的 46.8g', () => {
    const { profile: p, mealTargets } = calcTargets(profile({ goal: 'weight_gain' }));
    expect(p.day_kcal).toBe(2624);
    expect(mealTargets.lunch.protein_g).toBe(31.2); // 65×1.2×0.4
    const gain = calcTargets(profile({ goal: 'gain' })).mealTargets.lunch;
    expect(gain.protein_g).toBe(46.8); // 65×1.8×0.4
  });
});

// 提案分支（2026-11-24）：早餐占比 0.30 → 0.25、晚餐 0.30 → 0.35。
// 必须先由 PD 把 docs/API.md 附录 A 改成同一组数字，合入时本组断言才成立。
describe('餐次目标（提案：早餐 0.25 / 晚餐 0.35）', () => {
  it('男 health 早餐：kcal=570.5、protein_g=19.5', () => {
    const { mealTargets } = calcTargets(profile({ goal: 'health' }));
    const breakfast = mealTargets.breakfast;
    expect(breakfast.meal_ratio).toBe(0.25);
    expect(breakfast.kcal).toBe(570.5);
    expect(breakfast.protein_g).toBe(19.5);
  });
  it('男 health 晚餐：kcal=798.7、protein_g=27.3', () => {
    const { mealTargets } = calcTargets(profile({ goal: 'health' }));
    const dinner = mealTargets.dinner;
    expect(dinner.meal_ratio).toBe(0.35);
    expect(dinner.kcal).toBe(798.7);
    expect(dinner.protein_g).toBe(27.3);
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
  it('低代谢女性 lose：day_kcal 取地板值 1099 而非 1005', () => {
    // BMR=1047(女 42/150/30)，BMI=18.67（不低于 18.5，不触发降级），
    // TDEE×0.8≈1005，BMR×1.05≈1099 → 取 1099
    const { profile: p } = calcTargets(
      profile({ sex: 'female', height_cm: 150, weight_kg: 42, age: 30, activity: 'low', goal: 'lose' }),
    );
    expect(calcBMR('female', 42, 150, 30)).toBe(1047);
    expect(p.day_kcal).toBe(1099);
    expect(p.day_kcal).toBeGreaterThanOrEqual(Math.round(1047 * 1.05));
  });
});

describe('边界：未成年 + lose 强制降级 health', () => {
  it('age<18 且 goal=lose → health，并给出警告', () => {
    const { profile: p } = calcTargets(
      profile({ height_cm: 170, weight_kg: 60, age: 16, goal: 'lose' }),
    );
    expect(p.goal).toBe('health');
    expect(p.warnings).toContain('未满18岁不提供热量缺口方案，已调整为保持');
    // health 的 day_kcal = BMR×1.4 = 1588×1.4 = 2223
    expect(calcBMR('male', 60, 170, 16)).toBe(1588);
    expect(p.day_kcal).toBe(2223);
  });
});

describe('规则 G：BMI<18.5 + lose 强制降级 health', () => {
  it('BMI 18.4 且 goal=lose → health，并提示 BMI', () => {
    // 女 160/47.1/30 mid：BMI=18.4
    const { profile: p } = calcTargets(
      profile({ sex: 'female', height_cm: 160, weight_kg: 47.1, age: 30, goal: 'lose' }),
    );
    expect(p.bmi).toBe(18.4);
    expect(p.goal).toBe('health');
    expect(p.warnings).toContain('BMI 低于 18.5 不提供热量缺口方案，已调整为保持');
  });

  it('BMI 18.5（临界值）不降级', () => {
    // 女 160/47.36/30 mid：BMI=18.5
    const { profile: p } = calcTargets(
      profile({ sex: 'female', height_cm: 160, weight_kg: 47.36, age: 30, goal: 'lose' }),
    );
    expect(p.bmi).toBe(18.5);
    expect(p.goal).toBe('lose');
    expect(p.warnings).toEqual([]);
  });
});

describe('规则 H：BMI≥24 + gain 只提示不降级', () => {
  it('BMI 24.0 且 goal=gain → 保留 gain，并提示控制增重速度', () => {
    // 女 160/61.44/30 mid：BMI=24
    const { profile: p } = calcTargets(
      profile({ sex: 'female', height_cm: 160, weight_kg: 61.44, age: 30, goal: 'gain' }),
    );
    expect(p.bmi).toBe(24);
    expect(p.goal).toBe('gain');
    expect(p.warnings).toContain('当前 BMI 属超重/肥胖，增肌期建议优先增肌、控制增重速度');
  });

  it('BMI 23.9 且 goal=gain → 无警告', () => {
    const { profile: p } = calcTargets(
      profile({ sex: 'female', height_cm: 160, weight_kg: 61.18, age: 30, goal: 'gain' }),
    );
    expect(p.bmi).toBe(23.9);
    expect(p.warnings).toEqual([]);
  });
});

describe('resolveGoal 纯函数', () => {
  it('成年 lose、BMI 正常 → 不降级', () => {
    expect(resolveGoal('lose', 20, 21.97)).toEqual({ goal: 'lose', downgrade: null });
  });
  it('未成年 lose → 降级（即使 BMI 正常）', () => {
    expect(resolveGoal('lose', 16, 21.97)).toEqual({ goal: 'health', downgrade: 'minor' });
  });
  it('BMI<18.5 的成年 lose → 降级', () => {
    expect(resolveGoal('lose', 20, 17.8)).toEqual({ goal: 'health', downgrade: 'underweight' });
  });
  it('非 lose 目标不受 BMI 影响', () => {
    expect(resolveGoal('gain', 20, 25)).toEqual({ goal: 'gain', downgrade: null });
  });
});
