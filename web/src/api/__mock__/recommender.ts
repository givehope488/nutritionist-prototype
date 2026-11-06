// 推荐引擎替身（真实实现在 server/src/engines/recommender.ts，属 BE-A）。
// 这里按 API.md §2.3 的响应形态 + 附录 B 权重的简化版本产出可演示组合，
// 目标只有两个：字段齐、组合合理，让 FE-B/FE-A 能脱离后端开发。评分口径以 BE-A 实装为准。
import type { Dish, DishTag, MealTarget, MealType, RecommendRequest } from '@shared/types';
import { activeDishes, comboIdOf, type CachedCombo } from './db';
import { AVOID_TAG_MAP } from './avoidOptions';
import { sumNutrition, scale } from './nutrition';

const MAX_COMBOS = 3;

export interface ScoredCombo {
  dish_ids: string[];
  totals: ReturnType<typeof sumNutrition>;
}

/** 忌口硬过滤：AvoidOption.excludes_tag 命中即剔除（API.md §2.1） */
export function filterAvoid(dishes: Dish[], avoidKeys: string[]): Dish[] {
  const banned = new Set<DishTag>();
  for (const key of avoidKeys) {
    const tag = AVOID_TAG_MAP[key];
    if (tag) banned.add(tag);
  }
  if (banned.size === 0) return dishes;
  return dishes.filter((dish) => !dish.tags.some((tag) => banned.has(tag)));
}

interface Pool {
  staple: Dish[];
  protein: Dish[];
  veg: Dish[];
  soup: Dish[];
  fruit: Dish[];
}

function pickPool(meal: MealType, avoid: string[]): Pool {
  const dishes = filterAvoid(activeDishes(meal), avoid);
  const group = (category: Dish['category']) => dishes.filter((dish) => dish.category === category);
  return {
    staple: group('staple'),
    protein: group('protein'),
    veg: group('veg'),
    soup: group('soup'),
    fruit: group('fruit'),
  };
}

/** 餐次结构：早/午晚不同（ARCHITECTURE.md §3.b） */
function enumerate(pool: Pool, meal: MealType): Dish[][] {
  const sets: Dish[][] = [];
  const staples = pool.staple.length ? pool.staple : [undefined];
  const mains = pool.protein.length ? pool.protein : [undefined];
  const sides = meal === 'breakfast' ? pool.fruit : pool.veg;
  const sideList = sides.length ? sides : [undefined];

  for (const staple of staples) {
    if (!staple) continue;
    for (const main of mains) {
      if (!main) continue;
      for (const side of sideList) {
        const combo = [staple, main, side].filter(Boolean) as Dish[];
        if (combo.length < 2) continue;
        sets.push(combo);
        if (meal !== 'breakfast' && pool.soup.length > 0) {
          for (const soup of pool.soup) sets.push([...combo, soup]);
        }
      }
    }
  }
  return sets;
}

function fatEnergyRatio(dishes: Dish[]): number {
  const kcal = dishes.reduce((sum, dish) => sum + dish.kcal, 0);
  const fatKcal = dishes.reduce((sum, dish) => sum + dish.fat_g * 9, 0);
  return kcal > 0 ? fatKcal / kcal : 0;
}

/** 附录 B 权重的简化转写：偏离越小、蛋白越够、脂肪占比越合理，得分越高 */
export function scoreCombo(dishes: Dish[], target: MealTarget, goal: string): number {
  const totals = sumNutrition(dishes.map((dish) => scale(dish, 1)));
  let score = 1000;
  const deviation = Math.abs(totals.kcal - target.kcal) / target.kcal;
  score -= deviation * 120;
  if ((goal === 'health' || goal === 'gain') && totals.kcal < target.kcal * 0.85) {
    score -= (1 - totals.kcal / target.kcal) * 140;
  }
  if (totals.protein_g < target.protein_g) {
    score -= ((target.protein_g - totals.protein_g) / target.protein_g) * 45;
  } else if (totals.protein_g > target.protein_g * 1.6) {
    score -= ((totals.protein_g - target.protein_g * 1.6) / target.protein_g) * 35;
  }
  const fatRatio = fatEnergyRatio(dishes);
  if (fatRatio > 0.42) score -= 200;
  else if (fatRatio < 0.15) score -= 100;
  if (totals.sodium_mg > target.sodium_mg) {
    score -= (totals.sodium_mg - target.sodium_mg) / 100;
  }
  if (dishes.some((dish) => dish.category === 'veg' || dish.category === 'fruit')) score += 7;
  if (goal === 'lose' && fatRatio < 0.32) score += 6;
  if (goal === 'gain' && totals.protein_g >= target.protein_g) score += 9;
  return score;
}

