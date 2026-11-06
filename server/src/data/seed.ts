import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Dish } from '@canteen/shared';
import { getDb } from './db';

/**
 * 把 `server/data/menu-seed.json` 灌进 SQLite（`npm run seed`）。
 *
 * 幂等策略：一个事务里先清空 dishes 再整批写入。
 * 理由：种子里的 55 道是完整集合，用「全量对齐」比「逐条 upsert + 删除缺失项」
 * 少一半代码，重跑结果完全一致（验收要求：重跑幂等）。
 * 注意：管理端上线后不能用这招（会抹掉运营改过的数据），届时改成 upsert + 软删除。
 */
const SEED_PATH = fileURLToPath(new URL('../../data/menu-seed.json', import.meta.url));

type SeedRow = Dish & Record<string, unknown>;

export interface SeedResult {
  seeded: number;
}

export function seedDishes(): SeedResult {
  const raw = JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { dishes: SeedRow[] };
  const db = getDb();

  const insert = db.prepare(`
    INSERT INTO dishes (
      id, name, category, portion_label, meals,
      kcal, protein_g, fat_g, carbs_g, sodium_mg,
      price_yuan, tags, drink, reliability, status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM dishes');
    for (const row of raw.dishes) {
      insert.run(
        row.id,
        row.name,
        row.category,
        row.portion_label,
        JSON.stringify(row.meals),
        row.kcal,
        row.protein_g,
        row.fat_g,
        row.carbs_g,
        row.sodium_mg,
        row.price_yuan,
        JSON.stringify(row.tags),
        row.drink ? 1 : 0,
        row.reliability,
        row.status,
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { seeded: raw.dishes.length };
}
