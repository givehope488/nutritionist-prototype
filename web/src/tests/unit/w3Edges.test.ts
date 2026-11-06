// W3 异常与边界（TEAM v1.2）：限流 429、菜品下架后回填旧记录、跨天回填（凌晨填昨晚）。
import { nextTick, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import rawSeed from '@menu-seed';
import type { Meal, ProfileInput } from '@canteen/shared';
import { useLogDraft } from '@/composables/useLogDraft';
import {
  createMealLog,
  getInsightsSummary,
  getMenu,
  listMealLogs,
  saveProfile,
} from '@/api/endpoints';
import { toDateStr } from '@/utils/display';

const sessionId = 'w3-edge-session';

const baseProfile: ProfileInput = {
  session_id: sessionId,
  sex: 'male',
  height_cm: 172,
  weight_kg: 65,
  age: 20,
  activity: 'mid',
  goal: 'health',
  avoid: [],
  default_meal: 'dinner',
};

function dateOf(offsetDays: number): string {
  return toDateStr(new Date(Date.now() - offsetDays * 86400000));
}

async function seedProfile(): Promise<void> {
  const result = await saveProfile(baseProfile);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
}

function activeDish() {
  const dish = rawSeed.dishes.find((candidate) => candidate.status === 'active');
  if (!dish) throw new Error('种子数据里没有在架菜品');
  return dish;
}

describe('菜品下架后回填旧记录', () => {
  it('下架菜品从默认菜单消失，但旧记录仍能提交并在历史里保留原名', async () => {
    await seedProfile();
    const dish = activeDish();
    const meal = dish.meals[0] as Meal;
    const previous = dish.status;
    dish.status = 'hidden';
    try {
      const menu = await getMenu({ meal });
      if (!menu.ok) throw new Error(JSON.stringify(menu.error));
      expect(menu.data.dishes.some((item) => item.id === dish.id)).toBe(false);

      const withInactive = await getMenu({ meal, include_inactive: true });
      if (!withInactive.ok) throw new Error(JSON.stringify(withInactive.error));
      expect(withInactive.data.dishes.some((item) => item.id === dish.id)).toBe(true);

      const submitted = await createMealLog({
        id: 'edge-hidden-dish',
        session_id: sessionId,
        date: dateOf(1),
        meal,
        items: [{ dish_id: dish.id, servings: 1 }],
        adopted_combo_id: null,
      });
      if (!submitted.ok) throw new Error(JSON.stringify(submitted.error));
      expect(submitted.data.items[0].name).toBe(dish.name);

      const list = await listMealLogs({ session_id: sessionId });
      if (!list.ok) throw new Error(JSON.stringify(list.error));
      expect(list.data.logs[0].items[0]).toMatchObject({ dish_id: dish.id, name: dish.name });
    } finally {
      dish.status = previous;
    }
  });
});

describe('跨天回填（凌晨填昨晚）', () => {
  it('昨晚与今天的记录各自成条，统计按日期窗口分别计入', async () => {
    await seedProfile();
    const dish = activeDish();
    const yesterday = dateOf(1);
    const today = dateOf(0);

    const lastNight = await createMealLog({
      id: 'edge-yesterday-dinner',
      session_id: sessionId,
      date: yesterday,
      meal: 'dinner',
      items: [{ dish_id: dish.id, servings: 1 }],
      adopted_combo_id: null,
    });
    const thisMorning = await createMealLog({
      id: 'edge-today-breakfast',
      session_id: sessionId,
      date: today,
      meal: 'breakfast',
      items: [{ dish_id: dish.id, servings: 1 }],
      adopted_combo_id: null,
    });
    if (!lastNight.ok) throw new Error(JSON.stringify(lastNight.error));
    if (!thisMorning.ok) throw new Error(JSON.stringify(thisMorning.error));
    expect(lastNight.data.date).toBe(yesterday);
    expect(thisMorning.data.date).toBe(today);

    const list = await listMealLogs({ session_id: sessionId });
    if (!list.ok) throw new Error(JSON.stringify(list.error));
    expect(list.data.total).toBe(2);
    expect(list.data.logs.map((log) => log.date)).toEqual([today, yesterday]);

    const oneDay = await getInsightsSummary({ session_id: sessionId, days: 1 });
    const twoDays = await getInsightsSummary({ session_id: sessionId, days: 2 });
    if (!oneDay.ok) throw new Error(JSON.stringify(oneDay.error));
    if (!twoDays.ok) throw new Error(JSON.stringify(twoDays.error));
    expect(oneDay.data.logged_meals).toBe(1);
    expect(twoDays.data.logged_meals).toBe(2);
  });

  it('草稿按「日期 + 餐次」隔离，切到昨天不会带走今天已选的份数', async () => {
    const date = ref(dateOf(0));
    const meal = ref<Meal>('dinner');
    const draft = useLogDraft('draft-session', date, meal);
    const todayId = draft.logId.value;

    draft.items.value['s01'] = 1;
    await nextTick();

    date.value = dateOf(1);
    await nextTick();

    expect(draft.items.value).toEqual({});
    expect(draft.logId.value).not.toBe(todayId);
  });
});

describe('限流 429', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('429 响应按契约解成 RATE_LIMITED，页面可直接提示稍后再试', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE', 'https://api.test.local');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => ({
          error: { code: 'RATE_LIMITED', message: '操作过于频繁，请稍后再试' },
        }),
      })),
    );

    const { request } = await import('@/api/client');
    const result = await request('POST', '/meal-logs', { body: {} });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('429 应走失败分支');
    expect(result.error.code).toBe('RATE_LIMITED');
    expect(result.error.message).toContain('稍后再试');
  });
});
