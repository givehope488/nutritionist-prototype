import type { AdoptedComboSnapshot, MealLogResponse, Profile } from '@canteen/shared';
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
   * 合规删除入口（API.md §2.2，v1.2.4）：删除档案并连带删除该 session 的全部 meal-logs。
   * 两条 DELETE 放在一个事务里，避免「档案删了、记录还在」这种清不干净的中间态。
   * 返回 false 表示档案不存在（路由据此回 404）。
   */
  deleteBySession(sessionId: string): boolean {
    const db = getDb();
    const exists = db.prepare('SELECT 1 FROM profiles WHERE session_id = ?').get(sessionId);
    if (exists === undefined) return false;
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM meal_logs WHERE session_id = ?').run(sessionId);
      db.prepare('DELETE FROM profiles WHERE session_id = ?').run(sessionId);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    return true;
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
