// FE-A 主流程三页（建档 / 目标与忌口 / 推荐）的行为单测：
// 区间提示与契约同源、值来自服务端、换一批=重新请求、忌口无解用服务端 notice、未成年禁用减脂。
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { ApiResult, Profile, ProfileInput, RecommendationResponse } from '@canteen/shared';
import { createRecommendation, getProfile, saveProfile } from '@/api/endpoints';
import { routes } from '@/router';
import { sessionId } from '@/composables/useSession';
import GoalView from '@/views/goal/GoalView.vue';
import MineView from '@/views/mine/MineView.vue';
import ProfileView from '@/views/profile/ProfileView.vue';
import RecommendView from '@/views/recommend/RecommendView.vue';

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    createRecommendation: typeof createRecommendation;
    [key: string]: unknown;
  };
  return { ...actual, createRecommendation: vi.fn(actual.createRecommendation) };
});

const baseProfile: ProfileInput = {
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

async function seedProfile(overrides: Partial<ProfileInput> = {}): Promise<Profile> {
  const result = await saveProfile({ ...baseProfile, ...overrides });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.data;
}

async function startRouter(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push(path);
  await router.isReady();
  return router;
}

/** Mock 网络 0ms 延迟走的是 setTimeout，单靠 flushPromises 不够 */
async function settle(times = 4): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flushPromises();
  }
}

describe('建档页', () => {
  it('区间提示与 PROFILE_BOUNDS 同源；越界被拦下，合法后回首页', async () => {
    const router = await startRouter('/profile');
    const wrapper = mount(ProfileView, { global: { plugins: [router] } });
    await settle();

    expect(wrapper.text()).toContain('140~210');
    expect(wrapper.text()).toContain('35~150');
    expect(wrapper.text()).toContain('14~70');
    // 2026-11-25：建档页直接提供四档饮食目标（保持 / 减肥 / 增肌 / 增重）
    expect(wrapper.findAll('input[type="radio"][name="goal"]')).toHaveLength(4);
    expect(wrapper.text()).toContain('增重');

    const inputs = wrapper.findAll('input.numfield__input');
    expect(inputs.length).toBe(3);
    await inputs[0].setValue('100');
    await inputs[1].setValue('65');
    await inputs[2].setValue('20');
    await wrapper.get('button.btn--primary').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('取值须在 140~210');
    const rejected = await getProfile(sessionId);
    expect(rejected.ok).toBe(false);

    await inputs[0].setValue('172');
    // 选「增重」再保存：目标必须随档案一起落库，而不是永远带默认值
    await wrapper.get('input[type="radio"][value="weight_gain"]').setValue();
    await wrapper.get('button.btn--primary').trigger('click');
    await settle();
    // 2026-11-24：建档完成后回首页，忌口改从个人中心进
    expect(router.currentRoute.value.name).toBe('home');

    const saved = await getProfile(sessionId);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.data.bmi).toBeGreaterThan(0);
    expect(saved.data.goal).toBe('weight_gain');
    expect(saved.data.day_kcal).toBe(2624); // 2282×1.15
  });
});

describe('个人中心', () => {
  it('四档目标直接在表单里改：选减肥保存后日目标 1826、概览显示减肥', async () => {
    await seedProfile();
    const router = await startRouter('/mine');
    const wrapper = mount(MineView, { global: { plugins: [router] } });
    await settle();

    expect(wrapper.findAll('input[type="radio"][name="goal"]')).toHaveLength(4);
    expect(wrapper.text()).toContain('保持');

    await wrapper.get('input[type="radio"][value="lose"]').setValue();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存修改')!
      .trigger('click');
    await settle();

    const saved = await getProfile(sessionId);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.data.goal).toBe('lose');
    expect(saved.data.day_kcal).toBe(1826);
    expect(wrapper.text()).toContain('已保存');
    expect(wrapper.text()).toContain('减肥');
  });

  it('未成年档案：个人中心同样锁住减肥选项', async () => {
    await seedProfile({ age: 16 });
    const router = await startRouter('/mine');
    const wrapper = mount(MineView, { global: { plugins: [router] } });
    await settle();

    const lose = wrapper.find('input[type="radio"][value="lose"]');
    expect((lose.element as HTMLInputElement).disabled).toBe(true);
    expect(wrapper.text()).toContain('未满 18 岁');
  });
});

