// 2026-11-24 导航改版的行为护栏：
// 首页四张卡是唯一入口、建档页只服务新用户（已有档案即回首页）、回填页「已选」能看到并清空已选。
import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { ProfileInput } from '@canteen/shared';
import { saveProfile } from '@/api/endpoints';
import { routes } from '@/router';
import { sessionId } from '@/composables/useSession';
import HomeView from '@/views/home/HomeView.vue';
import LogView from '@/views/log/LogView.vue';
import ProfileView from '@/views/profile/ProfileView.vue';

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

async function settle(times = 6): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flushPromises();
  }
}

async function startRouter(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push(path);
  await router.isReady();
  return router;
}

describe('首页导航', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('未建档时给出建档入口，四张卡分别跳到对应页面', async () => {
    const router = await startRouter('/');
    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    await settle();

    expect(wrapper.text()).toContain('还没有建档');
    expect(wrapper.text()).toContain('去建档');

    for (const [label, name] of [
      ['饮食推荐', 'recommend'],
      ['用餐回填', 'log'],
      ['营养历史', 'history'],
      ['个人中心', 'mine'],
    ] as const) {
      const entry = wrapper.findAll('button').find((node) => node.text().includes(label));
      await entry?.trigger('click');
      await settle();
      expect(router.currentRoute.value.name).toBe(name);
    }
  });

  it('已有档案时首页展示 BMI 与日目标', async () => {
    const saved = await saveProfile(profile);
    expect(saved.ok).toBe(true);
    const router = await startRouter('/');
    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    await settle();

    expect(wrapper.text()).toContain('BMI');
    expect(wrapper.text()).toContain(String(saved.ok ? saved.data.day_kcal : ''));
    expect(wrapper.text()).not.toContain('还没有建档');
  });

  it('已有档案访问建档页会直接回首页（建档页只服务新用户）', async () => {
    const saved = await saveProfile(profile);
    expect(saved.ok).toBe(true);
    const router = await startRouter('/profile');
    mount(ProfileView, { global: { plugins: [router] } });
    await settle();

    expect(router.currentRoute.value.name).toBe('home');
  });
});

describe('回填页「已选」分类', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('选了两道菜后可在已选里看到，并能一键清空', async () => {
    const saved = await saveProfile(profile);
    expect(saved.ok).toBe(true);
    const router = await startRouter('/log?meal=lunch');
    const wrapper = mount(LogView, { global: { plugins: [router] } });
    await settle(8);

    // 菜品列表里点两个「+」
    const plus = wrapper.findAll('.stepper__btn').filter((node) => node.text() === '+');
    await plus[0].trigger('click');
    await plus[1].trigger('click');
    await settle();

    const selectedTab = wrapper.findAll('button[role="tab"]').find((node) => node.text().startsWith('已选'));
    expect(selectedTab?.text()).toContain('2');
    await selectedTab?.trigger('click');
    await settle();

    // 已选分类下列出两道菜，且不再显示楼层 / 店铺筛选
    expect(wrapper.findAll('.picked .dish')).toHaveLength(2);
    expect(wrapper.text()).not.toContain('楼层');
    expect(wrapper.text()).toContain('2 项已选');

    await wrapper
      .findAll('button')
      .find((node) => node.text() === '清空')!
      .trigger('click');
    await settle();
    expect(wrapper.text()).toContain('0 项已选');
    expect(wrapper.text()).toContain('还没选菜');
  });
});
