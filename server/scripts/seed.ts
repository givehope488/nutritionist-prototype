import { getDb } from '../src/data/db';
import { seedDishes } from '../src/data/seed';

/**
 * `npm run seed`：把种子 JSON 灌进 SQLite。
 *
 * 幂等：重跑结果一致（事务内清空后整批写入），可放进 CI 或部署脚本。
 */
const result = seedDishes();
const db = getDb();

const total = db.prepare('SELECT COUNT(*) AS c FROM dishes').get() as unknown as { c: number };
console.log(`[seed] 写入 ${result.seeded} 道菜，当前库内 ${total.c} 行`);
console.log(`[seed] 数据库：${process.env.DATABASE_URL ?? 'server/data/runtime/app.db'}`);

// 写完立刻从库里读一次，证明走的是数据库而不是直接读 JSON
const sample = db.prepare('SELECT id, name FROM dishes ORDER BY id LIMIT 1').get() as unknown as
  | { id: string; name: string }
  | undefined;
if (sample === undefined) {
  console.error('[seed] 写入后读不到数据，落库失败');
  process.exitCode = 1;
} else {
  console.log(`[seed] 抽查：${sample.id} ${sample.name}`);
}
