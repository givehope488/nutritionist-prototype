import type { Dish, DishTag, Meal } from '@canteen/shared';
import { getDb } from './db';

/**
 * 菜品数据访问层。
 *
 * W1 起数据源是 SQLite（`npm run seed` 从 menu-seed.json 灌入），
 * 不再是每次请求读 JSON —— 这是「接口读库」验收项。
 *
 * 种子文件里的 `source` / `portion_grams` 等治理字段不入库、不出接口，
 * 因此 DTO 投影在写入时就完成，读出来天然是契约形状。
 */

interface DishRow {
  id: string;
  name: string;
  category: string;
  portion_label: string;
  meals: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  sodium_mg: number;
  price_yuan: number;
  tags: string;
  drink: number;
  reliability: string;
  status: string;
}

function toDish(row: DishRow): Dish {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Dish['category'],
    portion_label: row.portion_label,
    meals: JSON.parse(row.meals) as Meal[],
    kcal: row.kcal,
    protein_g: row.protein_g,
    fat_g: row.fat_g,
    carbs_g: row.carbs_g,
    sodium_mg: row.sodium_mg,
    price_yuan: row.price_yuan,
    tags: JSON.parse(row.tags) as DishTag[],
    drink: row.drink === 1,
    reliability: row.reliability as Dish['reliability'],
    status: row.status as Dish['status'],
  };
}

export function getAllDishes(): Dish[] {
  const rows = getDb().prepare('SELECT * FROM dishes ORDER BY id').all() as unknown as DishRow[];
  if (rows.length === 0) {
    throw new Error('菜品表为空：请先运行 npm run seed');
  }
  return rows.map(toDish);
}

export function getDishesByMeal(meal: Meal, includeInactive: boolean): Dish[] {
  return getAllDishes().filter(
    (dish) => dish.meals.includes(meal) && (includeInactive || dish.status === 'active'),
  );
}

export function getActiveDishes(includeInactive: boolean): Dish[] {
  return getAllDishes().filter((dish) => includeInactive || dish.status === 'active');
}
