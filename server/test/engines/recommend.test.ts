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

/** 测试用菜品构造器（kcal / v3 字段可覆写，便于构造各 serving_mode 的真实化菜品池） */
function mk(
  id: string,
  name: string,
  category: Dish['category'],
  meals: Meal[],
  tags: Dish['tags'],
  kcal = 200,
  extra: Partial<Pick<Dish, 'serving_mode' | 'pricing_mode' | 'recommendable' | 'floor' | 'stall'>> = {},
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
    ...extra,
  };
}

describe('BMI ≥ 24 不推荐超出本餐热量（2026-11-25 用户决策）', () => {
  it('超重/肥胖时只返回 kcal ≤ 本餐目标的组合', () => {
    const target = { ...lunchTarget(), kcal: 700 };
    const { combos } = recommendCombos(DISHES, {
      meal: 'lunch',
      goal: 'health',
      avoidTags: [],
      target,
      bmi: 25,
    });
    expect(combos.length).toBe(3);
    for (const c of combos) {
      expect(c.totals.kcal).toBeLessThanOrEqual(700);
    }
  });

  it('所有组合都超目标时返回空 + 引导，不硬塞超热量套', () => {
    const target = { ...lunchTarget(), kcal: 500 };
    const { combos, notice } = recommendCombos(DISHES, {
      meal: 'lunch',
      goal: 'health',
      avoidTags: [],
      target,
      bmi: 29,
    });
    expect(combos).toEqual([]);
    expect(notice).toContain('不超过本餐热量');
  });

  it('BMI < 24 不受该上限影响（同一 500 kcal 目标仍有 3 套）', () => {
    const target = { ...lunchTarget(), kcal: 500 };
    const { combos } = recommendCombos(DISHES, {
      meal: 'lunch',
      goal: 'health',
      avoidTags: [],
      target,
      bmi: 23,
    });
    expect(combos.length).toBe(3);
  });
});

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

/* ==================== 菜单 v3 引擎四路分流（MENU-V3 §4.2 E1~E8） ==================== */

/** 一份「lunch 三件套池」+ single + plate + 不可推荐的干扰项，形态齐全 */
function v3Pool(): Dish[] {
  const trio: Dish[] = [
    mk('s1', '米饭', 'staple', ['lunch'], []),
    mk('s2', '馒头', 'staple', ['lunch'], []),
    mk('s3', '面条', 'staple', ['lunch'], []),
    mk('s4', '粉丝', 'staple', ['lunch'], []),
    mk('p1', '红烧肉', 'protein', ['lunch'], ['meat', 'pork']),
    mk('p2', '清蒸鱼', 'protein', ['lunch'], ['meat', 'seafood']),
    mk('p3', '鸡肉', 'protein', ['lunch'], []),
    mk('p4', '豆腐', 'protein', ['lunch'], ['vegprotein']),
    mk('v1', '青菜', 'veg', ['lunch'], []),
    mk('v2', '西兰花', 'veg', ['lunch'], []),
    mk('soup1', '番茄汤底', 'soup', ['lunch'], [], 120, { serving_mode: 'component' }),
    mk('soup2', '微辣汤底', 'soup', ['lunch'], ['spicy'], 190, { serving_mode: 'component' }),
  ];
  const singles: Dish[] = [
    mk('sg1', '牛肉面', 'staple', ['lunch'], ['meat', 'gluten'], 620, { serving_mode: 'single' }),
    mk('sg2', '盖浇饭', 'staple', ['lunch'], [], 700, { serving_mode: 'single' }),
    mk('sg3', '汉堡', 'protein', ['lunch'], ['meat'], 650, { serving_mode: 'single' }),
    mk('sg4', '烧饼', 'staple', ['lunch'], [], 380, { serving_mode: 'single' }),
  ];
  const plates: Dish[] = [
    mk('pl1', '自选青菜', 'veg', ['lunch'], [], 60, { serving_mode: 'plate', pricing_mode: 'weigh' }),
    mk('pl2', '自选肉', 'protein', ['lunch'], ['meat'], 200, { serving_mode: 'plate', pricing_mode: 'weigh' }),
  ];
  const excluded: Dish[] = [
    mk('no1', '不推荐主食', 'staple', ['lunch'], [], 100, { recommendable: false }),
    mk('no2', '不推荐成品', 'protein', ['lunch'], [], 900, { serving_mode: 'single', recommendable: false }),
  ];
  return [...trio, ...singles, ...plates, ...excluded];
}

describe('E1 候选池排除 recommendable=false', () => {
  it('不可推荐的菜（含 single）不出现在任何组合里', () => {
    const { combos } = recommendCombos(v3Pool(), {
      meal: 'lunch',
      goal: 'health',
      avoidTags: [],
      target: lunchTarget(),
    });
    const ids = combos.flatMap((c) => c.dishes.map((d) => d.id));
    expect(ids).not.toContain('no1');
    expect(ids).not.toContain('no2');
  });
});

