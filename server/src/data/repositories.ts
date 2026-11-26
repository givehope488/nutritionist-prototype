import type {
  AdoptedComboSnapshot,
  DishExclusion,
  MealLogResponse,
  Profile,
} from '@canteen/shared';
import { getDb } from './db';

/**
 * 档案与用餐记录的仓储层（SQLite）。
 *
 * 为什么单独一层：路由只管 HTTP 与校验，SQL 只在这里出现。
 * 将来换 ORM 或迁 PG，改这个文件即可，routes 不动。
 */

interface ProfileRow {
  session_id: string;
  sex: string;
  height_cm: number;
  weight_kg: number;
  age: number;
  activity: string;
  goal: string;
  avoid: string;
  default_meal: string;
  bmi: number;
  bmi_tag: string;
  day_kcal: number;
  warnings: string;
}

function toProfile(row: ProfileRow): Profile {
  return {
    session_id: row.session_id,
    sex: row.sex as Profile['sex'],
    height_cm: row.height_cm,
    weight_kg: row.weight_kg,
    age: row.age,
    activity: row.activity as Profile['activity'],
    goal: row.goal as Profile['goal'],
    avoid: JSON.parse(row.avoid) as string[],
    default_meal: row.default_meal as Profile['default_meal'],
    bmi: row.bmi,
    bmi_tag: row.bmi_tag,
    day_kcal: row.day_kcal,
    warnings: JSON.parse(row.warnings) as string[],
  };
}

export const profileRepository = {
  find(sessionId: string): Profile | undefined {
    const row = getDb()
      .prepare('SELECT * FROM profiles WHERE session_id = ?')
      .get(sessionId) as unknown as ProfileRow | undefined;
    return row === undefined ? undefined : toProfile(row);
  },

  /** upsert：以 session_id 为键（API.md §2.2） */
  save(profile: Profile): Profile {
    getDb()
      .prepare(
        `INSERT INTO profiles (
           session_id, sex, height_cm, weight_kg, age, activity, goal,
           avoid, default_meal, bmi, bmi_tag, day_kcal, warnings, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(session_id) DO UPDATE SET
           sex = excluded.sex,
           height_cm = excluded.height_cm,
           weight_kg = excluded.weight_kg,
           age = excluded.age,
           activity = excluded.activity,
           goal = excluded.goal,
           avoid = excluded.avoid,
           default_meal = excluded.default_meal,
           bmi = excluded.bmi,
           bmi_tag = excluded.bmi_tag,
           day_kcal = excluded.day_kcal,
           warnings = excluded.warnings,
           updated_at = datetime('now')`,
      )
      .run(
        profile.session_id,
        profile.sex,
        profile.height_cm,
        profile.weight_kg,
        profile.age,
        profile.activity,
        profile.goal,
        JSON.stringify(profile.avoid),
        profile.default_meal,
        profile.bmi,
        profile.bmi_tag,
        profile.day_kcal,
        JSON.stringify(profile.warnings),
      );
    return profile;
  },

  count(): number {
    const row = getDb().prepare('SELECT COUNT(*) AS c FROM profiles').get() as unknown as {
      c: number;
    };
    return row.c;
  },

  /**
   * 合规删除入口（API.md §2.2，v1.2.4）：删除档案并连带删除该 session 的全部
   * meal-logs 与个人排除记录（v1.2.12）。三条 DELETE 放在一个事务里，避免
   * 「档案删了、记录还在」这种清不干净的中间态。返回 false 表示档案不存在。
   *
   * 复核要点（2026-11-17 BE-B，W2 #12）：
   * - **不再在事务外 `SELECT 1` 预检**：检查与删除之间存在 TOCTOU（并发下两个请求都通过预检，
   *   第二个会返回「删除成功」但其实什么都没删）。改为事务内以 profiles 的**影响行数**判定。
   * - **用 `BEGIN IMMEDIATE`**：SQLite 的「先读后写」需要在事务中途升级锁，并发时可能直接
   *   `SQLITE_BUSY`；IMMEDIATE 在事务开始就拿写锁，失败立刻抛错而不是半途卡住。
   */
  deleteBySession(sessionId: string): boolean {
    const db = getDb();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM meal_logs WHERE session_id = ?').run(sessionId);
      db.prepare('DELETE FROM dish_exclusions WHERE session_id = ?').run(sessionId);
      const result = db.prepare('DELETE FROM profiles WHERE session_id = ?').run(sessionId);
      db.exec('COMMIT');
      return Number(result.changes) > 0;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },
};

