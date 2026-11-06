import { createHash } from 'node:crypto';
import type {
  Combo,
  ComboDish,
  Dish,
  DishTag,
  Meal,
  NutritionTotals,
} from '@canteen/shared';
import { AVOID_OPTIONS } from './avoid-options';
import { getDishesByMeal } from './dishes';

/**
 * 推荐组合的套数上限（API.md §2.3：固定最多 3 套）。
 * 只属于推荐层的实现常量，不进 shared —— 那不是契约字段。
 */
const MAX_COMBOS = 3;

/**
 * 每次请求换一个起点，让「换一批」真的能换出不同的组合。
 *
 * 依据 docs/PROGRESS.md §4.1-A：换一批不加参数，前端再调一次
 * `POST /recommendations`，服务端在候选里重抽。真实实现由引擎按评分排序后重抽，
 * Mock 阶段用轮转偏移模拟（同一个菜品池、不同起点）。
 */
let requestCounter = 0;

const AVOID_TO_TAG = new Map<string, DishTag>(
  AVOID_OPTIONS.map((option) => [option.key, option.excludes_tag]),
);

function excludedTags(avoid: readonly string[]): Set<DishTag> {
  const tags = new Set<DishTag>();
  for (const key of avoid) {
    const tag = AVOID_TO_TAG.get(key);
    if (tag !== undefined) tags.add(tag);
  }
  return tags;
}

function toComboDish(dish: Dish): ComboDish {
  return {
    id: dish.id,
    name: dish.name,
    category: dish.category,
    portion_label: dish.portion_label,
    servings: 1,
    kcal: dish.kcal,
    protein_g: dish.protein_g,
    fat_g: dish.fat_g,
    carbs_g: dish.carbs_g,
    sodium_mg: dish.sodium_mg,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function sumTotals(dishes: ComboDish[]): NutritionTotals {
  let kcal = 0;
  let protein = 0;
  let fat = 0;
  let carbs = 0;
  let sodium = 0;
  for (const dish of dishes) {
    kcal += dish.kcal;
    protein += dish.protein_g;
    fat += dish.fat_g;
    carbs += dish.carbs_g;
    sodium += dish.sodium_mg;
  }
  return {
    kcal: Math.round(kcal),
    protein_g: round1(protein),
    fat_g: round1(fat),
    carbs_g: round1(carbs),
    sodium_mg: Math.round(sodium),
  };
}

function hashCombo(dishes: ComboDish[]): string {
  return createHash('sha1')
    .update(dishes.map((dish) => dish.id).join('|'))
    .digest('hex')
    .slice(0, 8);
}

export interface MockRecommendation {
  combos: Combo[];
  notice: string | null;
}

/**
 * 确定性假推荐：按份轮流取菜，凑 3 套。
 *
 * 组合结构按 API v1.2.2 的类目规则（此前文档没定义，引擎各写各的）：
 *   - lunch / dinner：主食 × 主菜 × 素菜，**汤是可选件**，不进必备件
 *   - breakfast：主食 × 主菜，**不要求素菜、不要求汤**，水果可选
 *   （依据：55 道种子中早餐 14 道，素菜 0、汤 0，沿用午晚规则会恒为 0 套）
 *
 * 刻意不做的事（留给 BE-A 的引擎）：
 *   - 不按热量/蛋白打分排序
 *   - 不做「两阶段补小荤」
 *   - 不计算 target
 */
export function buildMockRecommendation(meal: Meal, avoid: readonly string[]): MockRecommendation {
  const excluded = excludedTags(avoid);
  const pool = getDishesByMeal(meal, false).filter(
    (dish) => !dish.tags.some((tag) => excluded.has(tag)),
  );

  const staples = pool.filter((dish) => dish.category === 'staple');
  const mains = pool.filter((dish) => dish.category === 'protein');
  const greens = pool.filter((dish) => dish.category === 'veg');
  const fruits = pool.filter((dish) => dish.category === 'fruit');

  // 早餐的素菜不是必备件（API v1.2.2），其余餐段必须有素菜才成组
  const needsVeg = meal !== 'breakfast';

  if (staples.length === 0 || mains.length === 0 || (needsVeg && greens.length === 0)) {
    return {
      combos: [],
      notice: '符合忌口条件的菜品太少，建议放宽一两个限制或换个时段',
    };
  }

  const combos: Combo[] = [];
  const offset = requestCounter++;
  for (let index = 0; index < MAX_COMBOS; index++) {
    const staple = staples[(index + offset) % staples.length];
    const main = mains[(index * 2 + 1 + offset) % mains.length];
    if (staple === undefined || main === undefined) continue;

    const dishes = [toComboDish(staple), toComboDish(main)];

    if (needsVeg) {
      const green = greens[(index + offset) % greens.length];
      if (green === undefined) continue;
      dishes.push(toComboDish(green));
    } else if (fruits.length > 0) {
      // 水果是可选件：有就加一份，没有也成组
      const fruit = fruits[(index + offset) % fruits.length];
      if (fruit !== undefined) dishes.push(toComboDish(fruit));
    }

    const totals = sumTotals(dishes);
    const names = dishes.map((dish) => dish.name).join('、');
    combos.push({
      id: hashCombo(dishes),
      dishes,
      totals,
      // 理由只引用已经算出的合计值，不引入新数字（ARCHITECTURE §4 的硬约束）
      reason: `这一餐约 ${totals.kcal} kcal，蛋白质 ${totals.protein_g}g、脂肪 ${totals.fat_g}g；由${names}搭配而成。`,
      engine: 'template',
    });
  }

  const unique = new Map(combos.map((combo) => [combo.id, combo]));
  return { combos: [...unique.values()].slice(0, MAX_COMBOS), notice: null };
}
