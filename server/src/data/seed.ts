import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Dish } from '@canteen/shared';
import { getDb } from './db';

/**
 * 把种子 JSON 灌进 SQLite（`npm run seed`）。
 *
 * 幂等策略：一个事务里先清空 dishes 再整批写入。
 * 理由：种子是完整集合，用「全量对齐」比「逐条 upsert + 删除缺失项」
 * 少一半代码，重跑结果完全一致（验收要求：重跑幂等）。
 * 注意：管理端上线后不能用这招（会抹掉运营改过的数据），届时改成 upsert + 软删除。
 *
 * 种子文件默认是 55 道原型数据（`menu-seed.json`）。菜单 v3 的 384 道数据层已就绪，
 * 但引擎还没适配四种份量形态，所以**上线前不切换默认值**；需要试跑 v3 时用：
 *
 * ```bash
 * SEED_PATH=server/data/menu-seed.v3.json npm run seed
 * ```
 */
const DEFAULT_SEED_PATH = fileURLToPath(new URL('../../data/menu-seed.json', import.meta.url));

function resolveSeedPath(): string {
  const override = process.env.SEED_PATH;
  if (override === undefined || override.length === 0) return DEFAULT_SEED_PATH;
  // 绝对路径直接用；相对路径按「仓库根」解析（本文件在 server/src/data/，三层回到仓库根）
  const isAbsolute = /^[A-Za-z]:[\\/]/.test(override) || override.startsWith('/');
  return isAbsolute ? override : fileURLToPath(new URL(`../../../${override}`, import.meta.url));
}

type SeedRow = Dish & Record<string, unknown>;

export interface SeedResult {
  seeded: number;
  source: string;
}

export function seedDishes(): SeedResult {
  const seedPath = resolveSeedPath();
  const raw = JSON.parse(readFileSync(seedPath, 'utf8')) as { dishes: SeedRow[] };
  const db = getDb();

  const insert = db.prepare(`
    INSERT INTO dishes (
      id, name, category, portion_label, meals,
      kcal, protein_g, fat_g, carbs_g, sodium_mg,
      tags, drink, reliability, status,
      floor, stall, serving_mode, pricing_mode, recommendable,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
        JSON.stringify(row.tags),
        row.drink ? 1 : 0,
        row.reliability,
        row.status,
        row.floor ?? null,
        row.stall ?? null,
        row.serving_mode ?? null,
        row.pricing_mode ?? null,
        row.recommendable === undefined ? null : row.recommendable ? 1 : 0,
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { seeded: raw.dishes.length, source: seedPath };
}
