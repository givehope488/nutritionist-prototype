import type { MealLogResponse, Profile } from '@canteen/shared';

/**
 * 进程内假存储（W2 过渡实现，替代 SQLite）。
 *
 * 为什么先内存：W2 的目标是让两个前端能打通「建档 → 推荐 → 回填 → 反馈」，
 * 落库要多写迁移与 seed 脚本，反而拖慢关键路径。**重启即清空是特性不是缺陷。**
 * TODO(BE-B, W3)：改为 SQLite + ORM（ARCHITECTURE §5），本文件换成 repository。
 */

const profiles = new Map<string, Profile>();

/**
 * 契约里的 MealLogResponse 不含 session_id（API.md §2.4），
 * 但按 session 查列表需要归属关系，所以存储层单独记，出接口时再剥掉。
 */
interface StoredMealLog {
  session_id: string;
  log: MealLogResponse;
}

const mealLogs = new Map<string, StoredMealLog>();

export const profileStore = {
  get(sessionId: string): Profile | undefined {
    return profiles.get(sessionId);
  },
  save(profile: Profile): Profile {
    profiles.set(profile.session_id, profile);
    return profile;
  },
  clear(): void {
    profiles.clear();
  },
};

export const mealLogStore = {
  get(id: string): StoredMealLog | undefined {
    return mealLogs.get(id);
  },
  save(sessionId: string, log: MealLogResponse): MealLogResponse {
    mealLogs.set(log.id, { session_id: sessionId, log });
    return log;
  },
  listBySession(sessionId: string): MealLogResponse[] {
    return [...mealLogs.values()]
      .filter((entry) => entry.session_id === sessionId)
      .map((entry) => entry.log)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  },
  clear(): void {
    mealLogs.clear();
  },
};

/** 测试用：清空全部假数据，避免用例互相污染 */
export function resetStores(): void {
  profileStore.clear();
  mealLogStore.clear();
}
