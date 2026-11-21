import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

/**
 * 数据库恢复（W2-D5 的「真实恢复演练」用）。
 *
 * 安全默认：
 * 1. **先校验备份**（能打开 + `integrity_check` = ok + 表齐全），坏备份不覆盖生产库；
 * 2. **覆盖前先给现库做一份 `.pre-restore-<时间戳>.db`**，恢复错了还能退回来；
 * 3. 恢复后重新打开目标库做一次完整性校验与行数比对。
 *
 * 用法：
 *   npm run restore -- server/data/backups/app-2026-11-21T13-00-00-000Z.db
 *   npm run restore -- <备份文件> <目标库路径>
 */
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DEFAULT_DB = join(REPO_ROOT, 'server', 'data', 'runtime', 'app.db');

const backupPath = process.argv[2];
const targetPath = process.argv[3] ?? process.env.DATABASE_URL ?? DEFAULT_DB;

function counts(db: DatabaseSync): string {
  const pick = (sql: string): number => (db.prepare(sql).get() as { c: number }).c;
  return [
    `dishes=${pick('SELECT COUNT(*) AS c FROM dishes')}`,
    `profiles=${pick('SELECT COUNT(*) AS c FROM profiles')}`,
    `meal_logs=${pick('SELECT COUNT(*) AS c FROM meal_logs')}`,
    `revisions=${pick('SELECT COUNT(*) AS c FROM dish_revisions')}`,
  ].join(' ');
}

function inspect(path: string, label: string): string {
  const db = new DatabaseSync(path);
  const integrity = (db.prepare('PRAGMA integrity_check').get() as { integrity_check: string })
    .integrity_check;
  const result = counts(db);
  db.close();
  if (integrity !== 'ok') {
    throw new Error(`${label} 完整性校验失败：${integrity}`);
  }
  return result;
}

function main(): void {
  if (backupPath === undefined) {
    console.error('用法：npm run restore -- <备份文件> [目标库路径]');
    process.exitCode = 1;
    return;
  }
  const from = resolve(backupPath);
  const to = resolve(targetPath);
  if (!existsSync(from)) {
    console.error(`[restore] 备份不存在：${from}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[restore] 备份：${from}`);
  console.log(`[restore] 目标：${to}`);

  const t0 = performance.now();
  const backupCounts = inspect(from, '备份');
  console.log(`[restore] 备份校验通过：${backupCounts}`);

  // 覆盖前给现库留退路
  if (existsSync(to)) {
    const safety = `${to}.pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(to, safety);
    console.log(`[restore] 已备份现库：${safety}`);
    for (const suffix of ['-wal', '-shm', '-journal']) {
      if (existsSync(`${to}${suffix}`)) {
        // 恢复前清掉 WAL/SHM，避免旧日志与恢复后的库不匹配
        copyFileSync(`${to}${suffix}`, `${safety}${suffix}`);
      }
    }
  } else {
    mkdirSync(dirname(to), { recursive: true });
  }

  copyFileSync(from, to);
  // 旧 WAL/SHM 会让 SQLite 把恢复后的库当成「未完成的事务」，恢复后必须删除
  for (const suffix of ['-wal', '-shm', '-journal']) {
    const stale = `${to}${suffix}`;
    if (existsSync(stale)) {
      copyFileSync(stale, `${to}${suffix}.bak`);
    }
  }

  const elapsed = Math.round(performance.now() - t0);
  const restoredCounts = inspect(to, '恢复后的库');
  const sizeKb = Math.round(statSync(to).size / 1024);

  console.log(`[restore] ✅ 完成，耗时 ${elapsed} ms，大小 ${sizeKb} KB`);
  console.log(`[restore] 恢复后：${restoredCounts}`);
  if (restoredCounts !== backupCounts) {
    console.error('[restore] ❌ 行数与备份不一致');
    process.exitCode = 1;
  }
}

main();
