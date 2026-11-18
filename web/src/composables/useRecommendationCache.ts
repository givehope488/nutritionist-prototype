// 推荐响应缓存：回填页「按推荐预填」的数据来源。
// 契约里没有 GET /recommendations/:combo_id，combo.id 只做关联提交的标识，
// 因此组合明细只能由前端在推荐响应里自取（API.md §2.3「有效期 24 小时」按本地缓存实现）。
// 调用约定：FE-A 推荐页在拿到响应后调用 saveRecommendationResponse(response, meal)。
import type { Combo, Meal, RecommendationResponse } from '@canteen/shared';
import type { AdoptedComboSnapshot } from '@/api/endpoints';

const STORAGE_KEY = 'cn.last_recommendation';
const TTL_MS = 24 * 60 * 60 * 1000;

interface CachedRecommendation {
  session_id: string;
  meal: Meal;
  cached_at: number;
  response: RecommendationResponse;
}

export function saveRecommendationResponse(
  sessionId: string,
  meal: Meal,
  response: RecommendationResponse,
): void {
  const payload: CachedRecommendation = {
    session_id: sessionId,
    meal,
    cached_at: Date.now(),
    response,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function read(): CachedRecommendation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedRecommendation;
    if (Date.now() - cached.cached_at > TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

/**
 * combo.id 有效期 24 小时；过期或不存在返回 null，页面回落为自选回填。
 * 传 meal 时还要校验缓存来自同一餐段——回填页切换餐次后不能把上一餐的组合预填进来。
 */
export function findCachedCombo(comboId: string, sessionId: string, meal?: Meal) {
  const cached = read();
  if (!cached || cached.session_id !== sessionId) return null;
  if (meal !== undefined && cached.meal !== meal) return null;
  return cached.response.combos.find((combo) => combo.id === comboId) ?? null;
}

export function clearRecommendationCache(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 采纳快照：份数取推荐当时的份数，不是用户回填时调整后的实际份数——
 * 两者不同，服务端才能判定「按推荐吃」还是「改了份量」（PD 2026-11-17 采纳率口径）。
 */
export function buildAdoptedSnapshot(combo: Combo): AdoptedComboSnapshot {
  return {
    id: combo.id,
    items: combo.dishes.map((dish) => ({ dish_id: dish.id, servings: dish.servings })),
  };
}
