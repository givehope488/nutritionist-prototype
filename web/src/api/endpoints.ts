// 用户端接口封装（docs/API.md §2）。字段名与 API.md 一字不改。
import type {
  InsightsSummary,
  MealLog,
  MealLogInput,
  MealLogListResponse,
  MealType,
  MenuResponse,
  Profile,
  ProfileInput,
  RecommendRequest,
  RecommendationResponse,
} from '@shared/types';
import { buildQuery, request } from './client';
import type { QueryValue } from './client';

export interface MenuQuery {
  meal?: MealType;
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

export function createRecommendation(input: RecommendRequest) {
  return request<RecommendationResponse>('POST', '/recommendations', { body: input });
}

export function createMealLog(input: MealLogInput) {
  return request<MealLog>('POST', '/meal-logs', { body: input });
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
  return request<InsightsSummary>('GET', `/insights/summary${buildQuery(query)}`);
}
