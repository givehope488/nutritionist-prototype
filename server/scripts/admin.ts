import { readFileSync } from 'node:fs';
import type { Dish, DishStatus } from '@canteen/shared';
import {
  bulkImport,
  findDish,
  listDishes,
  listRevisions,
  setDishStatus,
  updateDish,
  type DishPatch,
} from '../src/admin/dishes';
import { closeDb } from '../src/data/db';

/**
 * 管理端 CLI（W2 · 管理端）。
 *
 * PD 用它做「上下架 + 营养校准」，不需要前端界面、也不需要起服务：
 *
 * ```bash
 * npm run admin -w @canteen/server -- list --status=active --category=protein
 * npm run admin -w @canteen/server -- show s01
 * npm run admin -w @canteen/server -- status s01 hidden --operator=PD
 * npm run admin -w @canteen/server -- update s01 --kcal=245 --reason="10月抽检称重" --operator=PD
 * npm run admin -w @canteen/server -- revisions s01
 * npm run admin -w @canteen/server -- import review.csv.json --operator=PD
 * ```
 *
 * 为什么 CLI 直接调 service 而不是走 HTTP：PD 在本地/服务器上都要能跑，
 * 起服务再调一圈没有收益；HTTP 路由（`X-Admin-Token`）保留给将来的管理端页面。
 */

const argv = process.argv.slice(2);
const command = argv[0];

function flag(name: string): string | undefined {
  const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? undefined : hit.slice(name.length + 3);
}

const operator = flag('operator') ?? process.env.ADMIN_OPERATOR ?? 'unknown';

function positional(): string[] {
  return argv.slice(1).filter((arg) => !arg.startsWith('--'));
}

function printDishRow(dish: Dish): void {
  const status = dish.status === 'active' ? '在架' : '下架';
  const mode = dish.serving_mode ?? '-';
  const pricing = dish.pricing_mode ?? '-';
  console.log(
    `${dish.id.padEnd(10)} ${dish.name.padEnd(18)} ${dish.category.padEnd(8)} ${String(dish.kcal).padStart(5)} kcal  ${status}  ${mode}/${pricing}`,
  );
}

function usage(): void {
  console.log(
    [
      '用法：npm run admin -w @canteen/server -- <命令> [参数]',
      '',
      '  list [--status=active|hidden] [--category=staple|protein|veg|soup|fruit] [--q=关键词]',
      '  show <id>',
      '  status <id> active|hidden [--operator=名字]',
      '  update <id> --kcal=245 --protein_g=4.6 ... --reason="改动依据" [--operator=名字]',
      '  revisions <id>',
      '  import <文件.json> [--operator=名字]',
      '',
      '说明：改营养必须带 --reason（写修订留痕）；import 只更新已存在的菜品。',
    ].join('\n'),
  );
}

try {
  switch (command) {
    case 'list': {
      const dishes = listDishes({
        ...(flag('status') !== undefined ? { status: flag('status') } : {}),
        ...(flag('category') !== undefined ? { category: flag('category') } : {}),
        ...(flag('q') !== undefined ? { q: flag('q') } : {}),
      });
      if (flag('json') !== undefined) {
        console.log(JSON.stringify(dishes, null, 2));
      } else {
        console.log(`共 ${dishes.length} 道：`);
        dishes.forEach(printDishRow);
      }
      break;
    }
    case 'show': {
      const [id] = positional();
      if (id === undefined) throw new Error('缺少菜品 id');
      console.log(JSON.stringify(findDish(id), null, 2));
      break;
    }
    case 'status': {
      const [id, status] = positional();
      if (id === undefined || status === undefined) throw new Error('用法：status <id> active|hidden');
      if (status !== 'active' && status !== 'hidden') throw new Error('status 只能是 active 或 hidden');
      const { dish, from } = setDishStatus(id, status as DishStatus, operator);
      console.log(`${dish.id} ${dish.name}：${from} → ${dish.status}`);
      break;
    }
    case 'update': {
      const [id] = positional();
      if (id === undefined) throw new Error('缺少菜品 id');
      const patch: DishPatch = {};
      for (const key of ['portion_label', 'kcal', 'protein_g', 'fat_g', 'carbs_g', 'sodium_mg']) {
        const value = flag(key);
        if (value === undefined) continue;
        if (key === 'portion_label') patch.portion_label = value;
        else (patch as Record<string, number>)[key] = Number(value);
      }
      const { dish, changed } = updateDish(id, patch, { reason: flag('reason'), operator });
      const fields = Object.keys(changed);
      if (fields.length === 0) console.log(`${dish.id}：没有字段发生变化，未写修订`);
      else console.log(`${dish.id} ${dish.name}：已更新 ${fields.join(', ')}（已留痕）`);
      break;
    }
    case 'revisions': {
      const [id] = positional();
      if (id === undefined) throw new Error('缺少菜品 id');
      const { revisions } = listRevisions(id);
      if (revisions.length === 0) {
        console.log('没有修订记录');
        break;
      }
      for (const revision of revisions) {
        console.log(`#${revision.id} ${revision.created_at} ${revision.operator}：${revision.reason}`);
        console.log(`   ${JSON.stringify(revision.changed_fields)}`);
      }
      break;
    }
    case 'import': {
      const [file] = positional();
      if (file === undefined) throw new Error('缺少 JSON 文件路径');
      const rows = JSON.parse(readFileSync(file, 'utf8')) as unknown[];
      if (!Array.isArray(rows)) throw new Error('文件内容必须是数组');
      const result = bulkImport(rows, operator);
      console.log(`导入完成：成功 ${result.succeeded} 行，失败 ${result.failed} 行`);
      result.rows
        .filter((row) => !row.ok)
        .forEach((row) => console.log(`  第 ${row.index} 行失败：${row.message ?? ''}`));
      break;
    }
    default:
      usage();
      process.exitCode = command === undefined || command === '--help' ? 0 : 1;
  }
} finally {
  closeDb();
}
