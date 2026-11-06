// 单条用餐记录读取：优先本地缓存（提交后立刻可见），回落 GET /meal-logs 查找。
// 契约里没有 GET /meal-logs/:id，因此按 id 精确定位只能靠列表过滤（待评审议题 Q3）。
import type { MealLogResponse } from '@canteen/shared';
import { listMealLogs } from '@/api/endpoints';
import type { ApiResult } from '@canteen/shared';

const NAMESPACE = 'cn.last_log';

function cacheKey(id: string): string {
  return `${NAMESPACE}.${id}`;
}

export function cacheMealLog(log: MealLogResponse): void {
  sessionStorage.setItem(cacheKey(log.id), JSON.stringify(log));
}

function readCache(id: string): MealLogResponse | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(id));
    return raw ? (JSON.parse(raw) as MealLogResponse) : null;
  } catch {
    return null;
  }
}

export async function findMealLog(
  sessionId: string,
  id: string,
): Promise<ApiResult<MealLogResponse>> {
  const cached = readCache(id);
  if (cached) return { ok: true, data: cached };
  const result = await listMealLogs({ session_id: sessionId, page: 1, page_size: 50 });
  if (!result.ok) return result;
  const found = result.data.logs.find((log) => log.id === id);
  if (found) return { ok: true, data: found };
  return {
    ok: false,
    error: { code: 'NOT_FOUND', message: '没找到这条用餐记录，可能已被清理' },
  };
}