describe('E2/E3 single 路与 combo 路结构', () => {
  it('single 路每套恰好 1 道菜、无双主食', () => {
    // 池里只放 single → 所有组合都来自 single 路
    const singleOnly = [
      mk('sg1', '牛肉面', 'staple', ['lunch'], [], 620, { serving_mode: 'single' }),
      mk('sg2', '盖浇饭', 'staple', ['lunch'], [], 700, { serving_mode: 'single' }),
      mk('sg3', '汉堡', 'protein', ['lunch'], [], 650, { serving_mode: 'single' }),
      mk('sg4', '烧饼', 'staple', ['lunch'], [], 380, { serving_mode: 'single' }),
    ];
    const { combos } = recommendCombos(singleOnly, {
      meal: 'lunch', goal: 'health', avoidTags: [], target: lunchTarget(),
    });
    expect(combos.length).toBe(3);
    for (const c of combos) {
      expect(c.dishes.length).toBe(1);
      expect(c.dishes.filter((d) => d.category === 'staple').length).toBeLessThanOrEqual(1);
    }
  });

  it('combo 路（缺省 serving_mode）仍含主食+主菜+素菜', () => {
    const comboOnly = v3Pool().filter((d) => d.serving_mode === undefined || d.serving_mode === 'component');
    const { combos } = recommendCombos(comboOnly, {
      meal: 'lunch', goal: 'health', avoidTags: [], target: lunchTarget(),
    });
    expect(combos.length).toBeGreaterThanOrEqual(1);
    for (const c of combos) {
      const cats = c.dishes.map((d) => d.category);
      expect(cats).toContain('staple');
      expect(cats).toContain('protein');
      expect(cats).toContain('veg');
    }
  });
});

describe('E5 plate 菜不进 combos', () => {
  it('plate 菜（自选称重线）从不出现在组合里', () => {
    const { combos } = recommendCombos(v3Pool(), {
      meal: 'lunch', goal: 'health', avoidTags: [], target: lunchTarget(),
    });
    const ids = combos.flatMap((c) => c.dishes.map((d) => d.id));
    expect(ids).not.toContain('pl1');
    expect(ids).not.toContain('pl2');
  });
});

describe('E4 忌口对四路都生效（组合生成前过滤）', () => {
  it('不吃辣时微辣汤底（component 路）不出现', () => {
    const { combos } = recommendCombos(v3Pool(), {
      meal: 'lunch', goal: 'health', avoidTags: ['spicy'], target: lunchTarget(),
    });
    const ids = combos.flatMap((c) => c.dishes.map((d) => d.id));
    expect(ids).not.toContain('soup2');
    expect(ids).toContain('soup1'); // 番茄汤底还在，不是整个档口被排除
  });

  it('不吃肉时 meat 菜（combo + single 两路）都不出现', () => {
    const { combos } = recommendCombos(v3Pool(), {
      meal: 'lunch', goal: 'health', avoidTags: ['meat'], target: lunchTarget(),
    });
    const ids = new Set(combos.flatMap((c) => c.dishes.map((d) => d.id)));
    for (const id of ['p1', 'p2', 'sg1', 'sg3', 'pl2']) expect(ids.has(id)).toBe(false);
  });
});

