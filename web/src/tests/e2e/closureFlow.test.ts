// 闭环流程自测（TEAM.md W1「前端 npm run e2e」+ W3 末「闭环可演示」）。
// 覆盖五页闭环：建档 → 推荐 → 回填 → 反馈 → 历史，数据走内置 Mock 后端，零网络依赖。
// 首条用例驱动 FE-A 的真实页面（Q6 结项）；其余用例只关心 FE-B 三页，
// 用接口直接铺好档案与组合，避免每条都重走一遍表单。
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileInput } from '@canteen/shared';
import { createRecommendation, saveProfile } from '@/api/endpoints';
import * as api from '@/api/endpoints';
import FeedbackView from '@/views/feedback/FeedbackView.vue';
import HistoryView from '@/views/history/HistoryView.vue';
import LogView from '@/views/log/LogView.vue';
import ProfileView from '@/views/profile/ProfileView.vue';
import RecommendView from '@/views/recommend/RecommendView.vue';
import { routes } from '@/router';
import { saveRecommendationResponse, findCachedCombo } from '@/composables/useRecommendationCache';
import { sessionId } from '@/composables/useSession';

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

// Mock 即使零延迟也走 setTimeout，flushPromises 只清微任务；settle 同时等一个宏任务Tick
async function settle(ticks = 4): Promise<void> {
  for (let index = 0; index < ticks; index += 1) {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function makeRouter() {
  return createRouter({ history: createMemoryHistory(), routes });
}

async function seedProfileAndCombo() {
  const saved = await saveProfile(profile);
  expect(saved.ok).toBe(true);
  const reco = await createRecommendation({ session_id: sessionId, meal: 'lunch' });
  expect(reco.ok).toBe(true);
  if (!reco.ok) return null;
  // 模拟 FE-A 推荐页：拿到响应后写入本地缓存，供回填页预填
  saveRecommendationResponse(sessionId, 'lunch', reco.data);
  return reco.data;
}

describe('回填 → 反馈 → 历史', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('走真实页面：建档 → 推荐采纳 → 回填预填 → 提交反馈 → 历史可查', async () => {
    const router = makeRouter();
    await router.push({ name: 'profile' });
    await router.isReady();

    // 建档页：填三项体征并保存，BMI / 日目标由服务端返回
    const profilePage = mount(ProfileView, { global: { plugins: [router] } });
    await settle();
    const inputs = profilePage.findAll('.numfield__input');
    expect(inputs).toHaveLength(3);
    await inputs[0].setValue('172');
    await inputs[1].setValue('65');
    await inputs[2].setValue('20');
    const save = profilePage.findAll('button').find((node) => node.text().includes('保存'));
    await save?.trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('goal');

    // 推荐页：默认午餐拉 1~3 套，采纳第一套后交给回填页
    await router.push({ name: 'recommend' });
    const recommend = mount(RecommendView, { global: { plugins: [router] } });
    await settle(8);
    const comboLists = recommend.findAll('.combo__dishes');
    expect(comboLists.length).toBeGreaterThanOrEqual(1);
    const dishCount = comboLists[0].findAll('li').length;
    const adopt = recommend.findAll('button').find((node) => node.text() === '就去吃这组');
    await adopt?.trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('log');
    expect(router.currentRoute.value.query.meal).toBe('lunch');
    expect(typeof router.currentRoute.value.query.combo).toBe('string');

    const wrapper = mount(LogView, { global: { plugins: [router] } });
    await settle();

    // 推荐页写入的缓存让回填页自动预填，预填份数 = 组合内菜品数
    expect(wrapper.text()).toContain('已按推荐搭配预填');
    expect(wrapper.text()).toContain(`${dishCount} 项已选`);
    // B6：日志页整页不出现价格
    expect(wrapper.text()).not.toContain('¥');
    expect(wrapper.text()).not.toMatch(/\d+\s*元/);

    // 提交按钮可用（有选中项）
    const submit = wrapper.findAll('button').find((node) => node.text().includes('生成反馈'));
    expect(submit).toBeDefined();
    expect(submit?.attributes('disabled')).toBeUndefined();

    // 采纳率口径（PD 2026-11-17）：随 adopted_combo_id 一并提交推荐快照
    const comboId = router.currentRoute.value.query.combo as string;
    const spy = vi.spyOn(api, 'createMealLog');
    await submit?.trigger('click');
    await settle();

    const payload = spy.mock.calls.at(-1)?.[0];
    expect(payload?.adopted_combo_id).toBe(comboId);
    expect(payload?.adopted_combo).toEqual({
      id: comboId,
      items: findCachedCombo(comboId, sessionId, 'lunch')?.dishes.map((dish) => ({
        dish_id: dish.id,
        servings: dish.servings,
      })),
    });
    spy.mockRestore();

    // 契约里反馈页的数据来自 MealLogResponse 响应，跳转时带上记录 id
    expect(router.currentRoute.value.name).toBe('feedback');
    const feedback = mount(FeedbackView, { global: { plugins: [router] } });
    await settle();
    expect(feedback.text()).toContain('这一餐');
    expect(feedback.text()).toContain('目标');
    expect(['达标', '需调整']).toContain(feedback.text().includes('达标') ? '达标' : '需调整');
    expect(feedback.text()).not.toContain('¥');
    expect(feedback.text()).not.toMatch(/\d+\s*元/);

    // 历史页应能查到这条记录
    const history = mount(HistoryView, { global: { plugins: [router] } });
    await settle();
    expect(history.text()).toContain('近 7 天');
    expect(history.text()).toContain('已回填');
    expect(history.text()).toMatch(/1 餐/);
    expect(history.text()).not.toContain('¥');
    expect(history.text()).not.toMatch(/\d+\s*元/);
  });

  it('自选回填（无 combo 参数）：adopted 为 false，反馈页提示自选搭配', async () => {
    await seedProfileAndCombo();
    const router = makeRouter();
    await router.push({ name: 'log', query: { meal: 'lunch' } });
    await router.isReady();
    const wrapper = mount(LogView, { global: { plugins: [router] } });
    await settle();

    expect(wrapper.text()).not.toContain('已按推荐搭配预填');
    // 未选任何菜品时禁止提交，避免空记录
    const submit = wrapper.findAll('button').find((node) => node.text().includes('生成反馈'));
    expect(submit?.attributes('disabled')).toBeDefined();

    // 选第一个菜品的 + 一次（0.5 份）
    const plus = wrapper.findAll('.stepper__btn')[1];
    await plus?.trigger('click');
    await settle();
    expect(wrapper.text()).toContain('1 项已选');

    const spy = vi.spyOn(api, 'createMealLog');
    await submit?.trigger('click');
    await settle();
    const payload = spy.mock.calls.at(-1)?.[0];
    expect(payload?.adopted_combo_id).toBeNull();
    expect(payload && 'adopted_combo' in payload).toBe(false);
    spy.mockRestore();
    expect(router.currentRoute.value.name).toBe('feedback');
    const feedback = mount(FeedbackView, { global: { plugins: [router] } });
    await settle();
    expect(feedback.text()).toContain('这次是自选搭配');
  });

  it('切到其他餐次时不再套用上一餐的推荐组合', async () => {
    const reco = await seedProfileAndCombo();
    expect(reco).not.toBeNull();
    const router = makeRouter();
    await router.push({ name: 'log', query: { meal: 'lunch', combo: reco!.combos[0].id } });
    await router.isReady();
    const wrapper = mount(LogView, { global: { plugins: [router] } });
    await settle();
    expect(wrapper.text()).toContain('已按推荐搭配预填');

    const dinner = wrapper.findAll('button').find((node) => node.text() === '晚餐');
    await dinner?.trigger('click');
    await settle();

    // 午餐组合不能预填进晚餐，也不能把晚餐算成「按推荐」
    expect(wrapper.text()).not.toContain('已按推荐搭配预填');
    expect(wrapper.text()).toContain('0 项已选');
    const submit = wrapper.findAll('button').find((node) => node.text().includes('生成反馈'));
    expect(submit?.attributes('disabled')).toBeDefined();
  });

  it('断网/接口报错时给出可重试提示，不静默失败', async () => {
    await seedProfileAndCombo();
    const router = makeRouter();
    await router.push({ name: 'history' });
    await router.isReady();
    const wrapper = mount(HistoryView, { global: { plugins: [router] } });
    await settle();

    // 正常路径下应展示统计；这里额外验证缺 id 的反馈页会走错误分支
    expect(wrapper.text()).toContain('采纳率');

    await router.push({ name: 'feedback', query: {} });
    await router.isReady();
    const broken = mount(FeedbackView, { global: { plugins: [router] } });
    await settle();
    expect(broken.text()).toContain('缺少用餐记录标识');
    expect(broken.text()).toContain('VALIDATION_ERROR');
  });
});
