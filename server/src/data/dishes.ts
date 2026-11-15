import type { Dish, DishTag, Meal } from '@canteen/shared';
import { getDb } from './db';

/**
 * 菜品数据访问层。
 *
 * 数据源是 SQLite（`npm run seed` 灌入），不再是每次请求读 JSON —— 这是「接口读库」验收项。
 *
 * 种子文件里的 `source` / `portion_grams` / `ingredients` / `evidence` / `confidence`
 * 等治理字段不入库、不出接口，因此 DTO 投影在写入时就完成，读出来天然是契约形状。
 * 同理 `price_yuan` 已按产品决策删除（契约类型里也没有这个字段了）。
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
  tags: string;
  drink: number;
  reliability: string;
  status: string;
  floor: number | null;
  stall: string | null;
  serving_mode: string | null;
  pricing_mode: string | null;
  recommendable: number | null;
}

function toDish(row: DishRow): Dish {
  const dish: Dish = {
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
    tags: JSON.parse(row.tags) as DishTag[],
    drink: row.drink === 1,
    reliability: row.reliability as Dish['reliability'],
    status: row.status as Dish['status'],
  };

  // v3 的五个可选字段：老种子（55 道）为 NULL，此时**不写这个键**，
  // 否则接口会多下发一堆 null，前端和契约测试都得多处理一种形状。
  if (row.floor !== null) dish.floor = row.floor;
  if (row.stall !== null) dish.stall = row.stall;
  if (row.serving_mode !== null) dish.serving_mode = row.serving_mode as Dish['serving_mode'];
  if (row.pricing_mode !== null) dish.pricing_mode = row.pricing_mode as Dish['pricing_mode'];
  if (row.recommendable !== null) dish.recommendable = row.recommendable === 1;

  return dish;
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