describe('称重菜评分放宽 + 文案提示（MENU-V3 §2.4⑤ / I5）', () => {
  it('含称重菜的组合 reason 带「份量以现场称重为准」', () => {
    const weighPool: Dish[] = [
      mk('ws1', '称重主食', 'staple', ['lunch'], [], 300, { pricing_mode: 'weigh' }),
      mk('wp1', '称重主菜', 'protein', ['lunch'], [], 400, { pricing_mode: 'weigh' }),
      mk('wv1', '称重素菜', 'veg', ['lunch'], [], 100, { pricing_mode: 'weigh' }),
      mk('fs1', '固定主食', 'staple', ['lunch'], [], 300),
      mk('fp1', '固定主菜', 'protein', ['lunch'], [], 400),
      mk('fv1', '固定素菜', 'veg', ['lunch'], [], 100),
    ];
    let sawWeighReason = false;
    for (let i = 0; i < 30; i++) {
      const { combos } = recommendCombos(weighPool, {
        meal: 'lunch', goal: 'health', avoidTags: [], target: lunchTarget(),
      });
      for (const c of combos) {
        if (c.reason.includes('称重')) sawWeighReason = true;
      }
    }
    expect(sawWeighReason).toBe(true);
  });

  it('称重组合热量罚放宽：偏离目标时仍能入选（不被固定组合完全压掉）', () => {
    // 称重三件套热量贴近目标；固定三件套也贴近——两者都应能出现（放宽后才不会被系统性淘汰）
    const pool: Dish[] = [
      mk('ws1', '称重主食', 'staple', ['lunch'], [], 380, { pricing_mode: 'weigh' }),
      mk('wp1', '称重主菜', 'protein', ['lunch'], [], 380, { pricing_mode: 'weigh' }),
      mk('wv1', '称重素菜', 'veg', ['lunch'], [], 148, { pricing_mode: 'weigh' }),
      mk('fs1', '固定主食', 'staple', ['lunch'], [], 200),
      mk('fp1', '固定主菜', 'protein', ['lunch'], [], 200),
      mk('fv1', '固定素菜', 'veg', ['lunch'], [], 200),
    ];
    const target = lunchTarget();
    const nearby = Math.round(target.kcal);
    // 构造贴近目标的称重组合
    pool[0].kcal = Math.round(nearby * 0.42);
    pool[1].kcal = Math.round(nearby * 0.42);
    pool[2].kcal = nearby - pool[0].kcal - pool[1].kcal;
    let weighCount = 0;
    for (let i = 0; i < 30; i++) {
      const { combos } = recommendCombos(pool, {
        meal: 'lunch', goal: 'health', avoidTags: [], target,
      });
      weighCount += combos.filter((c) => c.reason.includes('称重')).length;
    }
    expect(weighCount).toBeGreaterThan(0);
  });
});