interface DishExclusionRow {
  dish_id: string;
  dish_name: string;
}

function toDishExclusion(row: DishExclusionRow): DishExclusion {
  return { dish_id: row.dish_id, name: row.dish_name };
}

/**
 * 个人排除仓储（API.md v1.2.12 §2.6）。
 *
 * 主键 (session_id, dish_id) 让「重复排除」天然幂等；`add` 返回 false 表示已存在，
 * 路由据此回 200 而不是 201。推荐路由只读 `dishIdsBySession`，不做任何营养计算。
 */
export const dishExclusionRepository = {
  listBySession(sessionId: string): DishExclusion[] {
    const rows = getDb()
      .prepare(
        `SELECT dish_id, dish_name FROM dish_exclusions
         WHERE session_id = ?
         ORDER BY created_at DESC, dish_id`,
      )
      .all(sessionId) as unknown as DishExclusionRow[];
    return rows.map(toDishExclusion);
  },

  dishIdsBySession(sessionId: string): string[] {
    const rows = getDb()
      .prepare('SELECT dish_id FROM dish_exclusions WHERE session_id = ?')
      .all(sessionId) as unknown as Array<{ dish_id: string }>;
    return rows.map((row) => row.dish_id);
  },

  /** 返回 true 表示新写入，false 表示该菜已在排除列表里 */
  add(sessionId: string, dishId: string, dishName: string): boolean {
    const result = getDb()
      .prepare(
        `INSERT OR IGNORE INTO dish_exclusions (session_id, dish_id, dish_name)
         VALUES (?, ?, ?)`,
      )
      .run(sessionId, dishId, dishName);
    return Number(result.changes) > 0;
  },

  /** 返回 false 表示本来就没有这条排除记录（路由回 404） */
  remove(sessionId: string, dishId: string): boolean {
    const result = getDb()
      .prepare('DELETE FROM dish_exclusions WHERE session_id = ? AND dish_id = ?')
      .run(sessionId, dishId);
    return Number(result.changes) > 0;
  },
};

interface MealLogRow {
  id: string;
  session_id: string;
  date: string;
  meal: string;
  items: string;
  totals: string;
  target: string;
  verdict: string;
  adopted: number;
  adopted_combo: string | null;
}

function toMealLog(row: MealLogRow): MealLogResponse {
  return {
    id: row.id,
    duplicate: false,
    date: row.date,
    meal: row.meal as MealLogResponse['meal'],
    items: JSON.parse(row.items) as MealLogResponse['items'],
    totals: JSON.parse(row.totals) as MealLogResponse['totals'],
    target: JSON.parse(row.target) as MealLogResponse['target'],
    verdict: JSON.parse(row.verdict) as MealLogResponse['verdict'],
    adopted: row.adopted === 1,
  };
}

/**
 * 用餐记录仓储。
 *
 * 契约里的 MealLogResponse 不含 session_id（API.md §2.4），
 * 但按 session 查列表需要归属关系，所以库里存 session_id，出接口时剥掉。
 */
export const mealLogRepository = {
  find(id: string): MealLogResponse | undefined {
    const row = getDb()
      .prepare('SELECT * FROM meal_logs WHERE id = ?')
      .get(id) as unknown as MealLogRow | undefined;
    return row === undefined ? undefined : toMealLog(row);
  },

  save(
    sessionId: string,
    log: MealLogResponse,
    adoptedCombo: AdoptedComboSnapshot | null = null,
  ): MealLogResponse {
    getDb()
      .prepare(
        `INSERT INTO meal_logs
           (id, session_id, date, meal, items, totals, target, verdict, adopted, adopted_combo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        log.id,
        sessionId,
        log.date,
        log.meal,
        JSON.stringify(log.items),
        JSON.stringify(log.totals),
        JSON.stringify(log.target),
        JSON.stringify(log.verdict),
        log.adopted ? 1 : 0,
        adoptedCombo === null ? null : JSON.stringify(adoptedCombo),
      );
    return log;
  },

  listBySession(sessionId: string): MealLogResponse[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM meal_logs
         WHERE session_id = ?
         ORDER BY date DESC, created_at DESC`,
      )
      .all(sessionId) as unknown as MealLogRow[];
    return rows.map(toMealLog);
  },

  count(): number {
    const row = getDb().prepare('SELECT COUNT(*) AS c FROM meal_logs').get() as unknown as {
      c: number;
    };
    return row.c;
  },
};
