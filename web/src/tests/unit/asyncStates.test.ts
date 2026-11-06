// 弱网 / 断网 / 重复提交的前端行为（TEAM.md W5「异常与边界」中 FE-B 的部分）
import { describe, expect, it } from 'vitest';
import { useAsync } from '@/composables/useAsync';
import { transportError } from '@/api/client';

describe('useAsync 状态机', () => {
  it('loading → success，data 有值', async () => {
    const state = useAsync<{ n: number }>(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: true, data: { n: 1 } };
    });
    const pending = state.run();
    expect(state.status.value).toBe('loading');
    await pending;
    expect(state.status.value).toBe('success');
    expect(state.data.value?.n).toBe(1);
  });

  it('error 分支保留错误对象供页面渲染', async () => {
    const state = useAsync<never>(async () => ({
      ok: false,
      error: { code: 'RATE_LIMITED', message: '操作太快了' },
    }));
    await state.run();
    expect(state.status.value).toBe('error');
    expect(state.error.value?.code).toBe('RATE_LIMITED');
  });

  it('进行中重复调用被忽略（防弱网双击重复提交）', async () => {
    let calls = 0;
    const state = useAsync<number>(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: true, data: calls };
    });
    const first = state.run();
    const second = await state.run();
    expect(second).toBeNull();
    await first;
    expect(calls).toBe(1);
  });
});

describe('传输层失败', () => {
  it('断网收敛为 INTERNAL + 可操作文案（契约里没有客户端网络错误码）', () => {
    const result = transportError(new TypeError('Failed to fetch'));
    if (result.ok) throw new Error('transportError 只应返回失败分支');
    expect(result.error.code).toBe('INTERNAL');
    expect(result.error.message).toContain('网络');
  });

  it('主动取消请求不当成服务异常', () => {
    const result = transportError(new DOMException('aborted', 'AbortError'));
    if (result.ok) throw new Error('transportError 只应返回失败分支');
    expect(result.error.message).toBe('请求已取消');
  });
});
