import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Dish, Meal } from '@canteen/shared';

/**
 * 菜品数据访问层（临时实现）。
 *
 * TODO(BE-B, W2)：改为 SQLite 查询，seed 仅在 `npm run seed` 时写入一次。
 * 在此之前保持「只读 + 启动即加载」的形态，保证前端能立刻对着真实字段开发。
 */
const SEED_PATH = fileURLToPath(new URL('../../data/menu-seed.json', import.meta.url));

/**
 * 种子文件里的记录比契约多若干元数据字段（如 `source` 来源说明）。
 * 这类字段只用于数据治理，**不得出现在 API 响应里**（DoD：无未记载字段），
 * 因此在数据边界上做一次显式投影，而不是把整行 JSON 直接吐出去。
 */
type SeedDish = Dish & Record<string, unknown>;

function toDishDto(row: SeedDish): Dish {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    portion_label: row.portion_label,
    meals: row.meals,
    kcal: row.kcal,
    protein_g: row.protein_g,
    fat_g: row.fat_g,
    carbs_g: row.carbs_g,
    sodium_mg: row.sodium_mg,
    price_yuan: row.price_yuan,
    tags: row.tags,
    drink: row.drink,
    reliability: row.reliability,
    status: row.status,
  };
}

let cache: Dish[] | null = null;

export function getAllDishes(): Dish[] {
  if (cache === null) {
    const raw = JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { dishes: SeedDish[] };
    cache = raw.dishes.map(toDishDto);
  }
  return cache;
}

export function getDishesByMeal(meal: Meal, includeInactive: boolean): Dish[] {
  return getAllDishes().filter(
    (dish) => dish.meals.includes(meal) && (includeInactive || dish.status === 'active'),
  );
}

export function getActiveDishes(includeInactive: boolean): Dish[] {
  return getAllDishes().filter((dish) => includeInactive || dish.status === 'active');
}
