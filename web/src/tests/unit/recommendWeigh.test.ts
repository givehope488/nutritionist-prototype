// A6 / W2 验收 I5：推荐页称重标记（API.md v1.2.4 §2.3）。
// 服务端算好 Combo.has_weighed_dish，前端只做一行判断；老种子缺省/false 不显示。
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { Combo, ProfileInput, RecommendationResponse } from '@canteen/shared';
import { createRecommendation, saveProfile } from '@/api/endpoints';
import { routes } from '@/router';
import { sessionId } from '@/composables/useSession';
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

const TARGET = {
  day_kcal: 2000,
  kcal: 700,
  protein_g: 30,
  fat_g: 50,
  carbs_g: 90,
  sodium_mg: 1500,
  meal_ratio: 0.4,
};

function makeCombo(hasWeighedDish?: boolean): Combo {
  return {
    id: 'weigh-test-01',
    dishes: [
      {
        id: 's01',
        name: '白米饭',
        category: 'staple',
        portion_label: '1 份',
        servings: 1,
        kcal: 232,
        protein_g: 4.4,
        fat_g: 0.6,
        carbs_g: 51.6,
        sodium_mg: 2,
      },
      {
        id: 'w01',
        name: '称重炒时蔬',
        category: 'veg',
        portion_label: '约 150 g',
        servings: 1,
        kcal: 120,
        protein_g: 5,
        fat_g: 6,
        carbs_g: 10,
        sodium_mg: 300,
        pricing_mode: 'weigh',
      },
    ],
    totals: { kcal: 352, protein_g: 9.4, fat_g: 6.6, carbs_g: 61.6, sodium_mg: 302 },
    reason: '主食 + 素菜，热量在目标范围内',
    engine: 'template',
    ...(hasWeighedDish === undefined ? {} : { has_weighed_dish: hasWeighedDish }),
  };
}

function makeResponse(hasWeighedDish?: boolean): RecommendationResponse {
  return { target: TARGET, combos: [makeCombo(hasWeighedDish)], notice: null };
}

async function settle(times = 4): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flushPromises();
  }
}

async function mountWith(response: RecommendationResponse) {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push('/recommend');
  await router.isReady();
  vi.mocked(createRecommendation).mockResolvedValueOnce({ ok: true, data: response });
  const wrapper = mount(RecommendView, { global: { plugins: [router] } });
  await settle();
  return wrapper;
}

describe('推荐页称重标记（A6 / I5）', () => {
  it('组合标记为 true 时展示「份量以现场称重为准」', async () => {
    const saved = await saveProfile(baseProfile);
    expect(saved.ok).toBe(true);

    const wrapper = await mountWith(makeResponse(true));
    expect(wrapper.findAll('.combo__title').length).toBe(1);
    expect(wrapper.text()).toContain('份量以现场称重为准');
  });

  it('标记为 false 或缺失（老种子/服务端尚未输出）时不展示', async () => {
    const saved = await saveProfile(baseProfile);
    expect(saved.ok).toBe(true);

    for (const flag of [false, undefined]) {
      const wrapper = await mountWith(makeResponse(flag));
      expect(wrapper.findAll('.combo__title').length).toBe(1);
      expect(wrapper.text()).not.toContain('份量以现场称重为准');
      wrapper.unmount();
    }
  });

  it('服务端 reason 已含称重说明时只出现一次，不再重复外置一行', async () => {
    const saved = await saveProfile(baseProfile);
    expect(saved.ok).toBe(true);

    const response = makeResponse(true);
    response.combos[0].reason = '这一餐约 352kcal；含称重菜，份量以现场称重为准，热量仅供参考。';
    const wrapper = await mountWith(response);
    const occurrences = wrapper.text().split('份量以现场称重为准').length - 1;
    expect(occurrences).toBe(1);
    expect(wrapper.find('.weigh-note').exists()).toBe(false);
  });
});