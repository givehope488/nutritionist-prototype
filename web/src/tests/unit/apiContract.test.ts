// 契约护栏：响应包络与字段名必须与 docs/API.md 一致（COLLAB.md 防线 1/6 的「查契约」自动化）。
import { describe, expect, it } from 'vitest';
import { API_PREFIX } from '@canteen/shared';
import type { ProfileInput } from '@canteen/shared';
import { handleMockRequest } from '@/api/__mock__';
import { getMenu, getProfile, saveProfile } from '@/api/endpoints';

const url = (path: string) => `mock://local${API_PREFIX}${path}`;

const baseProfile: ProfileInput = {
  session_id: 'test-session',
  sex: 'male',
  height_cm: 172,
  weight_kg: 65,
  age: 20,
  activity: 'mid',
  goal: 'health',
  avoid: ['nospicy'],
  default_meal: 'lunch',
};

async function seedProfile(overrides: Partial<ProfileInput> = {}) {
  const result = await saveProfile({ ...baseProfile, ...overrides });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.data;
}

describe('响应包络（API.md §0.8）', () => {
  it('成功响应直接返回业务对象，不裹 data/ok/result', async () => {
    const res = await handleMockRequest('GET', url('/menu?meal=lunch'), undefined);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body as object).sort()).toEqual(['avoid_options', 'dishes']);
    expect(res.body).not.toHaveProperty('data');
  });

  it('失败响应只有单一 error 对象，code 取自错误码表', async () => {
    const res = await handleMockRequest('GET', url('/nope'), undefined);
    expect(res.status).toBe(404);
    const body = res.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe('NOT_FOUND');
    expect(Object.keys(body)).toEqual(['error']);
  });

  it('参数越界返回 VALIDATION_ERROR 且带 fields 定位', async () => {
    const res = await saveProfile({ ...baseProfile, height_cm: 130 });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('VALIDATION_ERROR');
    expect(res.error.fields).toEqual([{ path: 'height_cm', issue: '取值须在 140~210' }]);
  });

  it('未知忌口选项视为非法枚举', async () => {
    const res = await saveProfile({ ...baseProfile, avoid: ['no_such_key'] });
    expect(res.ok).toBe(false);
  });

  it('菜单 meal 参数非法时按 §1 提示修正', async () => {
    const res = await getMenu({ meal: 'midnight' as never });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.fields?.[0]?.path).toBe('meal');
  });
});

describe('档案派生值（附录 A 口径）', () => {
  it('男 172cm/65kg/20 岁 mid health：与 API.md §2.2 示例逐字段一致', async () => {
    const profile = await seedProfile();
    expect(profile.bmi).toBe(21.97);
    expect(profile.bmi_tag).toBe('正常');
    expect(profile.day_kcal).toBe(2282);
    expect(profile.warnings).toEqual([]);
  });

  it('减脂目标按 ×0.8 计算，且不低于 BMR×1.05', async () => {
    const profile = await seedProfile({ goal: 'lose' });
    // BMR = 1630，×1.4×0.8 = 1825.6 → 1826；下限 1630×1.05 = 1711.5 不触发
    expect(profile.day_kcal).toBe(1826);
  });

  it('未成年 + 减脂：服务端强制降级 health 并回 warnings（双保险的另一半）', async () => {
    const profile = await seedProfile({ age: 16, goal: 'lose' });
    expect(profile.goal).toBe('health');
    expect(profile.warnings).toEqual(['未满18岁不提供热量缺口方案，已调整为日常保健']);
  });

  it('档案不存在时返回 404，前端可据此引导建档', async () => {
    const res = await getProfile('nobody-here');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('NOT_FOUND');
  });
});
