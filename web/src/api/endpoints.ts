// 用户端接口封装（docs/API.md §2）。字段名与 API.md 一字不改。
import type {
  InsightsSummaryResponse,
  MealLogItemInput,
  MealLogResponse,
  MealLogRequest,
  MealLogListResponse,
  Meal,
  MenuResponse,
  Profile,
  ProfileInput,
  RecommendationRequest,
  RecommendationResponse,
} from '@canteen/shared';
import { buildQuery, request } from './client';
import type { QueryValue } from './client';

export interface MenuQuery {
  meal?: Meal;
  include_inactive?: boolean;
}

export function getMenu(query: MenuQuery = {}) {
  return request<MenuResponse>('GET', `/menu${buildQuery(query as Record<string, QueryValue>)}`);
}

export function saveProfile(input: ProfileInput) {
  return request<Profile>('POST', '/profiles', { body: input });
}

export function getProfile(sessionId: string) {
  return request<Profile>('GET', `/profiles/me${buildQuery({ session_id: sessionId })}`);
}

export function createRecommendation(input: RecommendationRequest) {
  return request<RecommendationResponse>('POST', '/recommendations', { body: input });
}

/**
 * 采纳快照（API.md v1.2.5，BE-A 第 8 项）：服务端据此逐菜比对。
 * shared 尚未落字段，先在 web 侧本地扩展；shared 更新后删掉本类型改用它。
 */
export interface AdoptedComboSnapshot {
  id: string;
  items: MealLogItemInput[];
}

export type MealLogPayload = MealLogRequest & {
  adopted_combo?: AdoptedComboSnapshot;
};

export function createMealLog(input: MealLogPayload) {
  return request<MealLogResponse>('POST', '/meal-logs', { body: input });
}

export function listMealLogs(query: {
  session_id: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}) {
  return request<MealLogListResponse>('GET', `/meal-logs${buildQuery(query)}`);
}

export function getInsightsSummary(query: { session_id: string; days?: number }) {
  return request<InsightsSummaryResponse>('GET', `/insights/summary${buildQuery(query)}`);
}
