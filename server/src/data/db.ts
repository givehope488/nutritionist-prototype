import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

/**
 * SQLite 连接与建表（W1 · 持久化）。
 *
 * 为什么用 Node 内置 `node:sqlite` 而不是 better-sqlite3：
 *   - 零依赖、不需要编译原生模块，5 个新手在 Windows 上不会卡在 node-gyp；
 *   - API 是同步的，和现有同步路由风格一致。
 * 代价：该模块在 Node 24 仍标记 experimental，升级 Node 时要回归一次。
 * 所有 SQL 都收敛在 data/ 这一层，将来换 better-sqlite3 或 PG 只改这里。
 *
 * 连接串走环境变量 `DATABASE_URL`：
 *   - 默认落 `server/data/runtime/app.db`（已被 .gitignore 忽略）
 *   - 测试用 `:memory:`，每个测试进程一份，互不干扰
 */
const DEFAULT_DB_PATH = fileURLToPath(new URL('../../data/runtime/app.db', import.meta.url));

let connection: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (connection !== null) return connection;

  const url = process.env.DATABASE_URL ?? DEFAULT_DB_PATH;
  if (url !== ':memory:') {
    mkdirSync(dirname(url), { recursive: true });
  }

  const db = new DatabaseSync(url);
  db.exec('PRAGMA foreign_keys = ON;');
  migrate(db);
  connection = db;
  return db;
}

export function closeDb(): void {
  if (connection !== null) {
    connection.close();
    connection = null;
  }
}

/**
 * 表结构对齐 ARCHITECTURE §5：dishes / profiles / meal_logs。
 * 数组与对象字段以 JSON 文本存储（SQLite 无数组类型），读取时解析。
 */
function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dishes (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      category      TEXT NOT NULL,
      portion_label TEXT NOT NULL,
      meals         TEXT NOT NULL,
      kcal          REAL NOT NULL,
      protein_g     REAL NOT NULL,
      fat_g         REAL NOT NULL,
      carbs_g       REAL NOT NULL,
      sodium_mg     REAL NOT NULL,
      tags          TEXT NOT NULL,
      drink         INTEGER NOT NULL,
      reliability   TEXT NOT NULL,
      status        TEXT NOT NULL,
      floor           INTEGER,
      stall           TEXT,
      serving_mode    TEXT,
      pricing_mode    TEXT,
      recommendable   INTEGER,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profiles (
      session_id   TEXT PRIMARY KEY,
      sex          TEXT NOT NULL,
      height_cm    REAL NOT NULL,
      weight_kg    REAL NOT NULL,
      age          INTEGER NOT NULL,
      activity     TEXT NOT NULL,
      goal         TEXT NOT NULL,
      avoid        TEXT NOT NULL,
      default_meal TEXT NOT NULL,
      bmi          REAL NOT NULL,
      bmi_tag      TEXT NOT NULL,
      day_kcal     REAL NOT NULL,
      warnings     TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meal_logs (
      id         TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      date       TEXT NOT NULL,
      meal       TEXT NOT NULL,
      items      TEXT NOT NULL,
      totals     TEXT NOT NULL,
      target     TEXT NOT NULL,
      verdict    TEXT NOT NULL,
      adopted    INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_meal_logs_session_date
      ON meal_logs (session_id, date DESC);
  `);

  upgradeDishesSchema(db);
}

/**
 * dishes 表的增量升级（老库升级不能报错，必须幂等）。
 *
 * 1. **删 `price_yuan`**（用户 2026-11-13 决策：产品不向用户提供价格）。
 *    页面上写的是「SQLite 删列要重建表」，但 **Node 24 内置的 SQLite 是 3.50.4，
 *    支持 `ALTER TABLE ... DROP COLUMN`**（3.35+ 即支持），所以不必重建表、
 *    也不必搬数据。这里实测过：老库带 `price_yuan NOT NULL`，DROP 直接成功。
 * 2. **加菜单 v3 的五个字段**（`floor` / `stall` / `serving_mode` / `pricing_mode` /
 *    `recommendable`），逐列判断是否已存在，避免 `duplicate column` 报错。
 *
 * 用 PRAGMA table_info 探当前列，而不是捕获异常——报错会被吞掉真实问题。
 */
function upgradeDishesSchema(db: DatabaseSync): void {
  const columns = new Set(
    (db.prepare('PRAGMA table_info(dishes)').all() as unknown as Array<{ name: string }>).map(
      (row) => row.name,
    ),
  );

  if (columns.has('price_yuan')) {
    db.exec('ALTER TABLE dishes DROP COLUMN price_yuan');
  }

  const additions: Array<[string, string]> = [
    ['floor', 'INTEGER'],
    ['stall', 'TEXT'],
    ['serving_mode', 'TEXT'],
    ['pricing_mode', 'TEXT'],
    ['recommendable', 'INTEGER'],
  ];
  for (const [name, type] of additions) {
    if (!columns.has(name)) {
      db.exec(`ALTER TABLE dishes ADD COLUMN ${name} ${type}`);
    }
  }
}

/** 测试用：清空业务表（保留表结构），避免用例互相污染 */
export function resetDatabase(): void {
  const db = getDb();
  db.exec('DELETE FROM meal_logs; DELETE FROM profiles;');
}
