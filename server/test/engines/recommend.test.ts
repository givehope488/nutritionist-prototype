import { describe, expect, it } from 'vitest';
import { recommendCombos, sodiumPenalty } from '../../src/engines/recommend';
import { calcTargets } from '../../src/engines/nutrition';
import type { Dish, Goal, Meal, MealTarget } from '@canteen/shared';

/**
 * 推荐引擎测试（BE-A 验收：PROGRESS §2.2 #2）。
 *
 * 这里是**纯函数单测**：不依赖 SQLite 种子库，用内存构造的菜品池覆盖
 * 午/早结构、忌口过滤、无解处理。真实种子库（55 道）的端到端覆盖由
 * server/test/user-endpoints.test.ts 在 HTTP 层负责。
 *
 * 按附录 B 评分；每次返回 3 套（#27 套数坍缩修复后），同响应内主食互不相同、主菜不重复；
 * 忌口无解返空数组 + notice。
 */

/** 自包含菜品池：覆盖 lunch / breakfast 各餐段，且每餐 ≥3 主食 / ≥3 主菜，保证可凑满 3 套 */
const DISHES: Dish[] = [
  // —— 午餐 ——（≥3 主食 / ≥3 主菜 / ≥3 素菜）
  mk('s_l1', '米饭', 'staple', ['lunch'], []),
  mk('s_l2', '馒头', 'staple', ['lunch'], []),
  mk('s_l3', '面条', 'staple', ['lunch'], []),
  mk('p_l1', '红烧肉', 'protein', ['lunch'], ['meat', 'pork']),
  mk('p_l2', '清蒸鱼', 'protein', ['lunch'], ['meat', 'seafood']),
  mk('p_l3', '鸡肉', 'protein', ['lunch'], []),
  mk('v_l1', '青菜', 'veg', ['lunch'], []),
  mk('v_l2', '番茄炒蛋', 'veg', ['lunch'], ['egg']),
  mk('v_l3', '西兰花', 'veg', ['lunch'], []),
  mk('so_l1', '紫菜汤', 'soup', ['lunch'], []),
  // —— 早餐 ——（≥3 主食 / ≥3 主菜 / ≥2 水果，无素菜无汤）
  mk('s_b1', '粥', 'staple', ['breakfast'], []),
  mk('s_b2', '面包', 'staple', ['breakfast'], ['gluten']),
  mk('s_b3', '包子', 'staple', ['breakfast'], []),
  mk('p_b1', '煎蛋', 'protein', ['breakfast'], ['egg']),
  mk('p_b2', '牛奶', 'protein', ['breakfast'], ['milk']),
  mk('p_b3', '酸奶', 'protein', ['breakfast'], []),
  mk('f_b1', '苹果', 'fruit', ['breakfast'], []),
  mk('f_b2', '香蕉', 'fruit', ['breakfast'], []),
];

function lunchTarget(goal: Goal = 'health'): MealTarget {
  const { mealTargets } = calcTargets({
    session_id: 's',
    sex: 'male',
    height_cm: 172,
    weight_kg: 65,
    age: 20,
    activity: 'mid',
    goal,
    avoid: [],
    default_meal: 'lunch',
  });
  return mealTargets.lunch;
}

describe('推荐组合结构（§4.1-E）', () => {
  it('午餐 = 主食 × 主菜 × 素菜（汤可选），返回 3 套', () => {
    const { combos } = recommendCombos(DISHES, {
      meal: 'lunch',
      goal: 'health',
      avoidTags: [],
      target: lunchTarget(),
    });
    expect(combos.length).toBe(3);
    for (const c of combos) {
      const cats = c.dishes.map((d) => d.category);
      expect(cats).toContain('staple');
      expect(cats).toContain('protein');
      expect(cats).toContain('veg');
    }
  });

  it('早餐 = 主食 × 主菜（不要求素菜/汤），能产出组合且不含素菜', () => {
    const { combos } = recommendCombos(DISHES, {
      meal: 'breakfast',
      goal: 'health',
      avoidTags: [],
      target: lunchTarget(),
    });
    expect(combos.length).toBe(3);
    for (const c of combos) {
      const cats = c.dishes.map((d) => d.category);
      expect(cats).toContain('staple');
      expect(cats).toContain('protein');
      expect(cats).not.toContain('veg');
    }
  });

  it('同一次响应内：主食互不相同、主菜不重复', () => {
    const { combos } = recommendCombos(DISHES, {
      meal: 'lunch',
      goal: 'health',
      avoidTags: [],
      target: lunchTarget(),
    });
    const staples = combos.map((c) => c.dishes.find((d) => d.category === 'staple')?.id);
    const proteins = combos.map((c) => c.dishes.find((d) => d.category === 'protein')?.id);
    expect(new Set(staples).size).toBe(staples.length);
    expect(new Set(proteins).size).toBe(proteins.length);
  });
});

