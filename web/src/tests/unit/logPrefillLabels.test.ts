// PD 视觉走查 P2-3：回填页加载期摘要不能漏出内部 dish_id。
// 场景：草稿里已有选中项（预填或上次留下的），但菜单还没回来——摘要应显示「菜单加载中…」。
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Dish, MenuResponse, ProfileInput } from '@canteen/shared';
import * as api from '@/api/endpoints';
import { saveProfile } from '@/api/endpoints';
import LogView from '@/views/log/LogView.vue';
import { routes } from '@/router';
import { sessionId } from '@/composables/useSession';
import { toDateStr } from '@/utils/display';

const profile: ProfileInput = {
  session_id: sessionId,
  sex: 'male',
  height_cm: 172,
  weight_kg: 65,
  age: 20,
  activity: 'mid',
  goal: 'health',
  avoid: [],
  default_meal: 'lunch',
};

function dish(id: string, name: string): Dish {
  return {
    id,
    name,
    category: 'staple',
    portion_label: '1 碗',
    meals: ['lunch'],
    kcal: 200,
    protein_g: 4,
    fat_g: 1,
    carbs_g: 44,
    sodium_mg: 2,
    tags: [],
    drink: false,
    reliability: 'A',
    status: 'active',
  };
}

async function settle(ticks = 4): Promise<void> {
  for (let index = 0; index < ticks; index += 1) {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('回填页摘要的加载态', () => {
  it('菜单未就绪时不显示 dish_id，显示「菜单加载中…」；菜单回来后换成菜名', async () => {
    localStorage.clear();
    sessionStorage.clear();
    const saved = await saveProfile(profile);
    expect(saved.ok).toBe(true);

    // 草稿与 useLogDraft 的存储口径一致：cn.draft.<session>.<date>.<meal>
    const today = toDateStr(new Date());
    sessionStorage.setItem(
      `cn.draft.${sessionId}.${today}.lunch`,
      JSON.stringify({ id: 'draft-p2-3', items: { s01: 1, m10: 0.5, v06: 1 } }),
    );

    let release: (value: Awaited<ReturnType<typeof api.getMenu>>) => void = () => {};
    vi.spyOn(api, 'getMenu').mockImplementation(
      () => new Promise((resolve) => {
        release = resolve;
      }),
    );

    const router = createRouter({ history: createMemoryHistory(), routes });
    await router.push({ name: 'log', query: { meal: 'lunch' } });
    await router.isReady();
    const wrapper = mount(LogView, { global: { plugins: [router] } });
    await settle();

    expect(wrapper.text()).toContain('菜单加载中…');
    expect(wrapper.text()).not.toContain('s01');
    expect(wrapper.text()).not.toContain('m10');

    release({
      ok: true,
      data: {
        dishes: [dish('s01', '白米饭'), dish('m10', '红烧肉'), dish('v06', '炒青菜')],
        avoid_options: [],
      } satisfies MenuResponse,
    });
    await settle();

    expect(wrapper.text()).toContain('白米饭、红烧肉、炒青菜');
    expect(wrapper.text()).not.toContain('菜单加载中…');
  });

  it('菜单加载失败时只显示对得上的菜名，不再回退到 id', async () => {
    localStorage.clear();
    sessionStorage.clear();
    const saved = await saveProfile(profile);
    expect(saved.ok).toBe(true);
    const today = toDateStr(new Date());
    sessionStorage.setItem(
      `cn.draft.${sessionId}.${today}.lunch`,
      JSON.stringify({ id: 'draft-p2-3-fail', items: { s01: 1 } }),
    );
    vi.spyOn(api, 'getMenu').mockResolvedValue({
      ok: false,
      error: { code: 'INTERNAL', message: '网络异常' },
    });

    const router = createRouter({ history: createMemoryHistory(), routes });
    await router.push({ name: 'log', query: { meal: 'lunch' } });
    await router.isReady();
    const wrapper = mount(LogView, { global: { plugins: [router] } });
    await settle();

    expect(wrapper.text()).toContain('1 项已选');
    expect(wrapper.text()).not.toContain('s01');
  });
});