describe('目标与忌口页', () => {
  it('忌口选项来自服务端菜单；保存后 goal / avoid 落库，并展示服务端派生值', async () => {
    const profile = await seedProfile();
    const router = await startRouter('/goal');
    const wrapper = mount(GoalView, { global: { plugins: [router] } });
    await settle();

    expect(wrapper.findAll('.chip').length).toBe(9);
    expect(wrapper.text()).toContain(String(profile.day_kcal));

    await wrapper.find('input[type="radio"][value="lose"]').setValue();
    await wrapper
      .findAll('.chip')
      .find((chip) => chip.text().includes('素食'))!
      .trigger('click');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '只保存目标')!
      .trigger('click');
    await settle();

    const saved = await getProfile(sessionId);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.data.goal).toBe('lose');
    expect(saved.data.avoid).toContain('nomeat');
    expect(wrapper.text()).toContain('已保存');
  });

  it('未满 18 岁禁用减脂并给出原因', async () => {
    await seedProfile({ age: 16 });
    const router = await startRouter('/goal');
    const wrapper = mount(GoalView, { global: { plugins: [router] } });
    await settle();

    const lose = wrapper.find('input[type="radio"][value="lose"]');
    expect((lose.element as HTMLInputElement).disabled).toBe(true);
    expect(wrapper.text()).toContain('未满 18 岁');
  });
});

describe('推荐页', () => {
  it('渲染服务端组合并写入采纳缓存；换一批再次 POST；采纳跳回填', async () => {
    await seedProfile();
    const mocked = vi.mocked(createRecommendation);
    mocked.mockClear();

    const router = await startRouter('/recommend');
    const wrapper = mount(RecommendView, { global: { plugins: [router] } });
    await settle();

    expect(mocked).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('本餐目标');
    const titles = wrapper.findAll('.combo__title');
    expect(titles.length).toBeGreaterThan(0);
    expect(titles.length).toBeLessThanOrEqual(3);

    const cached = JSON.parse(localStorage.getItem('cn.last_recommendation') ?? 'null') as {
      response: RecommendationResponse;
    } | null;
    expect(cached?.response.combos.length).toBe(titles.length);

    await wrapper.get('button.page__refresh').trigger('click');
    await settle();
    expect(mocked).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).not.toContain('￥');

    await wrapper
      .findAll('button')
      .find((button) => button.text() === '就去吃这组')!
      .trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('log');
    expect(router.currentRoute.value.query.meal).toBe('lunch');
    expect(router.currentRoute.value.query.combo).toBeTruthy();
  });

  it('忌口无解时展示服务端 notice，放宽入口回到目标页', async () => {
    await seedProfile();
    const empty: ApiResult<RecommendationResponse> = {
      ok: true,
      data: {
        target: {
          day_kcal: 2000,
          meal_ratio: 0.4,
          kcal: 800,
          protein_g: 20,
          fat_g: 25,
          carbs_g: 110,
          sodium_mg: 700,
        },
        combos: [],
        notice: '测试文案：放宽一两个忌口再试',
      },
    };
    vi.mocked(createRecommendation).mockResolvedValueOnce(empty);

    const router = await startRouter('/recommend');
    const wrapper = mount(RecommendView, { global: { plugins: [router] } });
    await settle();

    expect(wrapper.text()).toContain('测试文案：放宽一两个忌口再试');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('放宽一两个忌口'))!
      .trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('goal');
  });

  it('没有档案时给出建档入口', async () => {
    const router = await startRouter('/recommend');
    const wrapper = mount(RecommendView, { global: { plugins: [router] } });
    await settle();

    expect(wrapper.text()).toContain('还没有建档');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '去建档')!
      .trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('profile');
  });
});