describe('忌口过滤与无解处理', () => {
  it('无解时返回空数组 + notice', () => {
    // 只有「主食 + 素菜」、没有主菜的池子 → 午餐（要求主菜）无解
    const fake: Dish[] = [
      mk('s1', '饭', 'staple', ['lunch'], []),
      mk('v1', '菜', 'veg', ['lunch'], []),
    ];
    const { combos, notice } = recommendCombos(fake, {
      meal: 'lunch',
      goal: 'health',
      avoidTags: [],
      target: lunchTarget(),
    });
    expect(combos).toEqual([]);
    expect(notice).not.toBeNull();
  });

  it('忌口排除 meat 后，含 meat 标签的菜不出现', () => {
    const { combos } = recommendCombos(DISHES, {
      meal: 'lunch',
      goal: 'health',
      avoidTags: ['meat'],
      target: lunchTarget(),
    });
    const forbiddenIds = new Set(
      DISHES.filter((d) => d.tags.includes('meat')).map((d) => d.id),
    );
    expect(forbiddenIds.size).toBeGreaterThan(0);
    for (const c of combos) {
      for (const d of c.dishes) {
        expect(forbiddenIds.has(d.id)).toBe(false);
      }
    }
  });
});

describe('套数坍缩修复（PROGRESS §2.2 #4 验收）', () => {
  it('早餐 / 午餐各抽 30 次，每次都返回 3 套', () => {
    for (let i = 0; i < 30; i++) {
      const lunch = recommendCombos(DISHES, {
        meal: 'lunch',
        goal: 'health',
        avoidTags: [],
        target: lunchTarget(),
      });
      expect(lunch.combos.length).toBe(3);
      const brk = recommendCombos(DISHES, {
        meal: 'breakfast',
        goal: 'health',
        avoidTags: [],
        target: lunchTarget(),
      });
      expect(brk.combos.length).toBe(3);
    }
  });
});

describe('贴合度退步修复（PROGRESS §2.2 #4 验收）', () => {
  it('三套里至少一套热量偏离目标 ≤10%', () => {
    const target = lunchTarget('health');
    const near = Math.round(target.kcal);
    const a = Math.round(near * 0.4);
    const b = Math.round(near * 0.4);
    const c = near - a - b; // a + b + c 恰好等于目标热量
    const pool: Dish[] = [
      mk('rs1', '米饭', 'staple', ['lunch'], [], a),
      mk('rs2', '馒头', 'staple', ['lunch'], [], 200),
      mk('rs3', '面条', 'staple', ['lunch'], [], 200),
      mk('rp1', '红烧肉', 'protein', ['lunch'], ['meat'], b),
      mk('rp2', '清蒸鱼', 'protein', ['lunch'], ['meat'], 200),
      mk('rp3', '鸡肉', 'protein', ['lunch'], [], 200),
      mk('rv1', '青菜', 'veg', ['lunch'], [], c),
      mk('rv2', '番茄炒蛋', 'veg', ['lunch'], ['egg'], 200),
    ];
    const { combos } = recommendCombos(pool, {
      meal: 'lunch',
      goal: 'health',
      avoidTags: [],
      target,
    });
    expect(combos.length).toBe(3);
    const minDev = Math.min(
      ...combos.map((x) => Math.abs(x.totals.kcal - target.kcal) / target.kcal),
    );
    expect(minDev).toBeLessThanOrEqual(0.1);
  });
});

/** 测试用菜品构造器（kcal 可覆写，便于构造「恰好命中目标」的真实化菜品池） */
function mk(
  id: string,
  name: string,
  category: Dish['category'],
  meals: Meal[],
  tags: Dish['tags'],
  kcal = 200,
): Dish {
  return {
    id,
    name,
    category,
    portion_label: '1 份',
    meals,
    kcal,
    protein_g: 10,
    fat_g: 5,
    carbs_g: 30,
    sodium_mg: 100,
    tags,
    drink: false,
    reliability: 'B',
    status: 'active',
  };
}

describe('钠罚分（v1.2.3 分段系数）', () => {
  it('Na=2150 → 52.5', () => {
    expect(sodiumPenalty(2150)).toBeCloseTo(52.5, 5);
  });
  it('Na=1600 → 0', () => {
    expect(sodiumPenalty(1600)).toBe(0);
  });
  it('Na=1900 → 15', () => {
    expect(sodiumPenalty(1900)).toBeCloseTo(15, 5);
  });
  it('Na=601 → 0（达标不罚）', () => {
    expect(sodiumPenalty(601)).toBe(0);
  });
});
