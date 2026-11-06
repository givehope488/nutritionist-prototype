import { describe, expect, it } from 'vitest';
import { recommendCombos } from '../../src/engines/recommend';
import { calcTargets } from '../../src/engines/nutrition';
import type { Dish, Goal, Meal, MealTarget } from '@canteen/shared';

/**
 * 推荐引擎测试（BE-A 验收：PROGRESS §2.2 #2）。
 *
 * 这里是**纯函数单测**：不依赖 SQLite 种子库，用内存构造的菜品池覆盖
 * 午/早结构、忌口过滤、无解处理。真实种子库（55 道）的端到端覆盖由
 * server/test/user-endpoints.test.ts 在 HTTP 层负责。
 *
 * 按附录 B 评分；每次返回 1~3 套，同响应内主食互不相同、主菜不重复；
 * 忌口无解返空数组 + notice。
 */

/** 自包含菜品池：覆盖 lunch / breakfast 各餐段的类目与标签 */
const DISHES: Dish[] = [
  // —— 午餐 ——
  mk('s_l1', '米饭', 'staple', ['lunch'], []),
  mk('s_l2', '馒头', 'staple', ['lunch'], []),
  mk('p_l1', '红烧肉', 'protein', ['lunch'], ['meat', 'pork']),
  mk('p_l2', '清蒸鱼', 'protein', ['lunch'], ['meat', 'seafood']),
  mk('v_l1', '青菜', 'veg', ['lunch'], []),
  mk('v_l2', '番茄炒蛋', 'veg', ['lunch'], ['egg']),
  mk('so_l1', '紫菜汤', 'soup', ['lunch'], []),
  // —— 早餐 ——
  mk('s_b1', '粥', 'staple', ['breakfast'], []),
  mk('s_b2', '面包', 'staple', ['breakfast'], ['gluten']),
  mk('p_b1', '煎蛋', 'protein', ['breakfast'], ['egg']),
  mk('p_b2', '牛奶', 'protein', ['breakfast'], ['milk']),
  mk('f_b1', '苹果', 'fruit', ['breakfast'], []),
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
  it('午餐 = 主食 × 主菜 × 素菜（汤可选），返回 1~3 套', () => {
    const { combos } = recommendCombos(DISHES, {
      meal: 'lunch',
      goal: 'health',
      avoidTags: [],
      target: lunchTarget(),
    });
    expect(combos.length).toBeGreaterThanOrEqual(1);
    expect(combos.length).toBeLessThanOrEqual(3);
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
    expect(combos.length).toBeGreaterThanOrEqual(1);
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
    for (const c of combos) {
      for (const d of c.dishes) {
        expect(d.tags).not.toContain('meat');
      }
    }
  });
});

/** 测试用菜品构造器 */
function mk(
  id: string,
  name: string,
  category: Dish['category'],
  meals: Meal[],
  tags: Dish['tags'],
): Dish {
  return {
    id,
    name,
    category,
    portion_label: '1 份',
    meals,
    kcal: 200,
    protein_g: 10,
    fat_g: 5,
    carbs_g: 30,
    sodium_mg: 100,
    price_yuan: 2,
    tags,
    drink: false,
    reliability: 'B',
    status: 'active',
  };
}