export function buildCombos(
  request: Pick<RecommendRequest, 'meal'> & { goal: string },
  avoid: string[],
  target: MealTarget,
): ScoredCombo[] {
  const pool = pickPool(request.meal, avoid);
  const ranked = enumerate(pool, request.meal)
    .map((dishes) => ({
      dish_ids: dishes.map((dish) => dish.id),
      totals: sumNutrition(dishes.map((dish) => scale(dish, 1))),
      score: scoreCombo(dishes, target, request.goal),
    }))
    .sort((a, b) => b.score - a.score);

  // 取 3 套：主菜组合不重复、主食互不相同；池不足时按「主食 → 主菜」顺序放宽（API.md §2.3）
  const picked: ScoredCombo[] = [];
  const taken = new Set<string>();
  const pass = (requireDistinctStaple: boolean, requireDistinctMain: boolean) => {
    const seenStaples = new Set<string>();
    const seenMains = new Set<string>();
    for (const item of ranked) {
      if (picked.length >= MAX_COMBOS) return;
      if (taken.has(item.dish_ids.join(','))) continue;
      const [staple, main] = item.dish_ids;
      if (requireDistinctStaple && staple !== undefined && seenStaples.has(staple)) continue;
      if (requireDistinctMain && main !== undefined && seenMains.has(main)) continue;
      picked.push(item);
      taken.add(item.dish_ids.join(','));
      if (staple !== undefined) seenStaples.add(staple);
      if (main !== undefined) seenMains.add(main);
    }
  };
  pass(true, true);
  pass(true, false);
  pass(false, false);
  return picked;
}

/** template 引擎理由文案：不产生输入之外的数字（ARCHITECTURE.md §4） */
export function reasonTemplate(
  combo: ScoredCombo,
  target: MealTarget,
  names: string[],
  meal: MealType,
): string {
  const mealLabel = meal === 'breakfast' ? '早餐' : meal === 'lunch' ? '午餐' : '晚餐';
  const diff = combo.totals.kcal - target.kcal;
  const kcalLine =
    Math.abs(diff) <= target.kcal * 0.08
      ? `这一餐约 ${combo.totals.kcal} kcal，和${mealLabel}目标 ${target.kcal} kcal 基本贴合`
      : diff > 0
        ? `这一餐约 ${combo.totals.kcal} kcal，比${mealLabel}目标 ${target.kcal} kcal 多了 ${diff} kcal`
        : `这一餐约 ${combo.totals.kcal} kcal，比${mealLabel}目标 ${target.kcal} kcal 少了 ${-diff} kcal`;
  const proteinLine =
    combo.totals.protein_g >= target.protein_g
      ? `蛋白质 ${combo.totals.protein_g} g 达到本餐目标 ${target.protein_g} g`
      : `蛋白质 ${combo.totals.protein_g} g，略低于本餐目标 ${target.protein_g} g`;
  const sodiumLine =
    combo.totals.sodium_mg > target.sodium_mg
      ? `钠 ${combo.totals.sodium_mg} mg 偏高，汤和菜少要一点汁`
      : `钠 ${combo.totals.sodium_mg} mg 在参考线内`;
  return `${kcalLine}；${proteinLine}；${sodiumLine}。搭配为${names.join('、')}。`;
}

export function comboToCached(
  sessionId: string,
  meal: MealType,
  combo: ScoredCombo,
): CachedCombo {
  return {
    combo_id: comboIdOf(combo.dish_ids),
    session_id: sessionId,
    meal,
    dish_ids: combo.dish_ids,
    created_at: Date.now(),
  };
}
