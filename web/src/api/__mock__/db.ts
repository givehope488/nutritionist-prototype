// Mock 后端替身（对齐 BE-B 的 W1「Mock API」任务：按接口协定返回假数据，供前端脱离后端开发）。
// 重要边界：架构 D1 规定营养计算只在服务端。本目录是「服务端替身」，
// 因此视图 / 组件禁止 import 本目录（由 src/tests/unit/layerBoundary.test.ts 把关）。
import rawSeed from '@menu-seed';
import type { Dish, MealLog, MealType, Profile } from '@shared/types';

const KEYS = {
  profiles: 'cn.mock.v1.profiles',
  logs: 'cn.mock.v1.meal_logs',
  combos: 'cn.mock.v1.combos',
} as const;

/** 组合关联有效期：API.md §2.3「combo.id 有效期 24 小时」 */
export const COMBO_TTL_MS = 24 * 60 * 60 * 1000;

/** 推荐组合索引：combo_id → 所属档案与菜品集合，供回填关联采纳判定 */
export interface CachedCombo {
  combo_id: string;
  session_id: string;
  meal: MealType;
  dish_ids: string[];
  created_at: number;
}

/** 落库记录比响应多一个 session_id（响应结构里没有，存储需要它做用户隔离） */
export interface StoredLog extends MealLog {
  session_id: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function allDishes(): Dish[] {
  return rawSeed.dishes.map((dish) => ({ ...dish })) as Dish[];
}

export function dishById(id: string): Dish | undefined {
  return allDishes().find((dish) => dish.id === id);
}

export function activeDishes(meal?: MealType): Dish[] {
  return allDishes().filter(
    (dish) => dish.status === 'active' && (meal === undefined || dish.meals.includes(meal)),
  );
}

export function getProfile(sessionId: string): Profile | undefined {
  return read<Record<string, Profile>>(KEYS.profiles, {})[sessionId];
}

export function upsertProfile(profile: Profile): Profile {
  const all = read<Record<string, Profile>>(KEYS.profiles, {});
  all[profile.session_id] = profile;
  write(KEYS.profiles, all);
  return profile;
}

/** 幂等键为请求体 id（API.md §0.7） */
export function findLog(id: string): StoredLog | undefined {
  return read<StoredLog[]>(KEYS.logs, []).find((log) => log.id === id);
}

export function insertLog(log: StoredLog): StoredLog {
  write(KEYS.logs, [...read<StoredLog[]>(KEYS.logs, []), log]);
  return log;
}

export function listLogs(sessionId: string, from?: string, to?: string): StoredLog[] {
  return read<StoredLog[]>(KEYS.logs, [])
    .filter((log) => log.session_id === sessionId)
    .filter((log) => (from ? log.date >= from : true))
    .filter((log) => (to ? log.date <= to : true))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** 短哈希形态对齐 API.md 示例 "c9f31a02"：FNV-1a 取 8 位十六进制 */
export function comboIdOf(dishIds: string[]): string {
  let hash = 0x811c9dc5;
  const input = dishIds.join(',');
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0').slice(0, 8);
}

function cachedCombos(): Record<string, CachedCombo> {
  const now = Date.now();
  const all = read<Record<string, CachedCombo>>(KEYS.combos, {});
  return Object.fromEntries(
    Object.entries(all).filter(([, item]) => now - item.created_at < COMBO_TTL_MS),
  );
}

export function saveCombos(sessionId: string, meal: MealType, dishIdSets: string[][]): void {
  const next = cachedCombos();
  for (const dish_ids of dishIdSets) {
    const combo_id = comboIdOf(dish_ids);
    next[combo_id] = { combo_id, session_id: sessionId, meal, dish_ids, created_at: Date.now() };
  }
  write(KEYS.combos, next);
}

export function findCombo(comboId: string): CachedCombo | undefined {
  return cachedCombos()[comboId];
}

/** 单测隔离用：清空 Mock 持久化状态 */
export function resetMockDb(): void {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}
