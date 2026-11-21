import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

/**
 * 数据库备份（W2-D5）。
 *
 * 用 `VACUUM INTO` 而不是直接拷 `.db` 文件：SQLite 在 WAL / 有写事务时，
 * 裸拷贝可能拿到**半写状态**的库；`VACUUM INTO` 由 SQLite 自己保证一致性快照。
 *
 * 用法：
 *   npm run backup                        # 备份到 server/data/backups/
 *   BACKUP_DIR=D:/backups npm run backup  # 自定义目录
 *   BACKUP_KEEP=3 npm run backup          # 只保留最近 3 份（默认 7）
 *
 * 备份文件是 `*.db`，已被 .gitignore 忽略，不会入库（§6 约束）。
 */
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DEFAULT_DB = join(REPO_ROOT, 'server', 'data', 'runtime', 'app.db');

const dbPath = process.env.DATABASE_URL ?? DEFAULT_DB;
const backupDir = process.env.BACKUP_DIR ?? join(REPO_ROOT, 'server', 'data', 'backups');
const keep = Number(process.env.BACKUP_KEEP ?? '7');

function counts(db: DatabaseSync): string {
  const pick = (sql: string): number => (db.prepare(sql).get() as { c: number }).c;
  const dishes = pick('SELECT COUNT(*) AS c FROM dishes');
  const profiles = pick('SELECT COUNT(*) AS c FROM profiles');
  const logs = pick('SELECT COUNT(*) AS c FROM meal_logs');
  const revisions = pick('SELECT COUNT(*) AS c FROM dish_revisions');
  return `dishes=${dishes} profiles=${profiles} meal_logs=${logs} revisions=${revisions}`;
}

function main(): void {
  if (!existsSync(dbPath)) {
    console.error(`[backup] 数据库不存在：${dbPath}（先跑 npm run seed 或启动服务）`);
    process.exitCode = 1;
    return;
  }
  mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = join(backupDir, `app-${stamp}.db`);
  if (existsSync(target)) {
    console.error(`[backup] 目标已存在：${target}`);
    process.exitCode = 1;
    return;
  }

  const db = new DatabaseSync(dbPath);
  const started = performance.now();
  // VACUUM INTO 的路径要写成 SQL 字符串字面量，Windows 反斜杠需转义
  db.exec(`VACUUM INTO '${target.replace(/\\/g, '/').replace(/'/g, "''")}'`);
  const elapsed = Math.round(performance.now() - started);

  // 备份产物自检：能打开、完整性 OK、表数与源库一致
  const copy = new DatabaseSync(target);
  const integrity = (copy.prepare('PRAGMA integrity_check').get() as { integrity_check: string })
    .integrity_check;
  const sourceCounts = counts(db);
  const backupCounts = counts(copy);
  copy.close();
  db.close();

  if (integrity !== 'ok' || sourceCounts !== backupCounts) {
    console.error(`[backup] 自检失败：integrity=${integrity}，源=${sourceCounts}，备份=${backupCounts}`);
    process.exitCode = 1;
    return;
  }

  // 轮转：只保留最近 keep 份
  const files = readdirSync(backupDir)
    .filter((name) => name.startsWith('app-') && name.endsWith('.db'))
    .sort();
  const removed: string[] = [];
  while (files.length > keep) {
    const victim = files.shift();
    if (victim === undefined) break;
    rmSync(join(backupDir, victim), { force: true });
    removed.push(victim);
  }

  const sizeKb = Math.round(statSync(target).size / 1024);
  console.log(`[backup] ✅ ${target}`);
  console.log(`[backup] 耗时 ${elapsed} ms，大小 ${sizeKb} KB，${backupCounts}`);
  if (removed.length > 0) console.log(`[backup] 轮转删除 ${removed.length} 份：${removed.join(', ')}`);
  console.log(`[backup] 当前保留 ${Math.min(files.length, keep)} 份（上限 ${keep}）`);
}

main();
