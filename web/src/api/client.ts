// 唯一 HTTP 出口：契约解包逻辑只写在这一处（API.md §0.8）。
// 业务代码只见 ApiResult<T> 两种形态，禁止各自判断 res.data / res。
import { API_PREFIX } from '@shared/constants';
import type { ApiError, ApiResult } from '@shared/types';
import { handleMockRequest } from './__mock__';

const RAW_BASE = import.meta.env.VITE_API_BASE ?? 'mock://local';
const BASE = RAW_BASE.replace(/\/+$/, '');

/** mock:// 前缀时走内置假后端；其余走真实服务（切换只改环境变量，COLLAB.md 防线 4） */
export const isMockMode = BASE.startsWith('mock://');

export type QueryValue = string | number | boolean | null | undefined;

export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function toApiError(status: number, payload: unknown): ApiError {
  const error = (payload as { error?: Partial<ApiError> } | null)?.error;
  if (error?.code) {
    return {
      code: error.code,
      message: error.message ?? '请求失败',
      ...(error.fields?.length ? { fields: error.fields } : {}),
    };
  }
  // 非契约形态的响应（网关错误、空 body 等）统一收敛为 INTERNAL，前端走通用错误页
  return {
    code: 'INTERNAL',
    message: status >= 500 ? '服务暂时不可用，请稍后再试' : '响应格式不符合接口协定',
  };
}

export interface RequestOptions {
  body?: unknown;
  /** 管理端接口用 X-Admin-Token（本次 FE-B 用户端范围未使用） */
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * 传输层失败（断网 / 超时）在契约里没有对应错误码，新增码须走接口变更流程；
 * 当前按 §1 表格最接近的 INTERNAL 收敛，message 用可操作文案。
 * 待 BE-A 评审是否补 CLIENT_NETWORK_ERROR（见 web/docs/FE-B-开发记录.md 待评审议题 Q7）。
 */
export function transportError(cause: unknown): ApiResult<never> {
  return {
    ok: false,
    error: {
      code: 'INTERNAL',
      message:
        cause instanceof DOMException && cause.name === 'AbortError'
          ? '请求已取消'
          : '网络连接失败，请检查网络后重试',
    },
  };
}

export async function request<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const url = `${BASE}${API_PREFIX}${path}`;
  let status: number;
  let payload: unknown;

  try {
    if (isMockMode) {
      const res = await handleMockRequest(method, url, options.body);
      status = res.status;
      payload = res.body;
    } else {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers ?? {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      });
      status = res.status;
      payload = res.ok ? await res.json().catch(() => null) : await res.json().catch(() => null);
    }
  } catch (cause) {
    return transportError(cause);
  }

  if (status >= 200 && status < 300) {
    // 成功直接返回业务对象，不剥包装层
    return { ok: true, data: payload as T };
  }
  return { ok: false, error: toApiError(status, payload) };
}
