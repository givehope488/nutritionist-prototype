// 个人排除（API v1.2.12 §2.6）的 Mock 契约 + 组件行为：
// 排除后推荐候选池跳过该菜，恢复后回到最佳组合；组件自身负责读写排除列表。
import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import type { ProfileInput } from '@canteen/shared';
import {
  addDishExclusion,
  createRecommendation,
  getMenu,
  listDishExclusions,
  removeDishExclusion,
  saveProfile,
} from '@/api/endpoints';
import DishExclusionsCard from '@/components/business/DishExclusionsCard.vue';
import { sessionId } from '@/composables/useSession';

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

async function seedProfile(): Promise<void> {
  const result = await saveProfile(baseProfile);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
}

async function settle(times = 3): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flushPromises();
  }
}

describe('Mock /dish-exclusions', () => {
  it('新增幂等、列表可按 session 读回、删除后 404', async () => {
    const menu = await getMenu({ meal: 'lunch' });
    expect(menu.ok).toBe(true);
    if (!menu.ok) return;
    const dish = menu.data.dishes[0];

    const added = await addDishExclusion({ session_id: sessionId, dish_id: dish.id });
    expect(added.ok).toBe(true);
    if (added.ok) expect(added.data).toEqual({ dish_id: dish.id, name: dish.name });

    // 重复排除不重复写
    const again = await addDishExclusion({ session_id: sessionId, dish_id: dish.id });
    expect(again.ok).toBe(true);

    const list = await listDishExclusions(sessionId);
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.data.dishes).toEqual([{ dish_id: dish.id, name: dish.name }]);

    await removeDishExclusion(sessionId, dish.id);
    const removedAgain = await removeDishExclusion(sessionId, dish.id);
    expect(removedAgain.ok).toBe(false);
    if (!removedAgain.ok) expect(removedAgain.error.code).toBe('NOT_FOUND');
  });

  it('排除后推荐不再出现该菜；恢复后第一套回到原组合', async () => {
    await seedProfile();
    const before = await createRecommendation({ session_id: sessionId, meal: 'lunch' });
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const target = before.data.combos[0]?.dishes[0];
    expect(target).toBeDefined();
    if (!target) return;

    await addDishExclusion({ session_id: sessionId, dish_id: target.id });
    const after = await createRecommendation({ session_id: sessionId, meal: 'lunch' });
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    const ids = after.data.combos.flatMap((combo) => combo.dishes.map((dish) => dish.id));
    expect(ids).not.toContain(target.id);

    await removeDishExclusion(sessionId, target.id);
    const restored = await createRecommendation({ session_id: sessionId, meal: 'lunch' });
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.data.combos[0]?.id).toBe(before.data.combos[0]?.id);
  });
});

describe('DishExclusionsCard', () => {
  it('点一下加入排除并在列表显示「已排除」，再点一下恢复', async () => {
    const menu = await getMenu({ meal: 'lunch' });
    expect(menu.ok).toBe(true);
    if (!menu.ok) return;
    const dish = menu.data.dishes[0];

    const wrapper = mount(DishExclusionsCard, {
      props: { dishes: [{ id: dish.id, name: dish.name }] },
    });
    await settle();

    const chip = wrapper.get('button.chip');
    expect(chip.text()).toBe(dish.name);
    await chip.trigger('click');
    await settle();

    expect(chip.text()).toContain('已排除');
    expect(wrapper.text()).toContain('已排除 1 道');
    const stored = await listDishExclusions(sessionId);
    expect(stored.ok).toBe(true);
    if (stored.ok) expect(stored.data.dishes[0]?.dish_id).toBe(dish.id);

    await chip.trigger('click');
    await settle();
    expect(chip.text()).toBe(dish.name);
    expect(wrapper.text()).toContain('已恢复推荐');
    const cleared = await listDishExclusions(sessionId);
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.data.dishes).toEqual([]);
  });

  it('已排除但不在当前可操作列表里的菜也会显示，便于恢复', async () => {
    const menu = await getMenu({ meal: 'lunch' });
    expect(menu.ok).toBe(true);
    if (!menu.ok) return;
    const dish = menu.data.dishes[0];
    await addDishExclusion({ session_id: sessionId, dish_id: dish.id });

    // 推荐页可能已经配不出含这道菜的组合，此时父级传入空列表
    const wrapper = mount(DishExclusionsCard, { props: { dishes: [] } });
    await settle();
    expect(wrapper.text()).toContain(dish.name);
    expect(wrapper.text()).toContain('已排除');
  });
});