import type { ErrorCode } from './types';

/** 所有业务端点的公共前缀（API.md §0.2） */
export const API_PREFIX = '/api/v1';

/** 份数步进与上限（API.md §2.4） */
export const SERVING_STEP = 0.5;
export const MAX_SERVINGS = 5;

/** 档案字段合法区间，前后端共用同一份校验边界（API.md §2.2） */
export const PROFILE_BOUNDS = {
  height_cm: { min: 140, max: 210 },
  weight_kg: { min: 35, max: 150 },
  age: { min: 14, max: 70 },
} as const;

/** 未成年不提供热量缺口方案（README 合规边界 2） */
export const MINOR_AGE = 18;

/** 错误码 → HTTP 状态码（API.md §1），前后端一致 */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/** 微信支付等外部依赖不在此列：本版仅做匿名 session */
export const SESSION_HEADER = 'x-session-id';
