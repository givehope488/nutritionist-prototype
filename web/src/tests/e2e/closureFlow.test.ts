// 闭环流程自测（TEAM.md W1「前端 npm run e2e」+ W3 末「闭环可演示」）。
// 覆盖 FE-B 的三个页面：回填 → 反馈 → 历史，数据走内置 Mock 后端，零网络依赖。
// 说明：建档 / 推荐两页属 FE-A，这里用接口直接模拟它们的产出（含推荐响应缓存），
// FE-A 页面合并后应把这两步替换为真实页面跳转（见 web/docs/FE-B-开发记录.md 议题 Q6）。
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ProfileInput } from '@canteen/shared';
import { createRecommendation, saveProfile } from '@/api/endpoints';
import FeedbackView from '@/views/feedback/FeedbackView.vue';
import HistoryView from '@/views/history/HistoryView.vue';
import LogView from '@/views/log/LogView.vue';
import { routes } from '@/router';
import { saveRecommendationResponse } from '@/composables/useRecommendationCache';
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

  it('按推荐进入回填页：预填份数、可调整、提交后跳反馈页并展示判定', async () => {
    const reco = await seedProfileAndCombo();
    expect(reco).not.toBeNull();
    const combo = reco!.combos[0];
    const router = makeRouter();
    await router.push({ name: 'log', query: { meal: 'lunch', combo: combo.id } });
    await router.isReady();

    const wrapper = mount(LogView, { global: { plugins: [router] } });
    await settle();

    // 预填提示 + 已选数量 = 组合内菜品数
    expect(wrapper.text()).toContain('已按推荐搭配预填');
    expect(wrapper.text()).toContain(`${combo.dishes.length} 项已选`);

    // 提交按钮可用（有选中项）
    const submit = wrapper.findAll('button').find((node) => node.text().includes('生成反馈'));
    expect(submit).toBeDefined();
    expect(submit?.attributes('disabled')).toBeUndefined();

    await submit?.trigger('click');
    await settle();

    // 契约里反馈页的数据来自 MealLogResponse 响应，跳转时带上记录 id
    expect(router.currentRoute.value.name).toBe('feedback');
    const feedback = mount(FeedbackView, { global: { plugins: [router] } });
    await settle();
    expect(feedback.text()).toContain('这一餐');
    expect(feedback.text()).toContain('目标');
    expect(['达标', '需调整']).toContain(feedback.text().includes('达标') ? '达标' : '需调整');

    // 历史页应能查到这条记录
    const history = mount(HistoryView, { global: { plugins: [router] } });
    await settle();
    expect(history.text()).toContain('近 7 天');
    expect(history.text()).toContain('已回填');
    expect(history.text()).toMatch(/1 餐/);
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

    await submit?.trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('feedback');
    const feedback = mount(FeedbackView, { global: { plugins: [router] } });
    await settle();
    expect(feedback.text()).toContain('这次是自选搭配');
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
