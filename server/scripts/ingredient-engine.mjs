// 配料反推引擎
//
// 2026-11-15 起，v3 的每一道菜都要有独立的配料依据（PROGRESS §2.2 PD 第 1 项）。
// 做法：菜名 → 配方（ingredient-library.mjs 的 FOOD 营养值 + recipes.mjs 的配比）
//       → 按菜品标注的热量做一次整体校准 → 输出 {name, grams, source}
//
// 三条原则：
//   1. **配料要具体**：写「猪里脊 80g」而不是「肉 若干」——忌口过滤与数据追溯都靠它
//   2. **加总要自洽**：各配料热量之和与菜品标注 kcal 的偏差控制在 ±8% 内，
//      否则说明配方与标注对不上，引擎会把这个比例记进复核清单
//   3. **兜底要露出来**：配不出来的走品类兜底，并在复核清单里点名，不藏

import { RECIPE } from './recipes.mjs';
import { foodOf } from './ingredient-library.mjs';

/** 配方键归一：只去括号内容与分隔符。
 *  注意**不删**「份/个/根/碗/只/串/片/块/粉/丝」——这些字是配方键的一部分
 *  （「白米饭」与「白米」是两道不同的菜）。 */
export const recipeKey = (s) =>
  String(s)
    .replace(/[（(]([^)）]*)[)）]/g, '$1')
    .replace(/[\s·、,，/／&+]/g, '')
    .replace(/[×xX]\d+$/g, '')
    .replace(/（\d+）|\(\d+\)/g, '')
    // 末尾的份数后缀（「鸡肉串（30串）」→「鸡肉串」）
    .replace(/\d+(串|个|只|块|片|根|份|克|g)$/i, '');

/** 主食基底的配料 */
export const BASE_INGREDIENTS = {
  rice: [['米饭', 200]],
  noodle: [['面条', 250]],
  noodle_soup: [['面条', 250], ['高汤', 200], ['葱', 6]],
  noodle_oil: [['面条', 250], ['植物油', 18], ['辣椒', 6], ['葱', 10]],
  rice_noodle: [['米粉', 200]],
};

/** 品类兜底配比（只在配不出具体配方时用，会进复核清单） */
const CATEGORY_FALLBACK = {
  staple: [['米饭', 200]],
  protein: [['猪里脊', 100], ['植物油', 10]],
  veg: [['小白菜', 180], ['植物油', 10]],
  soup: [['高汤', 250], ['盐', 2]],
  fruit: [['苹果', 150]],
};

/** 菜名里的前缀修饰（「小馆招牌牛肉面」→「招牌牛肉面」） */
const PREFIX = /^(小馆|招牌|金牌|秘制|特色|经典|正宗|老|传统|秘制)/;

/** 组合菜拆解：返回主食基底 + 浇头键名列表 */
function parseComboParts(name) {
  let baseKey = null;
  if (/盖浇饭|盖饭/.test(name)) baseKey = 'rice';
  else if (/拌粉/.test(name)) baseKey = 'rice_noodle';
  else if (/拌面/.test(name)) baseKey = 'noodle';
  else if (/汤面|汤粉/.test(name)) baseKey = 'noodle_soup';
  else if (/油泼面/.test(name)) baseKey = 'noodle_oil';
  else if (/面$/.test(name)) baseKey = 'noodle_soup';
  else if (/饭/.test(name)) baseKey = 'rice';
  if (!baseKey) return null;

  const rest = name
    .replace(/盖浇饭|盖饭/g, '')
    .replace(/拌面|拌粉/g, '')
    .replace(/汤面|汤粉/g, '')
    .replace(/油泼面/g, '')
    .replace(/饭/g, '')
    .replace(/面/g, '')
    .replace(/粉/g, '')
    .replace(/[（(].*?[)）]/g, '')
    .replace(/[/·、,，\s]/g, '')
    .trim();
  if (!rest) return null;

  return { baseKey, rest };
}

/** 从菜名里认出浇头（长的优先，可叠加） */
function findToppings(rest, toppingKeys) {
  const hits = [];
  let rest2 = rest;
  for (const key of [...toppingKeys].sort((a, b) => b.length - a.length)) {
    if (rest2.includes(key)) {
      hits.push(key);
      rest2 = rest2.replaceAll(key, '');
    }
  }
  return hits;
}

/**
 * 生成一道菜的配料。
 * @param {string} name 菜名
 * @param {number} kcal 该菜标注的热量（用于校准）
 * @param {string} category 品类（兜底用）
 * @param {string[]} toppingKeys 浇头候选词
 * @returns {{ingredients: Array, how: string, ratio: number, nominalKcal: number}}
 */
export function buildIngredients(name, kcal, category, toppingKeys = []) {
  let list = null;
  let how = 'recipe';

  // 1) 直接命中配方
  const key = recipeKey(name);
  if (RECIPE[key]) {
    list = RECIPE[key].map(([n, g]) => [n, g]);
  }

  // 2) 组合菜：主食基底 + 浇头
  if (!list) {
    const combo = parseComboParts(name);
    if (combo) {
      // 剥前缀再试一次（「小馆招牌牛肉面」）
      let rest = combo.rest;
      for (let i = 0; i < 3; i++) {
        const stripped = rest.replace(PREFIX, '');
        if (stripped === rest) break;
        rest = stripped;
        const hits = findToppings(rest, toppingKeys);
        if (hits.length) {
          const base = BASE_INGREDIENTS[combo.baseKey] || [];
          const top = hits.flatMap((h) => RECIPE[recipeKey(h)] || []);
          if (top.length) {
            list = [...base, ...top];
            how = 'combo';
            break;
          }
        }
      }
      if (!list) {
        const hits = findToppings(combo.rest, toppingKeys);
        const base = BASE_INGREDIENTS[combo.baseKey] || [];
        const top = hits.flatMap((h) => RECIPE[recipeKey(h)] || []);
        if (top.length) {
          list = [...base, ...top];
          how = 'combo';
        }
      }
    }
  }

  // 3) 兜底
  if (!list) {
    list = CATEGORY_FALLBACK[category] || CATEGORY_FALLBACK.staple;
    how = 'fallback';
  }

  // 4) 校准：让配料加总的热量对齐标注值
  const { scaled, ratio, nominal } = calibrate(list, kcal);

  const source =
    how === 'fallback'
      ? '品类兜底配比，待人工复核'
      : '标准配比（食堂常规做法），克重按标注热量校准';

  return {
    ingredients: scaled.map(([n, g]) => ({ name: n, grams: g, source })),
    how,
    ratio,
    nominalKcal: Math.round(nominal),
  };
}

/** 按标注热量整体缩放配料克重 */
function calibrate(list, kcal) {
  const nominal = list.reduce((sum, [n, g]) => {
    const f = foodOf(n);
    return sum + (f ? (f[0] * g) / 100 : 0);
  }, 0);
  if (!nominal || !kcal) return { scaled: list.map(([n, g]) => [n, Math.max(1, Math.round(g))]), ratio: 1, nominal };

  const ratio = kcal / nominal;
  const scaled = list.map(([n, g]) => [n, Math.max(1, Math.round(g * ratio))]);
  return { scaled, ratio, nominal };
}

/** 校准后配料加总的热量（用于复核） */
export function sumKcal(ingredients) {
  return ingredients.reduce((sum, ing) => {
    const f = foodOf(ing.name);
    return sum + (f ? (f[0] * ing.grams) / 100 : 0);
  }, 0);
}