describe('称重标记输出（PROGRESS §2.2 #7 / API.md v1.2.4 §2.3）', () => {
  it('含称重菜的组合 has_weighed_dish=true，且对应 dish 带 pricing_mode:"weigh"', () => {
    const pool: Dish[] = [
      mk('ws1', '称重主食', 'staple', ['lunch'], [], 300, { pricing_mode: 'weigh' }),
      mk('wp1', '称重主菜', 'protein', ['lunch'], [], 400, { pricing_mode: 'weigh' }),
      mk('wv1', '称重素菜', 'veg', ['lunch'], [], 100, { pricing_mode: 'weigh' }),
      mk('fs1', '固定主食', 'staple', ['lunch'], [], 300),
      mk('fp1', '固定主菜', 'protein', ['lunch'], [], 400),
      mk('fv1', '固定素菜', 'veg', ['lunch'], [], 100),
    ];
    let checked = 0;
    for (let i = 0; i < 30; i++) {
      const { combos } = recommendCombos(pool, {
        meal: 'lunch', goal: 'health', avoidTags: [], target: lunchTarget(),
      });
      for (const c of combos) {
        if (!c.has_weighed_dish) continue;
        checked++;
        expect(c.has_weighed_dish).toBe(true);
        // 组合级标记为真 ⇔ 至少有一道菜透传了 pricing_mode:'weigh'
        expect(c.dishes.some((d) => d.pricing_mode === 'weigh')).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('老种子（无 pricing_mode 字段）的组合不下发 pricing_mode 键、has_weighed_dish=false', () => {
    // mk() 不传 extra 即无 pricing_mode 键——等价于 55 道原型种子的菜
    const pool: Dish[] = [
      mk('fs1', '固定主食', 'staple', ['lunch'], [], 300),
      mk('fp1', '固定主菜', 'protein', ['lunch'], [], 400),
      mk('fv1', '固定素菜', 'veg', ['lunch'], [], 100),
      mk('fs2', '固定主食2', 'staple', ['lunch'], [], 320),
      mk('fp2', '固定主菜2', 'protein', ['lunch'], [], 380),
      mk('fv2', '固定素菜2', 'veg', ['lunch'], [], 120),
    ];
    expect(pool.some((d) => 'pricing_mode' in d)).toBe(false);

    const { combos } = recommendCombos(pool, {
      meal: 'lunch', goal: 'health', avoidTags: [], target: lunchTarget(),
    });
    expect(combos.length).toBeGreaterThan(0);
    for (const c of combos) {
      expect(c.has_weighed_dish).toBe(false);
      for (const d of c.dishes) {
        expect('pricing_mode' in d).toBe(false);
      }
    }
  });
});

describe('P2-1 单菜补位质量（UI 走查 2026-11-22）', () => {
  it('有正餐组合时，纯 single 单菜不被拉来凑第 2/3 套', () => {
    const target = lunchTarget('lose');
    const near = Math.round(target.kcal);
    const pool: Dish[] = [
      // 套餐路：3 个不同主食的三件套，贴合目标
      mk('cs1', '米饭', 'staple', ['lunch'], [], Math.round(near * 0.4)),
      mk('cp1', '鸡肉', 'protein', ['lunch'], [], Math.round(near * 0.4)),
      mk('cv1', '青菜', 'veg', ['lunch'], [], near - Math.round(near * 0.4) * 2),
      mk('cs2', '馒头', 'staple', ['lunch'], [], Math.round(near * 0.4)),
      mk('cp2', '鱼肉', 'protein', ['lunch'], [], Math.round(near * 0.4)),
      mk('cv2', '西兰花', 'veg', ['lunch'], [], near - Math.round(near * 0.4) * 2),
      mk('cs3', '面条', 'staple', ['lunch'], [], Math.round(near * 0.4)),
      mk('cp3', '虾仁', 'protein', ['lunch'], ['seafood'], Math.round(near * 0.4)),
      mk('cv3', '菠菜', 'veg', ['lunch'], [], near - Math.round(near * 0.4) * 2),
      // single 路：严重偏离目标（口水鸡 260 / 卤蛋 70 之类的补位菜）
      mk('chick', '招牌口水鸡', 'protein', ['lunch'], ['meat'], 260, { serving_mode: 'single' }),
      mk('egg', '卤蛋', 'protein', ['lunch'], [], 70, { serving_mode: 'single' }),
    ];
    for (let i = 0; i < 30; i++) {
      const { combos, notice } = recommendCombos(pool, {
        meal: 'lunch', goal: 'lose', avoidTags: [], target,
      });
      expect(combos.length).toBe(3);
      // 3 套都必须来自套餐路（含主食），单菜补位不出现
      for (const c of combos) {
        expect(c.dishes.map((d) => d.id)).not.toContain('chick');
        expect(c.dishes.map((d) => d.id)).not.toContain('egg');
        expect(c.reason).not.toContain('单点/加餐参考');
      }
      expect(notice).toBeNull();
    }
  });

  it('池子只剩严重偏离的单菜时，仍出组合但 reason + notice 标明「单点/加餐参考」', () => {
    const target = lunchTarget('lose');
    const pool: Dish[] = [
      mk('chick', '招牌口水鸡', 'protein', ['lunch'], ['meat'], 260, { serving_mode: 'single' }),
      mk('egg', '卤蛋', 'protein', ['lunch'], [], 70, { serving_mode: 'single' }),
      mk('tofu', '豆腐脑', 'protein', ['lunch'], [], 180, { serving_mode: 'single' }),
    ];
    const { combos, notice } = recommendCombos(pool, {
      meal: 'lunch', goal: 'lose', avoidTags: [], target,
    });
    expect(combos.length).toBe(3);
    for (const c of combos) {
      expect(c.dishes.length).toBe(1);
      expect(c.reason).toContain('单点/加餐参考');
    }
    expect(notice).toContain('单菜补位');
    expect(notice).toContain('单点/加餐参考');
  });
});

describe('E6/E7 四路混合下的套数与贴合度仍成立', () => {
  it('四路混合池 30 次抽样恒 3 套，且至少一套非称重偏离 ≤10%', () => {
    const target = lunchTarget('health');
    const near = Math.round(target.kcal);
    const pool: Dish[] = [
      // 一套精准贴合的 combo 三件套（非称重）
      mk('cs1', '米饭', 'staple', ['lunch'], [], Math.round(near * 0.4)),
      mk('cp1', '鸡肉', 'protein', ['lunch'], [], Math.round(near * 0.4)),
      mk('cv1', '青菜', 'veg', ['lunch'], [], near - Math.round(near * 0.4) * 2),
      mk('cs2', '馒头', 'staple', ['lunch'], [], 250),
      mk('cs3', '面条', 'staple', ['lunch'], [], 250),
      mk('cp2', '鱼肉', 'protein', ['lunch'], [], 250),
      mk('cv2', '西兰花', 'veg', ['lunch'], [], 250),
      // single 路
      mk('sg1', '牛肉面', 'staple', ['lunch'], [], 500, { serving_mode: 'single' }),
      mk('sg2', '盖浇饭', 'staple', ['lunch'], [], 560, { serving_mode: 'single' }),
      // plate 路（不应出现）
      mk('pl1', '自选菜', 'veg', ['lunch'], [], 100, { serving_mode: 'plate', pricing_mode: 'weigh' }),
    ];
    for (let i = 0; i < 30; i++) {
      const { combos } = recommendCombos(pool, {
        meal: 'lunch', goal: 'health', avoidTags: [], target,
      });
      expect(combos.length).toBe(3);
      for (const c of combos) {
        expect(c.dishes.map((d) => d.id)).not.toContain('pl1');
      }
      const minDev = Math.min(
        ...combos
          .filter((c) => !c.reason.includes('称重'))
          .map((c) => Math.abs(c.totals.kcal - target.kcal) / target.kcal),
      );
      expect(minDev).toBeLessThanOrEqual(0.1);
    }
  });
});
