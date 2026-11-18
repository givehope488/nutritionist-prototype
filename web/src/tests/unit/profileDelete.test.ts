// 合规删除入口（PROGRESS §2.2 FE-A #5① / API.md v1.2.4 §2.2）：
// 二次确认文案必须写明「删除档案与全部用餐记录」；确认后服务端连带删除记录，本机缓存同步清理。
import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { ProfileInput, RecommendationResponse } from '@canteen/shared';
import {
  createMealLog,
  deleteProfile,
  getMenu,
  getProfile,
  listMealLogs,
  saveProfile,
} from '@/api/endpoints';
import { routes } from '@/router';
import { sessionId } from '@/composables/useSession';
import { saveRecommendationResponse } from '@/composables/useRecommendationCache';
import ProfileView from '@/views/profile/ProfileView.vue';

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

async function seedProfile(overrides: Partial<ProfileInput> = {}): Promise<void> {
  const result = await saveProfile({ ...baseProfile, ...overrides });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
}

async function seedLog(): Promise<void> {
  const menu = await getMenu({ meal: 'lunch' });
  if (!menu.ok) throw new Error(JSON.stringify(menu.error));
  const dish = menu.data.dishes[0];
  const result = await createMealLog({
    id: `delete-test-${Date.now()}`,
    session_id: sessionId,
    date: '2026-11-18',
    meal: 'lunch',
    items: [{ dish_id: dish.id, servings: 1 }],
  });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
}

async function startRouter() {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push('/profile');
  await router.isReady();
  return router;
}

async function settle(times = 4): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flushPromises();
  }
}

async function mountProfile() {
  const router = await startRouter();
  const wrapper = mount(ProfileView, { global: { plugins: [router] } });
  await settle();
  return wrapper;
}

function buttonByText(wrapper: Awaited<ReturnType<typeof mountProfile>>, text: string) {
  const button = wrapper.findAll('button').find((item) => item.text() === text);
  if (!button) throw new Error(`找不到按钮：${text}`);
  return button;
}

describe('档案删除入口', () => {
  it('DELETE /profiles/me：首次 204 成功并连带删记录，再次调用回 404', async () => {
    await seedProfile();
    await seedLog();

    const first = await deleteProfile(sessionId);
    expect(first.ok).toBe(true);

    const profile = await getProfile(sessionId);
    expect(profile.ok).toBe(false);
    if (profile.ok) return;
    expect(profile.error.code).toBe('NOT_FOUND');

    const logs = await listMealLogs({ session_id: sessionId });
    expect(logs.ok).toBe(true);
    if (!logs.ok) return;
    expect(logs.data.total).toBe(0);

    const second = await deleteProfile(sessionId);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('NOT_FOUND');
  });

  it('未建档时不出现删除入口', async () => {
    const wrapper = await mountProfile();
    expect(wrapper.text()).not.toContain('删除档案');
  });

  it('二次确认文案写明连带删除；取消后档案仍在', async () => {
    await seedProfile();
    const wrapper = await mountProfile();

    await buttonByText(wrapper, '删除档案…').trigger('click');
    expect(wrapper.text()).toContain('将删除档案与全部用餐记录');

    await buttonByText(wrapper, '取消').trigger('click');
    expect(wrapper.text()).not.toContain('将删除档案与全部用餐记录');

    const profile = await getProfile(sessionId);
    expect(profile.ok).toBe(true);
  });

  it('确认删除：档案与记录清空、本机缓存清空、表单复位', async () => {
    await seedProfile();
    await seedLog();
    const cached: RecommendationResponse = {
      target: {
        day_kcal: 2000,
        kcal: 700,
        protein_g: 30,
        fat_g: 50,
        carbs_g: 90,
        sodium_mg: 1500,
        meal_ratio: 0.4,
      },
      combos: [],
      notice: null,
    };
    saveRecommendationResponse(sessionId, 'lunch', cached);
    sessionStorage.setItem(`cn.draft.${sessionId}.2026-11-18.lunch`, '{"id":"x","items":{}}');
    sessionStorage.setItem('cn.last_log.some-id', '{}');

    const wrapper = await mountProfile();
    expect((wrapper.findAll('input.numfield__input')[0].element as HTMLInputElement).value).toBe(
      '172',
    );

    await buttonByText(wrapper, '删除档案…').trigger('click');
    await buttonByText(wrapper, '确认删除').trigger('click');
    await settle();

    expect(wrapper.text()).toContain('档案与全部用餐记录已删除');
    expect(wrapper.text()).not.toContain('删除档案…');

    const inputs = wrapper.findAll('input.numfield__input');
    expect((inputs[0].element as HTMLInputElement).value).toBe('');
    expect((inputs[1].element as HTMLInputElement).value).toBe('');
    expect((inputs[2].element as HTMLInputElement).value).toBe('');

    expect(localStorage.getItem('cn.last_recommendation')).toBeNull();
    expect(sessionStorage.getItem(`cn.draft.${sessionId}.2026-11-18.lunch`)).toBeNull();
    expect(sessionStorage.getItem('cn.last_log.some-id')).toBeNull();

    const profile = await getProfile(sessionId);
    expect(profile.ok).toBe(false);
    const logs = await listMealLogs({ session_id: sessionId });
    expect(logs.ok).toBe(true);
    if (!logs.ok) return;
    expect(logs.data.total).toBe(0);
  });
});
