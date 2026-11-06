<script setup lang="ts">
// 推荐组合卡（供 FE-A 推荐页消费）：3 套搭配中的 1 套。
// 卡片只做展示与「采纳」事件上报，不判断营养达标与否——判定在服务端。
import type { Combo, MealTarget } from '@canteen/shared';
import AppBadge from '../base/AppBadge.vue';
import AppButton from '../base/AppButton.vue';
import AppCard from '../base/AppCard.vue';
import NutritionSummary from './NutritionSummary.vue';

withDefaults(
  defineProps<{
    combo: Combo;
    target: MealTarget;
    /** 1-based 序号，用于「搭配一 / 二 / 三」 */
    index: number;
    adopted?: boolean;
  }>(),
  { adopted: false },
);

const emit = defineEmits<{ adopt: []; replay: [] }>();
const labels = ['一', '二', '三', '四', '五'];
</script>

<template>
  <AppCard elevated>
    <div class="combo__head">
      <h3 class="combo__title">搭配{{ labels[index - 1] ?? index }}</h3>
      <div class="combo__badges">
        <AppBadge :tone="combo.engine === 'llm' ? 'brand' : 'neutral'">
          {{ combo.engine === 'llm' ? 'AI 润色' : '规则文案' }}
        </AppBadge>
        <AppBadge v-if="adopted" tone="ok" dot>已采纳</AppBadge>
      </div>
    </div>

    <ul class="combo__dishes">
      <li v-for="dish in combo.dishes" :key="dish.id" class="combo__dish">
        <span>{{ dish.name }}</span>
        <span class="combo__servings">{{ dish.servings === 1 ? '1 份' : `${dish.servings} 份` }}</span>
      </li>
    </ul>

    <NutritionSummary :totals="combo.totals" :target="target" :density="'compact'" />

    <p class="combo__reason">{{ combo.reason }}</p>

    <div class="combo__actions">
      <AppButton size="sm" variant="ghost" @click="emit('replay')">这组不行</AppButton>
      <AppButton size="sm" :variant="adopted ? 'secondary' : 'primary'" @click="emit('adopt')">
        {{ adopted ? '按这组回填' : '就去吃这组' }}
      </AppButton>
    </div>
  </AppCard>
</template>

<style scoped>
.combo__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}
.combo__title {
  margin: 0;
  font-size: var(--font-size-lg);
}
.combo__badges {
  display: flex;
  gap: var(--space-1);
}
.combo__dishes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  margin: 0 0 var(--space-3);
  padding: 0;
  list-style: none;
}
.combo__dish {
  display: inline-flex;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-bg-subtle);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
.combo__servings {
  color: var(--color-text-tertiary);
}
.combo__reason {
  margin: var(--space-3) 0;
  padding: var(--space-3);
  border-left: 3px solid var(--color-brand-300);
  border-radius: var(--radius-sm);
  background: var(--color-bg-subtle);
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
}
.combo__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
