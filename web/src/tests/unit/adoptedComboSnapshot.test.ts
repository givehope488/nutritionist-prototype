// 采纳率口径（PD 2026-11-17）：回填提交随 adopted_combo_id 带推荐快照，
// 快照份数必须是推荐当时的份数，服务端才能逐菜比对用户实际吃的份量。
import { describe, expect, it } from 'vitest';
import { buildAdoptedSnapshot } from '@/composables/useRecommendationCache';
import { sampleCombo } from '@/dev/fixtures';

describe('buildAdoptedSnapshot 采纳快照', () => {
  it('按推荐份数生成 { id, items }，与回填后的实际份数无关', () => {
    const combo = {
      ...sampleCombo,
      dishes: sampleCombo.dishes.map((dish) => ({ ...dish, servings: 0.5 })),
    };
    const snapshot = buildAdoptedSnapshot(combo);

    expect(snapshot).toEqual({
      id: sampleCombo.id,
      items: sampleCombo.dishes.map((dish) => ({ dish_id: dish.id, servings: 0.5 })),
    });
  });
});
