import type { Request } from 'express';
import type { ApiErrorField } from '@canteen/shared';
import { HttpError } from './errors';

/**
 * 请求校验的小工具集（手写，不引 zod）。
 *
 * 为什么手写：本项目依赖由 BE-B 统一管理，W1-W3 只有 3 周，为几个端点引入一个
 * 依赖 + 一套 schema 风格，收益不如保持「和 routes/menu.ts 一样的守卫风格」。
 * 若后续端点数量和嵌套明显变复杂，再单独提依赖变更（TEXT_ENGINE 之外的议题）。
 *
 * 约定：校验失败一律 throw HttpError('VALIDATION_ERROR', ...)，
 * fields 里的 path 用契约里的字段路径（如 items[0].servings），前端据此定位。
 */
export function invalid(fields: ApiErrorField[], message = '请求参数不合法'): never {
  throw new HttpError('VALIDATION_ERROR', message, fields);
}

/** 请求体必须是 JSON 对象（数组/原始值都算非法） */
export function bodyObject(req: Request): Record<string, unknown> {
  const body: unknown = req.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    invalid([{ path: '(body)', issue: '请求体必须是 JSON 对象' }]);
  }
  return body as Record<string, unknown>;
}

export interface NumOptions {
  min?: number;
  max?: number;
  integer?: boolean;
}

export function requireString(
  source: Record<string, unknown>,
  key: string,
  path: string = key,
  maxLength = 256,
): string {
  const value = source[key];
  if (typeof value !== 'string' || value.length === 0) {
    invalid([{ path, issue: '必填字符串' }]);
  }
  if (value.length > maxLength) {
    invalid([{ path, issue: `长度不得超过 ${maxLength}` }]);
  }
  return value;
}

export function requireNumber(
  source: Record<string, unknown>,
  key: string,
  path: string = key,
  options: NumOptions = {},
): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    invalid([{ path, issue: '必填数字' }]);
  }
  if (options.integer === true && !Number.isInteger(value)) {
    invalid([{ path, issue: '必须是整数' }]);
  }
  if (options.min !== undefined && value < options.min) {
    invalid([{ path, issue: `不得小于 ${options.min}` }]);
  }
  if (options.max !== undefined && value > options.max) {
    invalid([{ path, issue: `不得大于 ${options.max}` }]);
  }
  return value;
}

export function requireEnum<T extends string>(
  source: Record<string, unknown>,
  key: string,
  path: string,
  allowed: readonly T[],
): T {
  const value = source[key];
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    invalid([{ path, issue: `取值须为 ${allowed.join(' / ')}` }]);
  }
  return value as T;
}

export function optionalEnum<T extends string>(
  source: Record<string, unknown>,
  key: string,
  path: string,
  allowed: readonly T[],
): T | undefined {
  if (source[key] === undefined) return undefined;
  return requireEnum(source, key, path, allowed);
}

/** 字符串数组；给了 allowed 时逐项校验（如 avoid 必须是已下发的忌口 key） */
export function requireStringArray(
  source: Record<string, unknown>,
  key: string,
  path: string,
  allowed?: readonly string[],
): string[] {
  const value = source[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    invalid([{ path, issue: '必须是字符串数组' }]);
  }
  const items: string[] = [];
  value.forEach((item, index) => {
    if (typeof item !== 'string') {
      invalid([{ path: `${path}[${index}]`, issue: '必须是字符串' }]);
    }
    if (allowed !== undefined && !allowed.includes(item)) {
      invalid([{ path: `${path}[${index}]`, issue: `未知取值 ${item}` }]);
    }
    items.push(item);
  });
  return items;
}

/** query 参数里的正整数（分页用），缺省给默认值 */
export function queryInt(
  source: Record<string, unknown>,
  key: string,
  defaultValue: number,
  options: NumOptions = {},
): number {
  const raw = source[key];
  if (raw === undefined) return defaultValue;
  const parsed = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    invalid([{ path: key, issue: '必须是整数' }]);
  }
  if (options.min !== undefined && parsed < options.min) {
    invalid([{ path: key, issue: `不得小于 ${options.min}` }]);
  }
  if (options.max !== undefined && parsed > options.max) {
    invalid([{ path: key, issue: `不得大于 ${options.max}` }]);
  }
  return parsed;
}

/** query 参数里的必填字符串 */
export function queryString(source: Record<string, unknown>, key: string): string {
  const raw = source[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || value.length === 0) {
    invalid([{ path: key, issue: '必填查询参数' }]);
  }
  return value;
}

/** query 参数里的可选日期（YYYY-MM-DD） */
export function queryDate(source: Record<string, unknown>, key: string): string | undefined {
  const raw = source[key];
  if (raw === undefined) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    invalid([{ path: key, issue: '日期格式须为 YYYY-MM-DD' }]);
  }
  return value;
}
