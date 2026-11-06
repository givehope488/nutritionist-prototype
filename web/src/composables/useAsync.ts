// 请求状态机：把 loading / error / 空态 / 重复提交收敛到一处，页面不各写一套。
import { ref, type Ref } from 'vue';
import type { ApiError, ApiResult } from '@shared/types';

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseAsync<T> {
  status: Ref<AsyncStatus>;
  data: Ref<T | null>;
  error: Ref<ApiError | null>;
  /** 进行中时忽略重复调用，避免弱网下重复提交 */
  run: () => Promise<T | null>;
}

export function useAsync<T>(task: () => Promise<ApiResult<T>>): UseAsync<T> {
  const status = ref<AsyncStatus>('idle');
  const data = ref<T | null>(null) as Ref<T | null>;
  const error = ref<ApiError | null>(null);

  async function run(): Promise<T | null> {
    if (status.value === 'loading') return null;
    status.value = 'loading';
    error.value = null;
    const result = await task();
    if (result.ok) {
      data.value = result.data;
      status.value = 'success';
      return result.data;
    }
    error.value = result.error;
    status.value = 'error';
    return null;
  }

  return { status, data, error, run };
}
